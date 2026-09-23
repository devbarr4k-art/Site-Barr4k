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

  const arrow = "absolute top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/80 border border-purple-500/50 text-white items-center justify-center hover:bg-purple-600 transition-colors shadow-lg hidden md:flex";

  return (
    <div className="relative" role="region" aria-label={label}>
      {canPrev && (
        <button type="button" onClick={() => go(-1)} aria-label="Anteriores" className={`${arrow} -left-5`}>
          <ChevronLeft className="w-5 h-5" />
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
        <button type="button" onClick={() => go(1)} aria-label="Próximos" className={`${arrow} -right-5`}>
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
