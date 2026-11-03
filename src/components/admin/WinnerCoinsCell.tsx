"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useDialog } from "@/components/ui/Dialog";

// Coins de uma vitória, editável na própria linha (salva ao sair do campo ou com Enter)
export default function WinnerCoinsCell({ id, coins, onSaved }: { id: string; coins: number; onSaved: (coins: number) => void }) {
  const dialog = useDialog();
  const [value, setValue] = useState(String(coins));
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(String(coins)), [coins]);

  const commit = async () => {
    const next = Math.floor(Number(value));
    if (value === String(coins)) return;
    if (!Number.isFinite(next) || next < 0 || value === "") {
      setValue(String(coins));
      return;
    }
    setBusy(true);
    try {
      await adminApi("setWinnerCoins", { id, coins: next });
      onSaved(next);
    } catch (err) {
      setValue(String(coins));
      dialog.error(err, "Não foi possível salvar as coins");
    }
    setBusy(false);
  };

  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-black/40 px-2 py-1 focus-within:border-purple-500">
      <Coins className="w-3.5 h-3.5 text-yellow-400" />
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-20 bg-transparent text-white text-right font-bold outline-none disabled:opacity-50"
        aria-label="Coins desta vitória"
      />
    </label>
  );
}
