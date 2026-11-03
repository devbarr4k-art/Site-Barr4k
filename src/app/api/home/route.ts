import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_PARTNERS } from "@/lib/partners";
import { DEFAULT_VIDEOS_VISIBILITY, VIDEOS_VISIBILITY_KEY } from "@/lib/videos";
import { buildRanking, normalizeRanking, RANKING_SETTINGS_KEY } from "@/lib/ranking";

// Dados da home servidos pelo cache da Vercel: o visitante recebe na hora a última
// versão boa e a atualização acontece por trás (stale-while-revalidate). Se o banco
// travar, ninguém fica preso no "carregando".
export async function GET() {
  const [giveaways, winners, partners, videos, visibility, rankingConfig] = await Promise.all([
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
      .select("*, giveaways(image_url, type)") // todos: os visíveis vão para "Últimos Vencedores", todos contam no ranking
      .order("won_at", { ascending: false }),
    supabaseAdmin.from("partners").select("id, name, image_url, link_url").order("sort_order").order("created_at"),
    supabaseAdmin
      .from("videos")
      .select("*") // inclui sort_order quando a coluna existir
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
    supabaseAdmin.from("site_settings").select("value").eq("key", VIDEOS_VISIBILITY_KEY).maybeSingle(),
    supabaseAdmin.from("site_settings").select("value").eq("key", RANKING_SETTINGS_KEY).maybeSingle(),
  ]);
  const ranking = normalizeRanking(rankingConfig.error ? null : rankingConfig.data?.value);

  if (giveaways.error || winners.error) {
    return Response.json({ error: giveaways.error?.message || winners.error?.message }, { status: 500 });
  }

  return Response.json(
    {
      giveaways: giveaways.data ?? [],
      winners: (winners.data ?? []).filter((w) => w.in_hall_of_fame), // Últimos Vencedores
      // Hall da Fama: vitórias e coins somadas por pessoa, nas regras do painel
      hallRanking: buildRanking(winners.data ?? [], ranking),
      hallRankingSettings: ranking,
      // Sem a tabela de parceiros ainda (SQL não rodado): mantém os cards de sempre
      partners: partners.error ? DEFAULT_PARTNERS : partners.data ?? [],
      // Sem a tabela de vídeos ainda: a seção simplesmente não aparece
      videos: videos.error ? [] : videos.data ?? [],
      // Liga/desliga de Vídeos e Shorts do painel (sem a tabela ou sem configuração: os dois ligados)
      videosVisibility: { ...DEFAULT_VIDEOS_VISIBILITY, ...(visibility.error ? {} : visibility.data?.value ?? {}) },
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
