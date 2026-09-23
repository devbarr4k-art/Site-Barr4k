import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Dados da home servidos pelo cache da Vercel: o visitante recebe na hora a última
// versão boa e a atualização acontece por trás (stale-while-revalidate). Se o banco
// travar, ninguém fica preso no "carregando".
export async function GET() {
  const [giveaways, winners] = await Promise.all([
    supabaseAdmin
      .from("giveaways")
      .select(
        "id, title, description, highlight_text, subtitle, prize_label, prize_value, login_text, coins_cost, image_url, featured_image_url, draw_date, type, status, created_at"
      )
      .in("status", ["active", "completed"])
      .neq("type", "daily")
      .order("created_at", { ascending: false })
      .limit(40),
    supabaseAdmin
      .from("winners")
      .select("id, twitch_username, prize, avatar_url, won_at, giveaways(image_url)")
      .eq("in_hall_of_fame", true)
      .order("won_at", { ascending: false }),
  ]);

  if (giveaways.error || winners.error) {
    return Response.json({ error: giveaways.error?.message || winners.error?.message }, { status: 500 });
  }

  return Response.json(
    { giveaways: giveaways.data ?? [], winners: winners.data ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=600" } }
  );
}
