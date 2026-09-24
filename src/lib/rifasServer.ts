import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Raffle, TakenNumbers } from "@/lib/rifas";

// Só no servidor (usa a service role)

export const RAFFLE_COLUMNS =
  "id, title, subtitle, image_url, price_cents, total_numbers, draw_date, pix_key, pix_name, qr_image_url, status, created_at";

export const MISSING_RAFFLES = "Falta rodar o SQL supabase/migracao-rifas.sql no Supabase.";

export const isMissingTable = (message: string) => /raffle|schema cache|does not exist|function/i.test(message);

/** Libera as reservas vencidas (quem não pagou no prazo) antes de mostrar os números */
export async function expireHolds(raffleIds: string[]) {
  await Promise.all(raffleIds.map((id) => supabaseAdmin.rpc("raffle_expire_holds", { p_raffle: id })));
}

/** Números ocupados de cada rifa: pagos e reservados (pagando ou esperando aprovação) */
export async function takenByRaffle(raffleIds: string[]): Promise<Record<string, TakenNumbers>> {
  const out: Record<string, TakenNumbers> = Object.fromEntries(raffleIds.map((id) => [id, { approved: [], pending: [] }]));
  if (raffleIds.length === 0) return out;
  // o PostgREST devolve no máximo 1000 linhas por vez: busca em páginas
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("raffle_numbers")
      .select("raffle_id, number, status")
      .in("raffle_id", raffleIds)
      .order("number")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const bucket = out[row.raffle_id];
      if (bucket) (row.status === "approved" ? bucket.approved : bucket.pending).push(row.number);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function withCounts(raffles: Raffle[], taken: Record<string, TakenNumbers>): Raffle[] {
  return raffles.map((r) => ({ ...r, sold: taken[r.id]?.approved.length ?? 0, reserved: taken[r.id]?.pending.length ?? 0 }));
}

/** Traduz os erros das funções do banco para mensagens do site */
export function reserveError(message: string): { status: number; error: string; clash?: number[] } {
  const taken = message.match(/TAKEN:([\d,]+)/);
  if (taken) {
    const clash = taken[1].split(",").map(Number);
    return { status: 409, clash, error: "Alguns números acabaram de ser escolhidos por outra pessoa." };
  }
  if (message.includes("RAFFLE_CLOSED")) return { status: 400, error: "Esta rifa não está mais vendendo números." };
  if (message.includes("RAFFLE_NOT_FOUND")) return { status: 404, error: "Rifa não encontrada." };
  if (message.includes("INVALID_NUMBER")) return { status: 400, error: "Algum número escolhido não existe nesta rifa." };
  if (message.includes("NO_NUMBERS")) return { status: 400, error: "Escolha pelo menos um número." };
  if (message.includes("ALREADY_SENT")) return { status: 400, error: "O comprovante desta compra já foi enviado." };
  if (message.includes("ORDER_NOT_FOUND") || message.includes("ORDER_CLOSED")) return { status: 404, error: "Essa reserva não existe mais. Escolha os números de novo." };
  if (isMissingTable(message)) return { status: 500, error: MISSING_RAFFLES };
  return { status: 500, error: "Não foi possível concluir a compra agora. Tente de novo." };
}
