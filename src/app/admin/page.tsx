"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Users, Gift, Star, ArrowRight, Trophy, Sparkles, Radio, X, RotateCcw, Clock, Volume2, VolumeX, ImagePlus } from "lucide-react";
import { FaTwitch } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/admins";
import { adminApi } from "@/lib/adminApi";
import { uploadGiveawayImage } from "@/lib/image";
import { useDialog } from "@/components/ui/Dialog";
import WinnerPrizeEditor from "@/components/admin/WinnerPrizeEditor";
import AddWinnerModal from "@/components/admin/AddWinnerModal";
import SiteUsers from "@/components/admin/SiteUsers";
import PartnersManager from "@/components/admin/PartnersManager";
import { Handshake, UserRound } from "lucide-react";
import NumberInput from "@/components/ui/NumberInput";
import { useSounds } from "@/lib/useSounds";
import { avatarFor } from "@/lib/daily";
import { isGiveawayClosed } from "@/lib/giveaway";
import LiveGiveaway from "@/components/admin/LiveGiveaway";

const TooltipIcon = ({ text }: { text: string }) => (
  <div className="relative flex items-center justify-center group/tooltip">
    <span className="cursor-help text-purple-500 hover:text-purple-400 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    </span>
    <div className="absolute top-full right-0 mt-2 w-[220px] bg-[#0c0d10] text-gray-300 text-[10px] font-normal leading-relaxed rounded-md p-2.5 shadow-2xl border border-white/10 z-[100] pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity">
      {text}
    </div>
  </div>
);

type ImageSlot = "home" | "featured" | "detail";
interface ImageValue {
  file: File | null;      // arquivo novo escolhido agora
  preview: string | null; // o que aparece na prévia (novo ou o que já estava salvo)
  changed: boolean;       // trocou ou removeu nesta edição
}
const emptyImage: ImageValue = { file: null, preview: null, changed: false };

// Tamanho ideal de cada imagem, medido no espaço que ela ocupa no site (a imagem
// é recortada para preencher; no celular o corte é maior nas laterais)
const IMAGE_SIZES = {
  home: { size: "1200 × 800 px", tip: "A mesma arte serve para Home, Destaque e Sorteio, sem corte." },
  featured: { size: "1200 × 800 px", tip: "Mesma arte da Home. Se deixar vazio, o site usa a imagem da Home." },
  detail: { size: "1200 × 800 px", tip: "Mesma arte da Home. Se deixar vazio, o site usa a imagem da Home." },
} as const;

// Campo de upload com miniatura: cada tela (Home, Destaque, Sorteio) tem a sua imagem
const ImageField = ({ label, tooltip, value, onPick, onClear, hint }: {
  label: string;
  tooltip: string;
  hint?: { size: string; tip: string };
  value: ImageValue;
  onPick: (file: File) => void;
  onClear: () => void;
}) => (
  <div className="space-y-2 animate-fade-in">
    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
      {label}
      <TooltipIcon text={tooltip} />
    </label>
    {hint && (
      <p className="text-[11px] text-gray-500 leading-snug">
        Tamanho ideal: <span className="text-purple-400 font-bold not-italic">{hint.size}</span> (JPG ou PNG). {hint.tip}
      </p>
    )}
    <div className="relative w-full border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl bg-[#0a0a0b] transition-colors overflow-hidden">
      <input
        type="file"
        accept="image/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      {value.preview ? (
        <div className="flex items-center gap-4 p-3">
          <img src={value.preview} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-800" />
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-bold truncate">{value.file ? value.file.name : "Imagem atual"}</p>
            <p className="text-gray-500 text-[10px] uppercase tracking-widest mt-1">Clique para trocar</p>
          </div>
        </div>
      ) : (
        <div className="p-8 flex flex-col items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">Escolher imagem</span>
        </div>
      )}
    </div>
    {value.preview && (
      <button type="button" onClick={onClear} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300">
        Remover imagem
      </button>
    )}
  </div>
);

