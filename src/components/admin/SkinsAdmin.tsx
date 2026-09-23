"use client";

import { useEffect, useState } from "react";
import { Crosshair, Edit, Plus, Trash2, X, CheckCircle2, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { adminApi } from "@/lib/adminApi";
import { uploadGiveawayImage } from "@/lib/image";
import { useDialog } from "@/components/ui/Dialog";
import SkinCard, { type Skin } from "@/components/SkinCard";

const WEARS = ["Factory New", "Minimal Wear", "Field-Tested", "Well-Worn", "Battle-Scarred"];

const emptyForm = { name: "", wear: "Factory New", tag: "", float_value: "", price: "", buy_url: "", status: "available" };

const inputClass = "w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors";
const labelClass = "text-xs font-bold text-gray-400 uppercase tracking-widest";

// Aba "Skins" do painel: lista, cria e edita as skins da loja com prévia do card
export default function SkinsAdmin() {
  const dialog = useDialog();
  const [skins, setSkins] = useState<Skin[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("skins").select("*").order("created_at", { ascending: false });
    setSkins((data ?? []) as Skin[]);
  };

  useEffect(() => {
    load();
  }, []);

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const openNew = () => {
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setImageChanged(false);
    setEditingId(null);
    setIsOpen(true);
  };

  const openEdit = (skin: Skin) => {
    setForm({
      name: skin.name || "",
      wear: skin.wear || "",
      tag: skin.tag || "",
      float_value: skin.float_value || "",
      price: skin.price || "",
      buy_url: skin.buy_url || "",
      status: skin.status || "available",
    });
    setImageFile(null);
    setImagePreview(skin.image_url || null);
    setImageChanged(false);
    setEditingId(skin.id || null);
    setIsOpen(true);
  };

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    setImageFile(file);
    setImageChanged(true);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      dialog.alert({ title: "Falta o nome da skin", message: "Ex: Bayonet | Forest DDPAT", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const fields: Record<string, unknown> = { ...form };
      if (imageChanged) fields.image_url = imageFile ? await uploadGiveawayImage(imageFile) : null;
      await adminApi("saveSkin", { id: editingId, fields });
      setIsOpen(false);
      load();
    } catch (err) {
      dialog.error(err, "Não foi possível salvar a skin");
    }
    setSaving(false);
  };

  const toggleSold = async (skin: Skin) => {
    const status = skin.status === "sold" ? "available" : "sold";
    setSkins((prev) => prev.map((s) => (s.id === skin.id ? { ...s, status } : s)));
    try {
      await adminApi("saveSkin", { id: skin.id, fields: { status } });
    } catch (err) {
      dialog.error(err);
      load();
    }
  };

  const remove = async (skin: Skin) => {
    const ok = await dialog.confirm({
      title: `Excluir "${skin.name}"?`,
      message: "A skin sai da loja. Não dá para desfazer.",
      confirmText: "Excluir skin",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await adminApi("deleteSkin", { id: skin.id });
      setSkins((prev) => prev.filter((s) => s.id !== skin.id));
    } catch (err) {
      dialog.error(err);
    }
  };

  const previewSkin: Skin = { ...form, image_url: imagePreview };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Skins à Venda</h1>
          <p className="text-gray-400">Cadastre as skins que aparecem na página SKINS do site.</p>
        </div>
        <button onClick={openNew} className="btn-neon px-6 py-3 flex items-center gap-2">
          <Plus className="w-5 h-5" /> Nova Skin
        </button>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm text-gray-400">
            <thead className="bg-purple-900/20 text-xs uppercase text-gray-300 border-b border-purple-900/50">
              <tr>
                <th className="px-6 py-4">Skin</th>
                <th className="px-6 py-4">Float</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {skins.map((skin) => (
                <tr key={skin.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-10 rounded bg-black/50 flex items-center justify-center overflow-hidden">
                        {skin.image_url ? (
                          <img src={skin.image_url} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <Crosshair className="w-5 h-5 text-gray-700" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-white">{skin.name}</p>
                        <p className="text-xs text-gray-500">{skin.wear}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 tabular-nums">{skin.float_value || "—"}</td>
                  <td className="px-6 py-3 font-bold text-purple-400">{skin.price ? `R$ ${skin.price}` : "—"}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${skin.status === "sold" ? "bg-red-500/10 text-red-400 border border-red-500/30" : "bg-green-500/20 text-green-400 border border-green-500/30"}`}>
                      {skin.status === "sold" ? "Vendida" : "À venda"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleSold(skin)}
                        title={skin.status === "sold" ? "Voltar para à venda" : "Marcar como vendida"}
                        className={`p-2 rounded transition-colors ${skin.status === "sold" ? "bg-green-500/10 hover:bg-green-500/20 text-green-400" : "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400"}`}
                      >
                        {skin.status === "sold" ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(skin)} title="Editar" className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(skin)} title="Excluir" className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {skins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">Nenhuma skin cadastrada ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Criar / editar com prévia do card */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-[#121214] border-0 md:border border-gray-800 rounded-none md:rounded-2xl w-full max-w-5xl shadow-2xl relative my-0 md:my-12 overflow-hidden flex flex-col md:flex-row min-h-screen md:min-h-0">
            <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 md:top-6 md:right-6 text-gray-400 hover:text-white z-20 bg-black/50 md:bg-transparent rounded-full p-2 md:p-0">
              <X className="w-6 h-6" />
            </button>

            <form onSubmit={save} className="p-6 md:p-8 md:w-[55%] space-y-5 pt-16 md:pt-8">
              <h2 className="text-2xl font-black text-white uppercase tracking-wider">{editingId ? "Editar Skin" : "Nova Skin"}</h2>

              <div className="space-y-2">
                <label className={labelClass}>Nome da skin</label>
                <input value={form.name} onChange={set("name")} className={inputClass} placeholder="Ex: Bayonet | Forest DDPAT" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelClass}>Desgaste</label>
                  <select value={form.wear} onChange={set("wear")} className={inputClass}>
                    <option value="">Sem desgaste</option>
                    {WEARS.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Etiqueta (opcional)</label>
                  <input value={form.tag} onChange={set("tag")} className={inputClass} placeholder="Ex: CSGO-SKINS" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelClass}>Float</label>
                  <input value={form.float_value} onChange={set("float_value")} className={inputClass} placeholder="Ex: 0.0712" inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Valor (R$)</label>
                  <input value={form.price} onChange={set("price")} className={inputClass} placeholder="Ex: 1.364,35" />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Link para comprar</label>
                <input value={form.buy_url} onChange={set("buy_url")} className={inputClass} placeholder="WhatsApp, Steam, Instagram..." type="url" />
                <p className="text-[11px] text-gray-500">O botão Comprar do card abre este link. Ex: https://wa.me/5511999999999</p>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Imagem da skin</label>
                <div className="relative w-full border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl bg-[#0a0a0b] transition-colors overflow-hidden">
                  <input type="file" accept="image/*" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="p-6 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                    {imageFile ? imageFile.name : imagePreview ? "Clique para trocar a imagem" : "Escolher imagem (PNG sem fundo fica melhor)"}
                  </div>
                </div>
                {imagePreview && (
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setImageChanged(true); }} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300">
                    Remover imagem
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Status</label>
                <select value={form.status} onChange={set("status")} className={inputClass}>
                  <option value="available">À venda</option>
                  <option value="sold">Vendida</option>
                </select>
              </div>

              <button type="submit" disabled={saving} className="w-full btn-neon py-4 text-sm disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar Skin"}
              </button>
            </form>

            <div className="md:w-[45%] bg-[#080809] border-t md:border-t-0 md:border-l border-gray-800 p-6 md:p-8 flex flex-col items-center justify-center">
              <h3 className="text-gray-500 font-bold text-xs tracking-widest uppercase mb-6">Prévia do card</h3>
              <div className="w-full max-w-[320px]">
                <SkinCard skin={previewSkin} preview />
              </div>
              <p className="text-gray-600 text-[10px] uppercase font-bold text-center mt-6">É assim que a skin aparece na página SKINS.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
