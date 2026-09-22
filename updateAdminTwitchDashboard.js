const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'admin', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add states
const statesToInject = `
  const [liveDailyParticipants, setLiveDailyParticipants] = useState<any[]>([]);
  const activeDailyGiveaway = sorteios.find((s: any) => s.is_daily_highlight);
`;
if (!content.includes('liveDailyParticipants')) {
  content = content.replace(
    'const [twitchGiveawayImage, setTwitchGiveawayImage] = useState<File | null>(null);',
    'const [twitchGiveawayImage, setTwitchGiveawayImage] = useState<File | null>(null);\n' + statesToInject
  );
}

// 2. Add useEffect for liveDailyParticipants
const useEffectToInject = `
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
`;
if (!content.includes('channel(\'admin_daily_updates\')')) {
  content = content.replace(
    '// Conexão Inicial Supabase',
    useEffectToInject + '\n\n  // Conexão Inicial Supabase'
  );
}

// 3. Add methods handleDrawDailyWinner and handleStopDaily
const methodsToInject = `
  const handleDrawDailyWinner = async () => {
    if (liveDailyParticipants.length === 0) return alert("Nenhum participante aprovado ainda!");
    
    const tickets: any[] = [];
    liveDailyParticipants.forEach(p => {
      if (p.status === 'approved') {
        const chances = Math.max(1, p.coins_used);
        for (let i = 0; i < chances; i++) tickets.push(p);
      }
    });
    
    if (tickets.length === 0) return alert("Nenhum participante válido!");
    const winner = tickets[Math.floor(Math.random() * tickets.length)];

    const { data, error } = await supabase.from('winners').insert([{
      giveaway_id: activeDailyGiveaway.id,
      twitch_username: winner.twitch_username,
      prize: activeDailyGiveaway.title
    }]).select();

    if (!error) {
       alert(\`Vencedor sorteado: @\${winner.twitch_username}!\`);
       fetchWinners();
       fetchLocalWinners(activeDailyGiveaway.id);
    } else {
       alert("Erro: " + error.message);
    }
  };

  const handleStopDaily = async (id: string) => {
    if(confirm("Tem certeza que deseja encerrar o Sorteio Diário? Ele será finalizado.")) {
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

// 4. Update the JSX for activeTab === "twitch"
const originalTwitchUI = `            <div className="glass-panel rounded-xl border border-purple-500/30 p-8 relative overflow-hidden animated-border-card">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-purple-500" /> Criar Sorteio Instantâneo (Chat)
                </h2>
                <button 
                  onClick={toggleTwitchBot}
                  type="button"
                  className={\`flex items-center gap-2 font-bold px-6 py-2 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] border transition-all \${
                    botStatus === 'connected' 
                      ? 'bg-purple-900/50 border-purple-500 text-purple-400' 
                      : botStatus === 'connecting'
                      ? 'bg-yellow-900/50 border-yellow-500 text-yellow-500 cursor-wait'
                      : 'bg-black border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                  }\`}
                >
                  <Bot className={\`w-5 h-5 \${botStatus === 'connected' ? 'animate-pulse' : ''}\`} />
                  {botStatus === 'connected' ? \`Bot em #\${(session?.user as any)?.username || session?.user?.name || 'chat'}\` : botStatus === 'connecting' ? 'Conectando...' : 'Ligar Bot'}
                </button>
              </div>`;

const newTwitchUI = `
            {activeDailyGiveaway ? (
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
                          botStatus === 'connected' 
                            ? 'bg-purple-900/50 border border-purple-500 text-purple-400 animate-pulse' 
                            : botStatus === 'connecting'
                            ? 'bg-yellow-900/50 border border-yellow-500 text-yellow-500 cursor-wait'
                            : 'bg-black border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                        }\`}
                      >
                        <Bot className="w-6 h-6" />
                        {botStatus === 'connected' ? \`Bot Rodando em #\${(session?.user as any)?.username || session?.user?.name || 'chat'}\` : botStatus === 'connecting' ? 'Conectando...' : 'Ligar Captador (Bot)'}
                      </button>
                      
                      <button
                        onClick={handleDrawDailyWinner}
                        className="w-full btn-neon font-bold italic tracking-widest uppercase py-4 rounded-xl text-lg flex items-center justify-center gap-2"
                      >
                        <Trophy className="w-6 h-6" /> Sortear Agora
                      </button>

                      <button
                        onClick={() => handleStopDaily(activeDailyGiveaway.id)}
                        className="w-full bg-red-900/20 border border-red-500/30 text-red-500 hover:bg-red-900/40 font-bold py-4 rounded-xl text-sm"
                      >
                        Encerrar Sorteio Diário
                      </button>
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-xl border border-gray-800 p-6 flex flex-col max-h-[600px]">
                  <h2 className="text-lg font-bold text-white mb-4 flex justify-between items-center">
                    Participantes ao Vivo
                    <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs">{liveDailyParticipants.length} Total</span>
                  </h2>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {liveDailyParticipants.length === 0 ? (
                      <div className="text-gray-500 text-center py-8">Nenhum participante ainda...</div>
                    ) : (
                      liveDailyParticipants.map((p, idx) => (
                        <div key={idx} className="bg-black/50 border border-gray-800 p-3 rounded-lg flex justify-between items-center">
                          <span className="font-bold text-white flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" /> @{p.twitch_username}
                          </span>
                          <span className="text-xs font-bold text-purple-500 bg-purple-500/10 px-2 py-1 rounded">{p.coins_used} CHANCES</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-xl border border-purple-500/30 p-8 relative overflow-hidden animated-border-card">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Gift className="w-5 h-5 text-purple-500" /> Criar Sorteio Instantâneo (Chat)
                  </h2>
                </div>
`;

if (content.includes(originalTwitchUI)) {
  content = content.replace(originalTwitchUI, newTwitchUI);
  
  // also need to close the ternary we just opened
  const originalEndForm = `                  {isCreatingTwitchGiveaway ? "Criando..." : "Criar Sorteio Diário (Ao Vivo)"}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === "users" && (`;
        
  const newEndForm = `                  {isCreatingTwitchGiveaway ? "Criando..." : "Criar Sorteio Diário (Ao Vivo)"}
                </button>
              </form>
            </div>
            )}
          </div>
        )}

        {activeTab === "users" && (`;
        
  content = content.replace(originalEndForm, newEndForm);
} else {
  console.log("Could not find originalTwitchUI block");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated admin page with Operator Dashboard");
