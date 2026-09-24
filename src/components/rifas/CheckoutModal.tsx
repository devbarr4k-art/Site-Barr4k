"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock, Copy, ImagePlus, QrCode, X } from "lucide-react";
import { compressImage } from "@/lib/image";
import { brl, padNumber, type Raffle, type RaffleOrder } from "@/lib/rifas";

type Step = "review" | "pay" | "done";
type Result = { ok: true; order: RaffleOrder } | { ok: false; clash: number[] };

const MAX_PROOFS = 4;

// Compra de números: revisar → pagar no PIX (QR fixo) e anexar comprovante(s) → pendente
export default function CheckoutModal({ raffle, numbers, onClose, onConfirm }: {
  raffle: Raffle;
  numbers: number[];
  onClose: () => void;
  onConfirm: (proofs: string[]) => Result;
}) {
  const [step, setStep] = useState<Step>("review");
  const [proofs, setProofs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [order, setOrder] = useState<RaffleOrder | null>(null);
  const total = numbers.length * raffle.pricePerNumber;

  const addProofs = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PROOFS - proofs.length;
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    const small = await Promise.all(picked.map((f) => compressImage(f, 900, 0.7)));
    setProofs((prev) => [...prev, ...small]);
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(raffle.pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const confirm = () => {
    setError("");
    if (proofs.length === 0) return setError("Anexe o comprovante do PIX para enviar.");
    setSending(true);
    const res = onConfirm(proofs);
    setSending(false);
    if (!res.ok) {
      setError(`Os números ${res.clash.map((n) => padNumber(n, raffle.totalNumbers)).join(", ")} acabaram de ser escolhidos por outra pessoa. Volte e troque.`);
      return;
    }
    setOrder(res.order);
    setStep("done");
  };

  // Depois de enviar, a seleção da página é limpa: a tela final mostra os números do pedido
  const chips = (
    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
      {(order?.numbers ?? numbers).map((n) => (
        <span key={n} className="px-2.5 py-1 rounded-md bg-purple-600/20 border border-purple-500/40 text-purple-200 text-xs font-black not-italic">
          {padNumber(n, raffle.totalNumbers)}
        </span>
      ))}
    </div>
  );

  const stepIndex = { review: 0, pay: 1, done: 2 }[step];

  return (
    <div className="fixed inset-0 z-[200] flex overflow-y-auto p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="relative m-auto w-full max-w-lg rounded-2xl border border-purple-500/50 bg-[#101012] shadow-[0_0_60px_rgba(147,51,234,0.25)] p-6 sm:p-8 animate-scale-up">
        {step !== "done" && (
          <button onClick={onClose} aria-label="Fechar" className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
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
              <span className="text-gray-400 text-sm font-bold">{numbers.length} × {brl(raffle.pricePerNumber)}</span>
              <span className="text-2xl font-black text-white not-italic">{brl(total)}</span>
            </div>
            <button onClick={() => setStep("pay")} className="w-full btn-neon py-3.5 rounded-lg font-black uppercase tracking-widest text-sm">
              Ir para o pagamento
            </button>
          </div>
        )}

        {step === "pay" && (
          <div className="space-y-5">
            <div>
              <h2 className="font-title text-2xl text-white">Pague pelo PIX</h2>
              <p className="text-gray-400 text-sm mt-1">Escaneie o QR code ou copie a chave.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="shrink-0 w-44 h-44 rounded-xl bg-white p-2.5 relative">
                {raffle.qrImage ? <img src={raffle.qrImage} alt="QR code do PIX" className="w-full h-full object-contain" /> : <FakeQr />}
              </div>
              <div className="flex-1 w-full space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Favorecido</p>
                  <p className="text-white font-black not-italic">{raffle.pixName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Chave PIX (CNPJ)</p>
                  <button onClick={copyKey} className="mt-1 w-full flex items-center justify-between gap-2 rounded-lg bg-black/50 border border-gray-800 hover:border-purple-500 px-3 py-2 text-left">
                    <span className="text-gray-200 text-sm font-bold not-italic truncate">{raffle.pixKey}</span>
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
                Envie <b className="text-white text-base not-italic">exatamente {brl(total)}</b>, o valor dos {numbers.length} números. Valor diferente atrasa a aprovação.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Comprovante{MAX_PROOFS > 1 ? "s" : ""} do PIX</p>
              <div className="grid grid-cols-4 gap-2">
                {proofs.map((p, i) => (
                  <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-gray-800 bg-black">
                    <img src={p} alt="" className="w-full h-full object-cover" />
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

            <div className="flex gap-3">
              <button onClick={() => setStep("review")} className="px-4 py-3.5 rounded-lg border border-gray-800 text-gray-300 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
              <button onClick={confirm} disabled={sending} className="flex-1 btn-neon py-3.5 rounded-lg font-black uppercase tracking-widest text-sm disabled:opacity-50">
                Já paguei, enviar comprovante
              </button>
            </div>
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
                Seus números ficam <b className="text-gray-200">reservados</b> enquanto o BARR4K confere o PIX. Quando for aprovado, aparece em &quot;Meus números&quot;.
              </p>
            </div>
            {chips}
            <div className="rounded-xl bg-black/50 border border-white/5 p-3 flex items-center justify-between text-sm">
              <span className="text-gray-400 font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-purple-400" /> Comprovante enviado</span>
              <span className="text-white font-black not-italic">{brl(order.total)}</span>
            </div>
            <button onClick={onClose} className="w-full btn-neon py-3.5 rounded-lg font-black uppercase tracking-widest text-sm">Ver meus números</button>
          </div>
        )}
      </div>
    </div>
  );
}

// QR de mentira para o protótipo (no real, o streamer sobe a imagem do QR do CNPJ no painel)
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
    <div className="relative w-full h-full">
      <svg viewBox="0 0 21 21" className="w-full h-full" shapeRendering="crispEdges">
        {cells.map((on, i) => on && <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#111" />)}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1 not-italic shadow">
          <QrCode className="w-3 h-3" /> exemplo
        </span>
      </span>
    </div>
  );
}
