const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'admin', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Inject CheckCircle2 if missing
if (!content.includes('CheckCircle2')) {
  content = content.replace('Gift } from "lucide-react";', 'Gift, CheckCircle2 } from "lucide-react";');
}

// 2. Inject states
const statesToInject = `
  const [liveDailyParticipants, setLiveDailyParticipants] = useState<any[]>([]);
  const activeDailyGiveaway = sorteios.find((s: any) => s.is_daily_highlight);
`;
if (!content.includes('liveDailyParticipants')) {
  content = content.replace(
    /const \[isCreatingTwitchGiveaway, setIsCreatingTwitchGiveaway\] = useState\(false\);/g,
    'const [isCreatingTwitchGiveaway, setIsCreatingTwitchGiveaway] = useState(false);\n' + statesToInject
  );
}

// 3. Add useEffect
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
    /\/\/ Conexão Inicial Supabase/g,
    useEffectToInject + '\n\n  // Conexão Inicial Supabase'
  );
}

// 4. Add Methods
const methodsToInject = `
  const handleDrawDailyWinner = async () => {
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
    /const fetchSorteios = async \(\) => {/g,
    methodsToInject + '\n\n  const fetchSorteios = async () => {'
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully fixed admin page with states and methods");
