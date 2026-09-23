import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Mantém o Supabase ativo (o plano gratuito pausa o projeto após 7 dias sem uso).
// Chamado todo dia pelo cron da Vercel (vercel.json) e pelo cron-job.org.
// Faz uma consulta de verdade no banco, que é o que conta como atividade.
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const { count, error } = await supabaseAdmin.from("giveaways").select("id", { count: "exact", head: true });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(
    { ok: true, sorteios: count ?? 0, ms: Date.now() - started, em: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
