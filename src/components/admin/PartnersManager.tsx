"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Edit, ExternalLink, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { adminApi } from "@/lib/adminApi";
import { uploadGiveawayImage } from "@/lib/image";
import { useDialog } from "@/components/ui/Dialog";
import { PARTNER_IMAGE_SIZE, type Partner } from "@/lib/partners";

type Draft = { id?: string; name: string; link_url: string; image_url: string; file: File | null; preview: string | null };
const emptyDraft: Draft = { name: "", link_url: "", image_url: "", file: null, preview: null };

// Cards da seção "Nossos Parceiros" da home: adicionar, editar, reordenar e excluir
export default function PartnersManager() {
  const dialog = useDialog();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("partners").select("*").order("sort_order").order("created_at");
    setMissingTable(!!error);
    setPartners(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => setDraft({ ...emptyDraft });
  const openEdit = (p: Partner) =>
    setDraft({ id: p.id, name: p.name, link_url: p.link_url, image_url: p.image_url, file: null, preview: p.image_url });

  const pickImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setDraft((d) => d && { ...d, file, preview: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.name.trim() || !draft.link_url.trim() || !draft.preview) {
      dialog.alert({ title: "Faltam dados", message: "Preencha o nome, o link e escolha a imagem do banner.", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const imageUrl = draft.file ? await uploadGiveawayImage(draft.file) : draft.image_url;
      await adminApi("savePartner", { id: draft.id, name: draft.name, linkUrl: draft.link_url, imageUrl });
      setDraft(null);
      await load();
    } catch (err) {
      dialog.error(err, "Não foi possível salvar o parceiro");
    }
    setSaving(false);
  };

  const remove = async (p: Partner) => {
    const ok = await dialog.confirm({
      title: `Excluir o parceiro "${p.name}"?`,
      message: "O card sai da página inicial na hora. Dá para adicionar de novo depois.",
      confirmText: "Excluir parceiro",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await adminApi("deletePartner", { id: p.id });
      setPartners((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      dialog.error(err);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= partners.length) return;
    const next = [...partners];
    [next[index], next[target]] = [next[target], next[index]];
    setPartners(next);
    try {
      await adminApi("reorderPartners", { ids: next.map((p) => p.id) });
    } catch (err) {
      dialog.error(err);
      load();
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Parceiros</h1>
          <p className="text-gray-400">Os cards da seção &quot;Nossos Parceiros&quot; na página inicial. A ordem aqui é a ordem do site.</p>
        </div>
        {!missingTable && (
          <button onClick={openNew} className="btn-neon px-6 py-3 rounded-lg font-bold flex items-center gap-2 shrink-0">
            <Plus className="w-5 h-5" /> Novo Parceiro
          </button>
        )}
      </div>

      {missingTable ? (
        <div className="glass-panel rounded-xl border border-yellow-500/30 p-6 text-yellow-200">
          Para gerenciar os parceiros, rode o arquivo <b>supabase/migracao-usuarios-e-parceiros.sql</b> no SQL Editor do Supabase.
          Enquanto isso, o site continua mostrando os 3 parceiros de sempre.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><div className="uiverse-loader" /></div>
      ) : partners.length === 0 ? (
        <div className="glass-panel rounded-xl border border-gray-800 p-10 text-center text-gray-500">
          Nenhum parceiro. A seção de parceiros fica vazia na home até você adicionar um.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {partners.map((p, i) => (
            <div key={p.id} className="glass-panel rounded-xl border border-purple-500/20 overflow-hidden flex flex-col">
              <div className="h-56 bg-[#0a0a0c] flex items-center justify-center relative">
                <img src={p.image_url} alt={p.name} className="w-full h-full object-contain p-3" />
                <span className="absolute top-3 left-3 w-7 h-7 rounded-full bg-black/70 border border-white/10 text-xs font-bold text-white flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3">
                <div className="min-w-0">
                  <p className="text-white font-bold truncate">{p.name}</p>
                  <a href={p.link_url} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1 min-w-0">
                    <span className="truncate">{p.link_url}</span> <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <button onClick={() => move(i, -1)} disabled={i === 0} title="Mover para a esquerda"
                    className="p-2 rounded bg-gray-800 text-gray-300 hover:text-white disabled:opacity-30">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === partners.length - 1} title="Mover para a direita"
                    className="p-2 rounded bg-gray-800 text-gray-300 hover:text-white disabled:opacity-30">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => openEdit(p)} title="Editar" className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(p)} title="Excluir" className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Popup de criar/editar parceiro */}
      {draft && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <form onSubmit={save} className="relative w-full max-w-lg my-auto rounded-2xl border border-purple-500/40 bg-[#121214] p-6 sm:p-8 space-y-5 shadow-2xl">
            <button type="button" onClick={() => setDraft(null)} aria-label="Fechar" className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-title text-2xl text-white">{draft.id ? "Editar parceiro" : "Novo parceiro"}</h2>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nome</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: CSGOROLL"
                className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Link de direcionamento</label>
              <input value={draft.link_url} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} placeholder="https://site-do-parceiro.com/r/BARR4K"
                className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Banner</label>
              <p className="text-[11px] text-gray-500 leading-snug">
                Tamanho ideal: <span className="text-purple-400 font-bold not-italic">{PARTNER_IMAGE_SIZE.size}</span> (JPG ou PNG). {PARTNER_IMAGE_SIZE.tip}
              </p>
              <label className="relative flex items-center gap-4 p-3 border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl bg-[#0a0a0b] cursor-pointer transition-colors">
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ""; }} />
                {draft.preview ? (
                  <img src={draft.preview} alt="" className="w-20 h-24 rounded-lg object-contain bg-black border border-gray-800" />
                ) : (
                  <div className="w-20 h-24 rounded-lg bg-black border border-gray-800 flex items-center justify-center">
                    <ImagePlus className="w-6 h-6 text-purple-400" />
                  </div>
                )}
                <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">
                  {draft.preview ? "Clique para trocar" : "Escolher imagem"}
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setDraft(null)}
                className="px-5 py-2.5 rounded-lg font-bold text-sm text-gray-300 bg-white/5 hover:bg-white/10 border border-gray-800">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="btn-neon px-6 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar parceiro"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
