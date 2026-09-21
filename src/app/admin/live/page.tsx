"use client";

import { useEffect, useState, useRef } from "react";
import { Gift, Zap, Users, Trophy, PlayCircle, PauseCircle, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Mock data generator for live feed
const generateUser = () => {
  const names = ["Fallen_God", "Fer_Monster", "Coldzera_2016", "TACO_Mito", "Fnx_Lenda", "Kscerato_Aim", "Yuurih_Clutch", "Art_Rush"];
  const tiers = ["none", "tier1", "tier2", "tier3"];
  const username = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 99);
  return {
    id: Math.random().toString(36).substring(7),
    username,
    avatar: `https://ui-avatars.com/api/?name=${username}&background=random&color=fff`,
    tier: tiers[Math.floor(Math.random() * tiers.length)],
    timestamp: new Date().toLocaleTimeString(),
  };
};

export default function SorteiosLive() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [isCapturing, setIsCapturing] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState<any | null>(null);
  const [rouletteItems, setRouletteItems] = useState<any[]>([]);

  // Simulating live feed dropping in
  useEffect(() => {
    if (!isCapturing || isRolling || winner) return;
    const interval = setInterval(() => {
      setParticipants((prev) => [generateUser(), ...prev].slice(0, 100)); // Keep last 100
    }, 1000);
    return () => clearInterval(interval);
  }, [isCapturing, isRolling, winner]);

  const renderTierIcon = (tier: string) => {
    switch (tier) {
      case "tier3":
        return (
          <div className="flex items-center gap-1 bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/50">
            <Zap className="w-3 h-3 fill-purple-400" />
            <span className="text-xs font-bold">T3</span>
          </div>
        );
      case "tier2":
        return (
          <div className="flex items-center gap-1 bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded border border-pink-500/50">
            <Zap className="w-3 h-3 fill-pink-400" />
            <span className="text-xs font-bold">T2</span>
          </div>
        );
      case "tier1":
        return (
          <div className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/50">
            <Zap className="w-3 h-3 fill-blue-400" />
            <span className="text-xs font-bold">T1</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded border border-gray-500/50">
            <Users className="w-3 h-3" />
            <span className="text-xs font-bold">Padrão</span>
          </div>
        );
    }
  };

  const startRoulette = () => {
    if (participants.length < 5) {
      alert("Aguarde mais participantes para iniciar a roleta!");
      return;
    }
    
    setIsCapturing(false);
    setIsRolling(true);
    setWinner(null);

    // Create a pool of ~50 items for the roulette animation
    const pool = [];
    for (let i = 0; i < 50; i++) {
      pool.push(participants[Math.floor(Math.random() * participants.length)]);
    }
    
    // Choose winner at fixed index 40
    const chosenWinner = pool[40];
    setRouletteItems(pool);

    // After animation ends (approx 8 seconds)
    setTimeout(() => {
      setWinner(chosenWinner);
      setIsRolling(false);
    }, 8500);
  };

  const resetGiveaway = () => {
    setWinner(null);
    setParticipants([]);
    setIsCapturing(true);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#050505]">
      
      {/* Left Column - Giveaway Info & Controls */}
      <div className="w-full md:w-1/3 border-r border-gray-800 p-8 flex flex-col relative overflow-hidden bg-[#0a0a0c]">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className={`inline-flex items-center gap-2 border px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isCapturing ? "bg-red-500/20 text-red-500 border-red-500/50 animate-pulse" : "bg-gray-800 text-gray-400 border-gray-700"}`}>
              {isCapturing ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
              {isCapturing ? "Captação Ativa" : "Pausado"}
            </div>
            
            <Link href="/admin" className="text-gray-500 hover:text-white text-xs underline">
              Voltar ao Admin
            </Link>
          </div>

          <h1 className="text-3xl font-black text-white uppercase italic tracking-wide mb-2">
            Sorteio Ativo
          </h1>
          <h2 className="text-xl text-purple-400 font-bold mb-8">Faca Butterfly | Fade (FN)</h2>

          <div className="glass-panel p-6 rounded-2xl border border-purple-500/30 mb-8 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-3">Comando no chat:</p>
            <div className="bg-black/50 border border-gray-700 rounded-lg p-4 text-center">
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 animate-pulse-glow">
                !BARR4K
              </span>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-500" /> Multiplicadores
            </h3>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/10 text-sm">
                <span className="text-purple-400 font-bold">Tier 3</span>
                <span className="bg-purple-500 text-white font-bold px-2 py-0.5 rounded">5X</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/10 text-sm">
                <span className="text-pink-400 font-bold">Tier 2</span>
                <span className="bg-pink-500 text-white font-bold px-2 py-0.5 rounded">3X</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/10 text-sm">
                <span className="text-blue-400 font-bold">Tier 1</span>
                <span className="bg-blue-500 text-white font-bold px-2 py-0.5 rounded">2X</span>
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-4">
            {!isRolling && !winner && (
              <button 
                onClick={() => setIsCapturing(!isCapturing)}
                className={`w-full py-3 rounded-lg font-bold uppercase tracking-widest transition-colors ${isCapturing ? "bg-orange-600/20 text-orange-400 border border-orange-500/50 hover:bg-orange-600/30" : "bg-green-600/20 text-green-400 border border-green-500/50 hover:bg-green-600/30"}`}
              >
                {isCapturing ? "Pausar Captação" : "Voltar a Captar"}
              </button>
            )}
            
            {!winner && (
              <button 
                onClick={startRoulette}
                disabled={isRolling || participants.length === 0}
                className="w-full btn-neon font-black italic uppercase py-5 rounded-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRolling ? "Sorteando..." : "INICIAR SORTEIO"}
              </button>
            )}

            {winner && (
              <button 
                onClick={resetGiveaway}
                className="w-full flex justify-center items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold uppercase py-4 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5" /> Novo Sorteio
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Live Feed / Roulette */}
      <div className="w-full md:w-2/3 flex flex-col relative overflow-hidden bg-[#050505]">
        
        {/* Roulette Overlay */}
        {(isRolling || winner) && (
          <div className="absolute inset-0 z-20 bg-black/95 flex flex-col items-center justify-center p-8 animate-fade-in">
            <h2 className="text-4xl font-black text-white italic uppercase mb-12 animate-pulse">
              {winner ? "Ganhador!" : "Sorteando..."}
            </h2>

            {/* Roulette Track */}
            <div className="w-full max-w-4xl h-48 bg-[#0a0a0c] border-2 border-gray-800 rounded-xl overflow-hidden relative shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] flex items-center">
              {/* Winner Selector Line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-yellow-500 -translate-x-1/2 z-30 shadow-[0_0_15px_rgba(234,179,8,1)]"></div>
              
              <div 
                className="flex items-center gap-4 px-[50%]"
                style={{
                  transform: isRolling ? `translateX(calc(-40 * 160px))` : winner ? `translateX(calc(-40 * 160px))` : `translateX(0)`,
                  transition: isRolling ? "transform 8s cubic-bezier(0.15, 0.85, 0.2, 1)" : "none"
                }}
              >
                {rouletteItems.map((item, i) => (
                  <div 
                    key={i} 
                    className={`min-w-[144px] h-36 rounded-lg flex flex-col items-center justify-center p-4 border-2 transition-all ${winner && i === 40 ? "border-yellow-500 bg-yellow-500/10 scale-110 shadow-[0_0_30px_rgba(234,179,8,0.3)] z-20" : "border-gray-800 bg-[#121214] opacity-50"}`}
                  >
                    <div className="w-16 h-16 rounded-full overflow-hidden mb-3 border border-gray-700">
                      <img src={item.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                    <span className="font-bold text-white text-sm truncate w-full text-center">@{item.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {winner && (
              <div className="mt-12 text-center animate-fade-in-up">
                <p className="text-gray-400 uppercase tracking-widest text-sm font-bold mb-2">O grande vencedor é</p>
                <div className="flex items-center justify-center gap-4 text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 drop-shadow-lg">
                  @{winner.username}
                </div>
                <div className="mt-6 inline-block">
                  {renderTierIcon(winner.tier)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live List */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#050505]">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" /> Participantes ao Vivo
          </h2>
          <div className="text-sm font-bold text-gray-400">
            Total: <span className="text-purple-400">{participants.length}</span>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-80px)] space-y-3">
          {participants.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 font-medium">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              Aguardando participantes iniciarem o comando...
            </div>
          ) : (
            participants.map((p, index) => (
              <div 
                key={p.id} 
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 transition-all animate-fade-in-up"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700">
                    <img src={p.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <span className="font-bold text-gray-200">@{p.username}</span>
                    <div className="mt-1 flex">{renderTierIcon(p.tier)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 font-mono">
                  {p.timestamp}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
