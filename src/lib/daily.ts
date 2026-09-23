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

/**
 * A primeira palavra da mensagem precisa ser o comando. Remove os caracteres
 * invisíveis que 7TV/Chatterino colam em mensagens repetidas para driblar o
 * filtro de duplicadas da Twitch, e aceita texto depois ("!sorteio boa sorte").
 */
export function isCommand(message: string, command: string): boolean {
  const clean = message.replace(/[\u{E0000}-\u{E007F}\u{200B}-\u{200D}\u{2060}\u{FEFF}]/gu, "").trim().toLowerCase();
  return clean.split(/\s+/)[0] === command.trim().toLowerCase();
}

/** Tier do sub pela versão do badge: 3000+ = T3, 2000+ = T2, demais = T1; 0 = não é sub. */
export function tierFromBadgeVersion(version: string | null | undefined): SubTier {
  if (version === null || version === undefined) return 0;
  const n = parseInt(version, 10) || 0;
  return n >= 3000 ? 3 : n >= 2000 ? 2 : 1;
}
