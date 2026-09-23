import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Dados públicos da página do sorteio diário. Passa pelo servidor para expor
// só nome, foto e tier dos participantes (nunca comprovante ou ID na casa).
export async function GET() {
  const { data: giveaway } = await supabaseAdmin
    .from("giveaways")
    .select("id, title, image_url, capture_open, bot_command, chance_t1, chance_t2, chance_t3")
    .eq("type", "daily")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let participants: { twitch_username: string; sub_tier: number; avatar_url: string | null }[] = [];
  if (giveaway) {
    const { data } = await supabaseAdmin
      .from("participants")
      .select("twitch_username, sub_tier, avatar_url")
      .eq("giveaway_id", giveaway.id)
      .neq("status", "rejected")
      .order("created_at", { ascending: false });
    participants = data ?? [];
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabaseAdmin
    .from("winners")
    .select("twitch_username, prize, avatar_url, won_at, giveaways!inner(type)")
    .eq("giveaways.type", "daily")
    .gte("won_at", since)
    .order("won_at", { ascending: false });

  return Response.json(
    { giveaway, participants, history: history ?? [] },
    {
      headers: {
        // Cache curto só na Vercel; o navegador sempre busca a lista nova
        "Vercel-CDN-Cache-Control": "max-age=2, stale-while-revalidate=60",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    }
  );
}
