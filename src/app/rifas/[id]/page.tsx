"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { ArrowLeft, Calendar, CheckCircle2, Clock, Shuffle, Sparkles, Ticket, Trash2, X, XCircle } from "lucide-react";
import { FaTwitch } from "react-icons/fa";
import { brl, padNumber, takenNumbers, useRifaStore, type RaffleOrder } from "@/lib/rifas";
import CheckoutModal from "@/components/rifas/CheckoutModal";

type Filter = "all" | "free" | "mine";

// PROTÓTIPO: tela da rifa com todos os números
export default function RifaPage() {
  const { id } = useParams<{ id: string }>();
  const { store, placeOrder } = useRifaStore();
  const { data: session } = useSession();
  const username = String((session?.user as { username?: string } | undefined)?.username || session?.user?.name || "").toLowerCase();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [guest, setGuest] = useState(false); // só no protótipo: testar sem login

  const raffle = store?.raffles.find((r) => r.id === id);
  const buyer = username || (guest ? "visitante" : "");

  const taken = useMemo(() => (store && raffle ? takenNumbers(store.orders, raffle.id) : new Map()), [store, raffle]);
  const myOrders = useMemo(
    () => (store && raffle && buyer ? store.orders.filter((o) => o.raffleId === raffle.id && o.username === buyer) : []),
    [store, raffle, buyer]
  );
  const mine = useMemo(() => new Set(myOrders.filter((o) => o.status !== "rejected").flatMap((o) => o.numbers)), [myOrders]);

  if (!store) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="uiverse-loader" /></div>;
  if (!raffle) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 className="font-title text-3xl text-white">Rifa não encontrada</h1>
        <Link href="/rifas" className="text-purple-400 hover:text-purple-300 font-bold">Ver rifas abertas</Link>
      </div>
    );
  }

  const all = Array.from({ length: raffle.totalNumbers }, (_, i) => i + 1);
  const free = all.filter((n) => !taken.has(n));
  const pct = Math.round((taken.size / raffle.totalNumbers) * 100);
  const total = selected.size * raffle.pricePerNumber;
  const q = search.replace(/\D/g, "");
  const shown = all.filter((n) => {
    if (filter === "free" && taken.has(n)) return false;
    if (filter === "mine" && !mine.has(n)) return false;
    return !q || String(n).includes(String(Number(q))) || padNumber(n, raffle.totalNumbers).includes(q);
  });

  const toggle = (n: number) => {
    if (taken.has(n)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  // Surpresinha: sorteia números livres que ainda não estão selecionados
  const surprise = (count: number) => {
    const pool = free.filter((n) => !selected.has(n));
    const picks: number[] = [];
    while (picks.length < count && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    setSelected((prev) => new Set([...prev, ...picks]));
  };

  const startCheckout = () => {
    if (!buyer) return;
    setCheckoutOpen(true);
  };

  const cell = (n: number) => {
    const state = taken.get(n);
    const isMine = mine.has(n);
    const isSelected = selected.has(n);
    const base = "relative aspect-square rounded-lg text-xs sm:text-sm font-black not-italic flex items-center justify-center border transition-all select-none";
    if (isMine) {
      return `${base} bg-purple-500/15 border-purple-400/70 text-purple-200 cursor-default`;
    }
    if (state === "approved") return `${base} bg-white/[0.03] border-white/5 text-gray-700 line-through cursor-not-allowed`;
    if (state === "pending") return `${base} bg-white/[0.05] border-white/5 text-gray-600 cursor-not-allowed stripes`;
    if (isSelected) return `${base} bg-purple-600 border-purple-300 text-white shadow-[0_0_18px_rgba(168,85,247,0.7)] scale-[1.06] z-10`;
    return `${base} bg-[#121214] border-white/10 text-gray-200 hover:border-purple-400 hover:text-white hover:bg-purple-600/15 cursor-pointer active:scale-95`;
  };

  return (
    <div className="min-h-screen bg-black pt-10 pb-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/rifas" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm font-bold mb-6">
          <ArrowLeft className="w-4 h-4" /> Todas as rifas
        </Link>

        {/* Cabeçalho da rifa */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
          <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-purple-500/30 bg-black aspect-[3/2]">
            {raffle.image && <img src={raffle.image} alt={raffle.title} className="w-full h-full object-cover" />}
          </div>
          <div className="lg:col-span-3 glass-panel rounded-2xl border border-gray-800 p-6 md:p-8 flex flex-col justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-600/15 border border-purple-500/40 text-purple-300 text-[11px] font-bold uppercase tracking-widest mb-4">
                <Ticket className="w-3.5 h-3.5" /> Rifa
              </span>
              <h1 className="font-title text-4xl md:text-5xl text-white">{raffle.title}</h1>
              <p className="text-gray-400 mt-2">{raffle.subtitle}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Por número", brl(raffle.pricePerNumber)],
                ["Números", String(raffle.totalNumbers)],
                ["Sorteio", new Date(raffle.drawDate).toLocaleDateString("pt-BR")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-black/40 border border-white/5 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
                  <p className="text-white font-black text-lg mt-1 not-italic">{value}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2">
                <span className="text-gray-400">{taken.size} de {raffle.totalNumbers} já escolhidos</span>
                <span className="text-purple-400">{pct}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 shadow-[0_0_12px_rgba(168,85,247,0.6)]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Meus números */}
        {myOrders.length > 0 && (
          <div className="glass-panel rounded-2xl border border-purple-500/30 p-5 md:p-6 mb-10">
            <h2 className="font-title text-2xl text-white mb-4">Meus números</h2>
            <div className="space-y-3">
              {myOrders.map((o) => <MyOrder key={o.id} order={o} total={raffle.totalNumbers} />)}
            </div>
          </div>
        )}

        {/* Barra de ferramentas + legenda */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            {([["all", `Todos (${raffle.totalNumbers})`], ["free", `Disponíveis (${free.length})`], ["mine", `Meus (${mine.size})`]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border transition-colors ${filter === key ? "bg-purple-600 border-purple-400 text-white" : "border-gray-800 text-gray-400 hover:text-white"}`}>
                {label}
              </button>
            ))}
            <input value={search} onChange={(e) => setSearch(e.target.value)} inputMode="numeric" placeholder="Buscar número"
              className="w-36 bg-[#0a0a0b] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-purple-500 outline-none" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mr-1 flex items-center gap-1.5"><Shuffle className="w-4 h-4 text-purple-400" /> Surpresinha</span>
            {[1, 5, 10].map((n) => (
              <button key={n} onClick={() => surprise(n)} disabled={free.length === 0}
                className="px-3 py-2 rounded-lg text-xs font-black border border-purple-500/40 text-purple-200 bg-purple-600/10 hover:bg-purple-600/25 disabled:opacity-40 not-italic">
                +{n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5 text-xs font-bold text-gray-400">
          <Legend className="bg-[#121214] border-white/10" label="Disponível" />
          <Legend className="bg-purple-600 border-purple-300" label="Selecionado" />
          <Legend className="bg-purple-500/15 border-purple-400/70" label="Meus" />
          <Legend className="bg-white/[0.05] border-white/5 stripes" label="Reservado (aguardando pagamento)" />
          <Legend className="bg-white/[0.03] border-white/5" label="Vendido" />
        </div>

        {/* Grade de números */}
        <div className="glass-panel rounded-2xl border border-gray-800 p-3 sm:p-5">
          {shown.length === 0 ? (
            <p className="text-center text-gray-500 py-10 font-bold">Nenhum número por aqui.</p>
          ) : (
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 sm:gap-2">
              {shown.map((n) => (
                <button key={n} type="button" onClick={() => toggle(n)} disabled={taken.has(n)} className={cell(n)}
                  title={mine.has(n) ? "Seu número" : taken.get(n) === "pending" ? "Reservado" : taken.has(n) ? "Vendido" : "Disponível"}>
                  {padNumber(n, raffle.totalNumbers)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Barra de compra (aparece ao escolher números) */}
      <div className={`fixed bottom-0 inset-x-0 z-40 transition-transform duration-300 ${selected.size ? "translate-y-0" : "translate-y-full"}`}>
        <div className="bg-[#0b0b0e]/95 backdrop-blur-md border-t border-purple-500/40 shadow-[0_-10px_40px_rgba(168,85,247,0.2)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{selected.size} {selected.size === 1 ? "número" : "números"}</p>
                <button onClick={() => setSelected(new Set())} className="text-xs font-bold text-gray-500 hover:text-red-400 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> limpar</button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                {[...selected].sort((a, b) => a - b).map((n) => (
                  <button key={n} onClick={() => toggle(n)} title="Tirar"
                    className="shrink-0 px-2.5 py-1 rounded-md bg-purple-600 text-white text-xs font-black not-italic flex items-center gap-1 hover:bg-purple-500">
                    {padNumber(n, raffle.totalNumbers)} <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-5">
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{selected.size} × {brl(raffle.pricePerNumber)}</p>
                <p className="text-3xl font-black text-white not-italic">{brl(total)}</p>
              </div>
              {buyer ? (
                <button onClick={startCheckout} className="btn-neon px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Comprar números
                </button>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <button onClick={() => signIn("twitch")} className="btn-neon px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-2">
                    <FaTwitch className="w-4 h-4" /> Entrar para comprar
                  </button>
                  <button onClick={() => setGuest(true)} className="text-[11px] text-gray-500 hover:text-gray-300 font-bold">continuar sem login (só no protótipo)</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {checkoutOpen && (
        <CheckoutModal
          raffle={raffle}
          numbers={[...selected].sort((a, b) => a - b)}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={(proofs) => {
            const res = placeOrder(raffle, buyer, [...selected], proofs);
            if (res.ok) setSelected(new Set());
            return res;
          }}
        />
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`w-4 h-4 rounded border ${className}`} /> {label}
    </span>
  );
}

function MyOrder({ order, total }: { order: RaffleOrder; total: number }) {
  const badge = {
    pending: { icon: Clock, text: "Aguardando aprovação", cls: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30" },
    approved: { icon: CheckCircle2, text: "Pagamento aprovado", cls: "text-green-300 bg-green-500/10 border-green-500/30" },
    rejected: { icon: XCircle, text: "Recusado (números liberados)", cls: "text-red-300 bg-red-500/10 border-red-500/30" },
  }[order.status];
  const Icon = badge.icon;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-black/40 border border-white/5 p-3">
      <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${badge.cls}`}>
        <Icon className="w-3.5 h-3.5" /> {badge.text}
      </span>
      <div className="flex-1 flex flex-wrap gap-1.5">
        {order.numbers.map((n) => (
          <span key={n} className={`px-2 py-0.5 rounded-md text-xs font-black not-italic border ${order.status === "rejected" ? "border-white/10 text-gray-600 line-through" : "border-purple-400/60 text-purple-200 bg-purple-500/10"}`}>
            {padNumber(n, total)}
          </span>
        ))}
      </div>
      <span className="shrink-0 text-sm font-black text-white not-italic flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-gray-500" /> {new Date(order.createdAt).toLocaleDateString("pt-BR")} · {brl(order.total)}
      </span>
    </div>
  );
}
