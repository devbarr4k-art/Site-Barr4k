"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Gift, Sparkles, Trophy, Upload, Clock } from "lucide-react";
import Link from "next/link";
import { FaTwitch } from "react-icons/fa";
import { supabase } from "@/lib/supabase";

const useCountdown = (targetDateString: string | null) => {
  const [timeLeft, setTimeLeft] = useState({
    days: "00", hours: "00", minutes: "00", seconds: "00"
  });

  useEffect(() => {
    if (!targetDateString) return;
    
    const targetDate = new Date(targetDateString).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        setTimeLeft({ days: "00", hours: "00", minutes: "00", seconds: "00" });
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24)).toString().padStart(2, '0');
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const seconds = Math.floor((distance % (1000 * 60)) / 1000).toString().padStart(2, '0');

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer(); // call immediately
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [targetDateString]);

  return timeLeft;
};

export default function SorteioPage() {
  const params = useParams();
  const router = useRouter();
  const [giveaway, setGiveaway] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [twitchId, setTwitchId] = useState("");
  const [instagram, setInstagram] = useState("");
  const [coinsSpent, setCoinsSpent] = useState("");
  const [isParticipating, setIsParticipating] = useState(false);
  
  const timeLeft = useCountdown(giveaway?.draw_date || null);

  // Simulating Auth for now
  const isLoggedIn = true;

  useEffect(() => {
    async function fetchGiveaway() {
      if (!params.id) return;
      const { data, error } = await supabase
        .from('giveaways')
        .select('*')
        .eq('id', params.id)
        .single();
        
      if (data) {
        setGiveaway(data);
      }
      setIsLoading(false);
    }
    fetchGiveaway();
  }, [params.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const extension = file.name.split('.').pop();
      let safeName = file.name.substring(0, file.name.lastIndexOf('.'));
      safeName = safeName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_"); 
      const sanitizedFile = new File([file], `${safeName}.${extension}`, { type: file.type });
      setSelectedFile(sanitizedFile);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      alert("Redirecionando para o Login da Twitch...");
      return;
    }
    
    let proofUrl = null;
    if (selectedFile) {
      proofUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(selectedFile);
      });
    }

    const { error } = await supabase.from('participants').insert([{
      giveaway_id: giveaway.id,
      twitch_username: twitchId,
      coins_used: coinsSpent ? parseInt(coinsSpent) : 0,
      instagram: instagram,
      proof_url: proofUrl, 
      status: 'pending'
    }]);

    if (!error) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsParticipating(false);
        router.push("/meus-tickets"); 
      }, 2500);
    } else {
      alert("Erro ao participar: " + error.message);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white font-bold">Carregando...</div>;
  }

  if (!giveaway) {
    return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white font-bold">Sorteio não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-[#050505] pb-20 pt-24 px-4 sm:px-6">
      
      {/* Header com botão Voltar */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between mb-2">
        <button onClick={() => router.back()} className="flex items-center gap-3 text-[#a0a0a0] hover:text-white transition-colors text-[10px] font-bold tracking-[0.2em] uppercase">
          <ArrowLeft className="w-4 h-4" /> VOLTAR
        </button>
      </div>

      <div className="w-full max-w-2xl mx-auto animate-scale-up pb-10">
        <div className="border border-purple-500 rounded-[24px] bg-[#101010] overflow-hidden">
        
        {/* Bloco 1: Host & Título */}
        <div className="p-6 sm:p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-black mb-6 border border-white/10">
            <img src="https://ui-avatars.com/api/?name=BARR4K&background=a855f7&color=fff&size=128" alt="" className="w-full h-full object-cover" />
          </div>

          <div className="flex items-center justify-center gap-4 mb-4 w-full max-w-[280px]">
            <div className="h-[1px] flex-1 bg-purple-600" />
            <span className="text-purple-500 font-bold text-[10px] tracking-[0.2em] uppercase">{giveaway.subtitle || "SORTEIO ESPECIAL"}</span>
            <div className="h-[1px] flex-1 bg-purple-600" />
          </div>

          <h2 className="text-[#a0a0a0] font-bold text-sm tracking-[0.4em] mb-2 uppercase">SORTEIO</h2>
          <h1 className="text-4xl sm:text-5xl md:text-[4rem] font-black text-white uppercase tracking-tighter leading-[0.9]" style={{ fontFamily: 'Impact, sans-serif' }}>
            {giveaway.title.split('|')[0] || giveaway.title} <br/>
            {giveaway.title.includes('|') && (
              <span className="text-purple-500 block mt-1">{giveaway.title.split('|')[1]}</span>
            )}
          </h1>

          <p className="text-[#a0a0a0] mt-6 max-w-md text-sm leading-relaxed font-medium">
            {giveaway.description || (
              <>Estou sorteando essa baioneta de forma <strong className="text-purple-500">totalmente gratuita</strong>. Siga no Instagram, inscreva-se nos três canais e garanta até <strong className="text-white">4 entradas</strong>.</>
            )}
          </p>
        </div>

        {/* Bloco 2: Imagem do Prêmio */}
        <div className="overflow-hidden border-t border-b border-white/5">
          <div className="relative h-[320px] md:h-[450px] w-full bg-black">
            {giveaway.detail_image_url || giveaway.image_url ? (
              <img src={giveaway.detail_image_url || giveaway.image_url} alt={giveaway.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700"><Gift className="w-20 h-20" /></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-black/20 to-transparent z-10" />
            
            {/* Title Overlay in Image */}
            <div className="absolute bottom-6 left-6 right-6 z-20">
              <div className="flex items-center gap-1.5 mb-2 text-purple-500">
                <Trophy className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-widest uppercase">{giveaway.prize_label || "PRÊMIO"}</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                <span className="text-white">★</span> {giveaway.title}
              </h3>
              <p className="text-purple-400 font-bold text-lg mt-1">
                {giveaway.prize_value ? `R$ ${giveaway.prize_value}` : (giveaway.coins_cost === 0 ? "R$ 860,54" : "R$ 1.364,35")}
              </p>
              <p className="text-[#808080] text-[11px] mt-2 font-bold uppercase tracking-wide">{giveaway.shipping_text || "100% grátis · Enviado direto via Steam Trade"}</p>
            </div>
          </div>
          
          {/* Cronômetro */}
          <div className="flex border-t border-white/5 p-4 md:p-6 divide-x divide-white/5 justify-center">
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">{timeLeft.days}</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">DIAS</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">{timeLeft.hours}</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">HORAS</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">{timeLeft.minutes}</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">MIN</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">{timeLeft.seconds}</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">SEG</div>
            </div>
          </div>
          
          <div className="text-center pb-6 text-[#505050] text-[10px] font-bold uppercase tracking-wider">
            Sorteio encerra em <span className="text-white">
              {giveaway.draw_date ? new Date(giveaway.draw_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "30/09/2026"}
            </span> às <span className="text-white">
              {giveaway.draw_date ? new Date(giveaway.draw_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "23:59"}
            </span>
          </div>
        </div>

        {/* Bloco 3: Formulário de Participação */}
        <div className="p-6 sm:p-12 text-center flex flex-col items-center">
          {isSuccess ? (
            <div className="flex flex-col items-center text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-6 animate-pulse" />
              <h3 className="text-2xl font-black text-white uppercase italic tracking-wider mb-2">Entrada Confirmada!</h3>
              <p className="text-[#a0a0a0]">Sua participação foi registrada. Redirecionando...</p>
            </div>
          ) : !isParticipating ? (
            <>
              <Sparkles className="w-8 h-8 text-purple-500 mb-6" />
              <h3 className="text-2xl font-black text-white italic tracking-wider uppercase mb-3">
                PARTICIPE AGORA
              </h3>
              <p className="text-[#a0a0a0] text-sm max-w-xs mx-auto mb-8 leading-relaxed font-medium">
                Entre com sua conta da Twitch para garantir sua vaga no sorteio. Uma participação por usuário.
              </p>
              <button 
                onClick={() => setIsParticipating(true)}
                className="w-full max-w-[280px] bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 text-[11px]"
              >
                <FaTwitch className="w-4 h-4 text-purple-600" /> ENTRAR COM A TWITCH
              </button>
            </>
          ) : (
            <form onSubmit={handleConfirm} className="w-full text-left space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-black text-white italic tracking-wider uppercase mb-2">
                  Preencher Requisitos
                </h3>
              </div>

              <div>
                <label className="block text-[#a0a0a0] text-xs font-bold uppercase tracking-wider mb-2">Seu @ na Twitch</label>
                <input 
                  type="text" 
                  required
                  value={twitchId}
                  onChange={(e) => setTwitchId(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Ex: gaules"
                />
              </div>

              <div>
                <label className="block text-[#a0a0a0] text-xs font-bold uppercase tracking-wider mb-2">Valor em Coins</label>
                <input 
                  type="number" 
                  required
                  value={coinsSpent}
                  onChange={(e) => setCoinsSpent(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Ex: 5000"
                />
              </div>

              <div>
                <label className="block text-[#a0a0a0] text-xs font-bold uppercase tracking-wider mb-2">SEU ID NA CASA</label>
                <input 
                  type="text" 
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Ex: 12345678"
                />
              </div>

              <div>
                <label className="block text-[#a0a0a0] text-xs font-bold uppercase tracking-wider mb-2">Comprovante (Opcional)</label>
                <div className="w-full border-2 border-dashed border-white/10 rounded-lg p-6 flex flex-col items-center justify-center bg-[#050505] hover:bg-white/5 transition-colors cursor-pointer relative group">
                  <input 
                    type="file" 
                    onChange={handleFileChange}
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  <Upload className="w-6 h-6 text-[#505050] mb-2 group-hover:text-purple-500 transition-colors" />
                  <p className="text-[#a0a0a0] text-sm font-medium">
                    {selectedFile ? selectedFile.name : "Clique ou arraste a imagem aqui"}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsParticipating(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-wider py-4 rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black italic uppercase tracking-wider py-4 rounded-xl transition-all shadow-lg text-sm"
                >
                  Confirmar
                </button>
              </div>
            </form>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
