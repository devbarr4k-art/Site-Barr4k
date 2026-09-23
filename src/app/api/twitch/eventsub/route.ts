import { verifyEventSubSignature } from "@/lib/eventsub";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addChatEntry } from "@/lib/dailyEntry";
import { isCommand, tierFromBadgeVersion } from "@/lib/daily";

// Webhook do EventSub: a Twitch chama esta rota a cada mensagem do chat do canal
// enquanto a captação do sorteio diário está ligada.
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyEventSubSignature(request.headers, raw)) {
    return new Response("assinatura inválida", { status: 403 });
  }

  // Rejeita mensagens antigas (proteção contra reenvio malicioso)
  const sentAt = Date.parse(request.headers.get("twitch-eventsub-message-timestamp") || "");
  if (!sentAt || Date.now() - sentAt > 10 * 60 * 1000) {
    return new Response("mensagem antiga", { status: 403 });
  }

  const body = JSON.parse(raw);
  const type = request.headers.get("twitch-eventsub-message-type");

  // A Twitch confirma que o endereço é nosso antes de começar a mandar o chat
  if (type === "webhook_callback_verification") {
    return new Response(body.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  if (type !== "notification") return new Response(null, { status: 204 });

  const event = body.event ?? {};
  const channel = String(event.broadcaster_user_login || "").toLowerCase();
  const chatter = String(event.chatter_user_login || "").toLowerCase();
  const text = String(event.message?.text || "");
  if (!channel || !chatter) return new Response(null, { status: 204 });

  const { data: daily } = await supabaseAdmin
    .from("giveaways")
    .select("id, bot_command")
    .eq("type", "daily")
    .eq("status", "active")
    .eq("capture_open", true)
    .eq("twitch_channel", channel)
    .limit(1)
    .maybeSingle();

  if (daily && isCommand(text, daily.bot_command || "!sorteio")) {
    const badges: { set_id: string; id: string }[] = event.badges ?? [];
    const subBadge = badges.find((b) => b.set_id === "subscriber") ?? badges.find((b) => b.set_id === "founder");
    await addChatEntry(daily.id, chatter, tierFromBadgeVersion(subBadge?.id));
  }

  return new Response(null, { status: 204 });
}
