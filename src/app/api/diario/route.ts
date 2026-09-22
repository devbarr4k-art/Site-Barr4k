import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Dados públicos da página do sorteio diário. Passa pelo servidor para expor
// só nome e chances dos participantes (nunca comprovante ou ID na casa).
export async function GET() {
  const { data: giveaway } = await supabaseAdmin
    .from("giveaways")
    .select("id, title, image_url")
    .eq("is_daily_highlight", true)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let participants: { twitch_username: string; coins_used: number }[] = [];
  let winner = null;

  if (giveaway) {
    const { data: parts } = await supabaseAdmin
      .from("participants")
      .select("twitch_username, coins_used")
      .eq("giveaway_id", giveaway.id)
      .neq("status", "rejected")
      .order("created_at", { ascending: true });
    participants = parts ?? [];

    const { data: win } = await supabaseAdmin
      .from("winners")
      .select("twitch_username, prize, won_at")
      .eq("giveaway_id", giveaway.id)
      .order("won_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    winner = win;
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabaseAdmin
    .from("winners")
    .select("twitch_username, prize, won_at, giveaways!inner(type)")
    .eq("giveaways.type", "daily")
    .gte("won_at", since)
    .order("won_at", { ascending: false });

  return Response.json({ giveaway, participants, winner, history: history ?? [] });
}
