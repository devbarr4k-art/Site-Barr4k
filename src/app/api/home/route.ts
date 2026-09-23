import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_PARTNERS } from "@/lib/partners";

// Dados da home servidos pelo cache da Vercel: o visitante recebe na hora a última
// versão boa e a atualização acontece por trás (stale-while-revalidate). Se o banco
// travar, ninguém fica preso no "carregando".
export async function GET() {
  const [giveaways, winners, partners, videos] = await Promise.all([
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
      .select("*, giveaways(image_url)") // inclui image_url do vencedor quando a coluna existir
      .eq("in_hall_of_fame", true)
      .order("won_at", { ascending: false }),
    supabaseAdmin.from("partners").select("id, name, image_url, link_url").order("sort_order").order("created_at"),
    supabaseAdmin
      .from("videos")
      .select("id, kind, youtube_id, title, thumbnail_url, duration, views, published_at")
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  if (giveaways.error || winners.error) {
    return Response.json({ error: giveaways.error?.message || winners.error?.message }, { status: 500 });
  }

  return Response.json(
    {
      giveaways: giveaways.data ?? [],
      winners: winners.data ?? [],
      // Sem a tabela de parceiros ainda (SQL não rodado): mantém os cards de sempre
      partners: partners.error ? DEFAULT_PARTNERS : partners.data ?? [],
      // Sem a tabela de vídeos ainda: a seção simplesmente não aparece
      videos: videos.error ? [] : videos.data ?? [],
    },
    {
      headers: {
        // Cache só na Vercel (protege o banco). O navegador sempre pergunta de novo: com
        // stale-while-revalidate no Cache-Control ele mostrava a resposta da visita anterior.
        "Vercel-CDN-Cache-Control": "max-age=10, stale-while-revalidate=600",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    }
  );
}
