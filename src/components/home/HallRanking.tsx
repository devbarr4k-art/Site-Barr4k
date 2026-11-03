"use client";

import { useState } from "react";
import { Coins, Crown, Medal, Trophy } from "lucide-react";
import { avatarFor } from "@/lib/daily";
import type { RankingRow, RankingSettings } from "@/lib/ranking";

const coinsText = (n: number) => n.toLocaleString("pt-BR");
const winsText = (n: number) => `${n} ${n === 1 ? "sorteio" : "sorteios"}`;

// Ouro, prata e bronze do pódio
const PODIUM = [
  { place: 1, ring: "border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.45)]", badge: "bg-yellow-400 text-black", glow: "from-yellow-500/25", height: "md:pt-6 md:pb-10" },
  { place: 2, ring: "border-gray-300 shadow-[0_0_30px_rgba(209,213,219,0.3)]", badge: "bg-gray-300 text-black", glow: "from-gray-300/15", height: "md:mt-10" },
  { place: 3, ring: "border-amber-600 shadow-[0_0_30px_rgba(217,119,6,0.35)]", badge: "bg-amber-600 text-black", glow: "from-amber-600/20", height: "md:mt-14" },
];

function PodiumCard({ row, place }: { row: RankingRow; place: number }) {
  const style = PODIUM[place - 1];
  return (
    <div className={`relative rounded-2xl border border-purple-500/30 bg-[#0c0d10] overflow-hidden px-5 py-6 text-center ${style.height} ${place === 1 ? "md:scale-105 border-yellow-400/40" : ""}`}>
      <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${style.glow} to-transparent pointer-events-none`} />
      <div className="relative">
        {place === 1 && <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-1 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />}
        <div className="relative w-24 h-24 mx-auto">
          <img src={avatarFor(row.username, row.avatar_url)} alt="" className={`w-24 h-24 rounded-full object-cover border-4 ${style.ring}`} />
          <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm not-italic ${style.badge}`}>{place}</span>
        </div>
        <p className="mt-5 text-white font-black text-lg truncate">@{row.username}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-black/50 border border-white/5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Vitórias</p>
            <p className="text-white font-black text-lg">{row.wins}</p>
          </div>
          <div className="rounded-xl bg-black/50 border border-white/5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Coins</p>
            <p className="text-yellow-400 font-black text-lg flex items-center justify-center gap-1"><Coins className="w-4 h-4" />{coinsText(row.coins)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hall da Fama: quem mais venceu, somando vitórias e coins (regras no painel, aba Vencedores). */
export default function HallRanking({ rows, settings }: { rows: RankingRow[]; settings: RankingSettings | null }) {
  const [showAll, setShowAll] = useState(false);
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const visibleRest = showAll ? rest : rest.slice(0, 7);

  return (
    <section id="hall-da-fama" className="py-20 bg-black border-t border-white/5 relative scroll-mt-20 overflow-hidden">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-purple-700/15 blur-[120px] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-title text-3xl md:text-5xl text-white flex items-center justify-center gap-3">
            <Trophy className="w-9 h-9 text-yellow-400" /> Hall da <span className="text-purple-500">Fama</span>
          </h2>
          <p className="text-gray-400 mt-3">
            {settings?.period === "month" ? "Ranking do mês" : "Ranking de todos os tempos"}: quem mais venceu sorteios do BARR4K
            {settings?.order === "wins" ? ", por número de vitórias." : ", somando as coins ganhas."}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-purple-500/30 p-12 text-center">
            <Medal className="w-10 h-10 text-purple-400 mx-auto mb-3" />
            <p className="text-white font-bold text-xl">O ranking começa no próximo sorteio</p>
            <p className="text-gray-400 mt-1">Ganhe e garanta seu lugar no Hall da Fama!</p>
          </div>
        ) : (
          <>
            {/* Pódio: no celular 1, 2, 3 empilhados; no computador 2 · 1 · 3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start mb-10">
              {[1, 0, 2].map((i) =>
                top[i] ? (
                  <div key={top[i].username} className={i === 0 ? "order-1 md:order-2" : i === 1 ? "order-2 md:order-1" : "order-3"}>
                    <PodiumCard row={top[i]} place={i + 1} />
                  </div>
                ) : null
              )}
            </div>

            {rest.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#0c0d10] overflow-hidden">
                <div className="grid grid-cols-[3rem_1fr_auto_auto] gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">
                  <span>#</span><span>Jogador</span><span className="text-right w-24">Vitórias</span><span className="text-right w-28">Coins</span>
                </div>
                {visibleRest.map((r, i) => (
                  <div key={r.username} className="grid grid-cols-[3rem_1fr_auto_auto] gap-4 items-center px-5 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <span className="text-gray-400 font-black">{i + 4}</span>
                    <span className="flex items-center gap-3 min-w-0">
                      <img src={avatarFor(r.username, r.avatar_url)} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700 shrink-0" />
                      <span className="text-white font-bold truncate">@{r.username}</span>
                    </span>
                    <span className="text-right w-24 text-gray-200 font-bold">{winsText(r.wins)}</span>
                    <span className="text-right w-28 text-yellow-400 font-black flex items-center justify-end gap-1"><Coins className="w-3.5 h-3.5" />{coinsText(r.coins)}</span>
                  </div>
                ))}
                {rest.length > 7 && (
                  <button onClick={() => setShowAll(!showAll)} className="w-full py-3 text-sm font-bold text-purple-400 hover:text-purple-300 hover:bg-white/5 transition-colors">
                    {showAll ? "Mostrar menos" : `Ver ranking completo (${rows.length})`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
