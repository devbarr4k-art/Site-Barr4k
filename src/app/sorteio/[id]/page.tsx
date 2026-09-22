"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Gift, Sparkles, Trophy, Upload, Clock, X, ArrowRight } from "lucide-react";
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
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 py-20">
      <div className="w-full max-w-[420px] animate-scale-up">
        <div className="border border-purple-500/50 rounded-[24px] bg-[#101010] overflow-hidden shadow-2xl">
          
          {/* Top Image Area */}
          <div className="relative h-[380px] w-full bg-black">
            {giveaway.detail_image_url || giveaway.image_url ? (
              <img src={giveaway.detail_image_url || giveaway.image_url} alt={giveaway.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700"><Gift className="w-20 h-20" /></div>
            )}
            {/* Gradient Overlay for bottom text */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-black/20 to-transparent z-10" />
            
            {/* Top Badges */}
            <div className="absolute top-4 left-4 z-20 flex gap-2 w-[calc(100%-32px)] justify-between items-start">
              <div className="bg-purple-600 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg">
                <Gift className="w-3.5 h-3.5 text-white" />
                <span className="text-[10px] font-bold text-white tracking-widest uppercase">100% GRÁTIS</span>
              </div>
              
              <div className="flex gap-2">
                <div className="bg-black/70 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 flex items-center shadow-lg">
                  <span className="text-[10px] font-bold text-purple-400 tracking-widest">
                    R$ {giveaway.prize_value || "1.364,35"}
                  </span>
                </div>
                <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors shadow-lg">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Bottom Overlay Text on Image */}
            <div className="absolute bottom-6 left-6 right-6 z-20">
              <div className="flex items-center gap-1.5 mb-1.5 text-purple-500">
                <Trophy className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-widest uppercase">{giveaway.prize_label || "PRÊMIO"}</span>
              </div>
              <h3 className="text-2xl font-bold text-white leading-tight">
                <span className="text-white mr-1.5">★</span> {giveaway.title.split('|')[0] || giveaway.title}
              </h3>
              <p className="text-purple-400 font-bold text-sm mt-1">
                R$ {giveaway.prize_value || "1.364,35"}
              </p>
            </div>
          </div>

          {/* Bottom Area (Content & Actions) */}
          <div className="p-6 sm:p-8 bg-[#101010] flex flex-col items-start w-full relative z-30">
            {!isParticipating && !isSuccess ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-orange-500 text-sm">🔥</span>
                  <span className="text-[10px] font-bold text-purple-500 tracking-widest uppercase">
                    {giveaway.subtitle || giveaway.title.split('|')[0]}
                  </span>
                </div>
                
                <h1 className="text-4xl sm:text-[2.5rem] font-black text-white uppercase tracking-tighter leading-[0.95]" style={{ fontFamily: 'var(--font-kanit)' }}>
                  SORTEIO {giveaway.title.split('|')[0] || "BAIONETA DOPLER"} <br/>
                  {giveaway.title.includes('|') && (
                    <span className="text-purple-500 inline-block mt-1">{giveaway.title.split('|')[1]}</span>
                  )}
                </h1>
                
                <p className="text-[#a0a0a0] mt-4 mb-6 text-sm leading-relaxed font-medium">
                  {giveaway.description || (
                    `Respostas aceitas até dia ${giveaway.draw_date ? new Date(giveaway.draw_date).toLocaleDateString('pt-BR') : '30/09/2026'}!`
                  )}
                </p>

                {/* Cronômetro Compacto */}
                <div className="w-full flex items-center justify-between bg-black/50 border border-white/5 rounded-xl p-4 mb-6">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-[#606060] uppercase tracking-widest font-bold mb-1">Encerra em</span>
                    <div className="flex items-center gap-1.5 text-white font-black text-lg" style={{ fontFamily: 'var(--font-kanit)' }}>
                      <Clock className="w-4 h-4 text-purple-500 mr-1" />
                      {timeLeft.days}d : {timeLeft.hours}h : {timeLeft.minutes}m : {timeLeft.seconds}s
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setIsParticipating(true)}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 text-sm shadow-[0_0_20px_rgba(147,51,234,0.3)] mb-4"
                >
                  QUERO PARTICIPAR <ArrowRight className="w-4 h-4" />
                </button>
                
                <p className="w-full text-center text-[#606060] text-[10px] font-bold uppercase tracking-widest">
                  {giveaway.login_text || "Entrada Gratuita . Login com a Twitch"}
                </p>
              </>
            ) : isSuccess ? (
              <div className="w-full flex flex-col items-center text-center py-6">
                <CheckCircle2 className="w-16 h-16 text-green-500 mb-6 animate-pulse" />
                <h3 className="text-2xl font-black text-white uppercase italic tracking-wider mb-2">Entrada Confirmada!</h3>
                <p className="text-[#a0a0a0] text-sm">Sua participação foi registrada. Redirecionando...</p>
              </div>
            ) : (
              <form onSubmit={handleConfirm} className="w-full text-left space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-black text-white italic tracking-wider uppercase mb-1">
                    Completar Acesso
                  </h3>
                  <p className="text-[#a0a0a0] text-xs">Preencha para liberar sua vaga.</p>
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
                  <div className="w-full border-2 border-dashed border-white/10 rounded-lg p-5 flex flex-col items-center justify-center bg-[#050505] hover:bg-white/5 transition-colors cursor-pointer relative group">
                    <input 
                      type="file" 
                      onChange={handleFileChange}
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    />
                    <Upload className="w-5 h-5 text-[#505050] mb-2 group-hover:text-purple-500 transition-colors" />
                    <p className="text-[#a0a0a0] text-[11px] font-medium text-center">
                      {selectedFile ? selectedFile.name : "Toque para adicionar imagem"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsParticipating(false)}
                    className="w-1/3 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-wider py-3.5 rounded-xl transition-colors text-xs"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit"
                    className="w-2/3 bg-purple-600 hover:bg-purple-700 text-white font-black italic uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] text-xs"
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
