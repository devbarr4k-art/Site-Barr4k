const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'admin', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add CheckCircle2
if (!content.includes('CheckCircle2')) {
  content = content.replace('Gift } from "lucide-react";', 'Gift, CheckCircle2 } from "lucide-react";');
}

// 2. States and derived
const statesToInject = `
  const [twitchTimer, setTwitchTimer] = useState(60);
  const [isRolling, setIsRolling] = useState(false);
  const [currentRollName, setCurrentRollName] = useState("");
  const [winnerResult, setWinnerResult] = useState<any>(null);
  const [timerCount, setTimerCount] = useState<number | null>(null);
  const [liveDailyParticipants, setLiveDailyParticipants] = useState<any[]>([]);
  const timerRef = useRef<any>(null);
  const activeDailyGiveaway = sorteios.find((s: any) => s.is_daily_highlight);
`;
if (!content.includes('liveDailyParticipants')) {
  content = content.replace(
    'const [isCreatingTwitchGiveaway, setIsCreatingTwitchGiveaway] = useState(false);',
    'const [isCreatingTwitchGiveaway, setIsCreatingTwitchGiveaway] = useState(false);\n' + statesToInject
  );
}

// 3. useEffects
const useEffectsToInject = `
  useEffect(() => {
    if (activeDailyGiveaway) {
      const fetchDailyParts = async () => {
        const { data } = await supabase.from('participants').select('*').eq('giveaway_id', activeDailyGiveaway.id);
        if (data) setLiveDailyParticipants(data);
      };
      fetchDailyParts();

      const channel = supabase.channel('admin_daily_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: \`giveaway_id=eq.\${activeDailyGiveaway.id}\` }, payload => {
          fetchDailyParts();
        })
        .subscribe();
        
      return () => { supabase.removeChannel(channel); };
    } else {
      setLiveDailyParticipants([]);
    }
  }, [activeDailyGiveaway?.id]);

  useEffect(() => {
    if (timerCount !== null && timerCount > 0) {
      timerRef.current = setTimeout(() => setTimerCount(timerCount - 1), 1000);
    } else if (timerCount === 0) {
      clearTimeout(timerRef.current);
    }
    return () => clearTimeout(timerRef.current);
  }, [timerCount]);
`;
if (!content.includes('admin_daily_updates')) {
  content = content.replace(
    '// Conexão Inicial Supabase',
    useEffectsToInject + '\n\n  // Conexão Inicial Supabase'
  );
}

// 4. Methods
const methodsToInject = `
  const handleDrawDailyWinner = async () => {
    if (liveDailyParticipants.length === 0) return alert("Nenhum participante na fila!");
    
    const tickets: any[] = [];
    liveDailyParticipants.forEach((p: any) => {
      if (p.status === 'approved' || p.status === 'pending') {
        const chances = Math.max(1, p.coins_used);
        for (let i = 0; i < chances; i++) tickets.push(p);
      }
    });
    
    if (tickets.length === 0) return alert("Nenhum participante válido!");
    
    setIsRolling(true);
    setWinnerResult(null);
    let counter = 0;
    const maxSpins = 30; // spins
    const intervalTime = 100; // ms
    
    const interval = setInterval(() => {
      const randomTicket = tickets[Math.floor(Math.random() * tickets.length)];
      setCurrentRollName(randomTicket.twitch_username);
      counter++;
      
      if (counter >= maxSpins) {
        clearInterval(interval);
        const finalWinner = tickets[Math.floor(Math.random() * tickets.length)];
        setCurrentRollName(finalWinner.twitch_username);
        setWinnerResult(finalWinner);
        setIsRolling(false);
        // Use prize_value as timer, fallback to 60
        setTimerCount(parseInt(activeDailyGiveaway.prize_value) || 60);
      }
    }, intervalTime);
  };

  const confirmWinner = async () => {
    if (!winnerResult || !activeDailyGiveaway) return;
    const { error } = await supabase.from('winners').insert([{
      giveaway_id: activeDailyGiveaway.id,
      twitch_username: winnerResult.twitch_username,
      prize: activeDailyGiveaway.title
    }]);

    if (!error) {
       setWinnerResult(null);
       setTimerCount(null);
       alert(\`Vencedor salvo com sucesso: @\${winnerResult.twitch_username}!\`);
       fetchWinners();
    } else alert("Erro: " + error.message);
  };

  const rejectWinner = async () => {
    if (!winnerResult) return;
    await supabase.from('participants').update({ status: 'rejected' }).eq('id', winnerResult.id);
    setWinnerResult(null);
    setTimerCount(null);
    setCurrentRollName("");
    const { data } = await supabase.from('participants').select('*').eq('giveaway_id', activeDailyGiveaway.id);
    if (data) setLiveDailyParticipants(data);
  };

  const handleStopDaily = async (id: string) => {
    if(confirm("Tem certeza que deseja encerrar o Sorteio Diário?")) {
       await supabase.from('giveaways').update({ is_daily_highlight: false, status: 'completed' }).eq('id', id);
       fetchSorteios();
    }
  };
`;
if (!content.includes('handleDrawDailyWinner')) {
  content = content.replace(
    'const handleDrawWinner = async () => {',
    methodsToInject + '\n\n  const handleDrawWinner = async () => {'
  );
}

// 5. Update Giveaway Creation Form to save twitchTimer in prize_value
content = content.replace(
  `coins_cost: 0\n                    });`,
  `coins_cost: 0,\n                      prize_value: twitchTimer.toString()\n                    });`
);

