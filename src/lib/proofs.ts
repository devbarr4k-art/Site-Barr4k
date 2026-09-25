import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Comprovantes das inscrições: bucket privado, caminho "<giveawayId>/<uuid>.<ext>".
// Inscrições antigas guardavam a imagem inteira (data:image/...) no próprio campo.
export const PROOFS_BUCKET = "proofs";

const isStoragePath = (v: unknown): v is string => typeof v === "string" && v !== "" && !v.startsWith("data:");

type ProofRow = { proof_url?: string | null; proof_paths?: string[] | null };

/** Todos os comprovantes de uma inscrição: o principal (proof_url) e os extras (proof_paths). */
export const allProofs = (r: ProofRow) => [...new Set([r.proof_url, ...(r.proof_paths ?? [])].filter((p): p is string => !!p))];

/** Troca os caminhos por links temporários (1h) numa chamada só. `proofs` traz todos os links. */
export async function signProofs<T extends ProofRow>(rows: T[]): Promise<(T & { proofs: string[] })[]> {
  const paths = [...new Set(rows.flatMap(allProofs).filter(isStoragePath))];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabaseAdmin.storage.from(PROOFS_BUCKET).createSignedUrls(paths, 60 * 60);
    for (const d of data ?? []) if (d.path && d.signedUrl) signed.set(d.path, d.signedUrl);
  }
  const link = (p: string) => (isStoragePath(p) ? signed.get(p) ?? null : p); // base64 antigo vai como está
  return rows.map((r) => ({
    ...r,
    proof_url: r.proof_url ? link(r.proof_url) : null,
    proofs: allProofs(r).map(link).filter((u): u is string => !!u),
  }));
}

/** Apaga arquivos de comprovante (ignora os antigos em base64). */
export async function removeProofs(values: (string | null | undefined)[]) {
  const paths = values.filter(isStoragePath);
  if (paths.length > 0) await supabaseAdmin.storage.from(PROOFS_BUCKET).remove(paths);
}
