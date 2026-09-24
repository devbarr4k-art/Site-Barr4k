"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock, Edit, ExternalLink, ImagePlus, Lock, Plus, RotateCcw, Search, Ticket, Trash2, Unlock, X } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { uploadGiveawayImage } from "@/lib/image";
import { useDialog } from "@/components/ui/Dialog";
import NumberInput from "@/components/ui/NumberInput";
import {
  brl, centsToInput, MAX_RAFFLE_NUMBERS, padNumber, parseMoneyToCents,
  type OrderStatus, type Raffle, type RaffleOrder,
} from "@/lib/rifas";

type AdminRaffle = Raffle & { pending_orders: number; awaiting_orders: number; received_cents: number };

type Draft = {
  id?: string;
  title: string;
  subtitle: string;
  price: string; // "10,00"
  total: number | "";
  drawDate: string; // datetime-local
  pixKey: string;
  pixName: string;
  status: "open" | "closed";
  image: { url: string | null; file: File | null; preview: string | null };
  qr: { url: string | null; file: File | null; preview: string | null };
};

const STATUS_LABEL: Record<OrderStatus, string> = { awaiting: "Pagando agora", pending: "Pendentes", approved: "Aprovadas", rejected: "Recusadas", expired: "Vencidas" };

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyDraft = (last?: AdminRaffle): Draft => ({
  title: "", subtitle: "", price: "10,00", total: 100, drawDate: "",
  // chave e QR do PIX costumam ser os mesmos: reaproveita da última rifa
  pixKey: last?.pix_key ?? "", pixName: last?.pix_name ?? "BARR4K PRODUÇÕES", status: "open",
  image: { url: null, file: null, preview: null },
  qr: { url: last?.qr_image_url ?? null, file: null, preview: last?.qr_image_url ?? null },
});

