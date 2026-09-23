"use client";

import { useState } from "react";
import { Edit, ImagePlus, X } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { uploadGiveawayImage } from "@/lib/image";
import { useDialog } from "@/components/ui/Dialog";

type Winner = { id: string; prize: string; image_url?: string | null };

// Imagem e texto do prêmio que aparecem no Hall da Fama, editáveis na própria linha
export default function WinnerPrizeEditor({ winner, onChange }: {
  winner: Winner;
  onChange: (id: string, fields: Partial<Winner>) => void;
}) {
  const dialog = useDialog();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);

  const savePrize = async () => {
    const prize = draft.trim();
    if (!prize || prize === winner.prize) { setEditing(false); return; }
    try {
      await adminApi("updateWinner", { id: winner.id, prize });
      onChange(winner.id, { prize });
      setEditing(false);
    } catch (err) {
      dialog.error(err);
    }
  };

  const changeImage = async (file: File | null) => {
    setUploading(true);
    try {
      const imageUrl = file ? await uploadGiveawayImage(file) : null;
      await adminApi("updateWinner", { id: winner.id, imageUrl });
      onChange(winner.id, { image_url: imageUrl });
    } catch (err) {
      dialog.error(err, "Não foi possível enviar a imagem");
    }
    setUploading(false);
  };

  return (
    <div className="flex items-center gap-3">
      <label
        title={winner.image_url ? "Trocar imagem" : "Adicionar imagem"}
        className="relative shrink-0 w-12 h-12 rounded-lg border border-dashed border-purple-500/40 bg-black/40 hover:border-purple-400 cursor-pointer overflow-hidden flex items-center justify-center"
      >
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) changeImage(f); e.target.value = ""; }}
        />
        {uploading ? (
          <div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
        ) : winner.image_url ? (
          <img src={winner.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImagePlus className="w-5 h-5 text-purple-400" />
        )}
      </label>

      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") savePrize(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 min-w-0 bg-black border border-purple-500/50 rounded px-2 py-1 text-white outline-none focus:border-purple-400"
          />
          <button onClick={savePrize} className="px-2 py-1 rounded text-xs font-bold bg-green-600 hover:bg-green-500 text-white">Salvar</button>
          <button onClick={() => setEditing(false)} className="px-2 py-1 rounded text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white">Cancelar</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-purple-400 font-bold truncate">{winner.prize}</span>
          <button
            onClick={() => { setDraft(winner.prize); setEditing(true); }}
            title="Editar texto do prêmio"
            className="shrink-0 p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          {winner.image_url && (
            <button
              onClick={() => changeImage(null)}
              title="Remover imagem"
              className="shrink-0 p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
