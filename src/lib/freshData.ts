"use client";

import { useEffect, useRef } from "react";

// Quando o admin altera algo pelo painel, as rotas com cache da Vercel (/api/home)
// ainda podem devolver a versão antiga por alguns segundos. Guardamos a hora da
// última alteração e ela entra na URL, o que força uma resposta nova.
const KEY = "barr4k_data_version";

export function markDataChanged() {
  try { localStorage.setItem(KEY, String(Date.now())); } catch {}
}

/** "?v=123" se houve alteração pelo painel neste navegador, senão "". */
export function dataVersionQuery() {
  try {
    const v = localStorage.getItem(KEY);
    return v ? `?v=${v}` : "";
  } catch {
    return "";
  }
}

/** Chama `refresh` quando a pessoa volta para a aba (ou para a página pelo botão Voltar). */
export function useRefreshOnReturn(refresh: () => void) {
  const ref = useRef(refresh);
  useEffect(() => { ref.current = refresh; });

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      // Ignora trocas rápidas (menos de 1s) para não recarregar à toa
      else if (Date.now() - hiddenAt > 1000) ref.current();
    };
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) ref.current(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
}
