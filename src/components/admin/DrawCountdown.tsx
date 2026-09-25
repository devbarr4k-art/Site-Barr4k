"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const STEP_MS = 900;

// Contagem "3 · 2 · 1" antes da roleta (sorteio mensal e diário da live).
// Tela cheia por cima de tudo; chama onDone quando termina.
export default function DrawCountdown({ onDone, onStep }: {
  onDone: () => void;
  onStep?: (n: number) => void; // som de cada número
}) {
  const [n, setN] = useState(3);
  const doneRef = useRef(onDone);
  const stepRef = useRef(onStep);
  useEffect(() => { doneRef.current = onDone; stepRef.current = onStep; });

  useEffect(() => {
    stepRef.current?.(n);
    const t = setTimeout(() => (n > 1 ? setN(n - 1) : doneRef.current()), STEP_MS);
    return () => clearTimeout(t);
  }, [n]);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm select-none">
      <span
        key={n}
        className="font-title text-[11rem] leading-none text-white animate-countdown drop-shadow-[0_0_40px_rgba(168,85,247,0.9)]"
      >
        {n}
      </span>
    </div>,
    document.body
  );
}