const originalFormEnd = `                  {isCreatingTwitchGiveaway ? "Criando..." : "Criar Sorteio Diário (Ao Vivo)"}
                </button>
              </form>
            </div>
          </div>
        )}`;

// 6. Twitch Dashboard UI
const dashboardUI = `
            {activeDailyGiveaway ? (
              <>
                {/* ROULETTE & POPUP OVERLAY */}
                {(isRolling || winnerResult) && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel max-w-2xl w-full border border-purple-500/50 p-12 text-center rounded-3xl relative overflow-hidden">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />
                      <h2 className="text-3xl font-bold text-white mb-8">
                        {isRolling ? "Sorteando..." : "TEMOS UM VENCEDOR!"}
                      </h2>
                      <div className="text-7xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 animate-pulse mb-8 break-all">
                        @{currentRollName || "?"}
                      </div>
                      {winnerResult && (
                        <div className="space-y-8 animate-fade-in">
                          <div className="inline-block bg-black/50 border border-gray-800 rounded-2xl p-6">
                            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Tempo para responder:</p>
                            <div className={\`text-6xl font-black \${timerCount !== null && timerCount <= 10 ? 'text-red-500 animate-bounce' : 'text-white'}\`}>
                              {timerCount}s
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <button onClick={confirmWinner} className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 font-bold py-4 rounded-xl transition-all">
                              Ganhou! (Salvar)
                            </button>
                            <button onClick={rejectWinner} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 font-bold py-4 rounded-xl transition-all">
                              Não Respondeu (Sortear Novamente)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="glass-panel rounded-xl border border-purple-500/30 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden animated-border-card">
                      <h2 className="text-xl font-bold text-white mb-4">Sorteio em Andamento</h2>
                      {activeDailyGiveaway.image_url && <img src={activeDailyGiveaway.image_url} alt="Prêmio" className="w-32 h-32 object-contain mb-4" />}
                      <h3 className="text-2xl font-bold text-purple-400">{activeDailyGiveaway.title}</h3>
                      <div className="w-full mt-8 space-y-4">
                        <button 
                          onClick={toggleTwitchBot}
                          className={\`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all \${
                            botStatus === 'connected' ? 'bg-purple-900/50 border border-purple-500 text-purple-400 animate-pulse' : botStatus === 'connecting' ? 'bg-yellow-900/50 border border-yellow-500 text-yellow-500 cursor-wait' : 'bg-black border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                          }\`}
                        >
                          <Bot className="w-6 h-6" />
                          {botStatus === 'connected' ? \`Bot Ligado (#\${(session?.user as any)?.username || 'chat'})\` : botStatus === 'connecting' ? 'Conectando...' : 'Ligar Bot'}
                        </button>
                        <button onClick={handleDrawDailyWinner} className="w-full btn-neon font-bold italic tracking-widest uppercase py-4 rounded-xl text-lg flex items-center justify-center gap-2">
                          <Trophy className="w-6 h-6" /> Sortear Agora
                        </button>
                        <button onClick={() => handleStopDaily(activeDailyGiveaway.id)} className="w-full bg-red-900/20 border border-red-500/30 text-red-500 hover:bg-red-900/40 font-bold py-4 rounded-xl text-sm">
                          Encerrar Sorteio Diário
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="glass-panel rounded-xl border border-gray-800 p-6 flex flex-col max-h-[600px]">
                    <h2 className="text-lg font-bold text-white mb-4 flex justify-between items-center">
                      Participantes
                      <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs">{liveDailyParticipants.length} Total</span>
                    </h2>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                      {liveDailyParticipants.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">Nenhum participante ainda...</div>
                      ) : (
                        liveDailyParticipants.map((p, idx) => (
                          <div key={idx} className="bg-black/50 border border-gray-800 p-3 rounded-lg flex justify-between items-center">
                            <span className="font-bold text-white flex items-center gap-2">
                              {p.status === 'rejected' ? <span className="w-4 h-4 text-red-500 font-bold">X</span> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                              @{p.twitch_username}
                              {p.coins_used > 1 && <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-500 px-1 py-0.5 rounded uppercase">Sub</span>}
                            </span>
                            <span className="text-xs font-bold text-purple-500 bg-purple-500/10 px-2 py-1 rounded">{p.coins_used} CHANCES</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-panel rounded-xl border border-purple-500/30 p-8 relative overflow-hidden animated-border-card">
`;

if (!content.includes('TEMOS UM VENCEDOR!')) {
  content = content.replace(
    '<div className="glass-panel rounded-xl border border-purple-500/30 p-8 relative overflow-hidden animated-border-card">',
    dashboardUI
  );

  // Add the timer field to the form
  const timerField = `                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400">Tempo para Responder (Segundos)</label>
                    <input 
                      type="number" 
                      value={twitchTimer}
                      onChange={(e) => setTwitchTimer(parseInt(e.target.value) || 60)}
                      className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" 
                    />
                  </div>`;
  content = content.replace(
    '                    <label className="text-sm font-bold text-gray-400">Palavra-chave (Comando Chat)</label>',
    timerField + '\n                  <div className="space-y-2">\n                    <label className="text-sm font-bold text-gray-400">Palavra-chave (Comando Chat)</label>'
  );

  // Close the ternary
  content = content.replace(originalFormEnd, originalFormEnd.replace('          </div>\n        )}', '            )} // fechamento do ternary activeDailyGiveaway\n          </div>\n        )}'));
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully built Twitch Dashboard!");
