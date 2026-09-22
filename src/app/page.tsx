"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, Gift, Users, ArrowDown, Zap, X, Info } from "lucide-react";
import ParticiparModal from "@/components/ui/ParticiparModal";
import { supabase } from "@/lib/supabase";

const getColorClass = (color: string) => {
  switch (color) {
    case 'yellow': return 'bg-yellow-500 text-black';
    case 'green': return 'bg-green-500 text-white';
    case 'blue': return 'bg-blue-500 text-white';
    case 'purple': return 'bg-purple-500 text-white';
    case 'red': return 'bg-red-500 text-white';
    case 'orange': return 'bg-orange-500 text-white';
    case 'pink': return 'bg-pink-500 text-white';
    default: return 'bg-purple-500 text-white';
  }
};

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGiveaway, setSelectedGiveaway] = useState<{id: string, title: string} | null>(null);
  const [detailsGiveaway, setDetailsGiveaway] = useState<any>(null);
  
  const [featuredGiveaway, setFeaturedGiveaway] = useState<any>(null);
  const [showFeaturedPopup, setShowFeaturedPopup] = useState(false);
  const [activeGiveaways, setActiveGiveaways] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);

  useEffect(() => {
    fetchActiveGiveaways();
    fetchHallOfFame();
  }, []);

  const fetchActiveGiveaways = async () => {
    const { data } = await supabase
      .from('giveaways')
      .select('*')
    if (data) {
      const featured = data.find(g => g.type === 'featured');
      if (featured) {
        setFeaturedGiveaway(featured);
        // Só exibe se ainda não fechou nesta sessão
        if (!sessionStorage.getItem('featured_closed')) {
          setShowFeaturedPopup(true);
        }
      }
      setActiveGiveaways(data); // Todos continuam na grade normal
    }
  };

  const fetchHallOfFame = async () => {
    const { data } = await supabase
      .from('winners')
      .select('*')
      .eq('in_hall_of_fame', true)
      .order('won_at', { ascending: false });
      
    if (data) setWinners(data);
  };

  const handleOpenModal = (id: string, title: string) => {
    setSelectedGiveaway({ id, title });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            // Update the hash in URL without jumping
            window.history.replaceState(null, "", `#${entry.target.id}`);
          }
        });
      },
      { threshold: 0.5 } // Triggers when 50% of the section is visible
    );

    const sections = document.querySelectorAll("section[id]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section id="home" className="relative py-20 lg:py-32 overflow-hidden flex flex-col justify-center min-h-[90vh]">
        
        {/* Background Video */}
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        >
          <source src="/bg-video.mp4" type="video/mp4" />
        </video>
        
        {/* Gradient Overlays for Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-[#050505] z-0 pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none animate-[pulse_4s_ease-in-out_infinite] z-0" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-700/30 blur-[120px] rounded-full pointer-events-none animate-[pulse-glow_6s_ease-in-out_infinite] z-0" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          
          {/* Alerta Chamativo para Inscritos */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-900/40 border border-purple-500/50 text-purple-200 text-sm font-bold mb-8 animate-[float_4s_ease-in-out_infinite] shadow-[0_0_15px_rgba(168,85,247,0.4)]">
            <Zap className="w-4 h-4 text-purple-400 fill-purple-400" />
            <span>Inscritos têm até 5x mais chances de ganhar!</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-white drop-shadow-md">
            Sorteios Exclusivos para a <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 animate-pulse-glow">
              Família BARR4K
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-400 mb-10 font-light">
            Participe dos melhores sorteios da Twitch. Apoie o canal, interaja no chat e multiplique suas chances de ganhar prêmios incríveis todos os meses.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="#active-giveaways"
              className="btn-neon px-8 py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2"
            >
              Ver Sorteios Ativos <ArrowDown className="w-5 h-5 animate-bounce" />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Giveaway Popup Modal */}
      {featuredGiveaway && showFeaturedPopup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden bg-[#0a0a0c] border border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.15)] flex flex-col relative animate-scale-up">
            
            <button 
              onClick={() => {
                setShowFeaturedPopup(false);
                sessionStorage.setItem('featured_closed', 'true');
              }} 
              className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-orange-500 hover:text-white text-gray-300 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Image Hero Area */}
            <div className="relative h-64 w-full bg-black overflow-hidden group">
              {featuredGiveaway.image_url ? (
                <img src={featuredGiveaway.image_url} alt={featuredGiveaway.title} className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-700"><Gift className="w-20 h-20" /></div>
              )}
              
              {/* Gradient fade to bottom */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#0a0a0c]" />

              {/* Top Badges */}
              <div className="absolute top-4 left-4 z-10">
                <div className="px-3 py-1.5 bg-orange-500 text-white rounded font-bold text-xs uppercase tracking-wider flex items-center gap-1 shadow-lg">
                  <Gift className="w-3 h-3" /> 100% GRÁTIS
                </div>
              </div>

              {/* Title Overlay */}
              <div className="absolute bottom-4 left-6 right-6 z-10">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-3 h-3 text-orange-500" />
                  <span className="text-orange-500 text-[10px] font-bold tracking-[0.2em] uppercase">Sorteio Acontecendo Agora</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase leading-none" style={{ fontFamily: 'Impact, sans-serif' }}>
                  SORTEIO <br/><span className="text-orange-500">{featuredGiveaway.title}</span>
                </h3>
              </div>
            </div>

            {/* Content & Action Area */}
            <div className="bg-[#0a0a0c] p-6 border-t border-white/5 flex flex-col">
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                <strong className="text-white">{featuredGiveaway.title}</strong> — grátis para quem segue o Instagram e é inscrito nos canais.
              </p>

              <button 
                onClick={() => {
                  setShowFeaturedPopup(false);
                  sessionStorage.setItem('featured_closed', 'true');
                  handleOpenModal(String(featuredGiveaway.id), featuredGiveaway.title);
                }}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black italic tracking-widest uppercase py-4 rounded transition-colors flex items-center justify-center gap-2 text-sm shadow-[0_0_20px_rgba(249,115,22,0.3)]"
              >
                QUERO PARTICIPAR <ArrowDown className="w-5 h-5 -rotate-90" />
              </button>
              
              <p className="text-center text-[10px] text-gray-500 mt-4 tracking-widest uppercase font-bold">
                CUSTO: {featuredGiveaway.coins_cost} COINS
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sorteios Ativos (Grid Dinâmico) */}
      <section id="active-giveaways" className="py-16 bg-[#050505] relative border-t border-white/5 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
              <Gift className="w-8 h-8 text-purple-500" /> Sorteios Ativos
            </h2>
            <p className="text-gray-400">Escolha o sorteio abaixo, cumpra os requisitos e cruze os dedos!</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeGiveaways.map((giveaway) => (
              <div key={giveaway.id} className="glass-panel rounded-2xl overflow-hidden animated-border-card group flex flex-col">
                <div className="h-48 relative border-b border-gray-800 bg-[#121214] flex items-center justify-center overflow-hidden">
                  
                  {giveaway.highlight_text && (
                    <div className={`absolute top-3 left-3 px-3 py-1 rounded text-xs font-bold z-20 shadow-lg ${getColorClass(giveaway.highlight_color)}`}>
                      {giveaway.highlight_text}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-b from-purple-900/30 to-transparent opacity-50 z-0" />
                  {giveaway.image_url ? (
                    <img src={giveaway.image_url} alt={giveaway.title} className="w-full h-full object-cover relative z-10 transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <span className="text-gray-600 font-bold z-10">Imagem do Prêmio</span>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors line-clamp-1">
                    {giveaway.title}
                  </h3>
                  <p className="text-gray-400 text-sm mb-6 line-clamp-2 flex-1">
                    {giveaway.description}
                  </p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-yellow-500 font-bold text-sm bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">
                      {giveaway.coins_cost} Coins
                    </span>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button 
                      onClick={() => setDetailsGiveaway(giveaway)}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Info className="w-4 h-4" /> Detalhes
                    </button>
                    <button 
                      onClick={() => handleOpenModal(String(giveaway.id), giveaway.title)}
                      className="flex-1 btn-neon font-bold py-3 rounded-lg text-sm uppercase tracking-wider"
                    >
                      Participar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Winners Section */}
      <section id="hall-da-fama" className="py-20 bg-zinc-950 border-t border-white/5 relative scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 flex items-center gap-3">
                <Trophy className="w-8 h-8 text-purple-500" /> Hall da Fama
              </h2>
              <p className="text-gray-400 max-w-xl">Os sortudos que já levaram prêmios para casa recentemente. O próximo pode ser você!</p>
            </div>
          </div>

          {winners.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {winners.map((winner, i) => (
                <div key={i} className="glass-panel rounded-xl overflow-hidden group hover:border-purple-500/50 transition-all hover:-translate-y-2 animated-border-card p-1">
                  <div className="h-48 bg-black/60 rounded-t-lg flex items-center justify-center border-b border-gray-800 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="text-gray-700 text-sm font-medium z-10 relative">Foto do Prêmio</div>
                    <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-xs font-bold text-yellow-500 border border-yellow-500/30 z-10">
                      Sorteio #{winner.id}
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-white mb-1 truncate">{winner.prize}</h3>
                    <div className="flex items-center gap-3 mt-4">
                      <div className="w-8 h-8 rounded-full bg-purple-900 flex items-center justify-center">
                        <Users className="w-4 h-4 text-purple-300" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Vencedor</p>
                        <p className="text-purple-400 font-medium text-sm">@{winner.twitch_username}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty State: Pode ser você aqui! */
            <div className="glass-panel border border-purple-500/50 rounded-2xl p-12 text-center relative overflow-hidden animated-border-card shadow-[0_0_30px_rgba(168,85,247,0.2)]">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 animate-[pulse_4s_ease-in-out_infinite]" />
              <div className="relative z-10 flex flex-col items-center justify-center space-y-6">
                <div className="w-20 h-20 bg-purple-900/30 rounded-full flex items-center justify-center border border-purple-500/50 animate-[float_4s_ease-in-out_infinite]">
                  <Trophy className="w-10 h-10 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-white mb-2 text-shadow-glow">
                    Pode ser você aqui!
                  </h3>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Ainda não tivemos nosso primeiro sorteio concluído. Participe dos sorteios ativos e garanta seu lugar no Hall da Fama da família BARR4K!
                  </p>
                </div>
                <Link 
                  href="#active-giveaways"
                  className="mt-4 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/50 px-6 py-3 rounded-full font-medium transition-all"
                >
                  Participar Agora
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Parceiros Section */}
      <section id="parceiros" className="py-20 bg-black border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Nossos <span className="text-purple-500">Parceiros</span>
            </h2>
            <p className="text-gray-400">Apoie o canal utilizando nossos cupons e links de afiliado!</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            {/* CSGO ROLL */}
            <a 
              href="https://www.csgoroll.com/r/BARRAK" 
              target="_blank" 
              rel="noreferrer"
              className="group flex items-center justify-center relative rounded-2xl overflow-hidden border border-purple-500/20 hover:border-purple-500/80 transition-all hover:scale-105 shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] bg-[#0a0a0c] h-[450px]"
            >
              <img src="/parceiro1.png" alt="CSGOROLL" className="w-full h-full object-contain p-4" />
            </a>

            {/* CSGO BIG */}
            <a 
              href="https://csgobig.com/#!/r/barr4k" 
              target="_blank" 
              rel="noreferrer"
              className="group flex items-center justify-center relative rounded-2xl overflow-hidden border border-purple-500/20 hover:border-purple-500/80 transition-all hover:scale-105 shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] bg-[#0a0a0c] h-[450px]"
            >
              <img src="/parceiro2.png" alt="CSGOBIG" className="w-full h-full object-contain p-4" />
            </a>

            {/* FALLEN STORE */}
            <a 
              href="https://www.fallenstore.com.br/" 
              target="_blank" 
              rel="noreferrer"
              className="group flex items-center justify-center relative rounded-2xl overflow-hidden border border-purple-500/20 hover:border-purple-500/80 transition-all hover:scale-105 shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] bg-[#0a0a0c] h-[450px]"
            >
              <img src="/parceiro3.png" alt="Fallen Store" className="w-full h-full object-contain p-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Details Modal */}
      {detailsGiveaway && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121214] border border-gray-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden relative flex flex-col md:flex-row">
            {/* Left side Image */}
            <div className="w-full md:w-1/2 h-64 md:h-auto bg-[#0a0a0c] relative flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-800">
              {detailsGiveaway.image_url ? (
                <img src={detailsGiveaway.image_url} alt={detailsGiveaway.title} className="w-full h-full object-cover" />
              ) : (
                <Gift className="w-20 h-20 text-gray-700" />
              )}
            </div>
            {/* Right side Content */}
            <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col max-h-[80vh] overflow-y-auto">
              <button onClick={() => setDetailsGiveaway(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors bg-black/50 rounded-full p-1 z-10">
                <X className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-2 mb-4 mt-2">
                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs font-bold border border-yellow-500/30">
                  CUSTO: {detailsGiveaway.coins_cost} COINS
                </span>
                {detailsGiveaway.highlight_text && (
                  <span className={`px-3 py-1 rounded text-xs font-bold ${getColorClass(detailsGiveaway.highlight_color)}`}>
                    {detailsGiveaway.highlight_text}
                  </span>
                )}
              </div>

              <h2 className="text-2xl md:text-3xl font-black italic text-white uppercase tracking-wider mb-4 leading-tight">
                {detailsGiveaway.title}
              </h2>
              
              <div className="flex-1">
                <h4 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Descrição do Prêmio</h4>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-6">
                  {detailsGiveaway.description}
                </p>
              </div>
              
              <button 
                onClick={() => {
                  setDetailsGiveaway(null);
                  handleOpenModal(String(detailsGiveaway.id), detailsGiveaway.title);
                }}
                className="w-full btn-neon font-bold italic tracking-widest uppercase py-4 rounded-lg mt-auto text-sm"
              >
                Participar Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Render */}
      <ParticiparModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        sorteioId={selectedGiveaway?.id || ""}
        sorteioTitle={selectedGiveaway?.title || ""} 
        isLoggedIn={true} // Hardcoded for preview, normally comes from Context/Redux
      />
    </div>
  );
}
