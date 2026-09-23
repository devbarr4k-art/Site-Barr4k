import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchTwitchAvatar } from "@/lib/twitch";
import { chancesFor } from "@/lib/daily";

export type ChatEntryResult =
  | { ok: true; duplicate?: boolean; updated?: boolean; data?: Record<string, unknown> }
  | { ok: false; reason: "no-daily" | "closed" | "error"; message?: string };

const globalForCache = global as unknown as { chatEntryCache: Map<string, { time: number; tier: number }> };
const lockCache = globalForCache.chatEntryCache || (globalForCache.chatEntryCache = new Map());

// Registra quem digitou o comando no chat. Usado pelo painel (tmi.js no navegador)
// e pelo webhook da Twitch; atualiza se o usuário virou sub depois.
export async function addChatEntry(giveawayId: string, username: string, tier: number): Promise<ChatEntryResult> {
  const db = supabaseAdmin;
  const chatUser = username.toLowerCase();
  const safeTier = [0, 1, 2, 3].includes(tier) ? tier : 0;

  const lockKey = `${giveawayId}:${chatUser}`;
  const now = Date.now();
  const cached = lockCache.get(lockKey);
  // Se for tentativa repetida sem aumento de tier nos últimos 10s, ignora
  if (cached && now - cached.time < 10000 && safeTier <= cached.tier) {
    return { ok: true, duplicate: true };
  }
  lockCache.set(lockKey, { time: now, tier: safeTier });

  const { data: daily } = await db
    .from("giveaways")
    .select("id, status, capture_open, chance_t1, chance_t2, chance_t3")
    .eq("id", giveawayId)
    .maybeSingle();
  if (!daily || daily.status !== "active") return { ok: false, reason: "no-daily" };
  if (!daily.capture_open) return { ok: false, reason: "closed" };

  const { data: existing } = await db
    .from("participants")
    .select("id, sub_tier")
    .eq("giveaway_id", daily.id)
    .eq("twitch_username", chatUser)
    .maybeSingle();

  if (existing) {
    // Se o usuário deu sub ou aumentou de tier depois de entrar
    if (safeTier > (existing.sub_tier ?? 0)) {
      const { data: updated, error: updateError } = await db
        .from("participants")
        .update({
          sub_tier: safeTier,
          coins_used: chancesFor(safeTier, daily),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (updateError) return { ok: false, reason: "error", message: updateError.message };
      return { ok: true, updated: true, data: updated };
    }
    return { ok: true, duplicate: true };
  }

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

