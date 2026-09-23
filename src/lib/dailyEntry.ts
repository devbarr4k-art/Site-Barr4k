import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchTwitchAvatar } from "@/lib/twitch";
import { chancesFor } from "@/lib/daily";

export type ChatEntryResult =
  | { ok: true; duplicate?: boolean; data?: Record<string, unknown> }
  | { ok: false; reason: "no-daily" | "closed" | "error"; message?: string };

// Registra quem digitou o comando no chat. Usado pelo painel (tmi.js no navegador)
// e pelo webhook da Twitch; o unique (giveaway_id, twitch_username) evita duplicar.
export async function addChatEntry(giveawayId: string, username: string, tier: number): Promise<ChatEntryResult> {
  const db = supabaseAdmin;
  const chatUser = username.toLowerCase();
  const safeTier = [0, 1, 2, 3].includes(tier) ? tier : 0;

  const { data: daily } = await db
    .from("giveaways")
    .select("id, status, capture_open, chance_t1, chance_t2, chance_t3")
    .eq("id", giveawayId)
    .maybeSingle();
  if (!daily || daily.status !== "active") return { ok: false, reason: "no-daily" };
  if (!daily.capture_open) return { ok: false, reason: "closed" };

  const { data: existing } = await db
    .from("participants")
    .select("id")
    .eq("giveaway_id", daily.id)
    .eq("twitch_username", chatUser)
    .maybeSingle();
  if (existing) return { ok: true, duplicate: true };

  const { data, error } = await db
    .from("participants")
    .insert({
      giveaway_id: daily.id,
      twitch_username: chatUser,
      sub_tier: safeTier,
      coins_used: chancesFor(safeTier, daily),
      avatar_url: await fetchTwitchAvatar(chatUser),
      status: "approved",
    })
    .select()
    .single();
  // 23505 = violou o unique (giveaway_id, twitch_username): já estava inscrito
  if (error?.code === "23505") return { ok: true, duplicate: true };
  if (error) return { ok: false, reason: "error", message: error.message };
  return { ok: true, data };
}
