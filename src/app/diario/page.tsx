"use client";

import { useEffect, useState } from "react";
import { Trophy, Users, History, Calendar, Star, Sparkles, Gift, User } from "lucide-react";
import { avatarFor, chancesFor } from "@/lib/daily";

interface DailyData {
  giveaway: {
    id: string;
    title: string;
    image_url: string | null;
    capture_open: boolean;
    bot_command: string | null;
    chance_t1: number;
    chance_t2: number;
    chance_t3: number;
  } | null;
  participants: { twitch_username: string; sub_tier: number; avatar_url: string | null }[];
  history: { twitch_username: string; prize: string; avatar_url: string | null; won_at: string }[];
}

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export default function DiarioPage() {
  const [data, setData] = useState<DailyData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/diario")
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => json && setData(json))
        .catch(() => {});
    load();
    // Lista ao vivo: atualiza sozinha a cada 4 segundos
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="uiverse-loader"></div>
      </div>
    );
  }

  const { giveaway, participants, history } = data;
  const todayWinner = !giveaway && history[0] && isToday(history[0].won_at) ? history[0] : null;

  return (
    <div className="min-h-screen pt-10 pb-16 bg-[#050505] selection:bg-purple-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

        {/* CABEÇALHO */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-xs tracking-widest uppercase">
            <Calendar className="w-4 h-4" /> Sorteio Diário
          </div>
          <h1 className="font-title text-5xl md:text-7xl text-white uppercase">
            SORTEIO <span className="text-purple-500">DIÁRIO!</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto font-medium">
            Digite o comando do dia no chat da Twitch e veja seu nome aparecer aqui embaixo! Todos os dias tem sorteio.
            Subs T1 4x, Subs T2 6x e Subs T3 10x mais chances.
          </p>
        </div>

        {giveaway ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Prêmio e comando */}
            <div className="glass-panel rounded-2xl p-8 border border-purple-500/30 flex flex-col items-center text-center">
              {giveaway.image_url ? (
                <img src={giveaway.image_url} alt={giveaway.title} className="w-40 h-40 object-contain mb-6" />
              ) : (
                <Gift className="w-20 h-20 text-purple-500 mb-6" />
              )}
              <h2 className="text-purple-500 font-black tracking-widest uppercase text-sm mb-2">Prêmio de hoje</h2>
              <div className="text-3xl font-black text-white uppercase tracking-tighter mb-6">
                {giveaway.title.replace("|", " ")}
              </div>

              <div className="w-full rounded-xl border border-gray-800 bg-black/50 p-4 mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Digite no chat</p>
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500">
                  {giveaway.bot_command || "!sorteio"}
                </p>
              </div>

              <div className="w-full grid grid-cols-3 gap-2 text-xs">
                {[1, 2, 3].map((tier) => (
                  <div key={tier} className="rounded-lg border border-purple-500/20 bg-purple-500/5 py-2">
                    <p className="font-bold text-purple-300">Sub T{tier}</p>
                    <p className="text-white font-black text-lg">{chancesFor(tier, giveaway)}x</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Lista ao vivo */}
            <div className="lg:col-span-2 glass-panel rounded-2xl border border-gray-800 p-6 md:p-8 flex flex-col h-[560px]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-gray-800 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" /> Participantes ao Vivo
                </h2>
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    {giveaway.capture_open && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${giveaway.capture_open ? "bg-red-500" : "bg-gray-600"}`}></span>
                  </span>
                  <span className={`font-bold text-xs uppercase tracking-widest ${giveaway.capture_open ? "text-red-500" : "text-gray-500"}`}>
                    {giveaway.capture_open ? "Captação aberta" : "Captação encerrada"}
                  </span>
                  <span className="text-gray-400 font-bold text-sm bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
                    {participants.length} total
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 content-start pr-1 custom-scrollbar">
                {participants.length > 0 ? (
                  participants.map((p) => (
                    <div key={p.twitch_username} className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-lg p-2.5 animate-fade-in">
                      <img src={avatarFor(p.twitch_username, p.avatar_url)} alt="" className="w-9 h-9 rounded-full border border-gray-700 object-cover" />
                      <span className="text-white font-bold truncate flex-1">@{p.twitch_username}</span>
                      {p.sub_tier > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black tracking-wider text-purple-300 bg-purple-500/15 px-2 py-1 rounded border border-purple-500/40" title={`Sub Tier ${p.sub_tier}`}>
                          <Star className="w-3 h-3 fill-purple-400 text-purple-400" /> Sub
                        </span>
                      ) : (
                        <User className="w-4 h-4 text-gray-600" aria-label="Não é sub" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-500 space-y-4 py-16">
                    <Sparkles className="w-10 h-10 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-sm">Ninguém entrou ainda</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : todayWinner ? (
          <div className="glass-panel rounded-2xl p-10 border-2 border-yellow-500/50 relative overflow-hidden flex flex-col items-center text-center max-w-xl mx-auto animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 to-transparent pointer-events-none" />
            <Trophy className="w-14 h-14 text-yellow-500 mb-4 relative" />
            <h2 className="text-yellow-500 font-black tracking-widest uppercase text-sm mb-4 relative">Vencedor de hoje</h2>
            <img src={avatarFor(todayWinner.twitch_username, todayWinner.avatar_url)} alt=""
              className="w-24 h-24 rounded-full border-4 border-yellow-400 object-cover relative mb-4" />
            <div className="text-4xl font-black text-white uppercase tracking-wider mb-4 relative break-all">
              @{todayWinner.twitch_username}
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 rounded-lg text-yellow-400 font-bold border border-yellow-500/30 relative">
              <Star className="w-4 h-4" /> {todayWinner.prize}
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
        <div>
          <div className="flex items-center gap-3 mb-8">
            <History className="w-6 h-6 text-gray-500" />
            <h2 className="text-2xl font-black text-white uppercase tracking-widest">Histórico (30 Dias)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {history.length > 0 ? (
              history.map((item) => (
                <div key={item.won_at + item.twitch_username} className="bg-[#0a0a0c] border border-gray-800 rounded-xl p-4 hover:border-purple-500/30 transition-colors flex items-center gap-3">
                  <img src={avatarFor(item.twitch_username, item.avatar_url)} alt="" className="w-12 h-12 rounded-full border border-gray-700 object-cover shrink-0" />
                  <div className="min-w-0">
                    <div className="text-purple-500 text-xs font-bold">
                      {new Date(item.won_at).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="text-white font-black truncate">@{item.twitch_username}</div>
                    <div className="text-gray-400 text-xs font-medium truncate">{item.prize}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-gray-500 font-bold uppercase tracking-widest text-sm">
                Nenhum ganhador nos últimos 30 dias.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
