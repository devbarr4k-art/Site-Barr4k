// Regras do sorteio diário compartilhadas entre painel, página pública e API.

export type SubTier = 0 | 1 | 2 | 3;

export interface DailyChances {
  chance_t1: number;
  chance_t2: number;
  chance_t3: number;
}

/** Quantas chances um participante tem, pelo tier do sub e as chances configuradas. */
export function chancesFor(tier: number, g: DailyChances): number {
  if (tier === 3) return g.chance_t3;
  if (tier === 2) return g.chance_t2;
  if (tier === 1) return g.chance_t1;
  return 1;
}

/** Foto da Twitch ou um avatar com a inicial, para quem não tem foto salva. */
export function avatarFor(username: string, avatarUrl?: string | null): string {
  return avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6d28d9&color=fff&size=128&bold=true`;
}
