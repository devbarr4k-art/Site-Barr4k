export type Video = {
  id: string;
  kind: "video" | "short";
  youtube_id: string;
  title: string;
  thumbnail_url: string;
  duration: string | null;
  views: string | null;
  published_at: string; // AAAA-MM-DD
};

export const YOUTUBE_CHANNEL = "https://www.youtube.com/@barr4k";

/** Id do vídeo a partir de qualquer link do YouTube (watch, youtu.be, shorts, live, embed) ou do próprio id. */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname)) return null;
    const fromQuery = url.searchParams.get("v");
    if (fromQuery && /^[\w-]{11}$/.test(fromQuery)) return fromQuery;
    const match = url.pathname.match(/^\/(?:shorts\/|live\/|embed\/|v\/)?([\w-]{11})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export const isShortsLink = (input: string) => /youtube\.com\/shorts\//i.test(input);

export const videoUrl = (v: Pick<Video, "kind" | "youtube_id">) =>
  v.kind === "short" ? `https://www.youtube.com/shorts/${v.youtube_id}` : `https://www.youtube.com/watch?v=${v.youtube_id}`;

/** "hoje", "ontem", "há 5 dias", "há 1 semana", "há 3 meses"... */
export function timeAgo(date: string, now = new Date()): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  if (days < 30) { const w = Math.floor(days / 7); return `há ${w} ${w === 1 ? "semana" : "semanas"}`; }
  if (days < 365) { const mo = Math.floor(days / 30); return `há ${mo} ${mo === 1 ? "mês" : "meses"}`; }
  const yr = Math.floor(days / 365);
  return `há ${yr} ${yr === 1 ? "ano" : "anos"}`;
}

/** "25K" → 25000, "9,4K" → 9400, "1,2M" → 1200000, "7 mil" → 7000, "268" → 268. */
export function viewsToNumber(views: string | null): number {
  if (!views) return 0;
  const m = views.trim().toLowerCase().replace(/\./g, "").replace(",", ".").match(/^([\d.]+)\s*(k|mil|m|mi|mil?h(ões|ão)?)?/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2] ?? "";
  return Math.round(unit.startsWith("k") || unit === "mil" ? n * 1e3 : unit.startsWith("m") ? n * 1e6 : n);
}

/** Os mais vistos de um tipo (empate: o mais novo primeiro). É o que a home mostra. */
export function mostViewed(videos: Video[], kind: Video["kind"], limit: number): Video[] {
  return videos
    .filter((v) => v.kind === kind)
    .sort((a, b) => viewsToNumber(b.views) - viewsToNumber(a.views) || b.published_at.localeCompare(a.published_at))
    .slice(0, limit);
}

/** Quantos entram no carrossel da home (os mais vistos de cada tipo). */
export const HOME_LIMITS = { video: 20, short: 30 } as const;
