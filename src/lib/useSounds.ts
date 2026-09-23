"use client";

import { useEffect, useRef, useState } from "react";

// Sons curtos gerados no navegador (sem arquivos de áudio)
export function useSounds() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const unlock = () => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) ctxRef.current = new Ctx();
    }
    ctxRef.current?.resume();
  };

  const beep = (freq: number, duration: number, volume: number, type: OscillatorType = "square", delay = 0) => {
    const ctx = ctxRef.current;
    if (!ctx || !enabledRef.current) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  };

  return {
    enabled,
    setEnabled,
    unlock,
    tick: (progress: number) => beep(500 + progress * 700, 0.05, 0.05),
    win: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.35, 0.12, "triangle", i * 0.12)),
    alarm: () => beep(220, 0.25, 0.1, "sawtooth"),
  };
}
