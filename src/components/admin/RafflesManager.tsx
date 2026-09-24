"use client";

import { useMemo, useState } from "react";
import { Check, Clock, ExternalLink, ImagePlus, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { compressImage } from "@/lib/image";
import { useDialog } from "@/components/ui/Dialog";
import { brl, padNumber, takenNumbers, useRifaStore, type OrderStatus, type RaffleOrder } from "@/lib/rifas";

const STATUS_LABEL: Record<OrderStatus, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado" };

// PROTÓTIPO: aprovação manual dos pagamentos das rifas (dados de exemplo do navegador)
export default function RafflesManager() {
  const dialog = useDialog();
  const { store, setOrderStatus, updateRaffle, reset } = useRifaStore();
  const [tab, setTab] = useState<OrderStatus>("pending");
  const [preview, setPreview] = useState<string | null>(null);

  const orders = useMemo(() => (store ? store.orders.filter((o) => o.status === tab) : []), [store, tab]);
  const pendingCount = store?.orders.filter((o) => o.status === "pending").length ?? 0;

  if (!store) return <div className="flex justify-center py-16"><div className="uiverse-loader" /></div>;
  const raffleOf = (o: RaffleOrder) => store.raffles.find((r) => r.id === o.raffleId)!;

  const decide = async (o: RaffleOrder, status: OrderStatus) => {
    if (status === "rejected") {
      const ok = await dialog.confirm({
        title: `Recusar o pagamento de @${o.username}?`,
        message: `Os ${o.numbers.length} números voltam a ficar livres para outras pessoas.`,
        confirmText: "Recusar",
        tone: "danger",
      });
      if (!ok) return;
    }
    setOrderStatus(o.id, status);
  };

  const uploadQr = async (raffleId: string, file: File) => {
    updateRaffle(raffleId, { qrImage: await compressImage(file, 600, 0.9) });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            Rifas <span className="px-2 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-300 text-xs font-bold uppercase tracking-widest">Protótipo</span>
          </h1>
          <p className="text-gray-400">Confira o PIX de cada compra e aprove ou recuse. Os dados desta tela são de exemplo e ficam só neste navegador.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link href="/rifas" target="_blank" className="px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white text-sm font-bold flex items-center gap-2">
            <ExternalLink className="w-4 h-4" /> Ver rifas no site
          </Link>
          <button onClick={async () => { if (await dialog.confirm({ title: "Voltar aos dados de exemplo?", message: "Apaga as compras de teste feitas neste navegador.", confirmText: "Voltar", tone: "warning" })) reset(); }}
            className="px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white text-sm font-bold flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Resetar exemplo
          </button>
        </div>
      </div>

      {/* Rifas: andamento e QR code fixo do PIX */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {store.raffles.map((r) => {
          const taken = takenNumbers(store.orders, r.id);
          const approved = [...taken.values()].filter((s) => s === "approved").length;
          const received = store.orders.filter((o) => o.raffleId === r.id && o.status === "approved").reduce((a, o) => a + o.total, 0);
          return (
            <div key={r.id} className="glass-panel rounded-xl border border-gray-800 p-5 flex gap-4">
              <label className="relative shrink-0 w-24 h-24 rounded-lg bg-white p-1.5 cursor-pointer group" title="Subir a imagem do QR code do PIX (CNPJ)">
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadQr(r.id, f); e.target.value = ""; }} />
                {r.qrImage ? <img src={r.qrImage} alt="QR" className="w-full h-full object-contain" /> : (
                  <span className="w-full h-full rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500 text-[9px] font-bold uppercase text-center">
                    <ImagePlus className="w-5 h-5 mb-1" /> QR do PIX
                  </span>
                )}
              </label>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-white font-bold truncate">{r.title}</p>
                <p className="text-xs text-gray-400">{brl(r.pricePerNumber)} por número · {r.totalNumbers} números</p>
                <p className="text-xs text-gray-400"><b className="text-green-400">{approved}</b> pagos · <b className="text-yellow-300">{taken.size - approved}</b> reservados · <b className="text-gray-200">{r.totalNumbers - taken.size}</b> livres</p>
                <p className="text-xs text-gray-400">Recebido: <b className="text-white">{brl(received)}</b></p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compras */}
      <div className="space-y-4">
        <div className="flex bg-[#121214] border border-gray-800 rounded-lg overflow-hidden w-fit">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button key={s} onClick={() => setTab(s)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 ${tab === s ? "bg-purple-600 text-white" : "text-gray-500 hover:text-gray-300"}`}>
              {STATUS_LABEL[s]}
              {s === "pending" && pendingCount > 0 && <span className="px-1.5 rounded-full bg-yellow-400 text-black text-[10px] not-italic">{pendingCount}</span>}
            </button>
          ))}
        </div>

        {orders.length === 0 ? (
          <div className="glass-panel rounded-xl border border-gray-800 p-10 text-center text-gray-500">Nada por aqui.</div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const r = raffleOf(o);
              return (
                <div key={o.id} className="glass-panel rounded-xl border border-gray-800 p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="lg:w-56 shrink-0">
                    <p className="text-white font-bold">@{o.username}</p>
                    <p className="text-xs text-gray-500">{r.title} · {new Date(o.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {o.numbers.map((n) => (
                      <span key={n} className="px-2 py-0.5 rounded-md border border-purple-500/40 text-purple-200 bg-purple-500/10 text-xs font-black not-italic">{padNumber(n, r.totalNumbers)}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {o.proofs.length === 0 ? (
                      <span className="text-[11px] text-gray-600">sem comprovante (exemplo)</span>
                    ) : o.proofs.map((p, i) => (
                      <button key={i} onClick={() => setPreview(p)} className="w-10 h-12 rounded border border-gray-700 overflow-hidden hover:border-purple-400" title="Ver comprovante">
                        <img src={p} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <p className="text-lg font-black text-white not-italic lg:w-28 lg:text-right">{brl(o.total)}</p>
                  {o.status === "pending" ? (
                    <div className="flex gap-2">
                      <button onClick={() => decide(o, "approved")} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-bold flex items-center gap-1.5"><Check className="w-4 h-4" /> Aprovar</button>
                      <button onClick={() => decide(o, "rejected")} className="px-4 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 text-sm font-bold flex items-center gap-1.5"><X className="w-4 h-4" /> Recusar</button>
                    </div>
                  ) : (
                    <button onClick={() => setOrderStatus(o.id, "pending")} className="px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-xs font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Voltar para pendente
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt="Comprovante" className="max-w-full max-h-[90vh] rounded-lg border border-gray-800" />
        </div>
      )}
    </div>
  );
}
