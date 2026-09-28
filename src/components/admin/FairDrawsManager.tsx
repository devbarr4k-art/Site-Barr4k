"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, ShieldCheck, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { FAIR_KIND_LABEL, type FairDraw, type FairKind } from "@/lib/fair";
import { useDialog } from "@/components/ui/Dialog";

type Row = Pick<FairDraw, "id" | "kind" | "target_id" | "title" | "total_weight" | "drand_round" | "winner_label" | "winner_username" | "status" | "created_at">;

const STATUS: Record<FairDraw["status"], { label: string; cls: string }> = {
  waiting: { label: "Aguardando número", cls: "bg-gray-800 text-gray-300 border-gray-700" },
  drawn: { label: "Sorteado", cls: "bg-purple-500/15 text-purple-300 border-purple-500/40" },
  confirmed: { label: "Confirmado", cls: "bg-green-500/15 text-green-300 border-green-500/40" },
  skipped: { label: "Descartado", cls: "bg-red-500/10 text-red-300 border-red-500/30" },
};

const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Registro público dos giros (página /provably-fair). Daqui o operador apaga o que não quer mostrar.
export default function FairDrawsManager() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<FairKind | "">("");
  const [status, setStatus] = useState<FairDraw["status"] | "">("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const dialog = useDialog();

  const load = useCallback(async () => {
    try {
      const res = await adminApi<{ data: Row[] }>("listFairDraws");
      setRows(res.data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
      setRows([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(
    () => (rows ?? []).filter((r) => (!kind || r.kind === kind) && (!status || r.status === status)),
    [rows, kind, status]
  );

  const remove = async (ids: string[]) => {
    const list = (rows ?? []).filter((r) => ids.includes(r.id));
    if (list.length === 0) return;
    const confirmed = list.filter((r) => r.status === "confirmed").length;
    const ok = await dialog.confirm({
      title: list.length === 1 ? `Excluir o giro de "${list[0].title}"?` : `Excluir ${list.length} giros?`,
      message:
        "Some da página pública de provably fair e ninguém consegue mais conferir este sorteio. Não dá para desfazer." +
        (confirmed ? ` ${confirmed === 1 ? "Este giro tem ganhador confirmado" : `${confirmed} deles têm ganhador confirmado`}: o ganhador continua em Vencedores, só a prova é apagada.` : ""),
      confirmText: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await adminApi("deleteFairDraws", { ids });
      setRows((prev) => (prev ?? []).filter((r) => !ids.includes(r.id)));
      setSelected(new Set());
    } catch (err) {
      dialog.error(err, "Não foi possível excluir");
    }
    setBusy(false);
  };

  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Provably Fair</h1>
          <p className="text-gray-400">Todos os giros dos sorteios, como aparecem no site. Exclua testes ou giros que não quer mostrar.</p>
        </div>
        <a href="/provably-fair" target="_blank" className="px-4 py-3 rounded-lg border border-gray-700 text-gray-300 hover:text-white text-sm font-bold flex items-center gap-2 shrink-0">
          <ExternalLink className="w-4 h-4" /> Ver no site
        </a>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as FairKind | "")} className="bg-[#121214] border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200">
              <option value="">Todos os tipos</option>
              {(Object.keys(FAIR_KIND_LABEL) as FairKind[]).map((k) => <option key={k} value={k}>{FAIR_KIND_LABEL[k]}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as FairDraw["status"] | "")} className="bg-[#121214] border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200">
              <option value="">Todos os status</option>
              {(Object.keys(STATUS) as FairDraw["status"][]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
            <div className="flex-1" />
            {selected.size > 0 && (
              <button onClick={() => remove([...selected])} disabled={busy}
                className="px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> Excluir selecionados ({selected.size})
              </button>
            )}
          </div>

          {!rows ? (
            <div className="flex justify-center py-16"><div className="uiverse-loader" /></div>
          ) : shown.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-[#121214] p-10 text-center text-gray-400">
              <ShieldCheck className="w-8 h-8 text-purple-500 mx-auto mb-3" /> Nenhum giro por aqui.
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-[#121214] overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm text-gray-400">
                <thead className="text-xs uppercase tracking-widest text-gray-500 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Selecionar todos" /></th>
                    <th className="px-4 py-3">Sorteio</th>
                    <th className="px-4 py-3">Ganhador</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/70">
                  {shown.map((r) => (
                    <tr key={r.id} className={selected.has(r.id) ? "bg-purple-500/5" : ""}>
                      <td className="px-4 py-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Selecionar" /></td>
                      <td className="px-4 py-3">
                        <p className="text-white font-bold truncate max-w-[280px]">{r.title}</p>
                        <p className="text-xs text-gray-500">{FAIR_KIND_LABEL[r.kind]} · {when(r.created_at)} · {r.total_weight} {r.total_weight === 1 ? "chance" : "chances"}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-200 font-bold">
                        {r.winner_username ? (r.kind === "rifa" ? `Nº ${r.winner_label} · @${r.winner_username}` : `@${r.winner_username}`) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <a href={`/provably-fair?id=${r.id}`} target="_blank" title="Ver prova" className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-300"><ExternalLink className="w-4 h-4" /></a>
                          <button onClick={() => remove([r.id])} disabled={busy} title="Excluir" className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
