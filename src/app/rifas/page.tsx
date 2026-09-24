"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Ticket } from "lucide-react";
import { brl, takenNumbers, useRifaStore } from "@/lib/rifas";

// PROTÓTIPO: lista de rifas abertas (dados de exemplo do navegador)
export default function RifasPage() {
  const { store } = useRifaStore();

  return (
    <div className="min-h-screen bg-black pt-16 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-600/15 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase tracking-widest mb-6">
            <Ticket className="w-4 h-4" /> Rifas do BARR4K
          </span>
          <h1 className="font-title text-5xl md:text-6xl text-white">
            Escolha seus <span className="text-purple-500">números!</span>
          </h1>
          <p className="text-gray-400 mt-4 max-w-xl mx-auto">
            Escolha os números da sorte, pague pelo PIX e acompanhe tudo em &quot;Meus números&quot;. Quanto mais números, mais chances.
          </p>
        </div>

        {!store ? (
          <div className="flex justify-center py-20"><div className="uiverse-loader" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {store.raffles.filter((r) => r.status === "open").map((r) => {
              const sold = takenNumbers(store.orders, r.id).size;
              const pct = Math.round((sold / r.totalNumbers) * 100);
              return (
                <Link
                  key={r.id}
                  href={`/rifas/${r.id}`}
                  className="group rounded-2xl overflow-hidden border border-purple-500/30 hover:border-purple-500 bg-[#0c0d10] transition-all hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(168,85,247,0.25)]"
                >
                  <div className="relative aspect-[3/2] overflow-hidden bg-black">
                    {r.image && <img src={r.image} alt={r.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d10] via-transparent to-transparent" />
                    <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-green-500/90 text-black text-xs font-black uppercase tracking-widest not-italic">Aberta</span>
                    <span className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/80 border border-purple-500/50 text-purple-300 text-sm font-black not-italic">
                      {brl(r.pricePerNumber)} <span className="text-gray-400 font-bold text-xs">/ número</span>
                    </span>
                  </div>
                  <div className="p-6 space-y-5">
                    <div>
                      <h2 className="font-title text-3xl text-white">{r.title}</h2>
                      <p className="text-gray-400 text-sm mt-1">{r.subtitle}</p>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2">
                        <span className="text-gray-400">{sold} de {r.totalNumbers} vendidos</span>
                        <span className="text-purple-400">{pct}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 shadow-[0_0_12px_rgba(168,85,247,0.6)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-gray-400">
                        <Calendar className="w-4 h-4 text-purple-400" />
                        Sorteio {new Date(r.drawDate).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="btn-neon px-5 py-2.5 rounded-lg text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        Escolher números <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
