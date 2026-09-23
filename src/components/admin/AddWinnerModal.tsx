"use client";

import { useState } from "react";
import { ImagePlus, Trophy, X } from "lucide-react";
import { FaTwitch } from "react-icons/fa";
import { adminApi } from "@/lib/adminApi";
import { uploadGiveawayImage } from "@/lib/image";
import { useDialog } from "@/components/ui/Dialog";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Lança um vencedor à mão (sorteio feito fora do site, prêmio extra etc.)
export default function AddWinnerModal({ onClose, onAdded }: {
  onClose: () => void;
  onAdded: (winner: any) => void;
}) {
  const dialog = useDialog();
  const [nick, setNick] = useState("");
  const [prize, setPrize] = useState("");
  const [date, setDate] = useState(today);
  const [inHall, setInHall] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nick.trim() || !prize.trim()) {
      dialog.alert({ title: "Faltam dados", message: "Preencha o nick da Twitch e o prêmio.", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const imageUrl = file ? await uploadGiveawayImage(file) : null;
      // Meio-dia no horário local: a data não "volta um dia" por causa do fuso
      const wonAt = new Date(`${date}T12:00:00`).toISOString();
      const res = await adminApi<{ data: any }>("addWinnerManual", { twitchUsername: nick, prize, wonAt, imageUrl, inHall });
      onAdded(res.data);
      onClose();
    } catch (err) {
      dialog.error(err, "Não foi possível adicionar o vencedor");
    }
    setSaving(false);
  };

  const inputClass = "w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <form onSubmit={save} noValidate className="relative w-full max-w-lg my-auto rounded-2xl border border-purple-500/40 bg-[#121214] p-6 sm:p-8 space-y-5 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-title text-2xl text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" /> Adicionar vencedor
        </h2>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nick da Twitch</label>
          <div className="relative">
            <FaTwitch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
            <input autoFocus value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Ex: zezinho" className={`${inputClass} pl-11`} />
          </div>
          <p className="text-[11px] text-gray-500">A foto de perfil da Twitch aparece sozinha.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Prêmio</label>
          <input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Ex: AK-47 Redline" className={inputClass} />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Data do sorteio</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Foto do prêmio (opcional)</label>
          <p className="text-[11px] text-gray-500">Tamanho ideal: <span className="text-purple-400 font-bold not-italic">1200 × 800 px</span> (a mesma arte do sorteio serve).</p>
          <label className="relative flex items-center gap-4 p-3 border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl bg-[#0a0a0b] cursor-pointer transition-colors">
            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ""; }} />
            {preview ? (
              <img src={preview} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-800" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-black border border-gray-800 flex items-center justify-center">
                <ImagePlus className="w-6 h-6 text-purple-400" />
              </div>
            )}
            <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">{preview ? "Clique para trocar" : "Escolher imagem"}</span>
          </label>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input type="checkbox" checked={inHall} onChange={(e) => setInHall(e.target.checked)} className="w-5 h-5 accent-purple-600" />
          <span className="text-sm text-gray-300 font-bold">Mostrar no Hall da Fama</span>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg font-bold text-sm text-gray-300 bg-white/5 hover:bg-white/10 border border-gray-800">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-neon px-6 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
            {saving ? "Salvando..." : "Adicionar vencedor"}
          </button>
        </div>
      </form>
    </div>
  );
}
