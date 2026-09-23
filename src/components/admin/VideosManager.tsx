"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Edit, Eye, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { FaYoutube } from "react-icons/fa";
import { supabase } from "@/lib/supabase";
import { adminApi } from "@/lib/adminApi";
import { uploadGiveawayImage } from "@/lib/image";
import { useDialog } from "@/components/ui/Dialog";
import { HOME_LIMITS, mostViewed, parseYouTubeId, timeAgo, videoUrl, type Video } from "@/lib/videos";

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

// Vídeos e Shorts da seção "Vídeos Mais Acessados" da home: todos entram no carrossel,
// ordenados por visualizações (até HOME_LIMITS de cada tipo).
export default function VideosManager() {
  const dialog = useDialog();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [filter, setFilter] = useState<"all" | Kind>("all");
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

  const shown = useMemo(() => (filter === "all" ? videos : videos.filter((v) => v.kind === filter)), [videos, filter]);
  // O que aparece hoje no carrossel da home
  const onHome = useMemo(() => {
    const ids = new Set<string>();
    mostViewed(videos, "video", HOME_LIMITS.video).forEach((v) => ids.add(v.id));
    mostViewed(videos, "short", HOME_LIMITS.short).forEach((v) => ids.add(v.id));
    return ids;
  }, [videos]);

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
            Seção &quot;Vídeos Mais Acessados&quot; da home, em carrossel. A ordem é pelas visualizações (mais vistos primeiro), então mantenha esse campo atualizado.
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
          <div className="flex bg-[#121214] border border-gray-800 rounded-lg overflow-hidden w-fit">
            {([["all", "Todos"], ["video", "Vídeos"], ["short", "Shorts"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${filter === key ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                {label} ({key === "all" ? videos.length : videos.filter((v) => v.kind === key).length})
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="uiverse-loader" /></div>
          ) : shown.length === 0 ? (
            <div className="glass-panel rounded-xl border border-gray-800 p-10 text-center text-gray-500">
              Nenhum vídeo ainda. Clique em &quot;Novo Vídeo&quot; e cole o link do YouTube.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              {shown.map((v) => (
                <div key={v.id} className="glass-panel rounded-xl border border-purple-500/20 overflow-hidden flex flex-col">
                  <div className="relative bg-black overflow-hidden aspect-video">
                    <img src={v.thumbnail_url} alt="" className={`w-full h-full ${v.kind === "short" ? "object-contain" : "object-cover"}`} />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-[10px] font-bold uppercase tracking-widest text-white">
                      {v.kind === "short" ? "Short" : "Vídeo"}
                    </span>
                    {onHome.has(v.id) && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-purple-600 text-[10px] font-bold uppercase tracking-widest text-white">
                        Na home
                      </span>
                    )}
                    {v.duration && (
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-bold not-italic">{v.duration}</span>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <p className="text-white font-bold text-sm leading-snug line-clamp-2">{v.title}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {v.views && <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {v.views}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {timeAgo(v.published_at)}</span>
                    </div>
                    <div className="mt-auto flex items-center gap-2">
                      <a href={videoUrl(v)} target="_blank" rel="noreferrer" title="Abrir no YouTube"
                        className="p-2 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                        <FaYoutube className="w-4 h-4" />
                      </a>
                      <div className="flex-1" />
                      <button onClick={() => openEdit(v)} title="Editar" className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(v)} title="Excluir" className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
