"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Settings, Users, Gift, Save, AlertTriangle, Star, ArrowRight } from "lucide-react";
import { FaTwitch } from "react-icons/fa";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("sorteios");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Real States for Supabase Data
  const [sorteios, setSorteios] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New States for Giveaways UI
  const [managingParticipants, setManagingParticipants] = useState<string | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [editTwitchUsername, setEditTwitchUsername] = useState("");
  const [editCoinsUsed, setEditCoinsUsed] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState("Amarelo");
  const [previewMode, setPreviewMode] = useState<"home" | "inner">("home");

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
    const { data, error } = await supabase.from('giveaways').select('*').order('created_at', { ascending: false });
    if (data) setSorteios(data);
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

  const handleOpenParticipants = (id: string) => {
    setManagingParticipants(id);
    fetchParticipants(id);
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

  const handleEditGiveaway = (giveaway: any) => {
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
    setPreviewImage(giveaway.image_url || null);
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
          const max = 800;
          if (width > height) {
            if (width > max) { height *= max / width; width = max; }
          } else {
            if (height > max) { width *= max / height; height = max; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
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
      <aside className="w-full md:w-64 glass-panel border-r border-t-0 border-l-0 border-b-0 border-gray-800 p-6 flex flex-col gap-2">
        <h2 className="font-playfair text-2xl font-bold text-white mb-6">Painel <span className="text-purple-500">Admin</span></h2>

        <button
          onClick={() => setActiveTab("sorteios")}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === "sorteios" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <Gift className="w-5 h-5" /> Sorteios Mensais
        </button>
        <button
          onClick={() => setActiveTab("twitch")}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === "twitch" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <Gift className="w-5 h-5" /> Sorteios Twitch (Live)
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === "users" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <Users className="w-5 h-5" /> Usuários / Vencedores
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === "settings" ? "bg-purple-600/20 text-purple-300 border border-purple-500/50" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
        >
          <Settings className="w-5 h-5" /> Configurações
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
                  <button
                    onClick={() => setManagingParticipants(null)}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors"
                  >
                    Voltar aos Sorteios
                  </button>
                </div>

                <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
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
              </div>
            ) : (
              /* View Normal de Sorteios Mensais */
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white">Sorteios Ativos</h1>
                    <p className="text-gray-400">Crie, edite ou encerre os sorteios da plataforma.</p>
                  </div>
                  <button
                    onClick={openCreateModal}
                    className="btn-neon px-6 py-3 rounded-lg font-bold flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Criar Novo Sorteio
                  </button>
                </div>

                {/* Tabela de Gerenciamento */}
                <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
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
                            <td className="px-6 py-4">?</td> {/* TODO: Add participant count aggregation */}
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
                                  className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors" title="Editar">
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
                <table className="w-full text-left text-sm text-gray-400">
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

      {/* Pop-up de Criação de Sorteio */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-[#121214] border border-gray-800 rounded-2xl w-full max-w-5xl shadow-2xl relative my-12 overflow-hidden flex flex-col md:flex-row">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors z-20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div className="p-8 md:w-[55%] space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-wider">Criar Sorteio</h2>

              <form onSubmit={handleCreateSorteio} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    Nome
                    <span className="cursor-help text-purple-500" title="Nome principal do sorteio, ex: Sorteio Mensal TopSkin. Se quiser dividir o título em duas linhas e duas cores, use o caractere | ex: BAIONETA | FOREST DDPAT">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </span>
                  </label>
                  <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: BAIONETA | FOREST DDPAT" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    Descrição
                    <span className="cursor-help text-purple-500" title="Texto completo com as regras do sorteio. Aparece dentro da página do sorteio.">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </span>
                  </label>
                  <textarea rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors resize-none" placeholder="Ex: Respostas aceitas de 20/01 até 28/02. Regras, cupom, etc." />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    Destaque (Opcional)
                    <span className="cursor-help text-purple-500" title="Balão colorido que aparece no canto superior esquerdo da imagem no card da Home.">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </span>
                  </label>
                  <input type="text" value={newHighlight} onChange={(e) => setNewHighlight(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: CSGO-SKINS" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      Linha Fina (Subtítulo)
                      <span className="cursor-help text-purple-500" title="Opcional. Outro balão colorido ao lado do destaque, ex: FACTORY-NEW.">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      </span>
                    </label>
                    <input type="text" value={newSubtitle} onChange={(e) => setNewSubtitle(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: FACTORY-NEW" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      Texto da Entrada
                      <span className="cursor-help text-purple-500" title="O texto que aparece em 'ENTRADA' no card inferior esquerdo. Ex: Gratuito ou R$ 12,00">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      </span>
                    </label>
                    <input type="text" value={newPrizeLabel} onChange={(e) => setNewPrizeLabel(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: Gratuito" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      Valor do Prêmio (R$)
                      <span className="cursor-help text-purple-500" title="Aparece em VALOR no card. Ex: 1.364,35">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      </span>
                    </label>
                    <input type="text" value={newPrizeValue} onChange={(e) => setNewPrizeValue(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: 1.364,35" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      Data do Sorteio
                      <span className="cursor-help text-purple-500" title="Data exata de encerramento. Serve para alimentar o cronômetro automaticamente.">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      </span>
                    </label>
                    <input type="datetime-local" value={newDrawDate} onChange={(e) => setNewDrawDate(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors [color-scheme:dark]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    Texto de Login (Página Sorteio)
                    <span className="cursor-help text-purple-500" title="Texto que aparece abaixo do botão QUERO PARTICIPAR na página interna.">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </span>
                  </label>
                  <input type="text" value={newLoginText} onChange={(e) => setNewLoginText(e.target.value)} className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" placeholder="Ex: Entrada Gratuita . Login com a Twitch" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      Imagem (Capa / Home)
                      <span className="cursor-help text-purple-500" title="Imagem do prêmio, de preferência com fundo transparente, para os cards da tela inicial.">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      </span>
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
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      Imagem (Página Sorteio)
                      <span className="cursor-help text-purple-500" title="Imagem grande (com fundo) que aparece dentro da aba do sorteio, em alta resolução.">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      </span>
                    </label>
                    <label className="w-full border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0a0a0b] relative">
                      <input type="file" onChange={(e) => e.target.files && setNewDetailImage(e.target.files[0])} accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      <span className="text-gray-400 font-bold text-xs uppercase tracking-widest text-center truncate px-2 w-full">
                        {newDetailImage ? newDetailImage.name : "Imagem Interna"}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between">
                    Cor Principal do Card (Borda / Botão)
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {colorOptions.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setSelectedColor(color.name)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedColor === color.name
                            ? "bg-gray-800 text-white border border-gray-600"
                            : "bg-[#0a0a0b] text-gray-400 border border-gray-800 hover:bg-gray-900"
                          }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${color.hex}`}></span>
                        {color.name}
                      </button>
                    ))}
                  </div>
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
                  {previewMode === "home" ? "Prévia (Home)" : "Prévia (Sorteio)"}
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
                    onClick={() => setPreviewMode("inner")}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${previewMode === "inner" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    Sorteio
                  </button>
                </div>
              </div>
              
              {previewMode === "home" ? (
                /* O Card Simulado da Home */
                <div className="w-full max-w-[320px] rounded-xl p-6 bg-[#0c0d10] relative group transition-colors animated-border-card border border-white/5 mx-auto">
                {/* Destaques */}
                <div className="flex gap-2 flex-wrap mb-4 z-20 relative">
                  {newHighlight && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#1a1b23] text-purple-400 border border-purple-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                      {newHighlight}
                    </span>
                  )}
                  {newSubtitle && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#1a1b23] text-gray-400 border border-gray-800">
                      {newSubtitle}
                    </span>
                  )}
                </div>

                {/* Imagem */}
                <div className="relative h-48 w-full mb-6 z-10 flex items-center justify-center">
                  {previewImage ? (
                    <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 bg-black/50 rounded-xl">
                      <Gift className="w-12 h-12 mb-2" />
                      <span className="text-xs font-bold uppercase tracking-widest">Sem Imagem</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="z-20 relative">
                  <h3 className="text-xl font-bold text-white mb-6 line-clamp-2">
                    <span className="text-[#FF6B1C] mr-2">★</span>
                    {newTitle.split('|')[0] || "BAIONETA"}
                    {newTitle.includes('|') && (
                      <span className="text-gray-400 font-normal"> | {newTitle.split('|')[1]}</span>
                    )}
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
              ) : (
                /* O Card Simulado da Página de Sorteio (Popup) */
                <div className="w-full max-w-[320px] rounded-[24px] overflow-hidden bg-[#101010] flex flex-col relative border border-purple-500/50 mx-auto shadow-2xl">
                  <div className="relative h-[220px] w-full bg-black">
                    {previewImage ? (
                      <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
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
                    <button type="button" className="w-full bg-purple-600 text-white font-black uppercase tracking-widest py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
                      QUERO PARTICIPAR <ArrowRight className="w-3 h-3" />
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
