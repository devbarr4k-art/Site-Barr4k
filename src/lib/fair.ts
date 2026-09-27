// Provably fair: a conta que escolhe o ganhador. Roda igual no servidor (na hora do sorteio)
// e no navegador de qualquer pessoa (página /provably-fair), então o resultado pode ser conferido.
//
//   lista        = cada participante numa linha "nome:chances", na ordem gravada
//   hash_lista   = SHA-256(lista)
//   aleatório    = rodada do drand escolhida quando a lista foi congelada (ainda não existia)
//   bilhete      = SHA-256(hash_lista + ":" + aleatório) como número, módulo total de chances
//   ganhador     = dono do bilhete, contando as chances na ordem da lista

export type FairKind = "mensal" | "diario" | "rifa";
export type FairEntry = { label: string; weight: number };

export interface FairDraw {
  id: string;
  kind: FairKind;
  target_id: string;
  title: string;
  entries: FairEntry[];
  total_weight: number;
  entries_hash: string;
  drand_round: number;
  drand_randomness: string | null;
  drand_signature: string | null;
  ticket: string | null;
  winner_label: string | null;
  winner_username: string | null;
  status: "waiting" | "drawn" | "confirmed" | "skipped";
  created_at: string;
  drawn_at: string | null;
}

export const FAIR_KIND_LABEL: Record<FairKind, string> = { mensal: "Sorteio mensal", diario: "Sorteio diário", rifa: "Rifa" };

// drand "quicknet": uma rodada nova a cada 3 segundos, assinada por dezenas de organizações independentes
export const DRAND_CHAIN = "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
export const DRAND_GENESIS = 1692803367; // segundos
export const DRAND_PERIOD = 3;
export const DRAND_RELAYS = ["https://api.drand.sh", "https://drand.cloudflare.com"];

export const drandRoundUrl = (round: number, relay = DRAND_RELAYS[0]) => `${relay}/${DRAND_CHAIN}/public/${round}`;
/** Momento (ms) em que a rodada é publicada. */
export const drandRoundTime = (round: number) => (DRAND_GENESIS + (round - 1) * DRAND_PERIOD) * 1000;
/** Rodada mais recente já publicada no instante `ms`. */
export const drandCurrentRound = (ms: number) => Math.floor((ms / 1000 - DRAND_GENESIS) / DRAND_PERIOD) + 1;

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const hexToBytes = (hex: string): Uint8Array<ArrayBuffer> => new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));

export const sha256Hex = async (data: string | Uint8Array<ArrayBuffer>) =>
  toHex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? new TextEncoder().encode(data) : data));

/** O texto exato que entra no hash da lista. */
export const entriesText = (entries: FairEntry[]) => entries.map((e) => `${e.label}:${e.weight}`).join("\n");

/** No drand, o número aleatório é o SHA-256 da assinatura da rodada. */
export const drandRandomnessMatches = async (signature: string, randomness: string) =>
  (await sha256Hex(hexToBytes(signature))) === randomness.toLowerCase();

/** Bilhete sorteado e o índice do ganhador na lista. */
export async function pickWinner(entries: FairEntry[], entriesHash: string, randomness: string) {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  const h = await sha256Hex(`${entriesHash}:${randomness}`);
  const ticket = BigInt("0x" + h) % BigInt(total);
  let acc = BigInt(0);
  for (let i = 0; i < entries.length; i++) {
    acc += BigInt(entries[i].weight);
    if (ticket < acc) return { ticket, index: i, hash: h };
  }
  throw new Error("Lista vazia");
}

/** Última rodada publicada, pelo próprio drand (não depende do relógio de quem pergunta). */
export async function fetchDrandLatestRound(): Promise<number> {
  let lastError: unknown = null;
  for (const relay of DRAND_RELAYS) {
    try {
      const res = await fetch(`${relay}/${DRAND_CHAIN}/public/latest`, { cache: "no-store" });
      if (!res.ok) throw new Error(`drand ${res.status}`);
      const round = Number((await res.json()).round);
      if (round > 0) return round;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("drand indisponível");
}

/** Busca a rodada num dos servidores públicos do drand e confere a assinatura com o número. */
export async function fetchDrandRound(round: number): Promise<{ randomness: string; signature: string }> {
  let lastError: unknown = null;
  for (const relay of DRAND_RELAYS) {
    try {
      const res = await fetch(drandRoundUrl(round, relay), { cache: "no-store" });
      if (!res.ok) throw new Error(`drand ${res.status}`);
      const j = await res.json();
      if (Number(j.round) !== round || !(await drandRandomnessMatches(j.signature, j.randomness))) throw new Error("drand inválido");
      return { randomness: j.randomness, signature: j.signature };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("drand indisponível");
}
