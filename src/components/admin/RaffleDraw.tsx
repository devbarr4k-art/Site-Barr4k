"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, ShieldCheck, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { avatarFor } from "@/lib/daily";
import type { FairDraw } from "@/lib/fair";
import { useDialog } from "@/components/ui/Dialog";
import { useSounds } from "@/lib/useSounds";
import DrawCountdown from "@/components/admin/DrawCountdown";

// Mesma roleta do sorteio mensal, com os números da rifa nos cards
const ITEM_W = 144;
const ITEM_STEP = ITEM_W + 16;
const REEL_SIZE = 50;
const WINNER_INDEX = 40;
const SPIN_MS = 10000;

type Phase = "countdown" | "spinning" | "result";

// Sorteio da rifa entre os números aprovados. Quem ganha sai do servidor (provably fair);
// a roleta só mostra. Confirmar põe o ganhador no histórico e encerra a rifa.
export default function RaffleDraw({ raffle, onClose, onConfirmed }: {
  raffle: { id: string; title: string };
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("countdown");
  const [until, setUntil] = useState<Promise<FairDraw> | null>(null);
  const [draw, setDraw] = useState<FairDraw | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const reelRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const spinId = useRef(0);
  const sounds = useSounds();
  const dialog = useDialog();

  const start = () => {
    sounds.unlock();
    const p = adminApi<{ data: FairDraw }>("fairDraw", { kind: "rifa", targetId: raffle.id }).then((r) => r.data);
    p.catch(() => {}); // mostrado depois da contagem
    setDraw(null);
    setUntil(p);
    setPhase("countdown");
  };

  const started = useRef(false); // o modo de desenvolvimento do React roda o efeito duas vezes
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      start();
    }
    return () => { spinId.current++; timers.current.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spin = (d: FairDraw) => {
    const labels = d.entries.map((e) => e.label);
    const reel = Array.from({ length: REEL_SIZE }, () => labels[Math.floor(Math.random() * labels.length)]);
    reel[WINNER_INDEX] = d.winner_label ?? "";
    setItems(reel);
    setDraw(d);
    setPhase("spinning");

    // Quadro a quadro (funciona com "efeitos de animação" desligados), resultado garantido pelo relógio
    const id = ++spinId.current;
    const target = WINNER_INDEX * ITEM_STEP;
    let startedAt = 0;
    let lastIndex = -1;
    const frame = (now: number) => {
      const el = reelRef.current;
      if (spinId.current !== id || !el) return;
      if (!startedAt) startedAt = now;
      const t = Math.min(1, (now - startedAt) / SPIN_MS);
      const x = target * (1 - Math.pow(1 - t, 4));
      el.style.transform = `translateX(${-x}px)`;
      const index = Math.round(x / ITEM_STEP);
      if (index !== lastIndex) {
        lastIndex = index;
        sounds.tick(t);
      }
      if (t < 1) requestAnimationFrame(frame);
    };
    timers.current = [
      setTimeout(() => requestAnimationFrame(frame), 100),
      setTimeout(() => {
        spinId.current++;
        if (reelRef.current) reelRef.current.style.transform = `translateX(${-target}px)`;
        sounds.win();
        setPhase("result");
      }, SPIN_MS + 100),
    ];
  };

  const afterCountdown = () => {
    until?.then(spin, (err) => {
      dialog.error(err, "Não foi possível sortear");
      onClose();
    });
  };

  const discardAndRedraw = () => {
    if (draw) adminApi("fairStatus", { id: draw.id, status: "skipped" }).catch(() => {});
    start();
  };

  const confirm = async () => {
    if (!draw) return;
    setBusy(true);
    try {
      await adminApi("confirmRaffleWinner", { drawId: draw.id });
      onConfirmed();
    } catch (err) {
      dialog.error(err, "Não foi possível salvar o ganhador");
    }
    setBusy(false);
  };

  const cancel = () => {
    spinId.current++;
    timers.current.forEach(clearTimeout);
    if (draw) adminApi("fairStatus", { id: draw.id, status: "skipped" }).catch(() => {});
    onClose();
  };

  return createPortal(
    <>
      {phase === "countdown" && until && (
        <DrawCountdown
          until={until}
          onStep={(n) => sounds.tick(n === 1 ? 0.9 : n === 2 ? 0.5 : 0.15)}
          onDone={afterCountdown}
        />
      )}

      {phase !== "countdown" && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-5xl flex flex-col items-center">
            <h2 className={`text-4xl font-black text-white uppercase tracking-wider mb-12 ${phase === "result" ? "" : "animate-pulse"}`}>
              {phase === "result" ? "Número sorteado!" : "Sorteando..."}
            </h2>

            <div className="relative w-full h-48 bg-[#121214] border-y-4 border-purple-500/30 overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.1)] flex items-center">
              <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-red-500 z-50 -translate-x-1/2 shadow-[0_0_15px_rgba(239,68,68,1)]" />
              <div ref={reelRef} className="flex gap-4 w-full" style={{ paddingLeft: `calc(50% - ${ITEM_W / 2}px)` }}>
                {items.map((label, i) => (
                  <div key={i} className="w-[144px] h-[144px] flex-shrink-0 bg-black border border-gray-800 rounded-xl flex flex-col items-center justify-center opacity-80">
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-400 mb-1">Número</span>
                    <span className="font-title text-5xl text-white tabular-nums">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {phase === "spinning" && (
              <div className="mt-10 flex items-center gap-3">
                <button onClick={cancel} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-red-300 bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 transition-colors">
                  <X className="w-4 h-4" /> Cancelar sorteio
                </button>
                <button onClick={() => sounds.setEnabled(!sounds.enabled)} title={sounds.enabled ? "Desligar som" : "Ligar som"}
                  className="p-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
                  {sounds.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            )}

            {phase === "result" && draw && (
              <div className="mt-12 bg-[#121214] border border-purple-500/50 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(168,85,247,0.3)] p-8 text-center animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-600 to-pink-600" />
                <button onClick={onClose} title="Fechar" className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                <img src={avatarFor(draw.winner_username ?? "?", null)} alt=""
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.45)]" />
                <p className="font-title text-6xl text-white tabular-nums">{draw.winner_label}</p>
                <h3 className="text-2xl font-black text-white uppercase tracking-wider mt-2 truncate">@{draw.winner_username}</h3>
                <p className="text-gray-400 mt-1 mb-2 font-medium text-xs uppercase tracking-widest">Ganhador da rifa · {raffle.title}</p>
                <a href={`/provably-fair?id=${draw.id}`} target="_blank" className="inline-flex items-center gap-1.5 mb-6 text-[11px] font-bold text-purple-300 hover:text-purple-200 uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5" /> Ver prova do sorteio
                </a>
                <div className="flex gap-3">
                  <button onClick={confirm} disabled={busy}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold transition-colors text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                    <Trophy className="w-4 h-4" /> Confirmar ganhador
                  </button>
                  <button onClick={discardAndRedraw} disabled={busy}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-bold transition-colors text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                    <RotateCcw className="w-4 h-4" /> Sortear de novo
                  </button>
                </div>
                <p className="mt-4 text-[11px] text-gray-500">Confirmar encerra a rifa e coloca o ganhador em Vencedores. &quot;Sortear de novo&quot; fica registrado como descartado.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
