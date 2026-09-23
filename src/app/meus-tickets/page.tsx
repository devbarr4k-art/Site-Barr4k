"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FaTwitch, FaTicketAlt } from "react-icons/fa";
import { ArrowRight } from "lucide-react";
import { useSession, signIn } from "next-auth/react";

const ITEMS_PER_PAGE = 10;

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  approved: { label: "Aprovado", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  rejected: { label: "Rejeitado", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  pending: { label: "Em Análise", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
};

export default function MeusTicketsPage() {
  const { data: session, status } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentUser = String((session?.user as any)?.username || session?.user?.name || "").toLowerCase();

  useEffect(() => {
    if (status !== "authenticated") return;
    setIsLoading(true);
    fetch("/api/meus-tickets")
      .then((res) => res.json())
      .then((json) => setMyTickets(json.tickets ?? []))
      .catch(() => setMyTickets([]))
      .finally(() => setIsLoading(false));
  }, [status]);

  const totalPages = Math.ceil(myTickets.length / ITEMS_PER_PAGE) || 1;
  const currentTickets = myTickets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-black pt-28 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Meus <span className="text-purple-500">Tickets</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Acompanhe suas participações nos sorteios e o status de cada inscrição.
          </p>
        </div>

        {status === "loading" ? (
          <div className="flex justify-center py-20"><div className="uiverse-loader"></div></div>
        ) : status !== "authenticated" ? (
          <div className="glass-panel border border-purple-500/30 rounded-2xl p-12 md:p-20 text-center relative overflow-hidden animated-border-card shadow-[0_0_40px_rgba(126,34,206,0.15)]">
            <div className="relative z-10 flex flex-col items-center justify-center space-y-6">
              <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center border border-gray-800 shadow-xl mb-4">
                <FaTicketAlt className="w-10 h-10 text-gray-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Você não está conectado</h3>
                <p className="text-gray-400 max-w-md mx-auto">
                  Conecte-se com sua conta da Twitch para ver seus tickets e acompanhar suas participações.
                </p>
              </div>
              <button
                onClick={() => signIn("twitch")}
                className="mt-6 flex items-center gap-3 bg-white hover:bg-gray-100 text-black px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:-translate-y-1"
              >
                <FaTwitch className="w-5 h-5 text-purple-500" />
                Continuar com a Twitch
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            <div className="glass-panel border border-gray-800 rounded-xl p-6 flex items-center gap-4">
              <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center text-xl font-bold border-2 border-purple-500 overflow-hidden">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  String(currentUser || "U").charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">@{currentUser}</h2>
                <p className="text-gray-400 text-sm">Conectado via Twitch</p>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-white mb-6">Minhas Participações</h3>

              {isLoading ? (
                <div className="flex justify-center py-10"><div className="uiverse-loader"></div></div>
              ) : currentTickets.length === 0 ? (
                <div className="text-center py-10 space-y-4">
                  <p className="text-gray-400">Você ainda não participou de nenhum sorteio.</p>
                  <Link href="/#active-giveaways" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-bold text-sm">
                    Ver sorteios ativos <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {currentTickets.map((ticket) => {
                    const statusStyle = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.pending;
                    const giveawayOpen = ticket.giveaways?.status === "active";
                    return (
                      <Link
                        key={ticket.id}
                        href={`/sorteio/${ticket.giveaway_id}`}
                        className="glass-panel border border-gray-800 hover:border-purple-500/50 rounded-xl p-6 transition-all relative overflow-hidden group block"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 blur-[30px] rounded-full group-hover:bg-purple-600/20 transition-all" />
                        <div className="flex justify-between items-start gap-4 mb-4 relative z-10">
                          <div className="min-w-0">
                            <span className={`text-xs px-2 py-1 rounded font-bold border mb-2 inline-block ${statusStyle.className}`}>
                              {statusStyle.label}
                            </span>
                            <h4 className="text-lg font-bold text-white truncate">{ticket.giveaways?.title?.replace("|", " ") || "Sorteio removido"}</h4>
                          </div>
                          {ticket.coins_used > 0 && (
                            <div className="text-right shrink-0">
                              <span className="text-2xl font-black text-white">{ticket.coins_used}</span>
                              <span className="block text-[10px] text-gray-500 uppercase font-bold">Coins</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 relative z-10">
                          <span>Inscrito em {new Date(ticket.created_at).toLocaleDateString("pt-BR")}</span>
                          <span className={giveawayOpen ? "text-green-400 font-bold" : "text-gray-500 font-bold"}>
                            {giveawayOpen ? "Sorteio aberto" : "Sorteio encerrado"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex justify-center mt-10">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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
                          onClick={() => setCurrentPage(page)}
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
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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
    </div>
  );
}
