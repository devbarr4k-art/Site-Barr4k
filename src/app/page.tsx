"use client";

import { useState, useEffect, useRef } from "react";
import { Trophy, Gift, ArrowDown, X, ArrowRight, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isGiveawayClosed } from "@/lib/giveaway";
import { currentSectionId, handleSectionLink, scrollToSectionId } from "@/lib/sectionNav";
import ClosedStamp from "@/components/ui/ClosedStamp";
import { avatarFor } from "@/lib/daily";
import { dataVersionQuery, useRefreshOnReturn } from "@/lib/freshData";
import { DEFAULT_PARTNERS, type Partner } from "@/lib/partners";
import VideosSection from "@/components/home/VideosSection";
import { DEFAULT_VIDEOS_VISIBILITY, type Video, type VideosVisibility } from "@/lib/videos";

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

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [targetDateString]);

  return timeLeft;
};

export default function Home() {
  const router = useRouter();

  const [featuredGiveaway, setFeaturedGiveaway] = useState<any>(null);
  const [showFeaturedPopup, setShowFeaturedPopup] = useState(false);
  const [activeGiveaways, setActiveGiveaways] = useState<any[]>([]);
  const [isLoadingGiveaways, setIsLoadingGiveaways] = useState(true);
  const [winners, setWinners] = useState<any[]>([]);
  const [partners, setPartners] = useState<Partner[]>(DEFAULT_PARTNERS);
  const [videos, setVideos] = useState<Video[]>([]);
  const [videosVisibility, setVideosVisibility] = useState<VideosVisibility>(DEFAULT_VIDEOS_VISIBILITY);
  const rawGiveaways = useRef<any[]>([]);

  const timeLeft = useCountdown(featuredGiveaway?.draw_date || null);

  useEffect(() => {
    loadHome();
  }, []);

  // Voltou para a aba: busca de novo, sem piscar a tela de carregamento
  useRefreshOnReturn(() => loadHome(true));

  // Home e Hall da Fama numa chamada só, pela rota com cache da Vercel (/api/home).
  // Se ela falhar, busca direto no banco como reserva.
  const loadHome = async (silent = false) => {
    if (!silent) setIsLoadingGiveaways(true);
    let giveaways: any[] | null = null;
    let hall: any[] | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("/api/home" + dataVersionQuery(), { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        giveaways = json.giveaways;
        hall = json.winners;
        if (Array.isArray(json.partners)) setPartners(json.partners);
        if (Array.isArray(json.videos)) setVideos(json.videos);
        if (json.videosVisibility) setVideosVisibility(json.videosVisibility);
      }
    } catch {
      // cai para a reserva abaixo
    }
    if (!giveaways) {
      if (silent) return; // numa atualização em segundo plano, mantém o que já está na tela
      const [g, w] = await Promise.all([
        supabase.from('giveaways').select('*').in('status', ['active', 'completed']).neq('type', 'daily')
          .order('created_at', { ascending: false }).limit(40),
        supabase.from('winners').select('*, giveaways(image_url)').eq('in_hall_of_fame', true)
          .order('won_at', { ascending: false }),
      ]);
      giveaways = g.data ?? [];
      hall = w.data ?? [];
    }
    rawGiveaways.current = giveaways;
    classifyGiveaways(!silent);
    setWinners(hall ?? []);
    setIsLoadingGiveaways(false);
  };

  // Abertos primeiro; depois os 6 encerrados mais recentes, em preto e branco.
  // Roda de novo a cada 15s para o card virar "encerrado" na hora em que o tempo acaba.
  const classifyGiveaways = (firstLoad: boolean) => {
    const now = Date.now();
    const withState = rawGiveaways.current.map((g) => ({ ...g, isClosed: isGiveawayClosed(g, now) }));
    const open = withState.filter((g) => !g.isClosed);
    const closed = withState.filter((g) => g.isClosed).slice(0, 6);
    setActiveGiveaways([...open, ...closed]);

    // Destaque só aparece com o sorteio aberto; abre toda vez que a pessoa volta para a home
    const featured = open.find((g) => g.type === 'featured');
    setFeaturedGiveaway(featured ?? null);
    if (firstLoad) {
      let seen = false;
      try { seen = !!sessionStorage.getItem('featured_seen'); } catch {}
      setShowFeaturedPopup(!!featured && !seen);
    }
    else if (!featured) setShowFeaturedPopup(false);
  };

  useEffect(() => {
    const interval = setInterval(() => classifyGiveaways(false), 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenModal = (giveaway: any) => {
    router.push(`/sorteio/${giveaway.id}`);
  };

  // A URL acompanha a seção visível ao rolar (#sorteios, #hall-da-fama, #videos...);
  // no topo volta para "/" limpo
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("section[id]"));
    if (sections.length === 0) return;
    let current = "";
    const update = () => {
      const middle = window.innerHeight / 2;
      const visible = sections.find((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= middle && r.bottom > middle;
      });
      const id = !visible || visible.id === "home" ? "" : visible.id;
      if (id === current) return;
      current = id;
      const url = window.location.pathname + window.location.search + (id ? `#${id}` : "");
      window.history.replaceState(window.history.state, "", url);
    };
    window.addEventListener("scroll", update, { passive: true });
    if (!window.location.hash) update();
    return () => window.removeEventListener("scroll", update);
  }, [isLoadingGiveaways]);

  const scrollToSection = (e: React.MouseEvent, id: string) => handleSectionLink(e, `/#${id}`, "/");

  // Chegou com #secao (ex.: /#parceiros vindo de outra página): rola quando o conteúdo carregar
  // (lê o # só depois do carregamento: na montagem o Next ainda não gravou a URL nova)
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (isLoadingGiveaways || didInitialScroll.current) return;
    didInitialScroll.current = true;
    const hashId = window.location.hash.slice(1);
    if (!hashId) return;
    // Link antigo (ex.: #active-giveaways): troca a URL pelo nome novo da seção
    const id = currentSectionId(hashId);
    if (id !== hashId) window.history.replaceState(window.history.state, "", `/#${id}`);
    // segunda passada acerta a posição depois que imagens e o Hall da Fama terminam de montar
    const t1 = setTimeout(() => scrollToSectionId(id, "instant"), 50);
    const t2 = setTimeout(() => scrollToSectionId(id, "instant"), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isLoadingGiveaways]);


  // Fechou uma vez, não abre de novo nesta visita
  const closeFeaturedPopup = () => {
    setShowFeaturedPopup(false);
    try { sessionStorage.setItem('featured_seen', '1'); } catch {}
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section id="home" className="relative py-20 lg:py-32 overflow-hidden flex flex-col justify-center min-h-[calc(100svh-5rem)]">

        {/* Background Video */}
        {/* Vídeo em 1080p no computador e 720p no celular; a capa aparece enquanto carrega */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/bg-video-poster.jpg"
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        >
          <source src="/bg-video-720.mp4" type="video/mp4" media="(max-width: 768px)" />
          <source src="/bg-video-1080.mp4" type="video/mp4" />
        </video>

        {/* Gradient Overlays for Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-[#050505] z-0 pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none animate-[pulse_4s_ease-in-out_infinite] z-0" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-700/30 blur-[120px] rounded-full pointer-events-none animate-[pulse-glow_6s_ease-in-out_infinite] z-0" />
        {/* Só o vídeo; a setinha discreta leva para os sorteios ativos */}
        <a
          href="#sorteios"
          onClick={(e) => scrollToSection(e, "sorteios")}
          aria-label="Ver sorteios ativos"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Ver sorteios ativos</span>
          <ArrowDown className="w-6 h-6 animate-bounce" />
        </a>
      </section>

      {/* Featured Giveaway Popup Modal */}
      {featuredGiveaway && showFeaturedPopup && (
        <div className="fixed inset-0 z-[120] flex overflow-y-auto p-4 sm:p-6 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) closeFeaturedPopup(); }}>
          <div className="m-auto w-full max-w-[420px] shrink-0 rounded-[24px] overflow-hidden bg-[#101010] flex flex-col relative animate-scale-up border border-purple-500/50 shadow-2xl">

            {/* Top Image Area */}
            <div className="relative aspect-[3/2] w-full bg-black">
              {featuredGiveaway.featured_image_url || featuredGiveaway.image_url ? (
                <img src={featuredGiveaway.featured_image_url || featuredGiveaway.image_url} alt={featuredGiveaway.title} className={`w-full h-full object-cover ${featuredGiveaway.isClosed ? 'grayscale opacity-60' : ''}`} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-700"><Gift className="w-20 h-20" /></div>
              )}
              {/* Gradient Overlay for bottom text */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-black/20 to-transparent z-10" />
              {featuredGiveaway.isClosed && <ClosedStamp />}

              {/* Top Badges */}
              <div className="absolute top-4 left-4 z-20 flex gap-2 w-[calc(100%-32px)] justify-between items-start">
                <div />

                <div className="flex gap-2">
                  {featuredGiveaway.prize_value && (
                    <div className="bg-black/70 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 flex items-center shadow-lg">
                      <span className="text-[10px] font-bold text-purple-400 tracking-widest">
                        R$ {featuredGiveaway.prize_value}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={closeFeaturedPopup}
                    aria-label="Fechar"
                    className="w-8 h-8 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors shadow-lg"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Bottom Overlay Text on Image */}
              <div className="absolute bottom-6 left-6 right-6 z-20">
                <div className="flex items-center gap-1.5 mb-1.5 text-purple-500">
                  <Trophy className="w-3 h-3" />
                  <span className="text-[10px] font-bold tracking-widest uppercase">PRÊMIO</span>
                </div>
                <h3 className="font-title text-2xl text-white">
                  <span className="text-white mr-1.5">★</span> {featuredGiveaway.title.split('|')[0] || featuredGiveaway.title}
                </h3>
                {featuredGiveaway.prize_value && (
                  <p className="text-purple-400 font-bold text-sm mt-1">
                    R$ {featuredGiveaway.prize_value}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Area (Content & Actions) */}
            <div className="p-6 sm:p-8 bg-[#101010] flex flex-col items-start w-full relative z-30">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-orange-500 text-sm">🔥</span>
                <span className="text-[10px] font-bold text-purple-500 tracking-widest uppercase">
                  {featuredGiveaway.subtitle || featuredGiveaway.title.split('|')[0]}
                </span>
              </div>

              <h1 className="font-title text-4xl sm:text-[2.5rem] text-white uppercase leading-[1]">
                {featuredGiveaway.title.split('|')[0]} <br/>
                {featuredGiveaway.title.includes('|') && (
                  <span className="text-purple-500 inline-block mt-1">{featuredGiveaway.title.split('|')[1]}</span>
                )}
              </h1>

              <p className="text-[#a0a0a0] mt-4 mb-6 text-sm leading-relaxed font-medium">
                {featuredGiveaway.description || (
                  featuredGiveaway.draw_date ? `Respostas aceitas até dia ${new Date(featuredGiveaway.draw_date).toLocaleDateString('pt-BR')}!` : ""
                )}
              </p>

              {/* Cronômetro Compacto (ou aviso de encerrado) */}
              {featuredGiveaway.isClosed ? (
              <div className="w-full bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <span className="text-[9px] text-red-400/80 uppercase tracking-widest font-bold">Sorteio encerrado</span>
                <p className="text-white font-bold text-sm mt-1">As inscrições para este sorteio já foram fechadas.</p>
              </div>
              ) : featuredGiveaway.draw_date && (
              <div className="w-full flex items-center justify-between bg-black/50 border border-white/5 rounded-xl p-4 mb-6">
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#606060] uppercase tracking-widest font-bold mb-1">Encerra em</span>
                  <div className="flex items-center gap-1.5 text-white font-black text-lg">
                    <Clock className="w-4 h-4 text-purple-500 mr-1" />
                    {timeLeft.days}d : {timeLeft.hours}h : {timeLeft.minutes}m : {timeLeft.seconds}s
                  </div>
                </div>
              </div>
              )}

              <button
                onClick={() => {
                  closeFeaturedPopup();
                  handleOpenModal(featuredGiveaway);
                }}
                className={`w-full py-4 flex items-center justify-center gap-3 text-sm mb-4 ${featuredGiveaway.isClosed ? 'text-white font-black uppercase tracking-widest rounded-xl bg-white/10 hover:bg-white/15 transition-colors' : 'btn-neon'}`}
              >
                {featuredGiveaway.isClosed ? 'VER SORTEIO' : 'QUERO PARTICIPAR'} <ArrowRight className="w-4 h-4" />
              </button>

              {!featuredGiveaway.isClosed && (
              <p className="w-full text-center text-[#606060] text-[10px] font-bold uppercase tracking-widest">
                {featuredGiveaway.login_text || "Entrada Gratuita . Login com a Twitch"}
              </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sorteios Ativos (Grid Dinâmico) */}
      <section id="sorteios" className="py-16 bg-[#0c0d10] relative scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <h2 className="font-title text-4xl md:text-5xl text-white uppercase">
                SORTEIOS <span className="text-purple-500">ATIVOS</span>
              </h2>
              <p className="text-gray-400 text-xs tracking-widest uppercase font-bold mt-3">
                Sorteios para depositantes!
              </p>
            </div>
            <a href="#hall-da-fama" onClick={(e) => scrollToSection(e, "hall-da-fama")} className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-1">
              VER HALL DA FAMA
            </a>
          </div>

          {isLoadingGiveaways ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="uiverse-loader"></div>
              <p className="text-purple-500 font-bold tracking-widest uppercase text-xs animate-pulse">Carregando Sorteios...</p>
            </div>
          ) : activeGiveaways.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeGiveaways.map((giveaway, index) => (
              <div
                key={giveaway.id}
                onClick={() => handleOpenModal(giveaway)}
                className={`bg-[#0c0d10] rounded-xl overflow-hidden border cursor-pointer transition-all flex flex-col group ${giveaway.isClosed ? '' : 'hover:scale-[1.02]'} ${giveaway.isClosed ? 'border-white/5 opacity-80 hover:opacity-100' : index === 0 ? 'border-purple-500/50' : 'border-white/5 hover:border-white/20'}`}
              >
                {/* Imagem e Badges */}
                <div className="relative aspect-[3/2] bg-[#0c0d10] p-4 flex flex-col overflow-hidden">
                  <div className="flex gap-2 relative z-10">
                    {giveaway.highlight_text && (
                      <span className="px-3 py-1 bg-black/60 backdrop-blur-sm border border-white/10 text-gray-300 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm truncate max-w-full">
                        {giveaway.highlight_text}
                      </span>
                    )}
                    {giveaway.subtitle && (
                      <span className="px-3 py-1 bg-black/60 backdrop-blur-sm border border-white/10 text-gray-400 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm truncate max-w-full">
                        {giveaway.subtitle}
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center z-0">
                    {giveaway.image_url ? (
                      <img src={giveaway.image_url} alt={giveaway.title} className={`w-full h-full object-cover transition-transform duration-500 ${giveaway.isClosed ? 'grayscale opacity-60' : 'group-hover:scale-110 opacity-90 group-hover:opacity-100'}`} />
                    ) : (
                      <Gift className="w-20 h-20 text-gray-700" />
                    )}
                  </div>
                  {giveaway.isClosed && <ClosedStamp />}
                </div>

                {/* Informações */}
                <div className="p-6 flex flex-col flex-1 bg-[#0c0d10]">
                  <h3 className="font-title text-xl text-white mb-6 line-clamp-1">
                    <span className="text-purple-500 mr-2">★</span>{giveaway.title.replace("|", " ")}
                  </h3>

                  <div className="w-full h-[1px] bg-white/5 mb-6" />

                  <div className="flex justify-between items-center mb-6">
                    <div className="text-left">
                      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Entrada</p>
                      <p className="text-white font-bold text-sm">
                        {giveaway.prize_label || (giveaway.coins_cost > 0 ? `${giveaway.coins_cost} Coins` : "Gratuito")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Valor</p>
                      <p className="text-purple-500 font-bold text-sm">
                        {giveaway.prize_value ? `R$ ${giveaway.prize_value}` : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto text-gray-500 group-hover:text-gray-300 transition-colors">
                    <span className={`text-[11px] font-bold uppercase tracking-widest ${giveaway.isClosed ? 'text-red-400' : ''}`}>
                      {giveaway.isClosed ? 'Encerrado' : 'Participar'}
                    </span>
                    <span className="text-sm font-bold">↗</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="text-center py-20 text-gray-500 font-bold uppercase tracking-widest text-sm">Nenhum sorteio ativo no momento.</div>
          )}
        </div>
      </section>

      {/* Latest Winners Section */}
      <section id="hall-da-fama" className="py-20 bg-zinc-950 border-t border-white/5 relative scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="font-title text-3xl md:text-4xl text-white mb-4 flex items-center gap-3">
                <Trophy className="w-8 h-8 text-purple-500" /> Hall da Fama
              </h2>
              <p className="text-gray-400 max-w-xl">Os sortudos que já levaram prêmios para casa recentemente. O próximo pode ser você!</p>
            </div>
          </div>

          {isLoadingGiveaways ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="uiverse-loader"></div>
              <p className="text-purple-500 font-bold tracking-widest uppercase text-xs animate-pulse">Carregando Hall da Fama...</p>
            </div>
          ) : winners.length > 0 ? (
            <div className="flex overflow-x-auto gap-6 pb-6 snap-x snap-mandatory custom-scrollbar">
              {winners.map((winner, i) => (
                <div key={winner.id ?? i} className="w-[280px] md:w-[320px] snap-center shrink-0 glass-panel rounded-xl overflow-hidden group hover:border-purple-500/50 transition-all hover:-translate-y-2 animated-border-card p-1">
                  {/* Mesmo formato dos sorteios (3:2, 1200 × 800): a arte do sorteio serve aqui sem corte */}
                  <div className="aspect-[3/2] bg-black/60 rounded-t-lg flex items-center justify-center border-b border-gray-800 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {winner.image_url || winner.giveaways?.image_url ? (
                      <img src={winner.image_url || winner.giveaways.image_url} alt={winner.prize} className="w-full h-full object-cover relative z-10" />
                    ) : (
                      <div className="text-gray-700 text-sm font-medium z-10 relative">Foto do Prêmio</div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-white mb-1 truncate">{winner.prize}</h3>
                    <div className="flex items-center gap-3 mt-4">
                      <img src={avatarFor(winner.twitch_username, winner.avatar_url)} alt="" className="w-9 h-9 rounded-full object-cover border border-purple-500/50 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Vencedor</p>
                        <p className="text-purple-400 font-medium text-sm truncate">@{winner.twitch_username}</p>
                      </div>
                      {winner.won_at && (
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Sorteado</p>
                          <p className="text-gray-300 font-medium text-sm flex items-center gap-1 justify-end">
                            <Clock className="w-3.5 h-3.5 text-purple-400" />
                            {new Date(winner.won_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      )}
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
                    Sem últimos vencedores registrados. Participe dos sorteios ativos e garanta seu lugar no Hall da Fama!
                  </p>
                </div>
                <a
                  href="#sorteios"
                  onClick={(e) => scrollToSection(e, "sorteios")}
                  className="mt-4 btn-neon px-8 py-3"
                >
                  Participar Agora
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Vídeos do YouTube (depois do Hall da Fama) */}
      <VideosSection videos={videos} visibility={videosVisibility} />

      {/* Parceiros Section */}
      <section id="parceiros" className="py-20 bg-black border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-title text-3xl md:text-4xl text-white mb-4">
              Nossos <span className="text-purple-500">Parceiros</span>
            </h2>
            <p className="text-gray-400">Apoie o canal utilizando os nossos cupons e participe de Sorteios EXCLUSIVOS!</p>
          </div>

          {/* Cards cadastrados no painel (aba Parceiros); centraliza quando sobram menos de 3 na linha */}
          <div className="flex flex-wrap justify-center gap-8">
            {partners.map((partner) => (
              <a
                key={partner.id}
                href={partner.link_url}
                target="_blank"
                rel="noreferrer"
                title={partner.name}
                className="group w-full md:w-[calc(50%-1rem)] lg:w-[calc((100%-4rem)/3)] flex items-center justify-center relative rounded-2xl overflow-hidden border border-purple-500/20 hover:border-purple-500/80 transition-all hover:scale-105 shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] bg-[#0a0a0c] aspect-square"
              >
                <img src={partner.image_url} alt={partner.name} className="w-full h-full object-contain" />
              </a>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
