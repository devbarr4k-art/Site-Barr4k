"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, ImagePlus, Loader2, QrCode, Timer, X } from "lucide-react";
import { compressImage } from "@/lib/image";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { brl, HOLD_MINUTES, MAX_RAFFLE_PROOFS as MAX_PROOFS, padNumber, type Raffle, type RaffleOrder } from "@/lib/rifas";

type Step = "review" | "pay" | "done";
export type CheckoutResult = { ok: true; order: RaffleOrder } | { ok: false; error: string; clash?: number[] };

// Compra: revisar → "Ir para o pagamento" já RESERVA os números → PIX + comprovante → aguardando aprovação.
// Fechar o popup (ou a aba) sem enviar o comprovante SOLTA os números na hora.
// O prazo de HOLD_MINUTES só vale se a pessoa sumir sem fechar (bateria acabou, internet caiu...).
// Com `resume`, abre direto no pagamento de uma reserva que ficou pendurada.
export default function CheckoutModal({ raffle, numbers, resume, onReserve, onPay, onCancel, onClose }: {
  raffle: Raffle;
  numbers: number[];
  resume?: RaffleOrder | null;
  onReserve: (numbers: number[], recaptcha: string) => Promise<CheckoutResult>;
  onPay: (orderId: string, proofs: string[]) => Promise<CheckoutResult>;
  onCancel: (orderId: string, beacon?: boolean) => Promise<void> | void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(resume ? "pay" : "review");
  const [order, setOrder] = useState<RaffleOrder | null>(resume ?? null);
  const [proofs, setProofs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const list = order?.numbers ?? numbers;
  const total = order?.total_cents ?? numbers.length * raffle.price_cents;

  // Reserva aberta (ainda sem comprovante): é ela que se solta ao fechar
  const holdRef = useRef<string | null>(null);
  holdRef.current = step === "pay" && order?.status === "awaiting" ? order.id : null;

  // Fechou a aba/navegador no meio do pagamento: solta os números mesmo assim
  useEffect(() => {
    const release = () => { if (holdRef.current) onCancel(holdRef.current, true); };
    window.addEventListener("pagehide", release);
    return () => window.removeEventListener("pagehide", release);
  }, [onCancel]);

  // Cronômetro da reserva
  useEffect(() => {
    if (step !== "pay") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);
  const msLeft = order?.expires_at ? new Date(order.expires_at).getTime() - now : 0;
  const expired = step === "pay" && !!order?.expires_at && msLeft <= 0;
  const clock = `${String(Math.max(0, Math.floor(msLeft / 60000))).padStart(2, "0")}:${String(Math.max(0, Math.floor((msLeft % 60000) / 1000))).padStart(2, "0")}`;

  const reserve = async () => {
    setError("");
    setBusy(true);
    const res = await onReserve(numbers, await getRecaptchaToken("rifa"));
    setBusy(false);
    if (!res.ok) {
      setError(res.clash?.length
        ? `Os números ${res.clash.map((n) => padNumber(n, raffle.total_numbers)).join(", ")} acabaram de ser pegos por outra pessoa. Feche, troque e tente de novo.`
        : res.error);
      return;
    }
    setOrder(res.order);
    setNow(Date.now());
    setStep("pay");
  };

  const addProofs = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PROOFS - proofs.length;
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    // Legível para conferir o PIX e leve o bastante para enviar pelo celular
    const small = await Promise.all(picked.map((f) => compressImage(f, 1400, 0.8)));
    setProofs((prev) => [...prev, ...small]);
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(raffle.pix_key ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const pay = async () => {
    if (!order) return;
    setError("");
    if (proofs.length === 0) return setError("Anexe o comprovante do PIX para enviar.");
    setBusy(true);
    const res = await onPay(order.id, proofs);
    setBusy(false);
    if (!res.ok) {
      setError(res.clash?.length
        ? `Sua reserva venceu e os números ${res.clash.map((n) => padNumber(n, raffle.total_numbers)).join(", ")} foram pegos por outra pessoa. Se você já pagou, fale com o BARR4K com o comprovante.`
        : res.error);
      return;
    }
    setOrder(res.order);
    setStep("done");
  };

  // Fechar: se estava pagando sem ter enviado o comprovante, os números voltam para a lista
  const close = async () => {
    if (holdRef.current) {
      setBusy(true);
      await onCancel(holdRef.current);
      setBusy(false);
    }
    onClose();
  };

  const chips = (
    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
      {list.map((n) => (
        <span key={n} className="px-2.5 py-1 rounded-md bg-purple-600/20 border border-purple-500/40 text-purple-200 text-xs font-black not-italic">
          {padNumber(n, raffle.total_numbers)}
        </span>
      ))}
    </div>
  );

  const stepIndex = { review: 0, pay: 1, done: 2 }[step];

  return (
    <div className="fixed inset-0 z-[200] flex overflow-y-auto p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="relative m-auto w-full max-w-lg rounded-2xl border border-purple-500/50 bg-[#101012] shadow-[0_0_60px_rgba(147,51,234,0.25)] p-6 sm:p-8 animate-scale-up">
        {step !== "done" && (
          <button onClick={close} disabled={busy} aria-label="Fechar"
            title={step === "pay" ? "Fechar e liberar os números" : "Fechar"}
            className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        )}

        {/* Passos */}
        <div className="flex items-center gap-2 mb-6 pr-8">
          {["Números", "Pagamento", "Pronto"].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black not-italic border ${i < stepIndex ? "bg-purple-600 border-purple-400 text-white" : i === stepIndex ? "border-purple-400 text-purple-200 bg-purple-600/20" : "border-gray-700 text-gray-600"}`}>
                {i < stepIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className={`text-[11px] font-bold uppercase tracking-widest hidden sm:block ${i <= stepIndex ? "text-gray-200" : "text-gray-600"}`}>{label}</span>
              {i < 2 && <span className={`h-px flex-1 ${i < stepIndex ? "bg-purple-500" : "bg-gray-800"}`} />}
            </div>
          ))}
        </div>

        {step === "review" && (
          <div className="space-y-5">
            <div>
              <h2 className="font-title text-2xl text-white">Confira seus números</h2>
              <p className="text-gray-400 text-sm mt-1">{raffle.title}</p>
            </div>
            {chips}
            <div className="rounded-xl bg-black/50 border border-white/5 p-4 flex items-center justify-between">
              <span className="text-gray-400 text-sm font-bold">{numbers.length} × {brl(raffle.price_cents)}</span>
              <span className="text-2xl font-black text-white not-italic">{brl(total)}</span>
            </div>
            <p className="text-xs text-gray-500 flex items-start gap-1.5">
              <Timer className="w-4 h-4 text-purple-400 shrink-0" />
              Ao continuar, os números ficam reservados só para você enquanto paga (até {HOLD_MINUTES} minutos). Se fechar sem enviar o comprovante, eles voltam para a lista.
            </p>
            {error && <p className="text-red-400 text-sm font-bold">{error}</p>}
            <button onClick={reserve} disabled={busy} className="w-full btn-neon py-3.5 rounded-lg font-black uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Reservando...</> : "Ir para o pagamento"}
            </button>
          </div>
        )}

        {step === "pay" && order && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-title text-2xl text-white">Pague pelo PIX</h2>
                <p className="text-gray-400 text-sm mt-1">Seus números estão reservados. Escaneie o QR ou copie a chave.</p>
              </div>
              <div className={`shrink-0 rounded-xl border px-3 py-2 text-center ${expired ? "border-red-500/50 bg-red-500/10" : msLeft < 3 * 60000 ? "border-yellow-500/50 bg-yellow-500/10" : "border-purple-500/40 bg-purple-600/10"}`}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{expired ? "Reserva" : "Reservado por"}</p>
                <p className={`text-xl font-black not-italic tabular-nums ${expired ? "text-red-300" : "text-white"}`}>{expired ? "venceu" : clock}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="shrink-0 w-44 h-44 rounded-xl bg-white p-2.5 relative">
                {raffle.qr_image_url ? <img src={raffle.qr_image_url} alt="QR code do PIX" className="w-full h-full object-contain" /> : <FakeQr />}
              </div>
              <div className="flex-1 w-full space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Favorecido</p>
                  <p className="text-white font-black not-italic">{raffle.pix_name || "BARR4K PRODUÇÕES"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Chave PIX (CNPJ)</p>
                  <button onClick={copyKey} className="mt-1 w-full flex items-center justify-between gap-2 rounded-lg bg-black/50 border border-gray-800 hover:border-purple-500 px-3 py-2 text-left">
                    <span className="text-gray-200 text-sm font-bold not-italic truncate">{raffle.pix_key || "(chave não configurada)"}</span>
                    <span className={`shrink-0 text-xs font-bold flex items-center gap-1 ${copied ? "text-green-400" : "text-purple-400"}`}>
                      {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-100">
                Envie <b className="text-white text-base not-italic">exatamente {brl(total)}</b>, o valor dos {list.length} números. Valor diferente atrasa a aprovação.
              </p>
            </div>

            {expired && (
              <p className="text-xs text-red-200 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                O prazo da reserva acabou. Se você já pagou, envie o comprovante mesmo assim: se os números ainda estiverem livres, a compra entra normal.
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Comprovantes do PIX</p>
              <div className="grid grid-cols-4 gap-2">
                {proofs.map((p, i) => (
                  <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-gray-800 bg-white">
                    <img src={p} alt="" className="w-full h-full object-contain" />
                    <button onClick={() => setProofs((prev) => prev.filter((_, j) => j !== i))} aria-label="Tirar"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/80 text-gray-200 hover:text-red-400 flex items-center justify-center">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {proofs.length < MAX_PROOFS && (
                  <label className="relative aspect-[3/4] rounded-lg border-2 border-dashed border-gray-700 hover:border-purple-500 bg-[#0a0a0b] cursor-pointer flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-purple-300 transition-colors">
                    <input type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => { addProofs(e.target.files); e.target.value = ""; }} />
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Anexar</span>
                  </label>
                )}
              </div>
              <p className="text-[11px] text-gray-500">Até {MAX_PROOFS} imagens (ex.: se pagou em mais de um PIX).</p>
            </div>

            {error && <p className="text-red-400 text-sm font-bold">{error}</p>}

            <button onClick={pay} disabled={busy} className="w-full btn-neon py-3.5 rounded-lg font-black uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : "Já paguei, enviar comprovante"}
            </button>
            <button onClick={close} disabled={busy} className="w-full text-xs font-bold text-gray-500 hover:text-red-300 uppercase tracking-widest">
              Desistir e liberar os números
            </button>
          </div>
        )}

        {step === "done" && order && (
          <div className="text-center space-y-5 py-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/15 border border-yellow-500/50 flex items-center justify-center">
              <Clock className="w-8 h-8 text-yellow-300" />
            </div>
            <div>
              <h2 className="font-title text-2xl text-white">Pagamento em análise!</h2>
              <p className="text-gray-400 text-sm mt-2">
                Seus números continuam <b className="text-gray-200">reservados</b> enquanto o BARR4K confere o PIX. Quando for aprovado, aparece em &quot;Meus números&quot;.
              </p>
            </div>
            {chips}
            <div className="rounded-xl bg-black/50 border border-white/5 p-3 flex items-center justify-between text-sm">
              <span className="text-gray-400 font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-purple-400" /> Comprovante enviado</span>
              <span className="text-white font-black not-italic">{brl(order.total_cents)}</span>
            </div>
            <button onClick={onClose} className="w-full btn-neon py-3.5 rounded-lg font-black uppercase tracking-widest text-sm">Ver meus números</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Sem QR configurado no painel: desenho neutro com aviso (não parece um QR de verdade para pagar)
function FakeQr() {
  const cells = useMemo(() => {
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 21 * 21 }, (_, i) => {
      const x = i % 21, y = Math.floor(i / 21);
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (finder) {
        const fx = x > 13 ? x - 14 : x, fy = y > 13 ? y - 14 : y;
        return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5);
      }
      return rand() > 0.5;
    });
  }, []);
  return (
    <div className="relative w-full h-full opacity-30">
      <svg viewBox="0 0 21 21" className="w-full h-full" shapeRendering="crispEdges">
        {cells.map((on, i) => on && <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#111" />)}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1 not-italic shadow">
          <QrCode className="w-3 h-3" /> use a chave
        </span>
      </span>
    </div>
  );
}
