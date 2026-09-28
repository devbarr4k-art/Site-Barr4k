"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE = 10;

/** Divide uma lista em páginas. Volta para a última página válida se a lista encolher (filtro, exclusão). */
export function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const current = Math.min(page, pageCount);
  const pageItems = useMemo(() => items.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize]);
  return { page: current, setPage, pageCount, pageItems, total: items.length, pageSize };
}

// Números das páginas com "..." quando são muitas: 1 … 4 5 6 … 12
function pageList(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(count - 1, page + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < count - 1) out.push("…");
  out.push(count);
  return out;
}

/** Barra de páginas embaixo das listas do painel. Some quando cabe tudo numa página. */
export default function Pagination({ page, pageCount, total, pageSize, setPage, className = "" }: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  setPage: (p: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "min-w-9 h-9 px-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center";

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 ${className}`}>
      <p className="text-xs text-gray-500">Mostrando {from}–{to} de {total}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Página anterior"
          className={`${btn} text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pageList(page, pageCount).map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-gray-600">…</span>
          ) : (
            <button key={p} onClick={() => setPage(p)}
              className={`${btn} ${p === page ? "bg-purple-600 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
              {p}
            </button>
          )
        )}
        <button onClick={() => setPage(page + 1)} disabled={page === pageCount} aria-label="Próxima página"
          className={`${btn} text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent`}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
