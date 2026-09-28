import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { chancesFor } from "@/lib/daily";
import { padNumber } from "@/lib/rifas";
import {
  drandRoundTime, entriesText, fetchDrandLatestRound, fetchDrandRound, pickWinner, sha256Hex,
  type FairDraw, type FairEntry, type FairKind,
} from "@/lib/fair";

export const MISSING_FAIR = "Falta rodar o SQL supabase/migracao-provably-fair.sql no Supabase.";
export const FAIR_COLUMNS =
  "id, kind, target_id, title, entries, total_weight, entries_hash, drand_round, drand_randomness, drand_signature, ticket, winner_label, winner_username, status, created_at, drawn_at";

type Pool = { title: string; entries: FairEntry[]; owners?: Map<string, string> };

// A lista sai sempre do banco (nunca do navegador), na mesma regra de cada roleta
async function buildPool(kind: FairKind, targetId: string): Promise<Pool | null> {
  const db = supabaseAdmin;

  if (kind === "rifa") {
    const { data: raffle } = await db.from("raffles").select("title, total_numbers").eq("id", targetId).maybeSingle();
    if (!raffle) return null;
    const { data: nums } = await db.from("raffle_numbers").select("number, order_id").eq("raffle_id", targetId).eq("status", "approved").order("number");
    const orderIds = [...new Set((nums ?? []).map((n) => n.order_id))];
    const { data: orders } = orderIds.length ? await db.from("raffle_orders").select("id, username").in("id", orderIds) : { data: [] };
    const userOf = new Map((orders ?? []).map((o) => [o.id, o.username as string]));
    const width = Math.max(raffle.total_numbers, ...(nums ?? []).map((n) => n.number));
    const owners = new Map<string, string>();
    const entries = (nums ?? []).map((n) => {
      const label = padNumber(n.number, width);
      owners.set(label, userOf.get(n.order_id) ?? "");
      return { label, weight: 1 };
    });
    return { title: raffle.title, entries, owners };
  }

  // O tipo do sorteio tem que bater com o botão usado (regras do mensal não valem no diário e vice-versa)
  const { data: g } = await db.from("giveaways").select("title, type, chance_t1, chance_t2, chance_t3").eq("id", targetId).maybeSingle();
  if (!g || (kind === "diario") !== (g.type === "daily")) return null;
  const weights = new Map<string, number>();

  if (kind === "mensal") {
    // Aprovados; quem já ganhou este sorteio fica de fora. Cada coin vale uma chance
    // (5000 coins = 5000 chances), somando as inscrições da pessoa; inscrição sem coins vale 1.
    const [{ data: parts }, { data: won }] = await Promise.all([
      db.from("participants").select("twitch_username, coins_used").eq("giveaway_id", targetId).eq("status", "approved"),
      db.from("winners").select("twitch_username").eq("giveaway_id", targetId),
    ]);
    const excluded = new Set((won ?? []).map((w) => w.twitch_username));
    for (const p of parts ?? []) {
      const chances = Math.max(1, Math.floor(Number(p.coins_used) || 0));
      if (!excluded.has(p.twitch_username)) weights.set(p.twitch_username, (weights.get(p.twitch_username) ?? 0) + chances);
    }
  } else {
    // Diário: cada pessoa entra UMA vez, com as chances do tier do sub. O chat às vezes grava a mesma
    // pessoa repetida (bot do painel + captação do servidor ao mesmo tempo): conta uma vez só, pelo
    // maior tier, e quem foi tirado da lista em qualquer linha fica de fora.
    const { data: parts } = await db.from("participants").select("twitch_username, sub_tier, status").eq("giveaway_id", targetId);
    const removed = new Set((parts ?? []).filter((p) => p.status === "rejected").map((p) => p.twitch_username));
    const tier = new Map<string, number>();
    for (const p of parts ?? []) {
      if (!removed.has(p.twitch_username)) tier.set(p.twitch_username, Math.max(tier.get(p.twitch_username) ?? 0, p.sub_tier ?? 0));
    }
    for (const [name, t] of tier) weights.set(name, chancesFor(t, g));
  }

  const entries = [...weights].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([label, weight]) => ({ label, weight }));
  return { title: String(g.title).replace(/\s*\|\s*/g, " "), entries };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/**
 * Congela a lista, grava (com a rodada futura do drand) e, quando a rodada sai,
 * calcula e grava o ganhador. Leva de 3 a 7 segundos.
 */
export async function runFairDraw(kind: FairKind, targetId: string): Promise<{ draw?: FairDraw; error?: string; status?: number }> {
  const db = supabaseAdmin;
  const pool = await buildPool(kind, targetId);
  if (!pool) return { error: "Sorteio não encontrado.", status: 404 };
  if (pool.entries.length === 0) return { error: "Não há ninguém para sortear.", status: 400 };

  const entriesHash = await sha256Hex(entriesText(pool.entries));
  // Duas rodadas à frente da última publicada: o número ainda não existe quando a lista é gravada.
  // A rodada atual vem do drand (o relógio do servidor pode estar alguns segundos errado).
  let latest: number;
  try {
    latest = await fetchDrandLatestRound();
  } catch {
    return { error: "O número público (drand) não respondeu. Tente sortear de novo.", status: 503 };
  }
  const round = latest + 2;

  const { data: created, error } = await db
    .from("fair_draws")
    .insert({
      kind,
      target_id: targetId,
      title: pool.title,
      entries: pool.entries,
      total_weight: pool.entries.reduce((s, e) => s + e.weight, 0),
      entries_hash: entriesHash,
      drand_round: round,
    })
    .select("id")
    .single();
  if (error || !created) {
    return { error: /fair_draws|schema cache|does not exist/i.test(error?.message ?? "") ? MISSING_FAIR : error?.message ?? "Erro ao sortear.", status: 500 };
  }

  // Espera a rodada sair (~3 a 6s) e tenta buscar por até ~12s
  await wait(Math.min(6500, drandRoundTime(round) - Date.now() + 400));
  let beacon: { randomness: string; signature: string } | null = null;
  for (let attempt = 0; attempt < 12 && !beacon; attempt++) {
    try {
      beacon = await fetchDrandRound(round);
    } catch {
      await wait(1000);
    }
  }
  if (!beacon) return { error: "O número público (drand) não respondeu. Tente sortear de novo.", status: 503 };

  const { ticket, index } = await pickWinner(pool.entries, entriesHash, beacon.randomness);
  const label = pool.entries[index].label;
  const { data: draw, error: updateError } = await db
    .from("fair_draws")
    .update({
      drand_randomness: beacon.randomness,
      drand_signature: beacon.signature,
      ticket: ticket.toString(),
      winner_label: label,
      winner_username: pool.owners ? pool.owners.get(label) ?? null : label,
      status: "drawn",
      drawn_at: new Date().toISOString(),
    })
    .eq("id", created.id)
    .select(FAIR_COLUMNS)
    .single();
  if (updateError || !draw) return { error: updateError?.message ?? "Erro ao sortear.", status: 500 };
  return { draw: draw as FairDraw };
}

/** Marca o giro como confirmado (ganhador salvo) ou descartado (sem resposta, cancelado, sortear de novo). */
export async function setFairStatus(id: string | undefined | null, status: "confirmed" | "skipped") {
  if (!id) return;
  // Só um giro "sorteado" muda de estado: confirmado nunca vira descartado, nem o contrário
  await supabaseAdmin.from("fair_draws").update({ status }).eq("id", id).eq("status", "drawn");
}
