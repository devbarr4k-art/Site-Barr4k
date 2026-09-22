"use client";

import { useState, useEffect } from "react";
import { FaTwitch, FaTicketAlt } from "react-icons/fa";
import { Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";

export default function MeusTicketsPage() {
  const { data: session, status } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGiveaway, setSelectedGiveaway] = useState<any>(null);
  const [myTickets, setMyTickets] = useState<any[]>([]);

  const ITEMS_PER_PAGE = 10;
  
  const currentUser = (session?.user as any)?.username || session?.user?.name;

  useEffect(() => {
    if (status === "authenticated" && currentUser) {
      fetchMyTickets();
    }
  }, [status, currentUser]);

  const fetchMyTickets = async () => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('participants')
      .select('*, giveaways(*)')
      .eq('twitch_username', currentUser)
      .order('created_at', { ascending: false });
      
    if (data) {
      setMyTickets(data);
    }
  };

  // Lógica de Paginação
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentTickets = myTickets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(myTickets.length / ITEMS_PER_PAGE) || 1;

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="min-h-screen bg-black pt-28 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Meus <span className="text-purple-500">Tickets</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Acompanhe suas participações em sorteios, gerencie suas palavras-chave e verifique seus multiplicadores.
          </p>
        </div>

        {!isAuthenticated ? (
          /* Unauthenticated State */
          <div className="glass-panel border border-purple-500/30 rounded-2xl p-12 md:p-20 text-center relative overflow-hidden animated-border-card shadow-[0_0_40px_rgba(126,34,206,0.15)]">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 animate-[pulse_4s_ease-in-out_infinite]" />
            <div className="relative z-10 flex flex-col items-center justify-center space-y-6">
              <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center border border-gray-800 shadow-xl mb-4">
                <FaTicketAlt className="w-10 h-10 text-gray-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Você não está conectado
                </h3>
                <p className="text-gray-400 max-w-md mx-auto">
                  Conecte-se com sua conta da Twitch para ver seus tickets, histórico de vitórias e gerenciar suas participações ativas.
                </p>
              </div>
              <button 
                onClick={() => setIsAuthenticated(true)}
                className="mt-6 flex items-center gap-3 bg-white hover:bg-gray-100 text-black px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:-translate-y-1"
              >
                <FaTwitch className="w-5 h-5 text-purple-500" />
                Continuar com a Twitch
              </button>
            </div>
          </div>
        ) : (
          /* Authenticated State (Mock) */
          <div className="space-y-8 animate-fade-in">
            {/* Header User Info */}
            <div className="glass-panel border border-gray-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center text-xl font-bold border-2 border-purple-500">
                  U
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">@{currentUser}</h2>
                  <p className="text-gray-400 text-sm">Conectado via Twitch</p>
                </div>
              </div>
            </div>

            {/* Active Tickets */}
            <div>
              <h3 className="text-2xl font-bold text-white mb-6">Sorteios Ativos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {currentTickets.map((ticket) => (
                  <div 
                    key={ticket.id} 
                    onClick={() => setSelectedGiveaway(ticket)}
                    className="glass-panel border border-gray-800 hover:border-purple-500/50 rounded-xl p-6 transition-all relative overflow-hidden group cursor-pointer"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 blur-[30px] rounded-full group-hover:bg-purple-600/20 transition-all" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <span className="bg-purple-900/40 text-purple-300 text-xs px-2 py-1 rounded font-bold border border-purple-800 mb-2 inline-block">
                          {ticket.status === 'approved' ? 'Participando (Aprovado)' : ticket.status === 'rejected' ? 'Rejeitado' : 'Em Análise'}
                        </span>
                        <h4 className="text-lg font-bold text-white truncate max-w-[200px]">{ticket.giveaways?.title}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-white">{Math.floor(ticket.coins_used / 100) || 1}</span>
                        <span className="block text-[10px] text-gray-500 uppercase font-bold">Chances Estimadas</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400 relative z-10">
                      <AlertCircle className="w-4 h-4 text-purple-500" /> Clique para ver os tickets
                    </div>
                  </div>
                ))}

                {currentTickets.length === 0 && (
                  <div className="col-span-1 md:col-span-2 text-center py-10">
                    <p className="text-gray-400">Você ainda não participou de nenhum sorteio.</p>
                  </div>
                )}

              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-10">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg font-bold text-sm bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Ant
                    </button>
                    
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const page = idx + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => paginate(page)}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold text-sm transition-all ${
                            currentPage === page 
                              ? "bg-purple-600 text-white border border-purple-500" 
                              : "bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800 hover:text-white"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 rounded-lg font-bold text-sm bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Próx
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Modal de Detalhes do Ticket */}
      {selectedGiveaway !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-[#121214] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl relative my-8">
            <button 
              onClick={() => setSelectedGiveaway(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            <div className="p-8 space-y-6">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-wider mb-2">Meus Tickets</h2>
              <p className="text-gray-400 text-sm border-b border-gray-800 pb-4">
                Sorteio: <span className="text-white font-bold">{selectedGiveaway?.giveaways?.title}</span>
              </p>
              
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {/* Simulando os números dos tickets baseado nas chances */}
                {Array.from({ length: Math.floor(selectedGiveaway?.coins_used / 100) || 1 }).map((_, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#0a0a0b] border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <FaTicketAlt className="text-purple-500 w-5 h-5" />
                      <span className="font-bold text-gray-300">Ticket #{String(idx + 1).padStart(4, '0')}</span>
                    </div>
                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded font-bold border border-green-500/30">
                      {selectedGiveaway?.status === 'approved' ? 'Aprovado' : 'Em Análise'}
                    </span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setSelectedGiveaway(null)}
                className="w-full btn-neon font-bold italic tracking-widest uppercase py-4 rounded-lg mt-2 text-sm text-center block"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
