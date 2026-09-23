"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Edit, Eye, GripVertical, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { FaYoutube } from "react-icons/fa";
import { supabase } from "@/lib/supabase";
import { adminApi } from "@/lib/adminApi";
import { uploadGiveawayImage } from "@/lib/image";
import { useDialog } from "@/components/ui/Dialog";
import { mostViewed, parseYouTubeId, timeAgo, videoUrl, type Video } from "@/lib/videos";

type Kind = "video" | "short";
type Draft = {
  id?: string;
  link: string;
  youtubeId: string;
  kind: Kind;
  title: string;
  duration: string;
  views: string;
  publishedAt: string;
  thumbnailUrl: string;
  thumbs: Record<Kind, string> | null; // capas automáticas do YouTube
  customFile: File | null;
  customPreview: string | null;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyDraft = (): Draft => ({
  link: "", youtubeId: "", kind: "video", title: "", duration: "", views: "", publishedAt: today(),
  thumbnailUrl: "", thumbs: null, customFile: null, customPreview: null,
});

// Vídeos e Shorts da seção "Vídeos Mais Acessados" da home. A lista abaixo é a prévia da
// ordem da home; arrastar grava sort_order (sem ordem = por visualizações).
export default function VideosManager() {
  const dialog = useDialog();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  // Cópias sempre atuais para o "soltar": o evento pode chegar antes da tela redesenhar
  const videosRef = useRef<Video[]>([]);
  const dragRef = useRef<string | null>(null);
  useEffect(() => { videosRef.current = videos; }, [videos]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false });
    setMissingTable(!!error);
    setVideos((data as Video[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Arrastando: o card vai para a posição de quem está embaixo do mouse (só entre o mesmo tipo)
  const moveOver = (over: Video) => {
    const dragId = dragRef.current;
    if (!dragId || dragId === over.id) return;
    // Calcula já (e não dentro do setState): o "soltar" pode chegar antes da tela redesenhar
    const prev = videosRef.current;
    const dragged = prev.find((v) => v.id === dragId);
    if (!dragged || dragged.kind !== over.kind) return;
    const list = mostViewed(prev, over.kind, Infinity).filter((v) => v.id !== dragId);
    list.splice(list.findIndex((v) => v.id === over.id), 0, dragged);
    const order = new Map(list.map((v, i) => [v.id, i + 1]));
    const next = prev.map((v) => (order.has(v.id) ? { ...v, sort_order: order.get(v.id)! } : v));
    videosRef.current = next;
    setVideos(next);
  };

  // Soltou: grava a ordem nova no banco
  const finishDrag = async () => {
    const id = dragRef.current;
    if (!id) return;
    dragRef.current = null;
    setDragId(null);
    const kind = videosRef.current.find((v) => v.id === id)?.kind;
    if (!kind) return;
    setSavingOrder(true);
    try {
      await adminApi("reorderVideos", { ids: mostViewed(videosRef.current, kind, Infinity).map((v) => v.id) });
    } catch (err) {
      dialog.error(err, "Não foi possível salvar a ordem");
      load();
    }
    setSavingOrder(false);
  };

  const resetOrder = async (kind: Kind) => {
    setSavingOrder(true);
    try {
      await adminApi("reorderVideos", { ids: videos.filter((v) => v.kind === kind).map((v) => v.id), reset: true });
      setVideos((prev) => prev.map((v) => (v.kind === kind ? { ...v, sort_order: null } : v)));
    } catch (err) {
      dialog.error(err);
    }
    setSavingOrder(false);
  };

  const openEdit = (v: Video) =>
    setDraft({
      id: v.id, link: videoUrl(v), youtubeId: v.youtube_id, kind: v.kind, title: v.title,
      duration: v.duration ?? "", views: v.views ?? "", publishedAt: v.published_at.slice(0, 10),
      thumbnailUrl: v.thumbnail_url, thumbs: null, customFile: null, customPreview: null,
    });

  // Busca título e capa no YouTube assim que o link é colado
  const fetchInfo = async (link: string, kind?: Kind) => {
    if (!parseYouTubeId(link)) return;
    setFetching(true);
    try {
      const info = await adminApi<{ youtubeId: string; title: string; kind: Kind; thumbnails: Record<Kind, string> }>(
        "youtubeInfo",
        { url: link, kind }
      );
      setDraft((d) => d && {
        ...d,
        youtubeId: info.youtubeId,
        kind: info.kind,
        title: d.title.trim() ? d.title : info.title,
        thumbs: info.thumbnails,
        thumbnailUrl: info.thumbnails[info.kind],
      });
    } catch (err) {
      dialog.error(err, "Não consegui buscar esse vídeo");
    }
    setFetching(false);
  };

  const setKind = (kind: Kind) =>
    setDraft((d) => d && { ...d, kind, thumbnailUrl: d.customPreview ? d.thumbnailUrl : d.thumbs?.[kind] ?? d.thumbnailUrl });

  const pickCustom = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setDraft((d) => d && { ...d, customFile: file, customPreview: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const youtubeId = draft.youtubeId || parseYouTubeId(draft.link) || "";
    if (!youtubeId || !draft.title.trim()) {
      dialog.alert({ title: "Faltam dados", message: "Cole o link do vídeo do YouTube e confira o título.", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const thumbnailUrl = draft.customFile
        ? await uploadGiveawayImage(draft.customFile)
        : draft.thumbnailUrl || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
      await adminApi("saveVideo", {
        id: draft.id, youtubeId, kind: draft.kind, title: draft.title, duration: draft.duration,
        views: draft.views, publishedAt: draft.publishedAt, thumbnailUrl,
      });
      setDraft(null);
      await load();
    } catch (err) {
      dialog.error(err, "Não foi possível salvar o vídeo");
    }
    setSaving(false);
  };

  const remove = async (v: Video) => {
    const ok = await dialog.confirm({
      title: `Excluir "${v.title}"?`,
      message: "Sai da página inicial na hora. O vídeo continua no YouTube.",
      confirmText: "Excluir vídeo",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await adminApi("deleteVideo", { id: v.id });
      setVideos((prev) => prev.filter((x) => x.id !== v.id));
    } catch (err) {
      dialog.error(err);
    }
  };

  const inputClass = "w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors";
  const preview = draft ? draft.customPreview || draft.thumbnailUrl : null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Vídeos</h1>
          <p className="text-gray-400">
            Seção &quot;Vídeos Mais Acessados&quot; da home, em carrossel. Sem ordem escolhida, vai do mais visto ao menos visto; arrastando os cards abaixo você define a ordem.
          </p>
        </div>
        {!missingTable && (
          <button onClick={() => setDraft(emptyDraft())} className="btn-neon px-6 py-3 rounded-lg font-bold flex items-center gap-2 shrink-0">
            <Plus className="w-5 h-5" /> Novo Vídeo
          </button>
        )}
      </div>

      {missingTable ? (
        <div className="glass-panel rounded-xl border border-yellow-500/30 p-6 text-yellow-200">
          Para cadastrar vídeos, rode o arquivo <b>supabase/migracao-videos.sql</b> no SQL Editor do Supabase.
          Enquanto isso, a seção de vídeos não aparece na home.
        </div>
      ) : (
        <>
          {loading ? (
            <div className="flex justify-center py-16"><div className="uiverse-loader" /></div>
          ) : videos.length === 0 ? (
            <div className="glass-panel rounded-xl border border-gray-800 p-10 text-center text-gray-500">
              Nenhum vídeo ainda. Clique em &quot;Novo Vídeo&quot; e cole o link do YouTube.
            </div>
          ) : (
            (["video", "short"] as const).map((kind) => {
              const list = mostViewed(videos, kind, Infinity);
              if (list.length === 0) return null;
              const manual = list.some((v) => v.sort_order != null);
              return (
                <div key={kind} className="glass-panel rounded-xl border border-gray-800 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="font-title text-xl text-white">{kind === "video" ? "Vídeos" : "Shorts"} <span className="text-gray-500 text-sm">({list.length})</span></h2>
                      <p className="text-xs text-gray-500">
                        Prévia da home, nesta ordem. Arraste os cards para mudar. {manual ? "Ordem escolhida por você." : "Ordem automática: mais visto primeiro."}
                      </p>
                    </div>
                    {manual && (
                      <button onClick={() => resetOrder(kind)} disabled={savingOrder}
                        className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest text-gray-300 border border-gray-700 hover:border-purple-500 disabled:opacity-50 shrink-0">
                        Ordenar por visualizações
                      </button>
                    )}
                  </div>
                  <div className={`grid gap-4 ${kind === "video" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"}`}>
                    {list.map((v, i) => (
                      <div
                        key={v.id}
                        draggable
                        onDragStart={(e) => { dragRef.current = v.id; setDragId(v.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragOver={(e) => { e.preventDefault(); moveOver(v); }}
                        onDrop={(e) => e.preventDefault()}
                        onDragEnd={finishDrag}
                        className={`group relative rounded-xl overflow-hidden border bg-[#0c0d10] cursor-grab active:cursor-grabbing transition-all ${dragId === v.id ? "opacity-40 border-purple-500" : "border-white/10 hover:border-purple-500/60"}`}
                      >
                        <div className={`relative overflow-hidden bg-black ${kind === "video" ? "aspect-video" : "aspect-[9/16]"}`}>
                          <img src={v.thumbnail_url} alt="" draggable={false} className="w-full h-full object-cover pointer-events-none" />
                          <span className="absolute top-2 left-2 w-7 h-7 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center not-italic shadow">{i + 1}</span>
                          <span className="absolute top-2 right-2 p-1 rounded bg-black/70 text-gray-300" title="Arraste para mudar a ordem"><GripVertical className="w-4 h-4" /></span>
                          {kind === "video" && v.duration && (
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-bold not-italic">{v.duration}</span>
                          )}
                          {kind === "short" && v.views && (
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/75 text-white text-[11px] font-bold flex items-center gap-1 not-italic"><Eye className="w-3 h-3" /> {v.views}</span>
                          )}
                        </div>
                        <div className="p-3 space-y-2">
                          <p className="text-white font-bold text-xs leading-snug line-clamp-2 min-h-[2.6em]">{v.title}</p>
                          {kind === "video" && (
                            <div className="flex items-center gap-3 text-[11px] text-gray-500">
                              {v.views && <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {v.views}</span>}
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(v.published_at)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <a href={videoUrl(v)} target="_blank" rel="noreferrer" title="Abrir no YouTube" className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400">
                              <FaYoutube className="w-3.5 h-3.5" />
                            </a>
                            <div className="flex-1" />
                            <button onClick={() => openEdit(v)} title="Editar" className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => remove(v)} title="Excluir" className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* Popup de criar/editar */}
      {draft && (
        <div className="fixed inset-0 z-[150] flex overflow-y-auto p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form onSubmit={save} noValidate className="relative m-auto w-full max-w-2xl rounded-2xl border border-purple-500/40 bg-[#121214] p-6 sm:p-8 space-y-5 shadow-2xl">
            <button type="button" onClick={() => setDraft(null)} aria-label="Fechar" className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-title text-2xl text-white">{draft.id ? "Editar vídeo" : "Novo vídeo"}</h2>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Link do YouTube</label>
              <div className="relative">
                <FaYoutube className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                <input
                  autoFocus={!draft.id}
                  value={draft.link}
                  onChange={(e) => setDraft({ ...draft, link: e.target.value })}
                  onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => fetchInfo(t), 0); }}
                  onBlur={() => { const id = parseYouTubeId(draft.link); if (id && id !== draft.youtubeId) fetchInfo(draft.link); }}
                  placeholder="https://www.youtube.com/watch?v=... ou /shorts/..."
                  className={`${inputClass} pl-11 pr-11`}
                />
                {fetching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 animate-spin" />}
              </div>
              <p className="text-[11px] text-gray-500">Colou o link, o título e a capa vêm sozinhos do YouTube.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-start">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Título</label>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tipo</label>
                <div className="flex bg-[#0a0a0b] border border-gray-800 rounded-lg overflow-hidden">
                  {(["video", "short"] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setKind(k)}
                      className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${draft.kind === k ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                      {k === "video" ? "Vídeo" : "Short"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`grid gap-5 ${draft.kind === "video" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
              {draft.kind === "video" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Duração</label>
                  <input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} placeholder="Ex: 15:53" className={inputClass} />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Visualizações</label>
                <input value={draft.views} onChange={(e) => setDraft({ ...draft, views: e.target.value })} placeholder="Ex: 7K" className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Publicado em</label>
                <input type="date" value={draft.publishedAt} onChange={(e) => setDraft({ ...draft, publishedAt: e.target.value })} className={`${inputClass} [color-scheme:dark]`} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Capa</label>
              <div className="flex items-center gap-4">
                <div className={`shrink-0 rounded-lg overflow-hidden bg-black border border-gray-800 flex items-center justify-center ${draft.kind === "short" ? "w-20 aspect-[9/16]" : "w-40 aspect-video"}`}>
                  {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <FaYoutube className="w-8 h-8 text-gray-700" />}
                </div>
                <div className="space-y-2">
                  <label className="relative inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:border-purple-500 text-xs font-bold uppercase tracking-widest text-gray-300 cursor-pointer">
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) pickCustom(f); e.target.value = ""; }} />
                    <ImagePlus className="w-4 h-4 text-purple-400" /> Usar outra imagem
                  </label>
                  {draft.customPreview && (
                    <button type="button" onClick={() => setDraft({ ...draft, customFile: null, customPreview: null })}
                      className="block text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300">
                      Voltar para a capa do YouTube
                    </button>
                  )}
                  <p className="text-[11px] text-gray-500">Opcional. Por padrão usa a capa do próprio YouTube.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setDraft(null)} className="px-5 py-2.5 rounded-lg font-bold text-sm text-gray-300 bg-white/5 hover:bg-white/10 border border-gray-800">
                Cancelar
              </button>
              <button type="submit" disabled={saving || fetching} className="btn-neon px-6 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar vídeo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
