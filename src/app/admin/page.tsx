"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Settings, Users, Gift, Save, AlertTriangle, Star, ArrowRight, Trophy, Sparkles, Bot } from "lucide-react";
import tmi from "tmi.js";
import { FaTwitch } from "react-icons/fa";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("sorteios");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Real States for Supabase Data
  const [sorteios, setSorteios] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [winners, setWinners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New States for Giveaways UI
  const [managingParticipants, setManagingParticipants] = useState<string | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [editTwitchUsername, setEditTwitchUsername] = useState("");
  const [editCoinsUsed, setEditCoinsUsed] = useState(0);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [rouletteItems, setRouletteItems] = useState<any[]>([]);
  const [rouletteOffset, setRouletteOffset] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [drawnWinner, setDrawnWinner] = useState<any>(null);
  const [localWinners, setLocalWinners] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState("Amarelo");
  const [previewMode, setPreviewMode] = useState<"home" | "destaque" | "sorteio">("home");

  // Bot da Twitch
  const [botStatus, setBotStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [botCommand, setBotCommand] = useState("!sorteio");
  const tmiClient = useRef<any>(null);

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
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newDetailImage, setNewDetailImage] = useState<File | null>(null);
  const [newLoginText, setNewLoginText] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewDetailImage, setPreviewDetailImage] = useState<string | null>(null);

  const [editingGiveaway, setEditingGiveaway] = useState<string | null>(null);

  const colorOptions = [
    { name: "Amarelo", hex: "bg-yellow-500" },
    { name: "Verde", hex: "bg-green-500" },
    { name: "Azul", hex: "bg-blue-500" },
    { name: "Roxo", hex: "bg-purple-500" },
    { name: "Vermelho", hex: "bg-red-500" },
    { name: "Laranja", hex: "bg-orange-500" },
    { name: "Rosa", hex: "bg-pink-500" },
  ];

  const router = useRouter();

  // Conexão Inicial Supabase
  useEffect(() => {
    fetchSorteios();
    fetchWinners();
  }, []);

  const fetchSorteios = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('giveaways').select('id, title, description, highlight_text, highlight_color, coins_cost, subtitle, prize_label, shipping_text, prize_value, draw_date, login_text, type, status, created_at').order('created_at', { ascending: false });
    if (data) {
      setSorteios(data);
      // Fetch participant counts
      const { data: countData } = await supabase.from('participants').select('giveaway_id');
      if (countData) {
        const counts = countData.reduce((acc: Record<string, number>, p: any) => {
          acc[p.giveaway_id] = (acc[p.giveaway_id] || 0) + 1;
          return acc;
        }, {});
        setParticipantCounts(counts);
      }
    }
    setIsLoading(false);
  };

  const fetchParticipants = async (giveawayId: string) => {
    const { data } = await supabase.from('participants').select('*').eq('giveaway_id', giveawayId);
    if (data) setParticipants(data);
  };

  const handleUpdateParticipantStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('participants').update({ status }).eq('id', id);
    if (!error && managingParticipants) {
      fetchParticipants(managingParticipants);
    } else if (error) {
      alert("Erro ao atualizar status: " + error.message);
    }
  };

  const handleSaveParticipantEdit = async (id: string) => {
    const { error } = await supabase.from('participants').update({
      twitch_username: editTwitchUsername,
      coins_used: editCoinsUsed
    }).eq('id', id);

    if (!error && managingParticipants) {
      setEditingParticipant(null);
      fetchParticipants(managingParticipants);
    } else if (error) {
      alert("Erro ao salvar: " + error.message);
    }
  };

  const fetchWinners = async () => {
    const { data } = await supabase.from('winners').select('*').order('won_at', { ascending: false });
    if (data) setWinners(data);
  };

  const fetchLocalWinners = async (giveawayId: string) => {
    const { data } = await supabase.from('winners').select('*').eq('giveaway_id', giveawayId);
    if (data) setLocalWinners(data);
  };

  const handleOpenParticipants = (id: string) => {
    setManagingParticipants(id);
    fetchParticipants(id);
    fetchLocalWinners(id);
  };

  const startRoulette = () => {
    // Remover aprovados que já ganharam nesta sessão
    const alreadyWon = localWinners.map(w => w.twitch_username);
    const approved = participants.filter(p => p.status === 'approved' && !alreadyWon.includes(p.twitch_username));
    
    if (approved.length === 0) {
      alert("Não há mais participantes aprovados e não-sorteados disponíveis.");
      return;
    }

    const items = [];
    for (let i = 0; i < 50; i++) {
      items.push(approved[Math.floor(Math.random() * approved.length)]);
    }

    const trueWinnerIndex = 40;
    const trueWinner = approved[Math.floor(Math.random() * approved.length)];
    items[trueWinnerIndex] = trueWinner;

    setRouletteItems(items);
    setDrawnWinner(trueWinner);
    setRouletteOffset(0);
    setIsDrawing(true);
    setShowWinner(false);

    // Inicia o spin após 100ms
    setTimeout(() => {
      setRouletteOffset(trueWinnerIndex * 160); // 144px width + 16px gap = 160px
    }, 100);

    // Revela vencedor após 10s
    setTimeout(() => {
      setShowWinner(true);
    }, 10100);
  };

  const handleDrawWinner = () => {
    startRoulette();
  };

  const handleChatEntry = async (username: string) => {
    // Busca todos os sorteios ativos
    const { data: activeGiveaways } = await supabase.from('giveaways').select('id').eq('status', 'active');
    if (!activeGiveaways || activeGiveaways.length === 0) return;
    
    // Insere o usuário em todos os sorteios ativos
    for (const g of activeGiveaways) {
       const { data: existing } = await supabase.from('participants')
         .select('id')
         .eq('giveaway_id', g.id)
         .eq('twitch_username', username)
         .maybeSingle();
         
       if (!existing) {
          await supabase.from('participants').insert({
             giveaway_id: g.id,
             twitch_username: username,
             coins_used: 0,
             status: 'approved' // Sorteio de chat é aprovação automática
          });
       }
    }
  };

  const toggleTwitchBot = () => {
    if (botStatus === "connected" || botStatus === "connecting") {
       tmiClient.current?.disconnect();
       setBotStatus("disconnected");
       return;
    }
    
    setBotStatus("connecting");
    const client = new tmi.Client({
      channels: ['barr4k'] // Nome do canal da Twitch
    });
    
    client.connect().then(() => {
       setBotStatus("connected");
    }).catch(err => {
       console.error("Erro ao conectar bot:", err);
       setBotStatus("disconnected");
    });
    
    client.on('message', async (channel, tags, message, self) => {
       if (self) return;
       
       if (message.toLowerCase().trim() === botCommand.toLowerCase().trim()) {
          const username = tags.username;
          if (username) {
             await handleChatEntry(username);
          }
       }
    });
    
    tmiClient.current = client;
  };

  const saveWinner = async (drawAgain: boolean) => {
    const sorteio = sorteios.find(s => s.id === managingParticipants);
    const prize = sorteio ? sorteio.title : "Prêmio Sorteado";
    
    const { data, error } = await supabase.from('winners').insert([{
      twitch_username: drawnWinner.twitch_username,
      prize: prize,
      in_hall_of_fame: false,
      giveaway_id: managingParticipants
    }]).select();
    
    if (error) {
       alert("Erro ao salvar: " + error.message);
    } else {
       if (data && data[0]) setLocalWinners(prev => [...prev, data[0]]);
       fetchWinners(); // Atualiza aba global tbm
    }

    if (drawAgain) {
       startRoulette();
    } else {
       setIsDrawing(false);
       setShowWinner(false);
    }
  };

  const handleDeleteGiveaway = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este sorteio?")) {
      const { error } = await supabase.from('giveaways').delete().eq('id', id);
      if (!error) fetchSorteios();
      else alert("Erro: " + error.message);
    }
  };

  const handleSetFeatured = async (id: string, currentType: string) => {
    // Primeiro limpa todos os outros de featured para monthly
    await supabase.from('giveaways').update({ type: 'monthly' }).eq('type', 'featured');
    
    if (currentType !== 'featured') {
      // Agora seta esse para featured
      const { error } = await supabase.from('giveaways').update({ type: 'featured' }).eq('id', id);
      if (error) alert("Erro ao destacar: " + error.message);
    }
    
    fetchSorteios();
  };

  const handleEditGiveaway = async (giveaway: any) => {
    // Fetch heavy image data dynamically
    const { data: imgData } = await supabase.from('giveaways').select('image_url, detail_image_url').eq('id', giveaway.id).single();
    
    setNewTitle(giveaway.title);
    setNewDesc(giveaway.description || "");
    setNewHighlight(giveaway.highlight_text || "");
    setSelectedColor(giveaway.highlight_color || "Amarelo");
    setNewCoins(giveaway.coins_cost || 0);
    setNewSubtitle(giveaway.subtitle || "");
    setNewPrizeLabel(giveaway.prize_label || "");
    setNewShippingText(giveaway.shipping_text || "");
    setNewPrizeValue(giveaway.prize_value || "");
    setNewDrawDate(giveaway.draw_date ? new Date(giveaway.draw_date).toISOString().slice(0, 16) : "");
    setNewLoginText(giveaway.login_text || "");
    setNewImage(null);
    setNewDetailImage(null);
    setPreviewImage(imgData?.image_url || null);
    setPreviewDetailImage(imgData?.detail_image_url || null);
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
    setNewImage(null);
    setNewDetailImage(null);
    setPreviewImage(null);
    setEditingGiveaway(null);
    setIsCreateModalOpen(true);
  };

  const readImageAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max = 600; // Reduzido para caber 2 imagens no limite de 1MB do Supabase
          if (width > height) {
            if (width > max) { height *= max / width; width = max; }
          } else {
            if (height > max) { width *= max / height; height = max; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/webp', 0.6)); // Usando webp para compressão otimizada
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCreateSorteio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return alert("Título é obrigatório!");

    let imageUrl = null;
    if (newImage) imageUrl = await readImageAsBase64(newImage);
    
    let detailImageUrl = null;
    if (newDetailImage) detailImageUrl = await readImageAsBase64(newDetailImage);

    if (editingGiveaway) {
      const updateData: any = {
        title: newTitle,
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
      if (imageUrl) updateData.image_url = imageUrl;
      if (detailImageUrl) updateData.detail_image_url = detailImageUrl;

      const { error } = await supabase.from('giveaways').update(updateData).eq('id', editingGiveaway);
      
      if (!error) {
        setIsCreateModalOpen(false);
        setEditingGiveaway(null);
        fetchSorteios();
      } else alert("Erro ao editar: " + error.message);
    } else {
      const { error } = await supabase.from('giveaways').insert([{
        title: newTitle,
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
        image_url: imageUrl,
        detail_image_url: detailImageUrl,
        type: 'monthly',
        status: 'active'
      }]);

      if (!error) {
        setIsCreateModalOpen(false);
        fetchSorteios(); // Atualiza a lista
      } else {
        alert("Erro ao criar sorteio: " + error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black pt-24 pb-20 flex flex-col md:flex-row">

      {/* Sidebar Admin */}
      <aside className="w-full md:w-64 glass-panel md:border-r border-b md:border-b-0 border-gray-800 p-4 md:p-6 flex md:flex-col gap-2 overflow-x-auto hide-scrollbar z-10 sticky top-0 md:static bg-black/80 md:bg-transparent backdrop-blur-md">
        <h2 className="font-playfair text-xl md:text-2xl font-bold text-white mb-0 md:mb-6 flex-shrink-0 flex items-center md:block mr-4 md:mr-0">Painel <span className="text-purple-500 ml-1 md:ml-0">Admin</span></h2>

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
          <Gift className="w-4 h-4 md:w-5 md:h-5" /> Sorteios Twitch (Live)
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-lg font-medium transition-all flex-shrink-0 ${activeTab === "users" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <Users className="w-4 h-4 md:w-5 md:h-5" /> Usuários / Vencedores
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-lg font-medium transition-all flex-shrink-0 ${activeTab === "settings" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <Settings className="w-4 h-4 md:w-5 md:h-5" /> Configurações
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10">

        {activeTab === "sorteios" && (
          <div className="space-y-8 animate-fade-in">
            {managingParticipants !== null ? (
              /* View de Gerenciamento de Participantes */
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                      Participantes do Sorteio #{managingParticipants}
                    </h1>
                    <p className="text-gray-400 mt-1">Apenas participantes <span className="text-green-400 font-bold">Aprovados</span> irão para a roleta.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDrawWinner}
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
                                  <input 
                                    type="number" 
                                    value={editCoinsUsed} 
                                    onChange={(e) => setEditCoinsUsed(Number(e.target.value))}
                                    className="bg-black border border-gray-700 rounded px-2 py-1 text-white w-20 outline-none focus:border-purple-500" 
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  {p.proof_url ? (
                                    <a href={p.proof_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline font-medium truncate max-w-[100px] inline-block">
                                      Ver Imagem
                                    </a>
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
                                <td className="px-6 py-4">
                                  <a href={p.proof_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline font-medium">
                                    Ver Imagem
                                  </a>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded text-xs font-bold 
                                    ${p.status === "approved" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                                      p.status === "rejected" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                        "bg-yellow-500/20 text-yellow-500 border border-yellow-500/30"}`}>
                                    {p.status}
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
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
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
                    <div className="glass-panel rounded-xl overflow-hidden border border-yellow-500/30">
                      <table className="w-full text-left text-sm text-gray-400">
                        <thead className="bg-yellow-900/20 text-xs uppercase text-gray-300 border-b border-yellow-900/50">
                          <tr>
                            <th className="px-6 py-4">Usuário da Twitch</th>
                            <th className="px-6 py-4">Prêmio Ganho</th>
                            <th className="px-6 py-4">Data do Sorteio</th>
                            <th className="px-6 py-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {localWinners.map(winner => (
                            <tr key={winner.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-bold text-white">@{winner.twitch_username}</td>
                              <td className="px-6 py-4 text-yellow-500 font-bold">{winner.prize}</td>
                              <td className="px-6 py-4">{new Date(winner.won_at).toLocaleDateString()}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={winner.in_hall_of_fame ? 'text-purple-400 font-bold' : 'text-gray-500'}>
                                  {winner.in_hall_of_fame ? 'No Hall da Fama' : 'Comum'}
                                </span>
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
                    <div className="relative flex items-center">
                      <input 
                        type="text" 
                        value={botCommand}
                        onChange={(e) => setBotCommand(e.target.value)}
                        disabled={botStatus !== 'disconnected'}
                        placeholder="Ex: !sorteio"
                        className="bg-black/50 border border-gray-700 text-white font-mono rounded-lg px-4 py-3 w-40 disabled:opacity-50 focus:border-purple-500 focus:outline-none transition-colors"
                        title="Comando que o bot vai escutar no chat"
                      />
                    </div>
                    <button 
                      onClick={toggleTwitchBot}
                      className={`flex items-center gap-2 font-bold px-6 py-3 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] border transition-all ${
                        botStatus === 'connected' 
                          ? 'bg-purple-900/50 border-purple-500 text-purple-400' 
                          : botStatus === 'connecting'
                          ? 'bg-yellow-900/50 border-yellow-500 text-yellow-500 cursor-wait'
                          : 'bg-black border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                      }`}
                    >
                      <Bot className={`w-5 h-5 ${botStatus === 'connected' ? 'animate-pulse' : ''}`} />
                      {botStatus === 'connected' ? 'Bot Rodando' : botStatus === 'connecting' ? 'Conectando...' : 'Ligar Bot'}
                    </button>
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
                        {sorteios.map((sorteio) => (
                          <tr key={sorteio.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-bold text-white text-xs truncate max-w-[100px]" title={sorteio.id}>{sorteio.id}</td>
                            <td className="px-6 py-4 text-white font-medium">{sorteio.title}</td>
                            <td className="px-6 py-4">{sorteio.type}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${sorteio.status === "active" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-gray-800 text-gray-400"}`}>
                                {sorteio.status}
                              </span>
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "twitch" && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-white">Sorteios Twitch (Live)</h1>
              <p className="text-gray-400">Configure os parâmetros da sua live para captar usuários do chat da Twitch.</p>
            </div>

            <div className="glass-panel rounded-xl border border-purple-500/30 p-8 relative overflow-hidden animated-border-card">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-500" /> Criar Sorteio Instantâneo (Chat)
              </h2>
              <form className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-400">Título do Prêmio</label>
                  <input type="text" className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" placeholder="Ex: Faca Butterfly" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400">Palavra-chave (Comando Chat)</label>
                    <input type="text" className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" placeholder="Ex: !BARR4K" defaultValue="!BARR4K" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-purple-500">Imagem do Prêmio</label>
                    <input type="file" className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-2 text-gray-400 focus:border-purple-500 outline-none" />
                  </div>
                </div>

                {/* Twitch Multipliers Config */}
                <div className="pt-4 border-t border-gray-800 mt-4">
                  <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Multiplicadores de Tiers (Subscribers)</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-blue-400">TIER 1 (Chances)</label>
                      <input type="number" defaultValue="2" className="w-full bg-[#0a0a0b] border border-blue-500/30 rounded-lg px-4 py-2 text-white outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-pink-400">TIER 2 (Chances)</label>
                      <input type="number" defaultValue="3" className="w-full bg-[#0a0a0b] border border-pink-500/30 rounded-lg px-4 py-2 text-white outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-purple-400">TIER 3 (Chances)</label>
                      <input type="number" defaultValue="5" className="w-full bg-[#0a0a0b] border border-purple-500/30 rounded-lg px-4 py-2 text-white outline-none" />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(true)}
                  className="w-full btn-neon font-bold italic tracking-widest uppercase py-4 rounded-lg mt-6 text-sm text-center block"
                >
                  Iniciar Captação no Chat (Abrir Painel Live)
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-white">Usuários Vencedores</h1>
              <p className="text-gray-400">Histórico permanente de vencedores. Controle quem aparece no Hall da Fama.</p>
            </div>

            <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm text-gray-400">
                  <thead className="bg-purple-900/20 text-xs uppercase text-gray-300 border-b border-purple-900/50">
                    <tr>
                      <th className="px-6 py-4">Usuário</th>
                      <th className="px-6 py-4">Prêmio Ganho</th>
                      <th className="px-6 py-4">Data do Sorteio</th>
                      <th className="px-6 py-4 text-center">Hall da Fama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winners.map((winner: any) => (
                      <tr key={winner.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-bold text-white">@{winner.twitch_username}</td>
                        <td className="px-6 py-4 text-purple-400 font-bold">{winner.prize}</td>
                        <td className="px-6 py-4">{new Date(winner.won_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${winner.in_hall_of_fame
                                ? "bg-purple-600/20 text-purple-400 border-purple-500/50 hover:bg-purple-600/40"
                                : "bg-gray-800/50 text-gray-500 border-gray-700 hover:bg-gray-700"
                              }`}
                          >
                            {winner.in_hall_of_fame ? "Destacado" : "Destacar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-white">Configurações Gerais</h1>
              <p className="text-gray-400">Gerencie integrações, economia da plataforma e alertas globais.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Twitch API */}
              <div className="glass-panel rounded-xl border border-purple-500/30 p-8 relative overflow-hidden animated-border-card">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <FaTwitch className="w-5 h-5 text-purple-500" /> Integração Twitch
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-purple-900/10 border border-purple-500/20 rounded-lg">
                    <div>
                      <h3 className="font-bold text-white">Bot Leitor de Chat</h3>
                      <p className="text-sm text-gray-400">Status: <span className="text-red-400 font-bold">Desconectado</span></p>
                    </div>
                    <button className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors">
                      Conectar Bot
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400">Canal Monitorado (ID)</label>
                    <input type="text" className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" placeholder="Ex: barr4k" defaultValue="barr4k" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Pop-up do Sorteio (Roleta) */}
      {isDrawing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-5xl flex flex-col items-center">
            
            <h2 className="text-4xl font-black text-white uppercase italic tracking-wider mb-12 animate-pulse">Sorteando...</h2>

            {/* A linha de centro (mirador) */}
            <div className="relative w-full h-48 bg-[#121214] border-y-4 border-purple-500/30 overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.1)] flex items-center">
              
              {/* O traço vermelho no meio */}
              <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-red-500 z-50 transform -translate-x-1/2 shadow-[0_0_15px_rgba(239,68,68,1)]"></div>
              
              {/* A esteira de avatares */}
              <div 
                className={`flex gap-4 transition-transform ease-[cubic-bezier(0.15,0.85,0.15,1)]`}
                style={{ 
                  paddingLeft: 'calc(50vw - 72px)', /* 72px is half of item width 144px */
                  paddingRight: '50vw',
                  transform: `translateX(-${rouletteOffset}px)`,
                  transitionDuration: rouletteOffset > 0 ? '10s' : '0s'
                }}
              >
                {rouletteItems.map((item, index) => (
                  <div key={index} className="w-[144px] h-[144px] flex-shrink-0 bg-black border border-gray-800 rounded-xl flex flex-col items-center justify-center relative overflow-hidden opacity-80">
                    <img src={`https://ui-avatars.com/api/?name=${item.twitch_username}&background=random&color=fff&size=128`} className="w-16 h-16 rounded-full mb-3 shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                    <span className="text-white font-bold text-xs uppercase tracking-widest truncate w-full text-center px-2">@{item.twitch_username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quando terminar, mostrar vencedor e botões */}
            {showWinner && (
              <div className="mt-12 bg-[#121214] border border-purple-500/50 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(168,85,247,0.3)] p-8 text-center animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-600 to-pink-600"></div>
                
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                
                <h3 className="text-3xl font-black text-white uppercase italic tracking-wider mb-2 truncate">@{drawnWinner?.twitch_username}</h3>
                <p className="text-gray-400 mb-6 font-medium text-xs">VENCEDOR DO SORTEIO (ID: {drawnWinner?.id})</p>
                
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
              <h2 className="text-2xl font-black text-white uppercase italic tracking-wider">Criar Sorteio</h2>

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
                  <h3 className="text-[10px] font-bold text-purple-500 tracking-widest uppercase mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                    Preenchendo aba: {previewMode}
                  </h3>

                  {(previewMode === "home" || previewMode === "destaque") && (
                    <>
                      <div className="space-y-2 animate-fade-in">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                          Destaque (Opcional)
                          <TooltipIcon text="Balão colorido que aparece no canto superior esquerdo da imagem no card da Home." />
                        </label>
                        <input type="text" value={newHighlight} onChange={(e) => setNewHighlight(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: CSGO-SKINS" />
                      </div>

                      <div className="grid grid-cols-2 gap-4 animate-fade-in">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                            Linha Fina (Subtítulo)
                              <TooltipIcon text="Opcional. Outro balão colorido ao lado do destaque, ex: FACTORY-NEW." />
                          </label>
                          <input type="text" value={newSubtitle} onChange={(e) => setNewSubtitle(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: FACTORY-NEW" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                            Texto da Entrada
                              <TooltipIcon text="O texto que aparece em 'ENTRADA' no card inferior esquerdo. Ex: Gratuito ou R$ 12,00" />
                          </label>
                          <input type="text" value={newPrizeLabel} onChange={(e) => setNewPrizeLabel(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: Gratuito" />
                        </div>
                      </div>

                      <div className="space-y-2 animate-fade-in">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                          Imagem (Capa / Home)
                            <TooltipIcon text="Imagem principal do prêmio para os cards da tela inicial." />
                        </label>
                        <label className="w-full border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0a0a0b] relative">
                          <input type="file" onChange={(e) => {
                            if (e.target.files) {
                              setNewImage(e.target.files[0]);
                              const reader = new FileReader();
                              reader.onload = (e) => setPreviewImage(e.target?.result as string);
                              reader.readAsDataURL(e.target.files[0]);
                            }
                          }} accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                          <span className="text-gray-400 font-bold text-xs uppercase tracking-widest text-center truncate px-2 w-full">
                            {newImage ? newImage.name : "Imagem da Capa"}
                          </span>
                        </label>
                      </div>
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

                  {(previewMode === "sorteio" || previewMode === "destaque") && (
                    <>
                      <div className="space-y-2 animate-fade-in">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                          Texto de Login
                          <TooltipIcon text="Texto abaixo do botão QUERO PARTICIPAR." />
                        </label>
                        <input type="text" value={newLoginText} onChange={(e) => setNewLoginText(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: Entrada Gratuita . Login com a Twitch" />
                      </div>

                      <div className="space-y-2 animate-fade-in">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                          Imagem (Página Sorteio)
                            <TooltipIcon text="Imagem grande/fundo para a aba do sorteio." />
                        </label>
                        <label className="w-full border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0a0a0b] relative">
                          <input type="file" onChange={(e) => {
                            if (e.target.files) {
                              setNewDetailImage(e.target.files[0]);
                              const reader = new FileReader();
                              reader.onload = (e) => setPreviewDetailImage(e.target?.result as string);
                              reader.readAsDataURL(e.target.files[0]);
                            }
                          }} accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                          <span className="text-gray-400 font-bold text-xs uppercase tracking-widest text-center truncate px-2 w-full">
                            {newDetailImage ? newDetailImage.name : "Imagem Interna"}
                          </span>
                        </label>
                      </div>
                    </>
                  )}
                </div>



                <button
                  type="submit"
                  className="w-full btn-neon font-bold italic tracking-widest uppercase py-4 rounded-lg mt-6 text-sm text-center block"
                >
                  Salvar Sorteio
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
                <div className="relative h-64 bg-[#0c0d10] p-4 flex flex-col">
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
                    {previewImage ? (
                      <img src={previewImage} alt="Preview" className="w-full h-full object-cover filter transition-transform duration-500 opacity-90" />
                    ) : (
                      <Gift className="w-16 h-16 text-gray-700" />
                    )}
                  </div>
                </div>

                {/* Informações */}
                <div className="p-5 flex flex-col bg-[#0c0d10]">
                  <h3 className="text-xl font-black text-white mb-5 uppercase tracking-tight line-clamp-1" style={{ fontFamily: 'var(--font-kanit)' }}>
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
                      <p className="text-purple-400 font-bold text-sm">R$ {newPrizeValue || "1.364,35"}</p>
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
                  <div className="relative h-[220px] w-full bg-black">
                    {previewDetailImage || previewImage ? (
                      <img src={(previewDetailImage || previewImage) as string} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 bg-black/50">
                        <Gift className="w-12 h-12 mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Sem Imagem</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-black/20 to-transparent z-10" />
                    <div className="absolute top-3 left-3 z-20 flex gap-2">
                      <div className="bg-purple-600 rounded-full px-2 py-1 flex items-center gap-1 shadow-lg">
                        <Gift className="w-3 h-3 text-white" />
                        <span className="text-[9px] font-bold text-white tracking-widest uppercase">100% GRÁTIS</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 bg-[#101010] flex flex-col items-start w-full relative z-30">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-orange-500 text-xs">🔥</span>
                      <span className="text-[9px] font-bold text-purple-500 tracking-widest uppercase">
                        {newSubtitle || newTitle.split('|')[0] || "SORTEIO ACONTECENDO"}
                      </span>
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight" style={{ fontFamily: 'var(--font-kanit)' }}>
                      SORTEIO {newTitle.split('|')[0] || "BAIONETA"} <br/>
                      {newTitle.includes('|') && (
                        <span className="text-purple-500 inline-block mt-0.5">{newTitle.split('|')[1]}</span>
                      )}
                    </h1>
                    <p className="text-[#a0a0a0] mt-3 mb-5 text-[11px] leading-relaxed font-medium line-clamp-3">
                      {newDesc || "Respostas aceitas até a data estipulada. Siga as regras para participar!"}
                    </p>
                    <button type="button" className="w-full bg-purple-600 text-white font-black uppercase tracking-widest py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(147,51,234,0.3)] mb-3">
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

                    <h2 className="text-[#a0a0a0] font-bold text-[10px] tracking-[0.4em] mb-1 uppercase">SORTEIO</h2>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-[0.9]" style={{ fontFamily: 'Impact, sans-serif' }}>
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
                    <div className="relative h-[250px] w-full bg-black">
                      {previewDetailImage || previewImage ? (
                        <img src={(previewDetailImage || previewImage) as string} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-700"><Gift className="w-12 h-12" /></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-black/20 to-transparent z-10" />
                      
                      {/* Title Overlay in Image */}
                      <div className="absolute bottom-4 left-4 right-4 z-20 text-left">
                        <div className="flex items-center gap-1.5 mb-1.5 text-purple-500">
                          <Trophy className="w-3 h-3" />
                          <span className="text-[9px] font-bold tracking-widest uppercase">{newPrizeLabel || "PRÊMIO"}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white leading-tight">
                          <span className="text-white">★</span> {newTitle || "TÍTULO DO SORTEIO"}
                        </h3>
                        <p className="text-purple-400 font-bold text-sm mt-0.5">
                          {newPrizeValue ? `R$ ${newPrizeValue}` : (Number(newCoins) === 0 ? "R$ 0,00" : "R$ 1.364,35")}
                        </p>
                        <p className="text-[#808080] text-[9px] mt-1 font-bold uppercase tracking-wide">{newShippingText || "100% grátis · Enviado direto via Steam Trade"}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bloco 3: Formulário de Participação */}
                  <div className="p-6 text-center flex flex-col items-center">
                    <Sparkles className="w-6 h-6 text-purple-500 mb-4" />
                    <h3 className="text-lg font-black text-white italic tracking-wider uppercase mb-2">
                      PARTICIPE AGORA
                    </h3>
                    <button type="button" className="w-full btn-neon font-bold italic tracking-widest uppercase py-3 rounded-lg mt-2 text-xs flex items-center justify-center gap-2">
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
