import { getSessionUsername } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchTwitchAvatar } from "@/lib/twitch";
import { PROOFS_BUCKET } from "@/lib/proofs";
import { RECAPTCHA_FAILED, verifyRecaptcha } from "@/lib/recaptchaServer";

const MAX_PROOF_LENGTH = 3_000_000; // ~2 MB de imagem em base64

export async function POST(request: Request) {
  const username = await getSessionUsername();
  if (!username) {
    return Response.json({ error: "Faça login com a Twitch para participar." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const giveawayId = typeof body?.giveawayId === "string" ? body.giveawayId : "";
  const coins = Math.max(0, Math.floor(Number(body?.coins) || 0));
  const casaId = typeof body?.casaId === "string" ? body.casaId.trim().slice(0, 100) : "";
  const proof = typeof body?.proof === "string" ? body.proof : "";

  if (!giveawayId) return Response.json({ error: "Sorteio inválido." }, { status: 400 });
  if (!(await verifyRecaptcha(body?.recaptcha, "participar"))) {
    return Response.json({ error: RECAPTCHA_FAILED }, { status: 403 });
  }
  if (!proof.startsWith("data:image/") || proof.length > MAX_PROOF_LENGTH) {
    return Response.json({ error: "Envie o comprovante como imagem (até 2 MB)." }, { status: 400 });
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

  // O comprovante vai para o Storage (bucket privado); no banco fica só o caminho.
  // Guardar a imagem na tabela deixava a lista de participantes pesada.
  const match = proof.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return Response.json({ error: "Envie o comprovante como imagem (até 2 MB)." }, { status: 400 });
  const [, contentType, base64] = match;
  const ext = contentType.split("/")[1].replace("jpeg", "jpg").replace(/\+.*/, "");
  const proofPath = `${giveawayId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(PROOFS_BUCKET)
    .upload(proofPath, Buffer.from(base64, "base64"), { contentType });
  if (uploadError) return Response.json({ error: "Não foi possível enviar o comprovante. Tente de novo." }, { status: 500 });

  // A mesma pessoa pode mandar mais de uma entrada (cada comprovante vira uma entrada)
  const { error } = await supabaseAdmin.from("participants").insert({
    giveaway_id: giveawayId,
    twitch_username: username,
    coins_used: coins,
    casa_id: casaId || null,
    avatar_url: avatarUrl,
    proof_url: proofPath,
    status: "pending",
  });

  if (error) {
    await supabaseAdmin.storage.from(PROOFS_BUCKET).remove([proofPath]);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
