"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { avatarFor } from "@/lib/daily";
import { useDialog } from "@/components/ui/Dialog";

interface Winner {
  id: string;
  giveaway_id: string | null;
  twitch_username: string;
  prize: string;
  avatar_url: string | null;
  won_at: string;
}

interface Props {
  refreshKey: number;
  canReopen: boolean; // só dá para reabrir quando não há outro sorteio diário aberto
  onReopened: () => void;
}

// Ganhadores do sorteio diário nos últimos 30 dias, com opção de excluir
export default function DailyHistory({ refreshKey, canReopen, onReopened }: Props) {
  const [winners, setWinners] = useState<Winner[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const dialog = useDialog();

  const load = () =>
    adminApi<{ data: Winner[] }>("listDailyWinners")
      .then(({ data }) => setWinners(data))
      .catch(() => setWinners([]));

  useEffect(() => {
    load();
  }, [refreshKey]);

  const remove = async (winner: Winner, reopen: boolean) => {
    const ok = await dialog.confirm(
      reopen
        ? {
            title: `Excluir @${winner.twitch_username} e voltar ao sorteio?`,
            message: `O sorteio "${winner.prize}" reabre com a mesma lista de participantes para você sortear de novo. A captação volta pausada.`,
            confirmText: "Excluir e reabrir",
            tone: "warning",
          }
        : {
            title: `Excluir @${winner.twitch_username}?`,
            message: `O ganhador e o sorteio "${winner.prize}" são apagados, junto com a lista de participantes. Some também da página Sorteio Diário. Não dá para desfazer.`,
            confirmText: "Excluir",
            tone: "danger",
          }
    );
    if (!ok) return;

    setBusyId(winner.id);
    try {
      const res = await adminApi<{ reopened: boolean }>("deleteWinner", { id: winner.id, reopen });
      setWinners((prev) => prev?.filter((w) => w.id !== winner.id) ?? null);
      if (res.reopened) onReopened();
    } catch (err) {
      dialog.error(err, "Não foi possível excluir");
    }
    setBusyId(null);
  };

  return (
    <div className="glass-panel rounded-xl border border-gray-800 p-6">
      <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
        <History className="w-5 h-5 text-purple-500" /> Histórico do Sorteio Diário
      </h2>
      <p className="text-xs text-gray-500 mb-5">Últimos 30 dias. É o mesmo histórico que aparece na página pública.</p>

      {winners === null ? (
        <div className="flex justify-center py-6"><div className="uiverse-loader"></div></div>
      ) : winners.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">Nenhum ganhador ainda.</p>
      ) : (
        <div className="space-y-2">
          {winners.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-black/40 p-3">
              <img src={avatarFor(w.twitch_username, w.avatar_url)} alt="" className="w-10 h-10 rounded-full border border-gray-700 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white truncate">@{w.twitch_username}</p>
                <p className="text-xs text-gray-400 truncate">
                  {w.prize} · {new Date(w.won_at).toLocaleDateString("pt-BR")} às{" "}
                  {new Date(w.won_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex gap-2">
                {canReopen && w.giveaway_id && (
                  <button
                    onClick={() => remove(w, true)}
                    disabled={busyId === w.id}
                    title="Exclui este ganhador e reabre o sorteio com a mesma lista para sortear de novo"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Excluir e voltar ao sorteio
                  </button>
                )}
                <button
                  onClick={() => remove(w, false)}
                  disabled={busyId === w.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
