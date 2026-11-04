"use client";

import { useState } from "react";
import { Edit } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { avatarFor } from "@/lib/daily";
import { useDialog } from "@/components/ui/Dialog";

type Winner = { id: string; twitch_username: string; avatar_url?: string | null };

// Nick do vencedor, editável na própria linha (ex.: lançado com o nome errado)
export default function WinnerNameEditor({ winner, onChange }: {
  winner: Winner;
  onChange: (id: string, fields: Partial<Winner>) => void;
}) {
  const dialog = useDialog();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const username = draft.trim().replace(/^@/, "").toLowerCase();
    if (!username || username === winner.twitch_username) { setEditing(false); return; }
    const ok = await dialog.confirm({
      title: `Trocar @${winner.twitch_username} por @${username}?`,
      message: "A vitória (e as coins dela) passa a contar para o novo nick no Hall da Fama e em Últimos Vencedores. A prova do provably fair continua mostrando quem foi sorteado na hora.",
      confirmText: "Trocar vencedor",
      tone: "warning",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await adminApi<{ avatar_url?: string | null }>("updateWinner", { id: winner.id, twitchUsername: username });
      onChange(winner.id, { twitch_username: username, avatar_url: res.avatar_url ?? null });
      setEditing(false);
    } catch (err) {
      dialog.error(err, "Não foi possível trocar o vencedor");
    }
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-3">
      <img src={avatarFor(winner.twitch_username, winner.avatar_url)} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700 shrink-0" />
      {editing ? (
        <div className="flex items-center gap-2">
          <span className="text-gray-500">@</span>
          <input
            autoFocus
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="w-36 bg-black border border-purple-500/50 rounded px-2 py-1 text-white outline-none focus:border-purple-400"
          />
          <button onClick={save} disabled={saving} className="px-2 py-1 rounded text-xs font-bold bg-green-600 hover:bg-green-500 text-white disabled:opacity-50">Salvar</button>
          <button onClick={() => setEditing(false)} className="px-2 py-1 rounded text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white">Cancelar</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-white truncate">@{winner.twitch_username}</span>
          <button onClick={() => { setDraft(winner.twitch_username); setEditing(true); }} title="Trocar vencedor"
            className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 shrink-0">
            <Edit className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
