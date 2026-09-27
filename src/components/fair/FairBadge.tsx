"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Trophy } from "lucide-react";
import type { FairDraw } from "@/lib/fair";

type Item = Pick<FairDraw, "id" | "kind" | "winner_label" | "winner_username" | "status">;

// Selo nas páginas de sorteio: resultado com link para a prova, ou "como funciona" antes de sortear
export default function FairBadge({ target, className = "" }: { target: string | null | undefined; className?: string }) {
  const [draws, setDraws] = useState<Item[]>([]);
  useEffect(() => {
    if (!target) return;
    const load = () =>
      fetch(`/api/provably-fair?target=${encodeURIComponent(target)}`)
        .then((r) => r.json())
        .then((j) => setDraws(j.draws ?? []))
        .catch(() => {});
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => clearInterval(t);
  }, [target]);

  const results = draws.filter((d) => d.status === "confirmed");
  const shown = results.length ? results : draws.filter((d) => d.status === "drawn").slice(0, 1);

  return (
    <div className={`rounded-2xl border border-purple-500/30 bg-purple-600/5 p-4 ${className}`}>
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-purple-300">
        <ShieldCheck className="w-4 h-4" /> Sorteio provably fair
      </p>
      {shown.length > 0 ? (
        <div className="mt-3 space-y-2">
          {shown.map((d) => (
            <Link key={d.id} href={`/provably-fair?id=${d.id}`} className="flex items-center gap-2 text-sm text-white hover:text-purple-200">
              <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
              <span className="font-bold truncate">{d.kind === "rifa" ? `Número ${d.winner_label} · @${d.winner_username}` : `@${d.winner_username}`}</span>
              <span className="text-xs text-purple-400 font-bold shrink-0">ver prova</span>
            </Link>
          ))}
          <Link href={`/provably-fair?target=${target}`} className="block text-xs text-gray-400 hover:text-white">Todos os giros deste sorteio</Link>
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-400">
          O ganhador sai de uma conta com a lista de participantes e um número público que ninguém conhece antes.{" "}
          <Link href="/provably-fair" className="text-purple-400 hover:text-purple-300 font-bold">Como funciona</Link>
        </p>
      )}
    </div>
  );
}
