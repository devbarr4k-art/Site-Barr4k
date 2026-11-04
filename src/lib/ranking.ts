// Hall da Fama em ranking: soma vitórias e coins de cada pessoa. Usado pela home (/api/home)
// e pelo painel (prévia). As regras ficam em site_settings e o operador muda pelo painel.

export const RANKING_SETTINGS_KEY = "hall_ranking";

export type RankingKind = "mensal" | "diario" | "outros";
export const RANKING_KIND_LABEL: Record<RankingKind, string> = {
  mensal: "Sorteios mensais",
  diario: "Sorteio diário (live)",
  outros: "Rifas e vencedores lançados à mão",
};

export interface RankingSettings {
  period: "all" | "month"; // todos os tempos ou só o mês atual
  order: "coins" | "wins"; // o que decide a posição (o outro desempata)
  kinds: RankingKind[]; // quais sorteios contam
  limit: number; // quantos aparecem no site
}

export const DEFAULT_RANKING: RankingSettings = { period: "all", order: "coins", kinds: ["mensal", "diario", "outros"], limit: 10 };

export function normalizeRanking(value: unknown): RankingSettings {
  const v = (value ?? {}) as Partial<RankingSettings>;
  const kinds = Array.isArray(v.kinds) ? v.kinds.filter((k): k is RankingKind => k in RANKING_KIND_LABEL) : DEFAULT_RANKING.kinds;
  return {
    period: v.period === "month" ? "month" : "all",
    order: v.order === "wins" ? "wins" : "coins",
    kinds,
    limit: Math.min(100, Math.max(3, Math.floor(Number(v.limit) || DEFAULT_RANKING.limit))),
  };
}

export type RankingWinner = {
  twitch_username: string;
  prize?: string | null;
  avatar_url?: string | null;
  coins?: number | null;
  won_at: string;
  giveaways?: { type?: string | null } | null;
};

export type RankingWin = { prize: string; coins: number; won_at: string };
// history: as vitórias que somam no ranking, da primeira para a última (o site mostra ao clicar)
export type RankingRow = { username: string; avatar_url: string | null; wins: number; coins: number; last_win: string; history: RankingWin[] };

/** Mensal (e destaque), diário ou outros (rifa e vencedor lançado à mão, sem sorteio ligado). */
export const kindOf = (w: RankingWinner): RankingKind =>
  w.giveaways?.type === "daily" ? "diario" : w.giveaways?.type ? "mensal" : "outros";

/** Primeiro dia do mês atual no horário de Brasília. */
function monthStart(now: Date) {
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return new Date(Date.UTC(br.getFullYear(), br.getMonth(), 1, 3)); // 00:00 em Brasília = 03:00 UTC
}

export function buildRanking(winners: RankingWinner[], settings: RankingSettings, now = new Date()): RankingRow[] {
  const since = settings.period === "month" ? monthStart(now).getTime() : 0;
  const byUser = new Map<string, RankingRow>();
  for (const w of winners) {
    if (!settings.kinds.includes(kindOf(w))) continue;
    if (new Date(w.won_at).getTime() < since) continue;
    const row = byUser.get(w.twitch_username) ?? { username: w.twitch_username, avatar_url: null, wins: 0, coins: 0, last_win: w.won_at, history: [] as RankingWin[] };
    row.wins += 1;
    const coins = Math.max(0, Number(w.coins) || 0);
    row.coins += coins;
    row.history.push({ prize: w.prize ?? "Prêmio", coins, won_at: w.won_at });
    if (w.won_at >= row.last_win || !row.avatar_url) {
      row.avatar_url = w.avatar_url ?? row.avatar_url;
      row.last_win = w.won_at > row.last_win ? w.won_at : row.last_win;
    }
    byUser.set(w.twitch_username, row);
  }
  const main = settings.order === "coins" ? "coins" : "wins";
  const tie = main === "coins" ? "wins" : "coins";
  for (const row of byUser.values()) row.history.sort((a, b) => (a.won_at < b.won_at ? -1 : 1));
  return [...byUser.values()]
    .sort((a, b) => b[main] - a[main] || b[tie] - a[tie] || (a.last_win < b.last_win ? -1 : 1)) // empate total: quem chegou antes
    .slice(0, settings.limit);
}
