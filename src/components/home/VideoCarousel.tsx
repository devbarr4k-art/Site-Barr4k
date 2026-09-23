"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Fileira com rolagem lateral (arrasta no celular, setas no computador).
// As setas só aparecem quando há mais cards do que cabem na tela.
export default function VideoCarousel({ children, label }: { children: React.ReactNode; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  // Anda uma "página" (a largura visível), parando no começo de um card
  const go = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  // Setas no meio do espaço vazio ao lado dos cards (entre a fileira e a borda da tela),
  // do tamanho que couber nesse espaço: nunca por cima dos vídeos nem para fora da tela
  const gutter = "((100vw - 100%) / 2 - 6px)";
  const size = `min(2.75rem, calc(${gutter} - 4px))`;
  const offset = `calc(-1 * ${gutter} / 2 - ${size} / 2)`;
  const arrowStyle = { width: size, height: size };
  const arrow = "absolute top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/80 border border-purple-500/50 text-white items-center justify-center hover:bg-purple-600 transition-colors shadow-lg hidden lg:flex";

  return (
    <div className="relative" role="region" aria-label={label}>
      {canPrev && (
        <button type="button" onClick={() => go(-1)} aria-label="Anteriores" className={arrow} style={{ ...arrowStyle, left: offset }}>
          <ChevronLeft className="w-3/5 h-3/5" />
        </button>
      )}
      <div
        ref={trackRef}
        onScroll={update}
        className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar pb-2 -mb-2"
      >
        {children}
      </div>
      {canNext && (
        <button type="button" onClick={() => go(1)} aria-label="Próximos" className={arrow} style={{ ...arrowStyle, right: offset }}>
          <ChevronRight className="w-3/5 h-3/5" />
        </button>
      )}
    </div>
  );
}
