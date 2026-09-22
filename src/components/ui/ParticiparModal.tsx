"use client";

import { X, Gift, Upload, CheckCircle2, Trophy, ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FaTwitch } from "react-icons/fa";
import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";

interface ParticiparModalProps {
  isOpen: boolean;
  onClose: () => void;
  giveaway: any;
}

export default function ParticiparModal({ isOpen, onClose, giveaway }: ParticiparModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isLoggedIn = !!session;

  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [twitchId, setTwitchId] = useState("");
  const [instagram, setInstagram] = useState("");
  const [isParticipating, setIsParticipating] = useState(false); 

  useEffect(() => {
    if (session?.user?.name) {
      setTwitchId(session.user.name);
    }
  }, [session]);

  if (!isOpen || !giveaway) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      const extension = file.name.split('.').pop();
      let safeName = file.name.substring(0, file.name.lastIndexOf('.'));
      safeName = safeName.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
      safeName = safeName.replace(/[^a-zA-Z0-9]/g, "_"); 
      
      const newSafeName = `${safeName}.${extension}`;
      const sanitizedFile = new File([file], newSafeName, { type: file.type });
      setSelectedFile(sanitizedFile);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      signIn('twitch');
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
      coins_used: giveaway.coins_cost || 0,
      instagram: instagram,
      proof_url: proofUrl, 
      status: 'pending'
    }]);

    if (!error) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        setIsParticipating(false);
        router.push("/meus-tickets"); 
      }, 2500);
    } else {
      alert("Erro ao participar: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/90 backdrop-blur-sm animate-fade-in py-10 px-4 sm:px-6">
      
      {/* Header com botão Voltar e Share */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between mb-2 mt-4 md:mt-0">
        <button onClick={() => { setIsParticipating(false); onClose(); }} className="flex items-center gap-3 text-[#a0a0a0] hover:text-white transition-colors text-[10px] font-bold tracking-[0.2em] uppercase">
          <ArrowRight className="w-4 h-4 rotate-180" /> VOLTAR
        </button>
        <button className="text-[#a0a0a0] hover:text-white transition-colors">
          <Upload className="w-5 h-5" />
        </button>
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-6 animate-scale-up pb-10">
        
        {/* Bloco 1: Host & Título */}
        <div className="bg-[#101010] border border-white/5 rounded-[24px] p-8 sm:p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-black mb-6">
            <img src="/barr4k-logo.png" alt="Host" className="w-full h-full object-cover" />
          </div>

          <div className="flex items-center justify-center gap-4 mb-4 w-full max-w-[280px]">
            <div className="h-[1px] flex-1 bg-[#FF6B1C]" />
            <span className="text-[#FF6B1C] font-bold text-[10px] tracking-[0.2em] uppercase">Sorteio Especial</span>
            <div className="h-[1px] flex-1 bg-[#FF6B1C]" />
          </div>

          <h2 className="text-[#a0a0a0] font-bold text-sm tracking-[0.4em] mb-2 uppercase">SORTEIO</h2>
          <h1 className="text-5xl md:text-[4rem] font-black text-white uppercase tracking-tighter leading-[0.9]" style={{ fontFamily: 'Impact, sans-serif' }}>
            {giveaway.title.split('|')[0] || "BAIONETA"} <br/>
            <span className="text-[#FF6B1C] block mt-1">{giveaway.title.split('|')[1] || "FOREST DDPAT"}</span>
          </h1>

          <p className="text-[#a0a0a0] mt-6 max-w-md text-sm leading-relaxed font-medium">
            Estou sorteando essa baioneta de forma <strong className="text-[#FF6B1C]">totalmente gratuita</strong>. Siga no Instagram, inscreva-se nos três canais e garanta até <strong className="text-white">4 entradas</strong>.
          </p>
        </div>

        {/* Bloco 2: Imagem do Prêmio */}
        <div className="bg-[#101010] border border-white/5 rounded-[24px] overflow-hidden">
          <div className="relative h-[320px] md:h-[450px] w-full bg-black group">
            {giveaway.image_url ? (
              <img src={giveaway.image_url} alt={giveaway.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700"><Gift className="w-20 h-20" /></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-black/20 to-transparent z-10" />
            
            {/* Title Overlay in Image */}
            <div className="absolute bottom-6 left-6 right-6 z-20">
              <div className="flex items-center gap-1.5 mb-2 text-[#FF6B1C]">
                <Trophy className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-widest uppercase">PRÊMIO</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                <span className="text-white">★</span> {giveaway.title}
              </h3>
              <p className="text-[#FF6B1C] font-bold text-lg mt-1">R$ {giveaway.coins_cost === 0 ? "860,54" : "1.364,35"}</p>
              <p className="text-[#808080] text-[11px] mt-2 font-bold uppercase tracking-wide">100% grátis · Enviado direto via Steam Trade</p>
            </div>
          </div>
          
          {/* Cronômetro */}
          <div className="flex border-t border-white/5 p-4 md:p-6 divide-x divide-white/5 justify-center">
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">08</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">DIAS</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">23</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">HORAS</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">12</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">MIN</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">10</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">SEG</div>
            </div>
          </div>
          
          <div className="text-center pb-6">
             <p className="text-[#606060] text-[10px] font-bold">Sorteio encerra em <span className="text-[#a0a0a0]">30/09/2026 às 23:59</span></p>
          </div>
        </div>

        {/* Bloco 3: Formulário de Participação */}
        <div className="bg-[#101010] border border-white/5 rounded-[24px] p-8 sm:p-12 text-center flex flex-col items-center">
          
          {isSuccess ? (
            <div className="flex flex-col items-center text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-6 animate-pulse" />
              <h3 className="text-2xl font-black text-white uppercase italic tracking-wider mb-2">Entrada Confirmada!</h3>
              <p className="text-[#a0a0a0]">Sua participação foi registrada. Redirecionando...</p>
            </div>
          ) : !isParticipating ? (
            <>
              <Sparkles className="w-8 h-8 text-[#FF6B1C] mb-6" />
              <h3 className="text-2xl font-black text-white italic tracking-wider uppercase mb-3">
                PARTICIPE AGORA
              </h3>
              <p className="text-[#a0a0a0] text-sm max-w-xs mx-auto mb-8 leading-relaxed font-medium">
                Entre com sua conta da Twitch para garantir sua vaga no sorteio. Uma participação por usuário.
              </p>
              <button 
                onClick={() => {
                  if (!isLoggedIn) {
                    signIn('twitch');
                  } else {
                    setIsParticipating(true);
                  }
                }}
                className="w-full max-w-[280px] bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 text-[11px]"
              >
                <FaTwitch className="w-4 h-4" /> {isLoggedIn ? 'PREENCHER DADOS' : 'ENTRAR COM A TWITCH'}
              </button>
            </>
          ) : (
            <form onSubmit={handleConfirm} className="w-full text-left space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-black text-white italic tracking-wider uppercase mb-2">
                  Preencher Requisitos
                </h3>
                <p className="text-orange-500 text-sm font-bold">Custo: {giveaway.coins_cost} Coins</p>
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Seu @ na Twitch</label>
                <input 
                  type="text" 
                  required
                  value={twitchId}
                  onChange={(e) => setTwitchId(e.target.value)}
                  className="w-full bg-black/50 border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder="Ex: gaules"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Seu @ no Instagram (Opcional)</label>
                <input 
                  type="text" 
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full bg-black/50 border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder="Ex: @barr4k"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Comprovante de Inscrição (Opcional)</label>
                <div className="w-full border-2 border-dashed border-gray-800 rounded-lg p-6 flex flex-col items-center justify-center bg-black/30 hover:bg-black/50 transition-colors cursor-pointer relative group">
                  <input 
                    type="file" 
                    onChange={handleFileChange}
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  <Upload className="w-6 h-6 text-gray-500 mb-2 group-hover:text-orange-500 transition-colors" />
                  <p className="text-gray-400 text-sm font-medium">
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
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black italic uppercase tracking-wider py-4 rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(249,115,22,0.3)] text-sm"
                >
                  Confirmar Entrada
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
