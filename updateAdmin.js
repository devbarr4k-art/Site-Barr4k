const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'admin', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add states for twitch giveaway
content = content.replace(
  'const [subMultiplier, setSubMultiplier] = useState(2);',
  `const [subMultiplierT1, setSubMultiplierT1] = useState(2);
  const [subMultiplierT2, setSubMultiplierT2] = useState(3);
  const [subMultiplierT3, setSubMultiplierT3] = useState(5);
  const [twitchGiveawayTitle, setTwitchGiveawayTitle] = useState("");
  const [twitchGiveawayImage, setTwitchGiveawayImage] = useState<File | null>(null);
  const [isCreatingTwitchGiveaway, setIsCreatingTwitchGiveaway] = useState(false);`
);

// 2. Change handleChatEntry to use subMultiplierT1
content = content.replace(
  'const chances = isSub ? subMultiplier : 1;',
  'const chances = isSub ? subMultiplierT1 : 1;'
);

// 3. Update the Twitch Form inputs
const formToReplace = `<form className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-400">Título do Prêmio</label>
                  <input type="text" className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" placeholder="Ex: Faca Butterfly" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400">Palavra-chave (Comando Chat)</label>
                    <input 
                      type="text" 
                      value={botCommand}
                      onChange={(e) => setBotCommand(e.target.value)}
                      disabled={botStatus !== 'disconnected'}
                      className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none disabled:opacity-50" 
                      placeholder="Ex: !BARR4K" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-purple-500">Imagem do Prêmio</label>
                    <input type="file" className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-2 text-gray-400 focus:border-purple-500 outline-none" />
                  </div>
                </div>

                {/* Twitch Multipliers Config */}
                <div className="pt-4 border-t border-gray-800 mt-4">
                  <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Multiplicador de Subscribers</h3>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-purple-400">CHANCES PARA SUBS E FOUNDERS</label>
                    <input 
                      type="number" 
                      value={subMultiplier}
                      onChange={(e) => setSubMultiplier(parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0a0a0b] border border-purple-500/30 rounded-lg px-4 py-2 text-white outline-none" 
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(true)}
                  className="w-full btn-neon font-bold italic tracking-widest uppercase py-4 rounded-lg mt-6 text-sm text-center block"
                >
                  Criar Sorteio Diário (Ao Vivo)
                </button>
              </form>`;

const formReplacement = `<form className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-400">Título do Prêmio</label>
                  <input type="text" 
                    value={twitchGiveawayTitle}
                    onChange={(e) => setTwitchGiveawayTitle(e.target.value)}
                    className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" 
                    placeholder="Ex: Faca Butterfly" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400">Palavra-chave (Comando Chat)</label>
                    <input 
                      type="text" 
                      value={botCommand}
                      onChange={(e) => setBotCommand(e.target.value)}
                      disabled={botStatus !== 'disconnected'}
                      className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none disabled:opacity-50" 
                      placeholder="Ex: !BARR4K" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-purple-500">Imagem do Prêmio</label>
                    <input 
                      type="file" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setTwitchGiveawayImage(e.target.files[0]);
                        }
                      }}
                      className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-2 text-gray-400 focus:border-purple-500 outline-none" 
                    />
                  </div>
                </div>

                {/* Twitch Multipliers Config */}
                <div className="pt-4 border-t border-gray-800 mt-4">
                  <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Multiplicador de Subscribers (Por Tier)</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-purple-400">CHANCES TIER 1</label>
                      <input 
                        type="number" 
                        value={subMultiplierT1}
                        onChange={(e) => setSubMultiplierT1(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#0a0a0b] border border-purple-500/30 rounded-lg px-4 py-2 text-white outline-none" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-purple-400">CHANCES TIER 2</label>
                      <input 
                        type="number" 
                        value={subMultiplierT2}
                        onChange={(e) => setSubMultiplierT2(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#0a0a0b] border border-purple-500/30 rounded-lg px-4 py-2 text-white outline-none" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-purple-400">CHANCES TIER 3</label>
                      <input 
                        type="number" 
                        value={subMultiplierT3}
                        onChange={(e) => setSubMultiplierT3(parseInt(e.target.value) || 1)}
                        className="w-full bg-[#0a0a0b] border border-purple-500/30 rounded-lg px-4 py-2 text-white outline-none" 
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (!twitchGiveawayTitle) {
                      alert("Digite o título do prêmio!");
                      return;
                    }
                    setIsCreatingTwitchGiveaway(true);
                    
                    let uploadedUrl = "";
                    if (twitchGiveawayImage) {
                       const fileExt = twitchGiveawayImage.name.split('.').pop();
                       const fileName = \`\${Math.random()}.\${fileExt}\`;
                       
                       const { data: uploadData, error: uploadError } = await supabase.storage
                         .from('giveaway-images')
                         .upload(fileName, twitchGiveawayImage);
                         
                       if (uploadError) {
                         alert("Erro ao enviar imagem: " + uploadError.message);
                         setIsCreatingTwitchGiveaway(false);
                         return;
                       }
                       
                       const { data: { publicUrl } } = supabase.storage
                         .from('giveaway-images')
                         .getPublicUrl(fileName);
                         
                       uploadedUrl = publicUrl;
                    }

                    const { error } = await supabase.from('giveaways').insert({
                      title: twitchGiveawayTitle,
                      image_url: uploadedUrl,
                      status: 'active',
                      is_daily_highlight: true,
                      type: 'normal',
                      coins_cost: 0
                    });

                    if (error) {
                      alert("Erro ao criar sorteio diário: " + error.message);
                    } else {
                      alert("Sorteio diário criado com sucesso!");
                      setTwitchGiveawayTitle("");
                      setTwitchGiveawayImage(null);
                      // Re-fetch giveaways se necessário ou só avisar.
                    }
                    
                    setIsCreatingTwitchGiveaway(false);
                  }}
                  disabled={isCreatingTwitchGiveaway}
                  className="w-full btn-neon font-bold italic tracking-widest uppercase py-4 rounded-lg mt-6 text-sm text-center block disabled:opacity-50"
                >
                  {isCreatingTwitchGiveaway ? "Criando..." : "Criar Sorteio Diário (Ao Vivo)"}
                </button>
              </form>`;

content = content.replace(formToReplace, formReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated admin/page.tsx');
