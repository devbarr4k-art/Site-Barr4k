import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FAIR_COLUMNS } from "@/lib/fairServer";

const LIST_COLUMNS = "id, kind, target_id, title, total_weight, drand_round, winner_label, winner_username, status, created_at, drawn_at";

// Registro público dos sorteios: ?id= traz um giro completo (com a lista), ?target= os giros de um sorteio/rifa
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const target = url.searchParams.get("target");
  const headers = { "Vercel-CDN-Cache-Control": "max-age=5, stale-while-revalidate=60", "Cache-Control": "public, max-age=0, must-revalidate" };

  if (id) {
    const { data } = await supabaseAdmin.from("fair_draws").select(FAIR_COLUMNS).eq("id", id).maybeSingle();
    if (!data) return Response.json({ error: "Sorteio não encontrado." }, { status: 404 });
    return Response.json({ draw: data }, { headers });
  }

  let query = supabaseAdmin.from("fair_draws").select(LIST_COLUMNS).order("created_at", { ascending: false }).limit(100);
  if (target) query = query.eq("target_id", target);
  const { data, error } = await query;
  // Sem a tabela ainda: lista vazia
  return Response.json({ draws: error ? [] : data ?? [] }, { headers });
}
