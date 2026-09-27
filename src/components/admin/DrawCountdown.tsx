"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const STEP_MS = 900;

// Contagem "3 · 2 · 1" antes da roleta (sorteio mensal, diário da live e rifa).
// Tela cheia por cima de tudo; chama onDone quando termina. Com `until`, só termina
// depois que o sorteio no servidor responder (o número público do drand leva alguns segundos).
export default function DrawCountdown({ onDone, onStep, until }: {
  onDone: () => void;
  onStep?: (n: number) => void; // som de cada número
  until?: Promise<unknown>;
}) {
  const [n, setN] = useState(3);
  const [holding, setHolding] = useState(false);
  const doneRef = useRef(onDone);
  const stepRef = useRef(onStep);
  useEffect(() => { doneRef.current = onDone; stepRef.current = onStep; });

  useEffect(() => {
    stepRef.current?.(n);
    const t = setTimeout(() => {
      if (n > 1) return setN(n - 1);
      if (!until) return doneRef.current();
      setHolding(true);
      until.then(() => doneRef.current(), () => doneRef.current());
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [n, until]);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm select-none">
      {holding ? (
        <p className="text-sm font-black uppercase tracking-[0.4em] text-purple-300 animate-pulse">Gerando sorteio público...</p>
      ) : (
        <span
          key={n}
          className="font-title text-[11rem] leading-none text-white animate-countdown drop-shadow-[0_0_40px_rgba(168,85,247,0.9)]"
        >
          {n}
        </span>
      )}
    </div>,
    document.body
  );
}
