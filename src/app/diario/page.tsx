"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Users, History, Calendar, Star, Sparkles, CheckCircle2, Gift } from "lucide-react";

export default function DiarioPage() {
  const [dailyGiveaway, setDailyGiveaway] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [winner, setWinner] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDailyGiveaway = async () => {
    // Busca o sorteio marcado como diário atual
    const { data: activeData } = await supabase
      .from('giveaways')
      .select('*')
      .eq('is_daily_highlight', true)
      .single();

    if (activeData) {
      setDailyGiveaway(activeData);
      
      // Busca participantes
      const { data: parts } = await supabase
        .from('participants')
        .select('*')
        .eq('giveaway_id', activeData.id);
      
      if (parts) setParticipants(parts);

      // Busca se já tem vencedor deste sorteio
      const { data: win } = await supabase
        .from('winners')
        .select('*')
        .eq('giveaway_id', activeData.id)
        .single();
      
      if (win) setWinner(win);
    } else {
      setDailyGiveaway(null);
    }
  };

  const fetchHistory = async () => {
    // Pegar os últimos vencedores diários
    const { data } = await supabase
      .from('winners')
      .select('*, giveaways!inner(type)')
      .eq('giveaways.type', 'daily')
      .order('won_at', { ascending: false })
      .limit(30);

    if (data) setHistory(data);
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await fetchDailyGiveaway();
      await fetchHistory();
      setLoading(false);
    }
    loadData();

    // Inscricao Realtime para participantes e vencedores
    const channel = supabase.channel('daily_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, payload => {
        fetchDailyGiveaway();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'winners' }, payload => {
        fetchDailyGiveaway();
        fetchHistory();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'giveaways' }, payload => {
        fetchDailyGiveaway();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 bg-[#050505] flex items-center justify-center">
        <div className="uiverse-loader"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 bg-[#050505] selection:bg-purple-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* CABEÇALHO */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-xs tracking-widest uppercase">
            <Calendar className="w-4 h-4" /> Sorteio Diário
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter" style={{ fontFamily: 'var(--font-kanit)' }}>
            O SORTEIO DA <span className="text-purple-500">LIVE</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto font-medium">
            Digite o comando no chat da Twitch e veja seu nome aparecer aqui embaixo!
            Todos os dias um novo prêmio. Assinantes ganham multiplicadores de chance!
          </p>
        </div>

        {/* ÁREA CENTRAL - AO VIVO */}
        {dailyGiveaway ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Vencedor em Destaque (se houver) ou Prêmio */}
            <div className="lg:col-span-1 space-y-6">
              {winner ? (
                <div className="glass-panel rounded-2xl p-8 border-2 border-yellow-500/50 relative overflow-hidden animate-fade-in flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 to-transparent z-0" />
                  <Trophy className="w-20 h-20 text-yellow-500 mb-6 relative z-10" />
                  <h2 className="text-yellow-500 font-black tracking-widest uppercase text-sm mb-2 relative z-10">VENCEDOR DO DIA</h2>
                  <div className="text-4xl font-black text-white uppercase italic tracking-wider mb-4 relative z-10">
                    @{winner.twitch_username}
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 rounded-lg text-yellow-400 font-bold border border-yellow-500/30 relative z-10">
                    <Star className="w-4 h-4" /> {winner.prize}
                  </div>
                </div>
              ) : (
                <div className="glass-panel rounded-2xl p-8 border border-purple-500/30 flex flex-col items-center text-center h-full justify-center">
                  <Gift className="w-20 h-20 text-purple-500 mb-6" />
                  <h2 className="text-purple-500 font-black tracking-widest uppercase text-sm mb-2">PRÊMIO DE HOJE</h2>
                  <div className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                    {dailyGiveaway.title}
                  </div>
                  <p className="text-gray-400 text-sm">Aguardando o encerramento da live para o sorteio final.</p>
                </div>
              )}
            </div>

            {/* Lista Ao Vivo de Participantes */}
            <div className="lg:col-span-2 glass-panel rounded-2xl border border-gray-800 p-8 flex flex-col h-[500px]">
              <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" /> Participantes ao Vivo
                </h2>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-red-500 font-bold text-xs uppercase tracking-widest hidden sm:inline-block">Captação Aberta</span>
                  <span className="ml-2 text-gray-400 font-bold text-sm bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
                    {participants.length} Total
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {participants.length > 0 ? (
                  participants.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-black/40 border border-white/5 rounded-lg p-3 hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-white font-bold">@{p.twitch_username}</span>
                      </div>
                      {p.coins_used > 0 && (
                        <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
                          {p.coins_used} Chances
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                    <Sparkles className="w-10 h-10 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-sm">Ninguém entrou ainda</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-gray-800 p-12 text-center flex flex-col items-center">
            <Calendar className="w-16 h-16 text-gray-700 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Sorteio Diário Fechado</h2>
            <p className="text-gray-400">O streamer ainda não abriu a captação para o sorteio de hoje.</p>
          </div>
        )}

        {/* HISTÓRICO DE 30 DIAS */}
        <div className="mt-16">
          <div className="flex items-center gap-3 mb-8">
            <History className="w-6 h-6 text-gray-500" />
            <h2 className="text-2xl font-black text-white uppercase tracking-widest">Histórico (30 Dias)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {history.length > 0 ? (
              history.map((item, index) => (
                <div key={index} className="bg-[#0a0a0c] border border-gray-800 rounded-xl p-5 hover:border-purple-500/30 transition-colors">
                  <div className="text-purple-500 text-xs font-bold mb-2">
                    {new Date(item.won_at).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="text-white font-black text-lg mb-1 truncate">@{item.twitch_username}</div>
                  <div className="text-gray-400 text-xs font-medium truncate">{item.prize}</div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-gray-500 font-bold uppercase tracking-widest text-sm">
                Nenhum histórico encontrado.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
