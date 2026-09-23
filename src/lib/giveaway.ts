// Um sorteio está encerrado quando o admin encerrou ou quando a data dele já passou.
export function isGiveawayClosed(
  giveaway: { status?: string | null; draw_date?: string | null },
  now: number = Date.now()
): boolean {
  if (giveaway.status !== "active") return true;
  return !!giveaway.draw_date && new Date(giveaway.draw_date).getTime() < now;
}
