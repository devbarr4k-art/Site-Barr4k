const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'admin', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace handleDrawDailyWinner
const oldDrawDaily = `  const handleDrawDailyWinner = async () => {
    if (liveDailyParticipants.length === 0) return alert("Nenhum participante aprovado ainda!");
    
    const tickets: any[] = [];
    liveDailyParticipants.forEach((p: any) => {
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
  };`;

const newDrawDaily = `  const handleDrawDailyWinner = async () => {
    if (liveDailyParticipants.length === 0) return alert("Nenhum participante na fila!");
    
    const tickets: any[] = [];
    liveDailyParticipants.forEach((p: any) => {
      if (p.status === 'approved' || p.status === 'pending') { // aceitamos pendente pq vem do bot
        const chances = Math.max(1, p.coins_used);
        for (let i = 0; i < chances; i++) tickets.push(p);
      }
    });
    
    if (tickets.length === 0) return alert("Nenhum participante válido!");
    
    setIsRolling(true);
    setWinnerResult(null);
    let counter = 0;
    const maxSpins = 30; // 30 rapid spins
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
        // Set the timer
        setTimerCount(twitchTimer);
      }
    }, intervalTime);
  };

  useEffect(() => {
    if (timerCount !== null && timerCount > 0) {
      timerRef.current = setTimeout(() => setTimerCount(timerCount - 1), 1000);
    } else if (timerCount === 0) {
      clearTimeout(timerRef.current);
    }
    return () => clearTimeout(timerRef.current);
  }, [timerCount]);

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
    } else {
       alert("Erro ao salvar vencedor: " + error.message);
    }
  };

  const rejectWinner = async () => {
    if (!winnerResult) return;
    
    // Update participant to rejected
    await supabase.from('participants').update({ status: 'rejected' }).eq('id', winnerResult.id);
    
    setWinnerResult(null);
    setTimerCount(null);
    setCurrentRollName("");
    // Re-fetch parts
    const { data } = await supabase.from('participants').select('*').eq('giveaway_id', activeDailyGiveaway.id);
    if (data) setLiveDailyParticipants(data);
  };
`;

if (content.includes(oldDrawDaily)) {
  content = content.replace(oldDrawDaily, newDrawDaily);
} else {
  console.log("Could not find oldDrawDaily!");
}

// 2. Add the Roulette Popup to JSX
// It should be inside activeTab === "twitch"
const originalDashboardStart = `{activeDailyGiveaway ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">`;

const popupJSX = `
              {/* ROULETTE & POPUP OVERLAY */}
              {(isRolling || winnerResult) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in">
                  <div className="glass-panel max-w-2xl w-full border border-purple-500/50 p-12 text-center rounded-3xl relative overflow-hidden">
                    {/* Background glow */}
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
                          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Tempo para responder no chat:</p>
                          <div className={\`text-6xl font-black \${timerCount && timerCount <= 10 ? 'text-red-500 animate-bounce' : 'text-white'}\`}>
                            {timerCount}s
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={confirmWinner}
                            className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 font-bold py-4 rounded-xl transition-all"
                          >
                            Respondeu (Salvar Ganhou!)
                          </button>
                          <button
                            onClick={rejectWinner}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 font-bold py-4 rounded-xl transition-all"
                          >
                            Não Respondeu (Sortear Novamente)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
`;

if (content.includes(originalDashboardStart) && !content.includes('ROULETTE & POPUP OVERLAY')) {
  content = content.replace(originalDashboardStart, popupJSX + '\n' + originalDashboardStart);
} else {
  console.log("Could not inject popup or it already exists");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully added Roulette and Timer to Admin Page");
