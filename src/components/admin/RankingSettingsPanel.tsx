"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, ExternalLink, Save } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { avatarFor } from "@/lib/daily";
import { buildRanking, DEFAULT_RANKING, RANKING_KIND_LABEL, type RankingKind, type RankingSettings, type RankingWinner } from "@/lib/ranking";
import { useDialog } from "@/components/ui/Dialog";

// Regras do ranking do Hall da Fama, com prévia ao vivo do que vai aparecer no site
export default function RankingSettingsPanel({ winners }: { winners: RankingWinner[] }) {
  const dialog = useDialog();
  const [settings, setSettings] = useState<RankingSettings | null>(null);
  const [saved, setSaved] = useState<RankingSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi<{ data: RankingSettings }>("getRankingSettings")
      .then((r) => { setSettings(r.data); setSaved(r.data); })
      .catch(() => { setSettings(DEFAULT_RANKING); setSaved(DEFAULT_RANKING); });
  }, []);

  const preview = useMemo(() => (settings ? buildRanking(winners, settings) : []), [winners, settings]);
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const r = await adminApi<{ data: RankingSettings }>("saveRankingSettings", { settings });
      setSettings(r.data);
      setSaved(r.data);
    } catch (err) {
      dialog.error(err, "Não foi possível salvar");
    }
    setSaving(false);
  };

  if (!settings) return <div className="flex justify-center py-16"><div className="uiverse-loader" /></div>;

  const set = (patch: Partial<RankingSettings>) => setSettings({ ...settings, ...patch });
  const toggleKind = (k: RankingKind) =>
    set({ kinds: settings.kinds.includes(k) ? settings.kinds.filter((x) => x !== k) : [...settings.kinds, k] });
  const option = (active: boolean) =>
    `px-4 py-2.5 rounded-lg border text-sm font-bold transition-colors ${active ? "bg-purple-600/25 border-purple-500 text-white" : "border-gray-700 text-gray-400 hover:text-white"}`;

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <div className="glass-panel rounded-xl border border-gray-800 p-6 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Período</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => set({ period: "all" })} className={option(settings.period === "all")}>Todos os tempos</button>
            <button onClick={() => set({ period: "month" })} className={option(settings.period === "month")}>Só o mês atual (zera todo mês)</button>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Quem fica em 1º</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => set({ order: "coins" })} className={option(settings.order === "coins")}>Mais coins</button>
            <button onClick={() => set({ order: "wins" })} className={option(settings.order === "wins")}>Mais vitórias</button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Em caso de empate, o outro número desempata.</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Contam no ranking</p>
          <div className="space-y-2">
            {(Object.keys(RANKING_KIND_LABEL) as RankingKind[]).map((k) => (
              <label key={k} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.kinds.includes(k)} onChange={() => toggleKind(k)} className="w-5 h-5 accent-purple-600" />
                <span className="text-gray-200 text-sm">{RANKING_KIND_LABEL[k]}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Quantos aparecem no site</p>
          <input type="number" min={3} max={100} value={settings.limit}
            onChange={(e) => set({ limit: Number(e.target.value) || 3 })}
            className="w-28 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 outline-none" />
          <p className="text-xs text-gray-500 mt-2">Os 3 primeiros vão para o pódio; o resto, para a lista embaixo.</p>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={save} disabled={!dirty || saving} className="btn-neon px-6 py-3 rounded-lg font-bold flex items-center gap-2 disabled:opacity-40">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : dirty ? "Salvar regras" : "Salvo"}
          </button>
          <a href="/hall-da-fama" target="_blank" className="px-4 py-3 rounded-lg border border-gray-700 text-gray-300 hover:text-white text-sm font-bold flex items-center gap-2">
            <ExternalLink className="w-4 h-4" /> Ver no site
          </a>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-gray-800 overflow-hidden">
        <p className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-800">
          Prévia {dirty && <span className="text-yellow-300 normal-case tracking-normal">· ainda não salvo</span>}
        </p>
        {preview.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">Ninguém no ranking com essas regras.</p>
        ) : (
          preview.map((r, i) => (
            <div key={r.username} className="flex items-center gap-3 px-5 py-3 border-b border-gray-800/70 last:border-0">
              <span className={`w-7 text-center font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"}`}>{i + 1}</span>
              <img src={avatarFor(r.username, r.avatar_url)} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700" />
              <span className="flex-1 min-w-0 text-white font-bold truncate">@{r.username}</span>
              <span className="text-gray-300 text-sm">{r.wins} {r.wins === 1 ? "vitória" : "vitórias"}</span>
              <span className="w-24 text-right text-yellow-400 font-black text-sm flex items-center justify-end gap-1"><Coins className="w-3.5 h-3.5" />{r.coins.toLocaleString("pt-BR")}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
