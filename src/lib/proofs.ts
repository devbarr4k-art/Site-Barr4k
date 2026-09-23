import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Comprovantes das inscrições: bucket privado, caminho "<giveawayId>/<uuid>.<ext>".
// Inscrições antigas guardavam a imagem inteira (data:image/...) no próprio campo.
export const PROOFS_BUCKET = "proofs";

const isStoragePath = (v: unknown): v is string => typeof v === "string" && v !== "" && !v.startsWith("data:");

/** Troca os caminhos por links temporários (1h) numa chamada só. */
export async function signProofs<T extends { proof_url?: string | null }>(rows: T[]): Promise<T[]> {
  const paths = rows.map((r) => r.proof_url).filter(isStoragePath);
  if (paths.length === 0) return rows;
  const { data } = await supabaseAdmin.storage.from(PROOFS_BUCKET).createSignedUrls(paths, 60 * 60);
  const signed = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => (isStoragePath(r.proof_url) ? { ...r, proof_url: signed.get(r.proof_url) ?? null } : r));
}

/** Apaga arquivos de comprovante (ignora os antigos em base64). */
export async function removeProofs(values: (string | null | undefined)[]) {
  const paths = values.filter(isStoragePath);
  if (paths.length > 0) await supabaseAdmin.storage.from(PROOFS_BUCKET).remove(paths);
}
