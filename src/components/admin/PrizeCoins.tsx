"use client";

import { useMemo, useState } from "react";
import { Coins, Save } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useDialog } from "@/components/ui/Dialog";
import Pagination, { usePagination } from "@/components/ui/Pagination";

type Winner = { id: string; prize: string; coins?: number | null };

// Valor em coins de cada prêmio: o operador digita uma vez e vale para todas as vitórias
// com aquele prêmio. Vencedor novo com o mesmo prêmio já entra com esse valor.
export default function PrizeCoins({ winners, onChanged }: {
  winners: Winner[];
  onChanged: (prize: string, coins: number) => void;
}) {
  const dialog = useDialog();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const prizes = useMemo(() => {
    const map = new Map<string, { prize: string; count: number; values: Set<number> }>();
    for (const w of winners) {
      const p = map.get(w.prize) ?? { prize: w.prize, count: 0, values: new Set<number>() };
      p.count++;
      p.values.add(Number(w.coins) || 0);
      map.set(w.prize, p);
    }
    // Sem valor primeiro (o que falta preencher), depois os mais frequentes
    return [...map.values()].sort((a, b) => {
      const ea = a.values.size === 1 && a.values.has(0) ? 0 : 1;
      const eb = b.values.size === 1 && b.values.has(0) ? 0 : 1;
      return ea - eb || b.count - a.count;
    });
  }, [winners]);
  const page = usePagination(prizes);
  const missing = prizes.filter((p) => p.values.size === 1 && p.values.has(0)).length;

  const save = async (prize: string) => {
    const coins = Math.floor(Number(draft[prize]));
    if (!Number.isFinite(coins) || coins < 0 || draft[prize] === "" || draft[prize] === undefined) {
      dialog.alert({ title: "Valor inválido", message: "Digite quantas coins vale este prêmio (0 ou mais).", tone: "warning" });
      return;
    }
    setSaving(prize);
    try {
      await adminApi("setPrizeCoins", { prize, coins });
      onChanged(prize, coins);
      setDraft((d) => {
        const next = { ...d };
        delete next[prize];
        return next;
      });
    } catch (err) {
      dialog.error(err, "Não foi possível salvar");
    }
    setSaving(null);
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl border border-gray-800 p-5 text-sm text-gray-400">
        Digite quanto vale cada prêmio em <b className="text-yellow-400">coins</b>. O valor vale para todas as vitórias com esse prêmio e para as
        próximas também. É o que soma no ranking do Hall da Fama. Para mudar só uma vitória, edite a coluna Coins na sub-aba Vencedores.
        {missing > 0 && <p className="mt-2 text-yellow-300 font-bold">{missing} prêmio(s) ainda sem valor.</p>}
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm text-gray-400">
            <thead className="bg-purple-900/20 text-xs uppercase text-gray-300 border-b border-purple-900/50">
              <tr>
                <th className="px-6 py-4">Prêmio</th>
                <th className="px-6 py-4 text-center">Vitórias</th>
                <th className="px-6 py-4">Valor atual</th>
                <th className="px-6 py-4 text-right">Novo valor</th>
              </tr>
            </thead>
            <tbody>
              {page.pageItems.map((p) => {
                const values = [...p.values];
                const current = values.length === 1 ? values[0] : null;
                return (
                  <tr key={p.prize} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-white font-bold max-w-[320px] truncate">{p.prize}</td>
                    <td className="px-6 py-4 text-center">{p.count}</td>
                    <td className="px-6 py-4">
                      {current === null ? (
                        <span className="text-orange-300 text-xs font-bold">valores diferentes ({values.sort((a, b) => a - b).join(", ")})</span>
                      ) : current === 0 ? (
                        <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">sem valor</span>
                      ) : (
                        <span className="text-yellow-400 font-black flex items-center gap-1"><Coins className="w-4 h-4" />{current.toLocaleString("pt-BR")}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={draft[p.prize] ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, [p.prize]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") save(p.prize); }}
                          placeholder={current ? String(current) : "coins"}
                          className="w-28 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-right focus:border-purple-500 outline-none"
                        />
                        <button onClick={() => save(p.prize)} disabled={saving === p.prize || !draft[p.prize]}
                          title={`Aplicar às ${p.count} vitória(s)`}
                          className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40">
                          <Save className="w-3.5 h-3.5" /> Salvar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {prizes.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">Nenhum vencedor ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...page} className="px-6 pb-4" />
      </div>
    </div>
  );
}
