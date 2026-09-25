import { getSessionUsername } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchTwitchAvatar } from "@/lib/twitch";
import { PROOFS_BUCKET, removeProofs } from "@/lib/proofs";
import { RECAPTCHA_FAILED, verifyRecaptcha } from "@/lib/recaptchaServer";

const MAX_PROOF_LENGTH = 3_000_000; // ~2 MB de imagem em base64
const MAX_PROOFS = 4;

export async function POST(request: Request) {
  const username = await getSessionUsername();
  if (!username) {
    return Response.json({ error: "Faça login com a Twitch para participar." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const giveawayId = typeof body?.giveawayId === "string" ? body.giveawayId : "";
  const coins = Math.max(0, Math.floor(Number(body?.coins) || 0));
  const casaId = typeof body?.casaId === "string" ? body.casaId.trim().slice(0, 100) : "";
  // Vários comprovantes (proofs); "proof" único continua aceito para quem está com a página antiga aberta
  const proofs: string[] = (Array.isArray(body?.proofs) ? body.proofs : [body?.proof]).filter((p: unknown): p is string => typeof p === "string" && !!p);

  if (!giveawayId) return Response.json({ error: "Sorteio inválido." }, { status: 400 });
  if (!(await verifyRecaptcha(body?.recaptcha, "participar"))) {
    return Response.json({ error: RECAPTCHA_FAILED }, { status: 403 });
  }
  if (proofs.length === 0) return Response.json({ error: "Envie o comprovante." }, { status: 400 });
  if (proofs.length > MAX_PROOFS) return Response.json({ error: `Envie no máximo ${MAX_PROOFS} comprovantes.` }, { status: 400 });
  if (proofs.some((p) => !p.startsWith("data:image/") || p.length > MAX_PROOF_LENGTH)) {
    return Response.json({ error: "Os comprovantes precisam ser imagens de até 2 MB." }, { status: 400 });
  }

  // Checagem do sorteio e foto da Twitch em paralelo
  const [{ data: giveaway }, avatarUrl] = await Promise.all([
    supabaseAdmin.from("giveaways").select("id, status, draw_date").eq("id", giveawayId).maybeSingle(),
    fetchTwitchAvatar(username),
  ]);

  if (!giveaway) return Response.json({ error: "Sorteio não encontrado." }, { status: 404 });
  if (giveaway.status !== "active" || (giveaway.draw_date && new Date(giveaway.draw_date).getTime() < Date.now())) {
    return Response.json({ error: "Este sorteio já foi encerrado." }, { status: 400 });
  }

  // Os comprovantes vão para o Storage (bucket privado); no banco fica só o caminho.
  // Guardar a imagem na tabela deixava a lista de participantes pesada.
  const paths: string[] = [];
  for (const proof of proofs) {
    const match = proof.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!match) {
      await removeProofs(paths);
      return Response.json({ error: "Os comprovantes precisam ser imagens de até 2 MB." }, { status: 400 });
    }
    const [, contentType, base64] = match;
    const ext = contentType.split("/")[1].replace("jpeg", "jpg").replace(/\+.*/, "");
    const path = `${giveawayId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(PROOFS_BUCKET)
      .upload(path, Buffer.from(base64, "base64"), { contentType });
    if (uploadError) {
      await removeProofs(paths);
      return Response.json({ error: "Não foi possível enviar o comprovante. Tente de novo." }, { status: 500 });
    }
    paths.push(path);
  }

  // A mesma pessoa pode mandar mais de uma entrada (cada comprovante vira uma entrada)
  const row = {
    giveaway_id: giveawayId,
    twitch_username: username,
    coins_used: coins,
    casa_id: casaId || null,
    avatar_url: avatarUrl,
    proof_url: paths[0], // principal (inscrições antigas só têm este)
    proof_paths: paths, // todos
    status: "pending",
  };
  let { error } = await supabaseAdmin.from("participants").insert(row);
  // Coluna proof_paths ainda não criada (SQL não rodado): grava só o principal
  if (error && /proof_paths/.test(error.message)) {
    const { proof_paths: _unused, ...legacy } = row;
    ({ error } = await supabaseAdmin.from("participants").insert(legacy));
  }

  if (error) {
    await removeProofs(paths);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
