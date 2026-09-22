import { getSessionUsername } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const username = await getSessionUsername();
  if (!username) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("id, giveaway_id, coins_used, status, created_at, giveaways(id, title, status, draw_date)")
    .eq("twitch_username", username)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ tickets: data ?? [] });
}
