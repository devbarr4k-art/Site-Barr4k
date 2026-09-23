import { createHmac, timingSafeEqual } from "crypto";
import { getAppToken } from "@/lib/twitch";

// Captação pelo servidor: a Twitch avisa o site (webhook EventSub) a cada
// mensagem do chat, então o sorteio segue captando mesmo com o painel fechado.
// Requisito da Twitch: o streamer autoriza o app com user:read:chat, user:bot e channel:bot.

const HELIX = "https://api.twitch.tv/helix";
const CHAT_EVENT = "channel.chat.message";

/** Segredo do webhook, derivado do NEXTAUTH_SECRET (sem precisar de outra variável). */
export function eventSubSecret(): string {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET || "").update("barr4k-eventsub").digest("hex");
}

/** Confere a assinatura que a Twitch manda em cada chamada do webhook. */
export function verifyEventSubSignature(headers: Headers, rawBody: string): boolean {
  const id = headers.get("twitch-eventsub-message-id") || "";
  const timestamp = headers.get("twitch-eventsub-message-timestamp") || "";
  const signature = headers.get("twitch-eventsub-message-signature") || "";
  const expected = "sha256=" + createHmac("sha256", eventSubSecret()).update(id + timestamp + rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function helix(path: string, init: RequestInit = {}) {
  const token = await getAppToken();
  if (!token) throw new Error("Não foi possível falar com a Twitch.");
  return fetch(`${HELIX}${path}`, {
    ...init,
    headers: {
      "Client-Id": process.env.TWITCH_CLIENT_ID || "",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export async function getTwitchUserId(login: string): Promise<string | null> {
  const res = await helix(`/users?login=${encodeURIComponent(login.toLowerCase())}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.[0]?.id ?? null;
}

async function listChatSubscriptions(broadcasterId?: string) {
  const res = await helix(`/eventsub/subscriptions?type=${CHAT_EVENT}`);
  if (!res.ok) return [];
  const json = await res.json();
  const subs: { id: string; status: string; condition: { broadcaster_user_id: string }; transport: { callback?: string } }[] =
    json?.data ?? [];
  return broadcasterId ? subs.filter((s) => s.condition.broadcaster_user_id === broadcasterId) : subs;
}

export type ServerCaptureStatus = "on" | "needs_auth" | "unavailable" | "error";

/**
 * Liga a captação pelo servidor no canal. Devolve "needs_auth" quando o dono do
 * canal ainda não autorizou o site a ler o chat dele.
 */
export async function startServerCapture(channel: string, origin: string): Promise<ServerCaptureStatus> {
  // A Twitch só entrega webhook em HTTPS público (não funciona em localhost)
  if (!origin.startsWith("https://")) return "unavailable";
  try {
    const broadcasterId = await getTwitchUserId(channel);
    if (!broadcasterId) return "error";
    const callback = `${origin}/api/twitch/eventsub`;

    const existing = await listChatSubscriptions(broadcasterId);
    const healthy = existing.find((s) => s.status === "enabled" && s.transport.callback === callback);
    if (healthy) return "on";
    // Remove assinaturas antigas/quebradas antes de criar outra
    await Promise.all(existing.map((s) => helix(`/eventsub/subscriptions?id=${s.id}`, { method: "DELETE" })));

    const res = await helix("/eventsub/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        type: CHAT_EVENT,
        version: "1",
        condition: { broadcaster_user_id: broadcasterId, user_id: broadcasterId },
        transport: { method: "webhook", callback, secret: eventSubSecret() },
      }),
    });
    if (res.ok) return "on";
    if (res.status === 403) return "needs_auth";
    console.error("EventSub:", res.status, await res.text());
    return "error";
  } catch (err) {
    console.error("EventSub:", err);
    return "error";
  }
}

/** Desliga a captação pelo servidor (para de receber o chat e de gastar chamadas). */
export async function stopServerCapture(channel: string | null | undefined): Promise<void> {
  if (!channel) return;
  try {
    const broadcasterId = await getTwitchUserId(channel);
    if (!broadcasterId) return;
    const subs = await listChatSubscriptions(broadcasterId);
    await Promise.all(subs.map((s) => helix(`/eventsub/subscriptions?id=${s.id}`, { method: "DELETE" })));
  } catch (err) {
    console.error("EventSub:", err);
  }
}

/** Situação atual da captação pelo servidor no canal. */
export async function serverCaptureStatus(channel: string): Promise<"on" | "pending" | "off"> {
  try {
    const broadcasterId = await getTwitchUserId(channel);
    if (!broadcasterId) return "off";
    const subs = await listChatSubscriptions(broadcasterId);
    if (subs.some((s) => s.status === "enabled")) return "on";
    if (subs.some((s) => s.status === "webhook_callback_verification_pending")) return "pending";
    return "off";
  } catch {
    return "off";
  }
}
