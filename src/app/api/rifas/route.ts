import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { RAFFLE_COLUMNS, takenByRaffle, withCounts } from "@/lib/rifasServer";
import type { Raffle } from "@/lib/rifas";

// Lista pública das rifas (abertas primeiro), com quantos números já saíram
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("raffles")
    .select(RAFFLE_COLUMNS)
    .order("status", { ascending: false }) // "open" antes de "closed"
    .order("created_at", { ascending: false })
    .limit(50);
  // Sem a tabela ainda: lista vazia (a página mostra "nenhuma rifa")
  if (error) return Response.json({ raffles: [] });

  const raffles = (data ?? []) as Raffle[];
  const taken = await takenByRaffle(raffles.map((r) => r.id)).catch(() => ({}));
  return Response.json(
    { raffles: withCounts(raffles, taken) },
    {
      headers: {
        "Vercel-CDN-Cache-Control": "max-age=5, stale-while-revalidate=60",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    }
  );
}
