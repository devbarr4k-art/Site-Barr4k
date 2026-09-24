"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RotateCcw, Shuffle, X } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { padNumber, type Raffle, type RaffleOrder, type TakenNumbers } from "@/lib/rifas";

// Desfazer uma recusa quando alguns números já foram pegos por outra pessoa:
// troca só os perdidos por outros livres, ou (rifa cheia) cria números extras no fim.
export default function ReplaceNumbersModal({ order, raffle, lost, onDone, onClose }: {
  order: RaffleOrder;
  raffle: Raffle;
  lost: number[];
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const [lostNow, setLostNow] = useState(lost);
  const [taken, setTaken] = useState<Set<number> | null>(null);
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = raffle.total_numbers;
  const keep = useMemo(() => order.numbers.filter((n) => !lostNow.includes(n)), [order.numbers, lostNow]);
  const need = lostNow.length;

  const loadTaken = useCallback(async () => {
    try {
      const json = await (await fetch(`/api/rifas/${raffle.id}?x=${Date.now()}`)).json();
      const t: TakenNumbers = json.taken ?? { approved: [], pending: [] };
      setTaken(new Set([...t.approved, ...t.pending]));
    } catch {
      setTaken(new Set());
    }
  }, [raffle.id]);
  useEffect(() => { loadTaken(); }, [loadTaken]);

  // Livres para a troca: nem ocupados nem os que a pessoa já vai manter
  const free = useMemo(
    () => (taken ? Array.from({ length: total }, (_, i) => i + 1).filter((n) => !taken.has(n) && !keep.includes(n)) : []),
    [taken, total, keep]
  );
  const full = taken !== null && free.length < need;

  const toggle = (n: number) =>
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else if (next.size < need) next.add(n);
      return next;
    });

  const shuffle = () => {
    const pool = [...free];
    const out: number[] = [];
    while (out.length < need && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    setPicks(new Set(out));
  };

  const submit = async (extend: boolean) => {
    setError("");
    setBusy(true);
    try {
      const res = await adminApi<{ added: number[] }>("restoreRaffleOrder", { id: order.id, numbers: [...picks], extend });
      const added = (res.added ?? []).map((n) => padNumber(n, extend ? total + need : total)).join(", ");
      onDone(extend
        ? `@${order.username} voltou para Pendentes. A rifa ganhou ${need} número(s) extra(s): ${added}.`
        : `@${order.username} voltou para Pendentes com o(s) número(s) novo(s) ${added}.`);
    } catch (err) {
      const data = (err as { data?: { lost?: number[] } }).data;
      setError(err instanceof Error ? err.message : "Não foi possível voltar a compra.");
      if (data?.lost) {
        // alguém pegou um dos escolhidos agora: tira da seleção e atualiza a grade
        setPicks((prev) => new Set([...prev].filter((n) => !data.lost!.includes(n))));
        loadTaken();
      }
    }
    setBusy(false);
  };

  // se a lista de perdidos mudou (ex.: outra tentativa), recomeça a escolha
  useEffect(() => { setPicks(new Set()); }, [need]);

  const chip = (n: number, cls: string) => (
    <span key={n} className={`px-2 py-0.5 rounded-md border text-xs font-black not-italic ${cls}`}>{padNumber(n, total)}</span>
  );

  return (
    <div className="fixed inset-0 z-[160] flex overflow-y-auto p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative m-auto w-full max-w-xl rounded-2xl border border-purple-500/40 bg-[#121214] p-6 sm:p-8 space-y-5 shadow-2xl">
        <button onClick={onClose} aria-label="Fechar" className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>

        <div className="pr-6">
          <h2 className="font-title text-2xl text-white">
            {need > 1 ? `${need} números já foram escolhidos` : "Esse número já foi escolhido"}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Depois da recusa, outra pessoa pegou {need > 1 ? "esses números" : "esse número"}. Quer escolher {need > 1 ? `outros ${need}` : "outro"} para <b className="text-white">@{order.username}</b>? O valor pago continua o mesmo.
          </p>
        </div>

        <div className="rounded-xl bg-black/40 border border-white/5 p-4 space-y-2 text-xs">
          {keep.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-gray-500 font-bold uppercase tracking-widest mr-1">Continua com</span>
              {keep.map((n) => chip(n, "border-purple-400/60 text-purple-200 bg-purple-500/10"))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-gray-500 font-bold uppercase tracking-widest mr-1">Perdeu</span>
            {lostNow.map((n) => chip(n, "border-white/10 text-gray-500 line-through"))}
          </div>
        </div>

        {taken === null ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>
        ) : full ? (
          /* Rifa cheia: exceção, cria números além do limite */
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-3">
            <p className="text-sm text-yellow-100">
              {free.length === 0 ? "A rifa está cheia: não sobrou nenhum número livre." : `Só sobraram ${free.length} número(s) livre(s), precisa de ${need}.`}
              {" "}Dá para abrir uma exceção e criar {need > 1 ? `${need} números extras` : "um número extra"} além do limite ({Array.from({ length: need }, (_, i) => padNumber(total + i + 1, total + need)).join(", ")}).
            </p>
            <button onClick={() => submit(true)} disabled={busy}
              className="w-full btn-neon py-3 rounded-lg font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar {need > 1 ? `${need} números extras` : "número extra"} e voltar para pendente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Escolha {need} número{need > 1 ? "s" : ""} <span className="text-purple-300">({picks.size}/{need})</span>
              </p>
              <button onClick={shuffle} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-purple-500/40 text-purple-200 bg-purple-600/10 hover:bg-purple-600/25 flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5" /> Sortear
              </button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
              {free.map((n) => (
                <button key={n} type="button" onClick={() => toggle(n)}
                  className={`aspect-square rounded-md text-xs font-black not-italic border transition-colors ${picks.has(n) ? "bg-purple-600 border-purple-300 text-white" : "bg-[#0a0a0b] border-white/10 text-gray-300 hover:border-purple-400"} ${!picks.has(n) && picks.size >= need ? "opacity-40" : ""}`}>
                  {padNumber(n, total)}
                </button>
              ))}
            </div>
            <button onClick={() => submit(false)} disabled={busy || picks.size !== need}
              className="w-full btn-neon py-3 rounded-lg font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Trocar e voltar para pendente
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-sm font-bold">{error}</p>}
      </div>
    </div>
  );
}
