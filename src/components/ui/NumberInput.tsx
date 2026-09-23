"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

// Campo numérico com botões roxos de + / − no lugar das setinhas do navegador.
interface Props {
  value: number | "";
  onChange: (value: number | "") => void;
  /** Chamado ao sair do campo, apertar Enter ou clicar nas setas (para salvar na hora). */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  placeholder?: string;
  required?: boolean;
  className?: string; // classes do <input> (borda, padding, fundo)
}

export default function NumberInput({
  value, onChange, onCommit, min, max, step = 1, suffix, placeholder, required, className = "",
}: Props) {
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

  const bump = (dir: 1 | -1) => {
    const next = clamp((value === "" ? min ?? 0 : value) + dir * step);
    onChange(next);
    onCommit?.(next);
  };

  const commit = () => {
    if (value === "") return;
    const fixed = clamp(value);
    if (fixed !== value) onChange(fixed);
    onCommit?.(fixed);
  };

  return (
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        // O "step" só vale para as setas; o navegador aceita qualquer número inteiro digitado
        step={1}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        }}
        className={`${className} ${suffix ? "pr-16" : "pr-11"}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 text-xs text-gray-500">{suffix}</span>
      )}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-md border border-purple-500/40 bg-purple-500/10">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Aumentar"
          onClick={() => bump(1)}
          className="flex h-[15px] w-6 items-center justify-center text-purple-300 hover:bg-purple-500/40 hover:text-white transition-colors"
        >
          <ChevronUp className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
        <div className="h-px bg-purple-500/40" />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Diminuir"
          onClick={() => bump(-1)}
          className="flex h-[15px] w-6 items-center justify-center text-purple-300 hover:bg-purple-500/40 hover:text-white transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