// Rifas: criar/editar, abrir ou encerrar vendas e aprovar os pagamentos (PIX conferido à mão)
export default function RafflesManager() {
  const dialog = useDialog();
  const [raffles, setRaffles] = useState<AdminRaffle[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [orders, setOrders] = useState<RaffleOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [tab, setTab] = useState<OrderStatus>("pending");
  const [raffleFilter, setRaffleFilter] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const loadRaffles = useCallback(async () => {
    try {
      const res = await adminApi<{ data: AdminRaffle[] }>("listRaffles");
      setRaffles(res.data);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erro ao carregar.");
      setRaffles([]);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await adminApi<{ data: RaffleOrder[] }>("listRaffleOrders", { status: tab, raffleId: raffleFilter || undefined });
      setOrders(res.data);
    } catch {
      setOrders([]);
    }
    setOrdersLoading(false);
  }, [tab, raffleFilter]);

  useEffect(() => { loadRaffles(); }, [loadRaffles]);
  useEffect(() => { if (!loadError) loadOrders(); }, [loadOrders, loadError]);

  const shownOrders = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return orders;
    const num = Number(q);
    return orders.filter((o) => o.username.includes(q) || (Number.isInteger(num) && o.numbers.includes(num)));
  }, [orders, query]);

  const totalPending = raffles?.reduce((a, r) => a + r.pending_orders, 0) ?? 0;

  // ---- Rifa: criar/editar ----
  const openNew = () => setDraft(emptyDraft(raffles?.[0]));
  const openEdit = (r: AdminRaffle) =>
    setDraft({
      id: r.id, title: r.title, subtitle: r.subtitle ?? "", price: centsToInput(r.price_cents), total: r.total_numbers,
      drawDate: toLocalInput(r.draw_date), pixKey: r.pix_key ?? "", pixName: r.pix_name ?? "", status: r.status,
      image: { url: r.image_url, file: null, preview: r.image_url },
      qr: { url: r.qr_image_url, file: null, preview: r.qr_image_url },
    });

  const pick = (slot: "image" | "qr", file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setDraft((d) => d && { ...d, [slot]: { ...d[slot], file, preview: e.target?.result as string } });
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const price = parseMoneyToCents(draft.price);
    if (!draft.title.trim()) return dialog.alert({ title: "Falta o nome", message: "Dê um nome para a rifa.", tone: "warning" });
    if (!price) return dialog.alert({ title: "Valor inválido", message: "Coloque o valor de cada número, por exemplo 10,00.", tone: "warning" });
    if (!draft.total || draft.total < 1) return dialog.alert({ title: "Quantidade inválida", message: "A rifa precisa ter pelo menos 1 número.", tone: "warning" });
    setSaving(true);
    try {
      const imageUrl = draft.image.file ? await uploadGiveawayImage(draft.image.file) : draft.image.preview ? draft.image.url : null;
      const qrUrl = draft.qr.file ? await uploadGiveawayImage(draft.qr.file) : draft.qr.preview ? draft.qr.url : null;
      await adminApi("saveRaffle", {
        id: draft.id,
        fields: {
          title: draft.title, subtitle: draft.subtitle, price_cents: price, total_numbers: draft.total,
          draw_date: draft.drawDate ? new Date(draft.drawDate).toISOString() : null,
          pix_key: draft.pixKey, pix_name: draft.pixName, status: draft.status,
          image_url: imageUrl, qr_image_url: qrUrl,
        },
      });
      setDraft(null);
      loadRaffles();
    } catch (err) {
      dialog.error(err, "Não foi possível salvar a rifa");
    }
    setSaving(false);
  };

  const toggleOpen = async (r: AdminRaffle) => {
    const closing = r.status === "open";
    if (closing && !(await dialog.confirm({
      title: `Encerrar as vendas de "${r.title}"?`,
      message: "Ninguém mais consegue escolher números. As compras pendentes continuam aqui para você aprovar.",
      confirmText: "Encerrar vendas",
      tone: "warning",
    }))) return;
    try {
      await adminApi("saveRaffle", {
        id: r.id,
        fields: { ...r, status: closing ? "closed" : "open" },
      });
      loadRaffles();
    } catch (err) {
      dialog.error(err);
    }
  };

  const remove = async (r: AdminRaffle) => {
    const sold = (r.sold ?? 0) + (r.reserved ?? 0);
    const ok = await dialog.confirm({
      title: `Excluir a rifa "${r.title}"?`,
      message: sold > 0
        ? `Ela tem ${sold} números escolhidos. As compras e os comprovantes são apagados junto. Não dá para desfazer.`
        : "Não dá para desfazer.",
      confirmText: "Excluir rifa",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await adminApi("deleteRaffle", { id: r.id });
      if (raffleFilter === r.id) setRaffleFilter("");
      loadRaffles();
      loadOrders();
    } catch (err) {
      dialog.error(err);
    }
  };

  // ---- Compras: aprovar / recusar ----
  const decide = async (o: RaffleOrder, status: OrderStatus) => {
    if (status === "rejected" && !(await dialog.confirm({
      title: `Recusar a compra de @${o.username}?`,
      message: `Os ${o.numbers.length} números voltam a ficar livres e outra pessoa pode escolher. Se foi sem querer, dá para voltar na aba Recusadas enquanto ninguém pegar esses números.`,
      confirmText: "Recusar",
      tone: "danger",
    }))) return;
    setBusyOrder(o.id);
    try {
      await adminApi("setRaffleOrderStatus", { id: o.id, status });
      if (o.status === "rejected") dialog.alert({ title: "Compra de volta!", message: `@${o.username} voltou para Pendentes com os mesmos números.`, tone: "success" });
      setOrders((prev) => prev.filter((x) => x.id !== o.id)); // sai desta aba
      loadRaffles();
    } catch (err) {
      dialog.error(err);
    }
    setBusyOrder(null);
  };

  const inputClass = "w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors";

  if (!raffles) return <div className="flex justify-center py-16"><div className="uiverse-loader" /></div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Rifas</h1>
          <p className="text-gray-400">Crie as rifas, confira o PIX de cada compra e aprove. Recusar libera os números para outras pessoas.</p>
        </div>
        {!loadError && (
          <div className="flex gap-3 shrink-0">
            <Link href="/ragi09" target="_blank" className="px-4 py-3 rounded-lg border border-gray-700 text-gray-300 hover:text-white text-sm font-bold flex items-center gap-2">
              <ExternalLink className="w-4 h-4" /> Ver no site
            </Link>
            <button onClick={openNew} className="btn-neon px-6 py-3 rounded-lg font-bold flex items-center gap-2">
              <Plus className="w-5 h-5" /> Nova Rifa
            </button>
          </div>
        )}
      </div>

      {loadError ? (
        <div className="glass-panel rounded-xl border border-yellow-500/30 p-6 text-yellow-200">{loadError}</div>
      ) : (
        <>
          {/* Rifas */}
          {raffles.length === 0 ? (
            <div className="glass-panel rounded-xl border border-gray-800 p-10 text-center text-gray-500">
              Nenhuma rifa ainda. Clique em &quot;Nova Rifa&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {raffles.map((r) => {
                const sold = r.sold ?? 0;
                const reserved = r.reserved ?? 0;
                const free = r.total_numbers - sold - reserved;
                const open = r.status === "open";
                return (
                  <div key={r.id} className={`glass-panel rounded-xl border p-4 flex gap-4 ${open ? "border-purple-500/30" : "border-gray-800"}`}>
                    <div className="w-28 sm:w-36 shrink-0 aspect-[3/2] rounded-lg overflow-hidden bg-black border border-gray-800 self-start">
                      {r.image_url ? <img src={r.image_url} alt="" className={`w-full h-full object-cover ${open ? "" : "grayscale"}`} /> : <Ticket className="w-8 h-8 text-gray-700 m-auto mt-6" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-white font-bold truncate">{r.title}</p>
                          <p className="text-xs text-gray-400">{brl(r.price_cents)} por número · {r.total_numbers} números{r.draw_date ? ` · sorteio ${new Date(r.draw_date).toLocaleDateString("pt-BR")}` : ""}</p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${open ? "bg-green-500/15 text-green-300 border border-green-500/40" : "bg-gray-800 text-gray-400 border border-gray-700"}`}>
                          {open ? "Aberta" : "Encerrada"}
                        </span>
                      </div>
                      {/* barra: pagos | reservados | livres */}
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
                        <div className="bg-green-500" style={{ width: `${(sold / r.total_numbers) * 100}%` }} />
                        <div className="bg-yellow-400/80" style={{ width: `${(reserved / r.total_numbers) * 100}%` }} />
                      </div>
                      <p className="text-xs text-gray-400">
                        <b className="text-green-400">{sold}</b> pagos · <b className="text-yellow-300">{reserved}</b> reservados · <b className="text-gray-200">{free}</b> livres · recebido <b className="text-white">{brl(r.received_cents)}</b>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {r.pending_orders > 0 && (
                          <button onClick={() => { setTab("pending"); setRaffleFilter(r.id); }}
                            className="px-2.5 py-1 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-200 text-xs font-bold">
                            {r.pending_orders} para aprovar
                          </button>
                        )}
                        {r.awaiting_orders > 0 && (
                          <button onClick={() => { setTab("awaiting"); setRaffleFilter(r.id); }}
                            className="px-2.5 py-1 rounded bg-purple-500/15 border border-purple-500/40 text-purple-200 text-xs font-bold">
                            {r.awaiting_orders} pagando agora
                          </button>
                        )}
                        {!r.qr_image_url && <span className="px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold">sem QR do PIX</span>}
                        <div className="flex-1" />
                        <Link href={`/ragi09/${r.id}`} target="_blank" title="Ver no site" className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-300"><ExternalLink className="w-4 h-4" /></Link>
                        <button onClick={() => toggleOpen(r)} title={open ? "Encerrar vendas" : "Reabrir vendas"} className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-300">
                          {open ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button onClick={() => openEdit(r)} title="Editar" className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => remove(r)} title="Excluir" className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Compras */}
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <h2 className="font-title text-2xl text-white">Compras</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-[#121214] border border-gray-800 rounded-lg overflow-hidden">
                  {(["pending", "awaiting", "approved", "rejected"] as const).map((s) => (
                    <button key={s} onClick={() => setTab(s)}
                      className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 ${tab === s ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                      {STATUS_LABEL[s]}
                      {s === "pending" && totalPending > 0 && <span className="px-1.5 rounded-full bg-yellow-400 text-black text-[10px] not-italic">{totalPending}</span>}
                    </button>
                  ))}
                </div>
                <select value={raffleFilter} onChange={(e) => setRaffleFilter(e.target.value)}
                  className="bg-[#0a0a0b] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500 [color-scheme:dark]">
                  <option value="">Todas as rifas</option>
                  {raffles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nick ou número"
                    className="w-40 bg-[#0a0a0b] border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-purple-500 outline-none" />
                </div>
              </div>
            </div>

            {ordersLoading ? (
              <div className="flex justify-center py-10"><div className="uiverse-loader" /></div>
            ) : shownOrders.length === 0 ? (
              <div className="glass-panel rounded-xl border border-gray-800 p-10 text-center text-gray-500">
                {tab === "pending" ? "Nenhuma compra esperando aprovação." : "Nada por aqui."}
              </div>
            ) : (
              <div className="space-y-3">
                {shownOrders.map((o) => {
                  const r = raffles.find((x) => x.id === o.raffle_id);
                  return (
                    <div key={o.id} className="glass-panel rounded-xl border border-gray-800 p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="lg:w-52 shrink-0">
                        <p className="text-white font-bold">@{o.username}</p>
                        <p className="text-xs text-gray-500">{o.raffle_title} · {new Date(o.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                      </div>
                      <div className="flex-1 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                        {o.numbers.map((n) => (
                          <span key={n} className="px-2 py-0.5 rounded-md border border-purple-500/40 text-purple-200 bg-purple-500/10 text-xs font-black not-italic">{padNumber(n, r?.total_numbers ?? 100)}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {o.status === "awaiting" ? (
                          <span className="text-xs text-purple-300 font-bold">pagando até {o.expires_at ? new Date(o.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                        ) : (o.proofs ?? []).length === 0 ? (
                          <span className="text-xs text-gray-600">sem comprovante</span>
                        ) : (o.proofs ?? []).map((p, i) => (
                          <button key={i} onClick={() => setPreview(p)} title="Ver comprovante"
                            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-lg border border-gray-700 hover:border-purple-400 bg-white/5 hover:bg-purple-600/15 transition-colors">
                            <span className="w-9 h-11 rounded bg-white overflow-hidden flex items-center justify-center">
                              <img src={p} alt="" className="max-w-full max-h-full object-contain" />
                            </span>
                            <span className="text-xs font-bold text-gray-200">Ver{(o.proofs ?? []).length > 1 ? ` ${i + 1}` : " comprovante"}</span>
                          </button>
                        ))}
                      </div>
                      <div className="lg:w-28 lg:text-right">
                        <p className="text-lg font-black text-white not-italic">{brl(o.total_cents)}</p>
                        <p className="text-[11px] text-gray-500">{o.numbers.length} × {brl(r?.price_cents ?? o.total_cents / o.numbers.length)}</p>
                      </div>
                      {o.status === "awaiting" ? (
                        <button disabled={busyOrder === o.id} onClick={() => decide(o, "rejected")} className="px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-red-300 text-xs font-bold flex items-center gap-1.5">
                          <X className="w-3.5 h-3.5" /> Liberar números
                        </button>
                      ) : o.status === "pending" ? (
                        <div className="flex gap-2">
                          <button disabled={busyOrder === o.id} onClick={() => decide(o, "approved")} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"><Check className="w-4 h-4" /> Aprovar</button>
                          <button disabled={busyOrder === o.id} onClick={() => decide(o, "rejected")} className="px-4 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"><X className="w-4 h-4" /> Recusar</button>
                        </div>
                      ) : o.status === "approved" ? (
                        <button disabled={busyOrder === o.id} onClick={() => decide(o, "pending")} className="px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-xs font-bold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Voltar para pendente
                        </button>
                      ) : (
                        <button disabled={busyOrder === o.id} onClick={() => decide(o, "pending")} title="Recusou sem querer? Volta para Pendentes se os números ainda estiverem livres"
                          className="px-3 py-2 rounded-lg border border-purple-500/40 text-purple-200 hover:bg-purple-600/15 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                          <RotateCcw className="w-3.5 h-3.5" /> Voltar para pendente
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Popup de criar/editar rifa */}
      {draft && (
        <div className="fixed inset-0 z-[150] flex overflow-y-auto p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form onSubmit={save} noValidate className="relative m-auto w-full max-w-2xl rounded-2xl border border-purple-500/40 bg-[#121214] p-6 sm:p-8 space-y-5 shadow-2xl">
            <button type="button" onClick={() => setDraft(null)} aria-label="Fechar" className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="font-title text-2xl text-white">{draft.id ? "Editar rifa" : "Nova rifa"}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nome do prêmio</label>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex: Faca Doppler" className={inputClass} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Descrição curta (opcional)</label>
                <input value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} placeholder="Ex: Karambit Doppler FN" className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Valor de cada número (R$)</label>
                <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} inputMode="decimal" placeholder="10,00" className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quantidade de números</label>
                <NumberInput value={draft.total} onChange={(v) => setDraft({ ...draft, total: v })} min={1} max={MAX_RAFFLE_NUMBERS} step={10} className={inputClass} />
              </div>
              {draft.id && (
                <p className="sm:col-span-2 -mt-2 text-[11px] text-gray-500">
                  Mudar o valor vale só para as próximas compras: quem já comprou continua com o valor que pagou. A quantidade não pode ficar menor que o maior número já escolhido.
                </p>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Data do sorteio (opcional)</label>
                <input type="datetime-local" value={draft.drawDate} onChange={(e) => setDraft({ ...draft, drawDate: e.target.value })} className={`${inputClass} [color-scheme:dark]`} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Vendas</label>
                <div className="flex bg-[#0a0a0b] border border-gray-800 rounded-lg overflow-hidden">
                  {(["open", "closed"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setDraft({ ...draft, status: s })}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${draft.status === s ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                      {s === "open" ? "Abertas" : "Encerradas"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <ImagePick label="Imagem do prêmio" hint="1200 × 800 px (a mesma arte dos sorteios)" value={draft.image}
                onPick={(f) => pick("image", f)} onClear={() => setDraft({ ...draft, image: { url: null, file: null, preview: null } })} wide />
              <ImagePick label="QR code do PIX" hint="Imagem do QR fixo da chave CNPJ" value={draft.qr}
                onPick={(f) => pick("qr", f)} onClear={() => setDraft({ ...draft, qr: { url: null, file: null, preview: null } })} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Chave PIX (CNPJ)</label>
                <input value={draft.pixKey} onChange={(e) => setDraft({ ...draft, pixKey: e.target.value })} placeholder="00.000.000/0001-00" className={inputClass} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Favorecido</label>
                <input value={draft.pixName} onChange={(e) => setDraft({ ...draft, pixName: e.target.value })} placeholder="BARR4K PRODUÇÕES" className={inputClass} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setDraft(null)} className="px-5 py-2.5 rounded-lg font-bold text-sm text-gray-300 bg-white/5 hover:bg-white/10 border border-gray-800">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-neon px-6 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
                {saving ? "Salvando..." : draft.id ? "Salvar rifa" : "Criar rifa"}
              </button>
            </div>
          </form>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center gap-3 p-4 cursor-zoom-out" onClick={() => setPreview(null)}>
          {/* fundo claro: comprovante com fundo transparente ou escuro continua legível */}
          <img src={preview} alt="Comprovante" className="max-w-full max-h-[85vh] rounded-lg border border-gray-700 bg-white" />
          <a href={preview} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs font-bold text-purple-300 hover:text-purple-200">Abrir em outra aba</a>
        </div>
      )}
    </div>
  );
}

function ImagePick({ label, hint, value, onPick, onClear, wide }: {
  label: string;
  hint: string;
  value: { preview: string | null; file: File | null };
  onPick: (f: File) => void;
  onClear: () => void;
  wide?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</label>
      <p className="text-[11px] text-gray-500">{hint}</p>
      <label className="relative flex items-center gap-4 p-3 border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl bg-[#0a0a0b] cursor-pointer transition-colors">
        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
        <div className={`shrink-0 rounded-lg overflow-hidden bg-black border border-gray-800 flex items-center justify-center ${wide ? "w-24 aspect-[3/2]" : "w-16 h-16 bg-white"}`}>
          {value.preview ? <img src={value.preview} alt="" className={`w-full h-full ${wide ? "object-cover" : "object-contain p-1"}`} /> : <ImagePlus className="w-6 h-6 text-purple-400" />}
        </div>
        <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">{value.preview ? "Trocar" : "Escolher"}</span>
      </label>
      {value.preview && (
        <button type="button" onClick={onClear} className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300">Remover</button>
      )}
    </div>
  );
}