// Converte uma data ISO para o formato do <input type="datetime-local"> no fuso local.
const toLocalInputValue = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ITEM_STEP = 160; // largura do card da roleta (144px) + gap (16px)
const WINNER_INDEX = 40;

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const dialog = useDialog();
  const currentUsername = ((session?.user as any)?.username || session?.user?.name || "").toLowerCase();
  const allowed = isAdmin(currentUsername);

  const [activeTab, setActiveTab] = useState("sorteios");
  const [isAddWinnerOpen, setIsAddWinnerOpen] = useState(false);

  // Abre direto numa aba (?tab=twitch), usado na volta da autorização do chat
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && ["sorteios", "twitch", "users", "cadastros", "parceiros"].includes(tab)) setActiveTab(tab);
  }, []);

  const [sorteios, setSorteios] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [winners, setWinners] = useState<any[]>([]);

  // Gerenciamento de participantes
  const [managingParticipants, setManagingParticipants] = useState<string | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [editTwitchUsername, setEditTwitchUsername] = useState("");
  const [editCoinsUsed, setEditCoinsUsed] = useState<number | "">(0);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  // Roleta do sorteio mensal
  const [isDrawing, setIsDrawing] = useState(false);
  const [rouletteItems, setRouletteItems] = useState<any[]>([]);
  const [rouletteOffset, setRouletteOffset] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [drawnWinner, setDrawnWinner] = useState<any>(null);
  const [localWinners, setLocalWinners] = useState<any[]>([]);
  const rouletteTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reelRef = useRef<HTMLDivElement>(null);
  const spinIdRef = useRef(0); // muda a cada giro; o loop de som para quando o giro acaba ou é cancelado
  const sounds = useSounds();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState("Amarelo");
  const [previewMode, setPreviewMode] = useState<"home" | "destaque" | "sorteio">("home");
  const [isSaving, setIsSaving] = useState(false);

  // Formulário Criar Sorteio
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newHighlight, setNewHighlight] = useState("");
  const [newCoins, setNewCoins] = useState<number | "">(0);
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newPrizeLabel, setNewPrizeLabel] = useState("");
  const [newShippingText, setNewShippingText] = useState("");
  const [newPrizeValue, setNewPrizeValue] = useState("");
  const [newDrawDate, setNewDrawDate] = useState("");
  const [newLoginText, setNewLoginText] = useState("");
  const [images, setImages] = useState<Record<ImageSlot, ImageValue>>({ home: emptyImage, featured: emptyImage, detail: emptyImage });

  const pickImage = (slot: ImageSlot, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setImages((prev) => ({ ...prev, [slot]: { file, preview: e.target?.result as string, changed: true } }));
    reader.readAsDataURL(file);
  };
  const clearImage = (slot: ImageSlot) =>
    setImages((prev) => ({ ...prev, [slot]: { file: null, preview: null, changed: true } }));

  const [editingGiveaway, setEditingGiveaway] = useState<string | null>(null);


  // Reabrir sorteio encerrado (popup com a nova data de encerramento)
  const [reopenTarget, setReopenTarget] = useState<{ id: string; title: string } | null>(null);
  const [reopenDate, setReopenDate] = useState("");
  const [isReopening, setIsReopening] = useState(false);
  const [listLoadedAt, setListLoadedAt] = useState(0); // "agora" usado para saber quais já passaram da data

  // Segurança da rota (a proteção real está na /api/admin, que confere no servidor)
  useEffect(() => {
    if (status === "loading") return;
    if (!allowed) router.push("/");
  }, [allowed, status, router]);

  useEffect(() => {
    if (!allowed) return;
    fetchSorteios();
    fetchWinners();
  }, [allowed]);

  // Cancela a roleta ao sair da página
  useEffect(() => {
    return () => {
      rouletteTimers.current.forEach(clearTimeout);
    };
  }, []);

  const fetchSorteios = async () => {
    const { data } = await supabase
      .from("giveaways")
      .select("id, title, description, highlight_text, highlight_color, coins_cost, subtitle, prize_label, shipping_text, prize_value, draw_date, login_text, type, status, is_daily_highlight, response_seconds, created_at")
      .order("created_at", { ascending: false });
    if (data) {
      setSorteios(data);
      setListLoadedAt(Date.now());
    }
    adminApi<{ data: Record<string, number> }>("participantCounts")
      .then(({ data }) => setParticipantCounts(data))
      .catch(() => {});
  };

  const run = async (action: string, payload: Record<string, unknown> = {}) => {
    try {
      return await adminApi(action, payload);
    } catch (err) {
      dialog.error(err);
      return null;
    }
  };

  const fetchParticipants = async (giveawayId: string) => {
    const res = await run("listParticipants", { giveawayId, withProof: true });
    if (res) setParticipants(res.data);
  };

  const handleUpdateParticipantStatus = async (id: string, newStatus: string) => {
    if (await run("updateParticipant", { id, fields: { status: newStatus } })) {
      if (managingParticipants) fetchParticipants(managingParticipants);
    }
  };

  const handleDeleteParticipant = async (p: any) => {
    const ok = await dialog.confirm({
      title: `Excluir @${p.twitch_username} da lista?`,
      message: "A inscrição e o comprovante são apagados e a pessoa sai da roleta. Ela pode se inscrever de novo se o sorteio estiver aberto.",
      confirmText: "Excluir participante",
      tone: "danger",
    });
    if (!ok) return;
    if (await run("deleteParticipant", { id: p.id })) {
      setParticipants((prev) => prev.filter((x) => x.id !== p.id));
      setParticipantCounts((prev) => ({ ...prev, [p.giveaway_id]: Math.max(0, (prev[p.giveaway_id] || 1) - 1) }));
    }
  };

  const handleSaveParticipantEdit = async (id: string) => {
    const ok = await run("updateParticipant", {
      id,
      fields: { twitch_username: editTwitchUsername, coins_used: Number(editCoinsUsed) || 0 },
    });
    if (ok && managingParticipants) {
      setEditingParticipant(null);
      fetchParticipants(managingParticipants);
    }
  };

  const fetchWinners = async () => {
    const { data } = await supabase.from("winners").select("*").order("won_at", { ascending: false });
    if (data) setWinners(data);
  };

  const fetchLocalWinners = async (giveawayId: string) => {
    const { data } = await supabase.from("winners").select("*").eq("giveaway_id", giveawayId);
    if (data) setLocalWinners(data);
  };

  const handleOpenParticipants = (id: string) => {
    setParticipants([]);
    setLocalWinners([]);
    setManagingParticipants(id);
    fetchParticipants(id);
    fetchLocalWinners(id);
  };

  // excludeNames: quem já ganhou (passado explicitamente porque o estado pode estar desatualizado)
  const startRoulette = (excludeNames: string[] = localWinners.map((w) => w.twitch_username)) => {
    const approved = participants.filter((p) => p.status === "approved" && !excludeNames.includes(p.twitch_username));

    if (approved.length === 0) {
      dialog.alert({
        title: "Ninguém disponível para sortear",
        message: "Não há mais participantes aprovados que ainda não foram sorteados. Aprove participantes na tabela para sortear.",
        tone: "warning",
      });
      setIsDrawing(false);
      setShowWinner(false);
      return;
    }

    const items = [];
    for (let i = 0; i < 50; i++) {
      items.push(approved[Math.floor(Math.random() * approved.length)]);
    }
    const trueWinner = approved[Math.floor(Math.random() * approved.length)];
    items[WINNER_INDEX] = trueWinner;

    rouletteTimers.current.forEach(clearTimeout);
    setRouletteItems(items);
    setDrawnWinner(trueWinner);
    setRouletteOffset(0);
    setIsDrawing(true);
    setShowWinner(false);

    // Mesmo som do sorteio diário: tique a cada card que passa pelo traço e fanfarra no final
    sounds.unlock();
    const spinId = ++spinIdRef.current;
    const startedAt = performance.now() + 100;
    let lastIndex = -1;
    const tickLoop = () => {
      if (spinIdRef.current !== spinId || !reelRef.current) return;
      const x = -new DOMMatrixReadOnly(getComputedStyle(reelRef.current).transform).m41;
      const index = Math.round(x / ITEM_STEP);
      if (index !== lastIndex) {
        lastIndex = index;
        sounds.tick(Math.min(1, Math.max(0, (performance.now() - startedAt) / 10000)));
      }
      requestAnimationFrame(tickLoop);
    };

    rouletteTimers.current = [
      setTimeout(() => {
        setRouletteOffset(WINNER_INDEX * ITEM_STEP);
        requestAnimationFrame(tickLoop);
      }, 100),
      setTimeout(() => {
        spinIdRef.current++;
        sounds.win();
        setShowWinner(true);
      }, 10100),
    ];
  };

  const cancelRoulette = () => {
    spinIdRef.current++;
    rouletteTimers.current.forEach(clearTimeout);
    setIsDrawing(false);
    setShowWinner(false);
  };

  // Muda na hora nas duas listas (vencedores do sorteio e aba de vencedores) e confirma no servidor
  const toggleHallOfFame = async (winnerId: string, currentState: boolean) => {
    const apply = (value: boolean) => {
      const update = (list: any[]) => list.map((w) => (w.id === winnerId ? { ...w, in_hall_of_fame: value } : w));
      setWinners(update);
      setLocalWinners(update);
    };
    apply(!currentState);
    if (!(await run("setHallOfFame", { id: winnerId, value: !currentState }))) apply(currentState);
  };

  const saveWinner = async (drawAgain: boolean) => {
    const sorteio = sorteios.find((s) => s.id === managingParticipants);
    const res = await run("insertWinner", {
      giveawayId: managingParticipants,
      twitchUsername: drawnWinner.twitch_username,
      avatarUrl: drawnWinner.avatar_url ?? null,
      prize: sorteio ? sorteio.title : "Prêmio Sorteado",
    });

    const updatedWinners = res?.data ? [...localWinners, res.data] : localWinners;
    setLocalWinners(updatedWinners);
    fetchWinners();

    if (drawAgain) {
      startRoulette(updatedWinners.map((w) => w.twitch_username));
    } else {
      setIsDrawing(false);
      setShowWinner(false);
    }
  };

  const giveawayName = (id: string) => sorteios.find((s) => s.id === id)?.title?.replace("|", " ") || "este sorteio";

  const handleDeleteGiveaway = async (id: string) => {
    const ok = await dialog.confirm({
      title: `Excluir "${giveawayName(id)}"?`,
      message: "O sorteio some do site junto com todos os participantes e tickets dele. Os vencedores continuam no histórico. Não dá para desfazer.",
      confirmText: "Excluir sorteio",
      tone: "danger",
    });
    if (ok && (await run("deleteGiveaway", { id }))) fetchSorteios();
  };

  const handleCompleteGiveaway = async (id: string) => {
    const ok = await dialog.confirm({
      title: `Encerrar "${giveawayName(id)}"?`,
      message: "As inscrições fecham e o sorteio sai da página inicial. Os participantes continuam salvos para você sortear.",
      confirmText: "Encerrar",
      tone: "warning",
    });
    if (ok && (await run("completeGiveaway", { id }))) fetchSorteios();
  };

  const openReopen = (sorteio: any) => {
    // Sugere daqui a 2 horas
    setReopenDate(toLocalInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()));
    setReopenTarget({ id: sorteio.id, title: sorteio.title.replace("|", " ") });
  };

  const handleReopen = async () => {
    if (!reopenTarget) return;
    const date = new Date(reopenDate);
    if (!reopenDate || isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      dialog.alert({ title: "Data inválida", message: "Escolha um dia e horário no futuro.", tone: "warning" });
      return;
    }
    setIsReopening(true);
    const ok = await run("reopenGiveaway", { id: reopenTarget.id, drawDate: date.toISOString() });
    setIsReopening(false);
    if (ok) {
      setReopenTarget(null);
      fetchSorteios();
    }
  };

  // Edição de foto/prêmio vale nas duas listas (vencedores deste sorteio e aba de vencedores)
  const patchWinner = (id: string, fields: Record<string, unknown>) => {
    const apply = (list: any[]) => list.map((w) => (w.id === id ? { ...w, ...fields } : w));
    setWinners(apply);
    setLocalWinners(apply);
  };

  const handleDeleteWinner = async (winner: any) => {
    const ok = await dialog.confirm({
      title: `Excluir @${winner.twitch_username} dos vencedores?`,
      message: `O vencedor de "${winner.prize}" sai desta lista, do Hall da Fama e do histórico. Não dá para desfazer.`,
      confirmText: "Excluir vencedor",
      tone: "danger",
    });
    if (ok && (await run("deleteWinner", { id: winner.id, reopen: false }))) {
      fetchWinners();
      fetchSorteios();
      // Tira da lista deste sorteio: a pessoa volta a poder ser sorteada
      setLocalWinners((prev) => prev.filter((w) => w.id !== winner.id));
    }
  };

  const handleSetFeatured = async (id: string, currentType: string) => {
    await run("setFeatured", { id, on: currentType !== "featured" });
    fetchSorteios();
  };

  const handleEditGiveaway = async (giveaway: any) => {
    // As imagens são pesadas, então só são buscadas ao editar
    const { data: imgData } = await supabase.from("giveaways").select("*").eq("id", giveaway.id).single();

    setNewTitle(giveaway.title);
    setNewDesc(giveaway.description || "");
    setNewHighlight(giveaway.highlight_text || "");
    setSelectedColor(giveaway.highlight_color || "Amarelo");
    setNewCoins(giveaway.coins_cost || 0);
    setNewSubtitle(giveaway.subtitle || "");
    setNewPrizeLabel(giveaway.prize_label || "");
    setNewShippingText(giveaway.shipping_text || "");
    setNewPrizeValue(giveaway.prize_value || "");
    setNewDrawDate(giveaway.draw_date ? toLocalInputValue(giveaway.draw_date) : "");
    setNewLoginText(giveaway.login_text || "");
    setImages({
      home: { file: null, preview: imgData?.image_url || null, changed: false },
      featured: { file: null, preview: imgData?.featured_image_url || null, changed: false },
      detail: { file: null, preview: imgData?.detail_image_url || null, changed: false },
    });
    setEditingGiveaway(giveaway.id);
    setIsCreateModalOpen(true);
  };

  const openCreateModal = () => {
    setNewTitle("");
    setNewDesc("");
    setNewHighlight("");
    setSelectedColor("Amarelo");
    setNewCoins(0);
    setNewSubtitle("");
    setNewPrizeLabel("");
    setNewShippingText("");
    setNewPrizeValue("");
    setNewDrawDate("");
    setNewLoginText("");
    setImages({ home: emptyImage, featured: emptyImage, detail: emptyImage });
    setPreviewMode("home");
    setEditingGiveaway(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSorteio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      dialog.alert({ title: "Falta o nome do sorteio", message: "Preencha o campo Nome antes de salvar.", tone: "warning" });
      return;
    }
    setIsSaving(true);

    try {
      const fields: Record<string, unknown> = {
        title: newTitle.trim(),
        description: newDesc,
        highlight_text: newHighlight,
        highlight_color: selectedColor,
        coins_cost: Number(newCoins) || 0,
        subtitle: newSubtitle,
        prize_label: newPrizeLabel,
        shipping_text: newShippingText,
        prize_value: newPrizeValue,
        draw_date: newDrawDate ? new Date(newDrawDate).toISOString() : null,
        login_text: newLoginText,
      };
      // Só envia a imagem que foi trocada ou removida nesta edição
      const columns: Record<ImageSlot, string> = { home: "image_url", featured: "featured_image_url", detail: "detail_image_url" };
      for (const slot of Object.keys(columns) as ImageSlot[]) {
        const img = images[slot];
        if (!img.changed) continue;
        fields[columns[slot]] = img.file ? await uploadGiveawayImage(img.file) : null;
      }
      if (!editingGiveaway) {
        fields.type = "monthly";
        fields.status = "active";
      }

      if (await run("saveGiveaway", { id: editingGiveaway, fields })) {
        setIsCreateModalOpen(false);
        setEditingGiveaway(null);
        fetchSorteios();
      }
    } catch (err) {
      dialog.error(err, "Não foi possível salvar o sorteio");
    }
    setIsSaving(false);
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-purple-500 font-bold animate-pulse">Carregando painel...</div>;
  }

  // Se não estiver autorizado, não renderiza o painel (o useEffect redireciona)
  if (!allowed) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-red-500 font-bold">Acesso Negado</div>;
  }

  const managedGiveaway = sorteios.find((s) => s.id === managingParticipants);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col md:flex-row font-sans">

      {/* Sidebar Admin */}
      <aside className="w-full md:w-64 glass-panel md:border-r border-b md:border-b-0 border-gray-800 p-4 md:p-6 flex md:flex-col gap-2 overflow-x-auto hide-scrollbar z-10 sticky top-0 md:static bg-black/80 md:bg-transparent backdrop-blur-md">
        <h2 className="font-title text-xl md:text-2xl text-white mb-0 md:mb-6 flex-shrink-0 flex items-center md:block mr-4 md:mr-0">Painel <span className="text-purple-500 ml-1 md:ml-0">Admin</span></h2>

        <button
          onClick={() => setActiveTab("sorteios")}
          className={`flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-lg font-medium transition-all flex-shrink-0 ${activeTab === "sorteios" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <Gift className="w-4 h-4 md:w-5 md:h-5" /> Sorteios Mensais
        </button>
        <button
          onClick={() => setActiveTab("twitch")}
          className={`flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-lg font-medium transition-all flex-shrink-0 ${activeTab === "twitch" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <Radio className="w-4 h-4 md:w-5 md:h-5" /> Sorteio Diário (Live)
        </button>
        <button
          onClick={() => { setActiveTab("users"); fetchWinners(); }}
          className={`flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-lg font-medium transition-all flex-shrink-0 ${activeTab === "users" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <Trophy className="w-4 h-4 md:w-5 md:h-5" /> Vencedores dos Sorteios
        </button>
        <button
          onClick={() => setActiveTab("cadastros")}
          className={`flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-lg font-medium transition-all flex-shrink-0 ${activeTab === "cadastros" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <UserRound className="w-4 h-4 md:w-5 md:h-5" /> Usuários do Site
        </button>
        <button
          onClick={() => setActiveTab("parceiros")}
          className={`flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-lg font-medium transition-all flex-shrink-0 ${activeTab === "parceiros" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <Handshake className="w-4 h-4 md:w-5 md:h-5" /> Parceiros
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-6 md:p-10">

        {activeTab === "sorteios" && (
          <div className="space-y-8 animate-fade-in">
            {managingParticipants !== null ? (
              /* View de Gerenciamento de Participantes */
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                      Participantes: {managedGiveaway?.title || "Sorteio"}
                    </h1>
                    <p className="text-gray-400 mt-1">Apenas participantes <span className="text-green-400 font-bold">Aprovados</span> irão para a roleta.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startRoulette()}
                      className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                    >
                      <Trophy className="w-5 h-5" /> Sorteie Agora
                    </button>
                    <button
                      onClick={() => setManagingParticipants(null)}
                      className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors"
                    >
                      Voltar aos Sorteios
                    </button>
                  </div>
                </div>

                <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm text-gray-400">
                      <thead className="bg-purple-900/20 text-xs uppercase text-gray-300 border-b border-purple-900/50">
                        <tr>
                          <th className="px-6 py-4">Usuário</th>
                          <th className="px-6 py-4">Coins Investidas</th>
                          <th className="px-6 py-4">ID da Casa</th>
                          <th className="px-6 py-4">Comprovante</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((p) => (
                          <tr key={p.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                            {/* Se estiver editando */}
                            {editingParticipant === p.id ? (
                              <>
                                <td className="px-6 py-4">
                                  <input
                                    type="text"
                                    value={editTwitchUsername}
                                    onChange={(e) => setEditTwitchUsername(e.target.value)}
                                    className="bg-black border border-gray-700 rounded px-2 py-1 text-white w-full outline-none focus:border-purple-500"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <div className="w-28">
                                    <NumberInput
                                      value={editCoinsUsed}
                                      onChange={setEditCoinsUsed}
                                      min={0}
                                      className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white outline-none focus:border-purple-500"
                                    />
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-400">{p.casa_id || "N/A"}</td>
                                <td className="px-6 py-4">
                                  {p.proof_url ? (
                                    <button type="button" onClick={() => setProofPreview(p.proof_url)} className="text-blue-400 hover:text-blue-300 underline font-medium">
                                      Ver Imagem
                                    </button>
                                  ) : (
                                    <span>Nenhum</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  {p.status}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    onClick={() => handleSaveParticipantEdit(p.id)}
                                    className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    onClick={() => setEditingParticipant(null)}
                                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors ml-2"
                                  >
                                    Cancelar
                                  </button>
                                </td>
                              </>
                            ) : (
                              /* Visualização Normal */
                              <>
                                <td className="px-6 py-4 font-bold text-white">@{p.twitch_username}</td>
                                <td className="px-6 py-4 font-bold text-yellow-500">{p.coins_used}</td>
                                <td className="px-6 py-4 font-bold text-gray-400">{p.casa_id || "N/A"}</td>
                                <td className="px-6 py-4">
                                  {p.proof_url ? (
                                    <button type="button" onClick={() => setProofPreview(p.proof_url)} className="text-blue-400 hover:text-blue-300 underline font-medium">
                                      Ver Imagem
                                    </button>
                                  ) : (
                                    <span className="text-gray-600">Nenhum</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded text-xs font-bold
                                    ${p.status === "approved" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                                      p.status === "rejected" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                        "bg-yellow-500/20 text-yellow-500 border border-yellow-500/30"}`}>
                                    {p.status === "approved" ? "Aprovado" : p.status === "rejected" ? "Rejeitado" : "Pendente"}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleUpdateParticipantStatus(p.id, 'approved')}
                                      className="px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded font-bold text-xs transition-colors"
                                    >
                                      Aprovar
                                    </button>
                                    <button
                                      onClick={() => handleUpdateParticipantStatus(p.id, 'rejected')}
                                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded font-bold text-xs transition-colors"
                                    >
                                      Rejeitar
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditTwitchUsername(p.twitch_username);
                                        setEditCoinsUsed(p.coins_used);
                                        setEditingParticipant(p.id);
                                      }}
                                      className="p-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                                      title="Editar Usuário/Coins"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteParticipant(p)}
                                      className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                      title="Excluir da lista"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {participants.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-gray-500">Nenhum participante ainda.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabela de Vencedores Locais (Desse Sorteio) */}
                {localWinners.length > 0 && (
                  <div className="mt-12 space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" /> Vencedores deste Sorteio
                    </h2>
                    <div className="glass-panel rounded-xl overflow-x-auto border border-yellow-500/30">
                      <table className="w-full min-w-[760px] text-left text-sm text-gray-400">
                        <thead className="bg-yellow-900/20 text-xs uppercase text-gray-300 border-b border-yellow-900/50">
                          <tr>
                            <th className="px-6 py-4">Usuário da Twitch</th>
                            <th className="px-6 py-4">Foto e Prêmio (Hall da Fama)</th>
                            <th className="px-6 py-4">Data do Sorteio</th>
                            <th className="px-6 py-4 text-center">Hall da Fama</th>
                            <th className="px-6 py-4 text-right">Excluir</th>
                          </tr>
                        </thead>
                        <tbody>
                          {localWinners.map(winner => (
                            <tr key={winner.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-bold text-white">
                                <div className="flex items-center gap-3">
                                  <img src={avatarFor(winner.twitch_username, winner.avatar_url)} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700" />
                                  @{winner.twitch_username}
                                </div>
                              </td>
                              <td className="px-6 py-4"><WinnerPrizeEditor winner={winner} onChange={patchWinner} /></td>
                              <td className="px-6 py-4">{new Date(winner.won_at).toLocaleDateString("pt-BR")}</td>
                              <td className="px-6 py-4 text-center">
                                <button
                                  onClick={() => toggleHallOfFame(winner.id, winner.in_hall_of_fame)}
                                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${winner.in_hall_of_fame
                                    ? "bg-purple-600/20 text-purple-400 border-purple-500/50 hover:bg-purple-600/40"
                                    : "bg-gray-800/50 text-gray-500 border-gray-700 hover:bg-gray-700"}`}
                                >
                                  {winner.in_hall_of_fame ? "No Hall da Fama" : "Colocar no Hall"}
                                </button>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => handleDeleteWinner(winner)}
                                  className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                  title="Excluir vencedor (libera para sortear de novo)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              /* View Normal de Sorteios Mensais */
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white">Sorteios Ativos</h1>
                    <p className="text-gray-400">Crie, edite ou encerre os sorteios da plataforma.</p>
                  </div>
                  <div className="flex gap-4 items-center">
                    <button
                      onClick={openCreateModal}
                      className="btn-neon px-6 py-3 rounded-lg font-bold flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Criar Novo Sorteio
                    </button>
                  </div>
                </div>

                {/* Tabela de Gerenciamento */}
                <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm text-gray-400">
                      <thead className="bg-purple-900/20 text-xs uppercase text-gray-300 border-b border-purple-900/50">
                        <tr>
                          <th className="px-6 py-4">ID</th>
                          <th className="px-6 py-4">Título</th>
                          <th className="px-6 py-4">Tipo / Palavra-Chave</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Participantes</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorteios.filter((s) => s.type !== "daily").map((sorteio) => {
                          const closed = isGiveawayClosed(sorteio, listLoadedAt || undefined);
                          return (
                          <tr key={sorteio.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-bold text-white text-xs truncate max-w-[100px]" title={sorteio.id}>{sorteio.id}</td>
                            <td className="px-6 py-4 text-white font-medium">{sorteio.title}</td>
                            <td className="px-6 py-4">
                              {sorteio.type === "featured" ? "Destaque" : sorteio.type === "daily" ? "Diário (Live)" : "Mensal"}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${!closed ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}>
                                {!closed ? "Ativo" : "Encerrado"}
                              </span>
                              {sorteio.draw_date && (
                                <span className="block text-[10px] text-gray-500 mt-1">
                                  {closed ? "encerrou" : "até"} {new Date(sorteio.draw_date).toLocaleDateString("pt-BR")} {new Date(sorteio.draw_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-bold">{participantCounts[sorteio.id] || 0}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenParticipants(sorteio.id)}
                                  className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded transition-colors"
                                  title="Ver Participantes"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleSetFeatured(sorteio.id, sorteio.type)}
                                  className={`p-2 rounded transition-colors ${sorteio.type === 'featured' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-800 text-gray-500 hover:text-yellow-500'}`}
                                  title="Destacar Sorteio Principal">
                                  <Star className={`w-4 h-4 ${sorteio.type === 'featured' ? 'fill-current' : ''}`} />
                                </button>
                                {closed ? (
                                  <button
                                    onClick={() => openReopen(sorteio)}
                                    className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-colors" title="Voltar o sorteio ao ar">
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleCompleteGiveaway(sorteio.id)}
                                    className="p-2 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 rounded transition-colors" title="Encerrar Sorteio">
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleEditGiveaway(sorteio)}
                                  className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors" title="Editar Sorteio">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteGiveaway(sorteio.id)}
                                  className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors" title="Excluir">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "cadastros" && <SiteUsers />}
        {activeTab === "parceiros" && <PartnersManager />}

        {activeTab === "twitch" && <LiveGiveaway defaultChannel={currentUsername || "barr4k"} />}

        {activeTab === "users" && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white">Vencedores dos Sorteios</h1>
                <p className="text-gray-400">Todos os vencedores ficam salvos aqui, mesmo depois que o sorteio é excluído. Controle quem aparece no Hall da Fama.</p>
              </div>
              <button onClick={() => setIsAddWinnerOpen(true)} className="btn-neon px-6 py-3 rounded-lg font-bold flex items-center gap-2 shrink-0">
                <Plus className="w-5 h-5" /> Adicionar Vencedor
              </button>
            </div>

            {isAddWinnerOpen && (
              <AddWinnerModal
                onClose={() => setIsAddWinnerOpen(false)}
                onAdded={(w) => setWinners((prev) => [w, ...prev].sort((a, b) => +new Date(b.won_at) - +new Date(a.won_at)))}
              />
            )}

            <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm text-gray-400">
                  <thead className="bg-purple-900/20 text-xs uppercase text-gray-300 border-b border-purple-900/50">
                    <tr>
                      <th className="px-6 py-4">Usuário</th>
                      <th className="px-6 py-4">Prêmio Ganho</th>
                      <th className="px-6 py-4">Data do Sorteio</th>
                      <th className="px-6 py-4 text-center">Hall da Fama</th>
                      <th className="px-6 py-4 text-right">Excluir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winners.map((winner: any) => (
                      <tr key={winner.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-bold text-white">
                          <div className="flex items-center gap-3">
                            <img src={avatarFor(winner.twitch_username, winner.avatar_url)} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700" />
                            @{winner.twitch_username}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <WinnerPrizeEditor winner={winner} onChange={patchWinner} />
                        </td>
                        <td className="px-6 py-4">{new Date(winner.won_at).toLocaleDateString("pt-BR")}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleHallOfFame(winner.id, winner.in_hall_of_fame)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${winner.in_hall_of_fame
                                ? "bg-purple-600/20 text-purple-400 border-purple-500/50 hover:bg-purple-600/40"
                                : "bg-gray-800/50 text-gray-500 border-gray-700 hover:bg-gray-700"
                              }`}
                          >
                            {winner.in_hall_of_fame ? "Destacado" : "Destacar"}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteWinner(winner)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                            title="Excluir vencedor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {winners.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500">Nenhum vencedor ainda.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Voltar sorteio ao ar */}
      {reopenTarget && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setReopenTarget(null); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-purple-500/40 bg-[#101014] p-6 shadow-[0_0_60px_rgba(147,51,234,0.25)] animate-scale-up not-italic">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-11 h-11 rounded-full border border-purple-500/40 bg-purple-500/15 text-purple-300 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <h2 className="text-lg font-black text-white leading-snug">Voltar &quot;{reopenTarget.title}&quot; ao ar?</h2>
                <p className="mt-2 text-sm text-gray-400">Até que dia e horário as inscrições ficam abertas?</p>
              </div>
            </div>

            <label className="mt-5 block text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Encerra em
            </label>
            <input
              type="datetime-local"
              value={reopenDate}
              onChange={(e) => setReopenDate(e.target.value)}
              className="mt-2 w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none [color-scheme:dark]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 3, 6, 24].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setReopenDate(toLocalInputValue(new Date(Date.now() + h * 60 * 60 * 1000).toISOString()))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300 bg-white/5 hover:bg-white/10 border border-gray-800"
                >
                  +{h === 24 ? "1 dia" : `${h}h`}
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setReopenTarget(null)}
                className="px-5 py-2.5 rounded-lg font-bold text-sm text-gray-300 bg-white/5 hover:bg-white/10 border border-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReopen}
                disabled={isReopening}
                className="px-5 py-2.5 rounded-lg font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.35)] transition-colors disabled:opacity-50"
              >
                {isReopening ? "Reabrindo..." : "Voltar ao ar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up do Sorteio (Roleta) */}
      {isDrawing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-5xl flex flex-col items-center">

            <h2 className={`text-4xl font-black text-white uppercase tracking-wider mb-12 ${showWinner ? "" : "animate-pulse"}`}>{showWinner ? "Ganhador!" : "Sorteando..."}</h2>

            {/* A linha de centro (mirador) */}
            <div className="relative w-full h-48 bg-[#121214] border-y-4 border-purple-500/30 overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.1)] flex items-center">

              {/* O traço vermelho no meio */}
              <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-red-500 z-50 transform -translate-x-1/2 shadow-[0_0_15px_rgba(239,68,68,1)]"></div>

              {/* A esteira de avatares */}
              <div
                ref={reelRef}
                className={`flex gap-4 w-full transition-transform ease-[cubic-bezier(0.15,0.85,0.15,1)]`}
                style={{
                  /* centraliza o 1º card no traço: metade da faixa menos metade do card (144px) */
                  paddingLeft: 'calc(50% - 72px)',
                  transform: `translateX(-${rouletteOffset}px)`,
                  transitionDuration: rouletteOffset > 0 ? '10s' : '0s'
                }}
              >
                {rouletteItems.map((item, index) => (
                  <div key={index} className="w-[144px] h-[144px] flex-shrink-0 bg-black border border-gray-800 rounded-xl flex flex-col items-center justify-center relative overflow-hidden opacity-80">
                    <img src={avatarFor(item.twitch_username, item.avatar_url)} alt="" className="w-16 h-16 rounded-full mb-3 object-cover border-2 border-gray-700 shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                    <span className="text-white font-bold text-xs uppercase tracking-widest truncate w-full text-center px-2">@{item.twitch_username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quando terminar, mostrar vencedor e botões */}
            {!showWinner && (
              <div className="mt-10 flex items-center gap-3">
                <button
                  onClick={cancelRoulette}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm text-red-300 bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 transition-colors"
                >
                  <X className="w-4 h-4" /> Cancelar sorteio
                </button>
                <button
                  onClick={() => sounds.setEnabled(!sounds.enabled)}
                  title={sounds.enabled ? "Desligar som" : "Ligar som"}
                  className="p-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                >
                  {sounds.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            )}

            {showWinner && (
              <div className="mt-12 bg-[#121214] border border-purple-500/50 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(168,85,247,0.3)] p-8 text-center animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-600 to-pink-600"></div>

                <img
                  src={avatarFor(drawnWinner?.twitch_username || "", drawnWinner?.avatar_url)}
                  alt=""
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.45)]"
                />

                <h3 className="text-3xl font-black text-white uppercase tracking-wider mb-2 truncate">@{drawnWinner?.twitch_username}</h3>
                <p className="text-gray-400 mb-6 font-medium text-xs uppercase tracking-widest">Vencedor do sorteio</p>

                <div className="flex gap-3">
                  <button
                    onClick={() => saveWinner(false)}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold transition-colors text-xs uppercase tracking-widest"
                  >
                    Salvar & Concluir
                  </button>
                  <button
                    onClick={() => saveWinner(true)}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-bold transition-colors text-xs uppercase tracking-widest"
                  >
                    Salvar & Sortear Novo
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Visualizar comprovante (data URLs não abrem em nova aba) */}
      {proofPreview && (
        <div onClick={() => setProofPreview(null)} className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in cursor-zoom-out">
          <button onClick={() => setProofPreview(null)} className="absolute top-4 right-4 text-gray-300 hover:text-white bg-black/60 rounded-full p-2">
            <X className="w-6 h-6" />
          </button>
          <img src={proofPreview} alt="Comprovante" className="max-w-full max-h-[90vh] rounded-lg border border-gray-800" />
        </div>
      )}

      {/* Pop-up de Criação de Sorteio */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-[#121214] border-0 md:border border-gray-800 rounded-none md:rounded-2xl w-full max-w-5xl shadow-2xl relative my-0 md:my-12 overflow-hidden flex flex-col md:flex-row min-h-screen md:min-h-0">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 md:top-6 md:right-6 text-gray-400 hover:text-white transition-colors z-20 bg-black/50 md:bg-transparent rounded-full p-2 md:p-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div className="p-6 md:p-8 md:w-[55%] space-y-6 max-h-none md:max-h-[85vh] overflow-y-visible md:overflow-y-auto custom-scrollbar pt-16 md:pt-8">
              <h2 className="text-2xl font-black text-white uppercase tracking-wider">{editingGiveaway ? "Editar Sorteio" : "Criar Sorteio"}</h2>

              <form onSubmit={handleCreateSorteio} className="space-y-5">
                {/* Campos Globais (Sempre Visíveis) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    Nome
                    <TooltipIcon text="Nome principal do sorteio, ex: Sorteio Mensal TopSkin. Se quiser dividir o título em duas linhas e duas cores, use o caractere | ex: BAIONETA | FOREST DDPAT" />
                  </label>
                  <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: BAIONETA | FOREST DDPAT" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      Valor do Prêmio (R$)
                        <TooltipIcon text="Aparece em VALOR no card. Ex: 1.364,35" />
                    </label>
                    <input type="text" value={newPrizeValue} onChange={(e) => setNewPrizeValue(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: 1.364,35" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      Data do Sorteio
                        <TooltipIcon text="Data exata de encerramento. Serve para alimentar o cronômetro automaticamente." />
                    </label>
                    <input type="datetime-local" value={newDrawDate} onChange={(e) => setNewDrawDate(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors [color-scheme:dark]" />
                  </div>
                </div>

                {/* Campos Condicionais baseados na Aba Selecionada */}
                <div className="pt-4 border-t border-white/5 space-y-5 animate-fade-in relative min-h-[300px]">
                  {/* No celular a prévia fica escondida, então as abas aparecem aqui também */}
                  <div className="md:hidden flex bg-[#121214] border border-gray-800 rounded-lg overflow-hidden">
                    {(["home", "destaque", "sorteio"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPreviewMode(mode)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${previewMode === mode ? "bg-purple-600 text-white" : "text-gray-500"}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  <h3 className="text-[10px] font-bold text-purple-500 tracking-widest uppercase flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                    Preenchendo: {previewMode === "home" ? "Card da Home" : previewMode === "destaque" ? "Popup de Destaque" : "Página do Sorteio"}
                  </h3>

                  {/* Linha fina aparece nas três telas */}
                  <div className="space-y-2 animate-fade-in">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      Linha Fina (Subtítulo)
                      <TooltipIcon text="Aparece nas três telas: balão no card da Home, linha com 🔥 no Destaque e faixa no topo da página do sorteio. Ex: FACTORY-NEW." />
                    </label>
                    <input type="text" value={newSubtitle} onChange={(e) => setNewSubtitle(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: FACTORY-NEW" />
                  </div>

                  {previewMode === "home" && (
                  <>
                      <div className="space-y-2 animate-fade-in">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                          Destaque (Opcional)
                          <TooltipIcon text="Balão colorido que aparece no canto superior esquerdo da imagem no card da Home." />
                        </label>
                        <input type="text" value={newHighlight} onChange={(e) => setNewHighlight(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: CSGO-SKINS" />
                      </div>

                      <div className="animate-fade-in">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                            Texto da Entrada
                              <TooltipIcon text="O texto que aparece em 'ENTRADA' no card da Home. Ex: Gratuito ou R$ 12,00" />
                          </label>
                          <input type="text" value={newPrizeLabel} onChange={(e) => setNewPrizeLabel(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: Gratuito" />
                        </div>
                      </div>

                      <ImageField
                        label="Imagem (Card da Home)"
                        tooltip="Imagem do card na lista de sorteios da página inicial."
                        value={images.home}
                        hint={IMAGE_SIZES.home}
                        onPick={(file) => pickImage("home", file)}
                        onClear={() => clearImage("home")}
                      />
                  </>
                  )}

                  {(previewMode === "destaque" || previewMode === "sorteio") && (
                    <div className="space-y-2 animate-fade-in">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                        Descrição
                        <TooltipIcon text="Texto com as regras. Aparece no popup e na página." />
                      </label>
                      <textarea rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors resize-none" placeholder="Ex: Respostas aceitas de 20/01 até 28/02. Regras, cupom, etc." />
                    </div>
                  )}

                  {(previewMode === "destaque" || previewMode === "sorteio") && (
                    <>
                      {previewMode === "sorteio" && (
                      <div className="space-y-2 animate-fade-in">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                          Texto de Envio
                          <TooltipIcon text="Linha abaixo do valor na página do sorteio. Ex: 100% grátis · Enviado direto via Steam Trade" />
                        </label>
                        <input type="text" value={newShippingText} onChange={(e) => setNewShippingText(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: 100% grátis · Enviado direto via Steam Trade" />
                      </div>
                      )}

                      <div className="space-y-2 animate-fade-in">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                          Texto de Login
                          <TooltipIcon text="Texto abaixo do botão QUERO PARTICIPAR." />
                        </label>
                        <input type="text" value={newLoginText} onChange={(e) => setNewLoginText(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: Entrada Gratuita . Login com a Twitch" />
                      </div>

                      {previewMode === "destaque" ? (
                        <ImageField
                          key="featured"
                          label="Imagem (Popup de Destaque)"
                          tooltip="Imagem do popup que abre na Home quando o sorteio está em destaque. Sem ela, o site usa a imagem da Home."
                          value={images.featured}
                          hint={IMAGE_SIZES.featured}
                          onPick={(file) => pickImage("featured", file)}
                          onClear={() => clearImage("featured")}
                        />
                      ) : (
                        <ImageField
                          key="detail"
                          label="Imagem (Página do Sorteio)"
                          tooltip="Imagem grande da página do sorteio. Sem ela, o site usa a imagem da Home."
                          value={images.detail}
                          hint={IMAGE_SIZES.detail}
                          onPick={(file) => pickImage("detail", file)}
                          onClear={() => clearImage("detail")}
                        />
                      )}
                    </>
                  )}
                </div>



                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full btn-neon font-bold tracking-widest uppercase py-4 rounded-lg mt-6 text-sm text-center block disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Salvar Sorteio"}
                </button>
              </form>
            </div>

            {/* Live Preview Side */}
            <div className="hidden md:block md:w-[45%] bg-[#080809] border-l border-gray-800 p-8 flex flex-col items-center justify-center">
              <div className="flex items-center justify-between w-full max-w-[320px] mb-6">
                <h3 className="text-gray-500 font-bold text-xs tracking-widest uppercase">
                  {previewMode === "home" ? "Prévia (Home)" : previewMode === "destaque" ? "Prévia (Destaque)" : "Prévia (Sorteio)"}
                </h3>
                <div className="flex bg-[#121214] border border-gray-800 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("home")}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${previewMode === "home" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("destaque")}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${previewMode === "destaque" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    Destaque
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("sorteio")}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${previewMode === "sorteio" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    Sorteio
                  </button>
                </div>
              </div>

              {previewMode === "home" ? (
                /* O Card Simulado da Home */
                <div className="w-full max-w-[320px] rounded-xl overflow-hidden bg-[#0c0d10] border border-white/5 mx-auto group">
                {/* Imagem e Badges */}
                <div className="relative aspect-[3/2] bg-[#0c0d10] p-4 flex flex-col">
                  <div className="flex gap-2 relative z-10">
                    {newHighlight && (
                      <span className="px-3 py-1 bg-black/60 backdrop-blur-sm border border-white/10 text-gray-300 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm truncate max-w-full">
                        {newHighlight}
                      </span>
                    )}
                    {newSubtitle && (
                      <span className="px-3 py-1 bg-black/60 backdrop-blur-sm border border-white/10 text-gray-400 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm truncate max-w-full">
                        {newSubtitle}
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center z-0">
                    {images.home.preview ? (
                      <img src={images.home.preview} alt="Preview" className="w-full h-full object-cover filter transition-transform duration-500 opacity-90" />
                    ) : (
                      <Gift className="w-16 h-16 text-gray-700" />
                    )}
                  </div>
                </div>

                {/* Informações */}
                <div className="p-5 flex flex-col bg-[#0c0d10]">
                  <h3 className="font-title text-xl text-white mb-5 line-clamp-1">
                    <span className="text-purple-500 mr-2">★</span>{newTitle || "BAIONETA PHASE 2"}
                  </h3>

                  <div className="h-[1px] w-full bg-white/5 mb-4" />

                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">ENTRADA</p>
                      <p className="text-white font-bold text-sm">{newPrizeLabel || "Gratuito"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Valor</p>
                      <p className="text-purple-400 font-bold text-sm">{newPrizeValue ? `R$ ${newPrizeValue}` : "—"}</p>
                    </div>
                  </div>

                  <button type="button" className="w-full flex items-center justify-between text-gray-400 hover:text-white transition-colors group/btn">
                    <span className="text-xs font-bold uppercase tracking-widest">Participar</span>
                    <ArrowRight className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
                </div>
              ) : previewMode === "destaque" ? (
                /* O Card Simulado do Anúncio Destaque (Popup Vertical) */
                <div className="w-full max-w-[320px] rounded-[24px] overflow-hidden bg-[#101010] flex flex-col relative border border-purple-500/50 mx-auto shadow-2xl">
                  <div className="relative aspect-[3/2] w-full bg-black">
                    {images.featured.preview ? (
                      <img src={images.featured.preview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-700 bg-black/50">
                        <Gift className="w-12 h-12" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Sem imagem</span>
                        <span className="text-[9px] text-gray-600 normal-case tracking-normal">No site, usa a imagem da Home</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-black/20 to-transparent z-10" />
                  </div>
                  <div className="p-5 bg-[#101010] flex flex-col items-start w-full relative z-30">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-orange-500 text-xs">🔥</span>
                      <span className="text-[9px] font-bold text-purple-500 tracking-widest uppercase">
                        {newSubtitle || newTitle.split('|')[0] || "SORTEIO ACONTECENDO"}
                      </span>
                    </div>
                    <h1 className="font-title text-2xl text-white">
                      {newTitle.split('|')[0] || "BAIONETA"} <br/>
                      {newTitle.includes('|') && (
                        <span className="text-purple-500 inline-block mt-0.5">{newTitle.split('|')[1]}</span>
                      )}
                    </h1>
                    <p className="text-[#a0a0a0] mt-3 mb-5 text-[11px] leading-relaxed font-medium line-clamp-3">
                      {newDesc || "Respostas aceitas até a data estipulada. Siga as regras para participar!"}
                    </p>
                    <button type="button" className="w-full btn-neon py-3 text-xs flex items-center justify-center gap-2 mb-3">
                      QUERO PARTICIPAR <ArrowRight className="w-3 h-3" />
                    </button>
                    <p className="w-full text-center text-[#606060] text-[9px] font-bold uppercase tracking-widest">
                      {newLoginText || "Entrada Gratuita . Login com a Twitch"}
                    </p>
                  </div>
                </div>
              ) : (
                /* O Card Simulado da Página de Sorteio (Standalone Page Preview) */
                <div className="w-full max-w-[400px] border border-purple-500 rounded-[20px] bg-[#101010] overflow-hidden relative flex flex-col mx-auto scale-90 origin-top">
                  {/* Bloco 1: Host & Título */}
                  <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-black mb-4 border border-white/10">
                      <img src="https://ui-avatars.com/api/?name=BARR4K&background=a855f7&color=fff&size=128" alt="" className="w-full h-full object-cover" />
                    </div>

                    <div className="flex items-center justify-center gap-3 mb-3 w-full max-w-[200px]">
                      <div className="h-[1px] flex-1 bg-purple-600" />
                      <span className="text-purple-500 font-bold text-[8px] tracking-[0.2em] uppercase">{newSubtitle || "SORTEIO ESPECIAL"}</span>
                      <div className="h-[1px] flex-1 bg-purple-600" />
                    </div>

                    {!/^\s*sorteio\b/i.test(newTitle) && (
                      <h2 className="text-[#a0a0a0] font-bold text-[10px] tracking-[0.4em] mb-1 uppercase">SORTEIO</h2>
                    )}
                    <h1 className="font-title text-3xl text-white leading-[0.95]">
                      {(newTitle || "TÍTULO DO SORTEIO").split('|')[0]} <br/>
                      {(newTitle || "").includes('|') && (
                        <span className="text-purple-500 block mt-1">{(newTitle || "").split('|')[1]}</span>
                      )}
                    </h1>

                    <p className="text-[#a0a0a0] mt-4 text-xs leading-relaxed font-medium line-clamp-3">
                      {newDesc || "Descrição completa das regras do sorteio. Siga no Instagram, inscreva-se nos três canais..."}
                    </p>
                  </div>

                  {/* Bloco 2: Imagem do Prêmio */}
                  <div className="overflow-hidden border-t border-b border-white/5">
                    <div className="relative aspect-[3/2] w-full bg-black">
                      {images.detail.preview ? (
                        <img src={images.detail.preview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-700 bg-black/50">
                        <Gift className="w-12 h-12" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Sem imagem</span>
                        <span className="text-[9px] text-gray-600 normal-case tracking-normal">No site, usa a imagem da Home</span>
                      </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-black/20 to-transparent z-10" />

                      {/* Title Overlay in Image */}
                      <div className="absolute bottom-4 left-4 right-4 z-20 text-left">
                        <div className="flex items-center gap-1.5 mb-1.5 text-purple-500">
                          <Trophy className="w-3 h-3" />
                          <span className="text-[9px] font-bold tracking-widest uppercase">PRÊMIO</span>
                        </div>
                        <h3 className="font-title text-xl text-white">
                          <span className="text-white">★</span> {(newTitle || "TÍTULO DO SORTEIO").replace("|", " ")}
                        </h3>
                        <p className="text-purple-400 font-bold text-sm mt-0.5">
                          {newPrizeValue ? `R$ ${newPrizeValue}` : ""}
                        </p>
                        <p className="text-[#808080] text-[9px] mt-1 font-bold uppercase tracking-wide">{newShippingText || "100% grátis · Enviado direto via Steam Trade"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 3: Formulário de Participação */}
                  <div className="p-6 text-center flex flex-col items-center">
                    <Sparkles className="w-6 h-6 text-purple-500 mb-4" />
                    <h3 className="font-title text-lg text-white mb-2">
                      PARTICIPE AGORA
                    </h3>
                    <button type="button" className="w-full btn-neon font-bold tracking-widest uppercase py-3 rounded-lg mt-2 text-xs flex items-center justify-center gap-2">
                      <FaTwitch className="w-3 h-3" />
                      {newLoginText || "Entrada Gratuita . Login com a Twitch"}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-gray-600 text-[10px] uppercase font-bold text-center mt-6 max-w-[250px]">
                A prévia é uma aproximação visual do card.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
