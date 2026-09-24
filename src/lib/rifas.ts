// Rifas: tipos e utilidades usados pelas páginas, pelo painel e pelas rotas /api.
// Os dados vivem nas tabelas raffles, raffle_orders e raffle_numbers (supabase/migracao-rifas.sql).

export type RaffleStatus = "open" | "closed";
// awaiting = números presos esperando o PIX (prazo HOLD_MINUTES); pending = comprovante enviado, esperando aprovação
export type OrderStatus = "awaiting" | "pending" | "approved" | "rejected" | "expired";

export type Raffle = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  price_cents: number;
  total_numbers: number;
  draw_date: string | null;
  pix_key: string | null;
  pix_name: string | null;
  qr_image_url: string | null;
  status: RaffleStatus;
  created_at: string;
  // contagens (vêm da API)
  sold?: number; // pagos
  reserved?: number; // aguardando aprovação
};

/** Números ocupados de uma rifa (sem dizer de quem são) */
export type TakenNumbers = { approved: number[]; pending: number[] };

export type RaffleOrder = {
  id: string;
  raffle_id: string;
  username: string;
  numbers: number[];
  total_cents: number;
  status: OrderStatus;
  created_at: string;
  decided_at?: string | null;
  expires_at?: string | null; // até quando a reserva segura os números (status awaiting)
  proofs?: string[]; // links temporários dos comprovantes (só no painel)
  raffle_title?: string; // só no painel
};

export const MAX_RAFFLE_NUMBERS = 10000;
export const MAX_RAFFLE_PROOFS = 4;

/** Minutos que os números ficam presos para quem está pagando */
export const HOLD_MINUTES = 15;

export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** 7 → "007" numa rifa de 200 números */
export const padNumber = (n: number, total: number) => String(n).padStart(String(total).length, "0");

/** "10,50" / "10.5" / "R$ 10" → 1050 centavos (0 se inválido) */
export function parseMoneyToCents(value: string): number {
  const clean = value.replace(/[^\d,.]/g, "");
  if (!clean) return 0;
  // "1.234,56" → 1234.56 ; "10.5" → 10.5
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
