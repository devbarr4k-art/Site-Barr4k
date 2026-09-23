import { getSessionUsername } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchTwitchAvatar } from "@/lib/twitch";

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
  if (!proof.startsWith("data:image/") || proof.length > MAX_PROOF_LENGTH) {
    return Response.json({ error: "Envie o comprovante como imagem (até 2 MB)." }, { status: 400 });
  }

  const { data: giveaway } = await supabaseAdmin
    .from("giveaways")
    .select("id, status, draw_date")
    .eq("id", giveawayId)
    .maybeSingle();

  if (!giveaway) return Response.json({ error: "Sorteio não encontrado." }, { status: 404 });
  if (giveaway.status !== "active" || (giveaway.draw_date && new Date(giveaway.draw_date).getTime() < Date.now())) {
    return Response.json({ error: "Este sorteio já foi encerrado." }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("participants")
    .select("id")
    .eq("giveaway_id", giveawayId)
    .eq("twitch_username", username)
    .maybeSingle();

  if (existing) {
    return Response.json({ error: "Você já está participando deste sorteio." }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from("participants").insert({
    giveaway_id: giveawayId,
    twitch_username: username,
    coins_used: coins,
    casa_id: casaId || null,
    avatar_url: await fetchTwitchAvatar(username),
    proof_url: proof,
    status: "pending",
  });

  if (error?.code === "23505") {
    return Response.json({ error: "Você já está participando deste sorteio." }, { status: 409 });
  }
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
