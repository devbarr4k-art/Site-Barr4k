"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Gift, Sparkles, Trophy, Upload } from "lucide-react";
import { FaTwitch } from "react-icons/fa";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import ClosedStamp from "@/components/ui/ClosedStamp";
import NumberInput from "@/components/ui/NumberInput";
import { useSession, signIn } from "next-auth/react";

// onEnd é chamado quando o cronômetro zera (com a página aberta)
const useCountdown = (targetDateString: string | null, onEnd?: () => void) => {
  const [timeLeft, setTimeLeft] = useState({
    days: "00", hours: "00", minutes: "00", seconds: "00"
  });

  useEffect(() => {
    if (!targetDateString) return;

    const targetDate = new Date(targetDateString).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance <= 0) {
        setTimeLeft({ days: "00", hours: "00", minutes: "00", seconds: "00" });
        onEnd?.();
        clearInterval(interval);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24)).toString().padStart(2, '0');
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const seconds = Math.floor((distance % (1000 * 60)) / 1000).toString().padStart(2, '0');

      setTimeLeft({ days, hours, minutes, seconds });
    };

    const interval = setInterval(() => updateTimer(), 1000);
    updateTimer();

    return () => clearInterval(interval);
  }, [targetDateString]); // eslint-disable-line react-hooks/exhaustive-deps

  return timeLeft;
};

export default function SorteioPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const twitchId = (session?.user as any)?.username || session?.user?.name || "";

  const [giveaway, setGiveaway] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [casaId, setCasaId] = useState("");
  const [coinsSpent, setCoinsSpent] = useState<number | "">("");
  const [isParticipating, setIsParticipating] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const timeLeft = useCountdown(giveaway?.draw_date || null, () => setIsExpired(true));

  useEffect(() => {
    async function fetchGiveaway() {
      if (!params.id) return;
      const { data } = await supabase
        .from('giveaways')
        .select('*')
        .eq('id', params.id)
        .single();

      if (data) {
        setGiveaway(data);
        setIsExpired(!!data.draw_date && new Date(data.draw_date).getTime() < Date.now());
      }
      setLoading(false);
    }
    fetchGiveaway();
  }, [params.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      signIn('twitch');
      return;
    }
    if (!selectedFile) {
      setError("Você deve enviar um comprovante!");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const proof = await compressImage(selectedFile, 1600, 0.85);
      const res = await fetch("/api/participar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giveawayId: giveaway.id, coins: coinsSpent, casaId, proof }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Erro ao participar.");

      setIsSuccess(true);
      setTimeout(() => router.push("/meus-tickets"), 2500);
    } catch (err: any) {
      setError(err.message);
    }
    setIsSubmitting(false);
  };

  const isClosed = !!giveaway && (giveaway.status !== "active" || isExpired);

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white font-bold">Carregando...</div>;
  }

  if (!giveaway) {
    return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white font-bold">Sorteio não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-[#050505] pb-20 pt-24 px-4 sm:px-6">

      {/* Header com botão Voltar */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between mb-2">
        <button onClick={() => router.back()} className="flex items-center gap-3 text-[#a0a0a0] hover:text-white transition-colors text-[10px] font-bold tracking-[0.2em] uppercase">
          <ArrowLeft className="w-4 h-4" /> VOLTAR
        </button>
      </div>

      <div className="w-full max-w-2xl mx-auto animate-scale-up pb-10">
        <div className="border border-purple-500 rounded-[24px] bg-[#101010] overflow-hidden">

        {/* Bloco 1: Host & Título */}
        <div className="p-6 sm:p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-black mb-6 border border-white/10">
            <img src="/avatar.png" alt="BARR4K" className="w-full h-full object-cover" />
          </div>

          <div className="flex items-center justify-center gap-4 mb-4 w-full max-w-[280px]">
            <div className="h-[1px] flex-1 bg-purple-600" />
            <span className="text-purple-500 font-bold text-[10px] tracking-[0.2em] uppercase">{giveaway.subtitle || "SORTEIO ESPECIAL"}</span>
            <div className="h-[1px] flex-1 bg-purple-600" />
          </div>

          <h2 className="text-[#a0a0a0] font-bold text-sm tracking-[0.4em] mb-2 uppercase">SORTEIO</h2>
          <h1 className="font-graffiti text-4xl sm:text-5xl md:text-[4rem] text-white uppercase leading-[1]">
            {giveaway.title.split('|')[0] || giveaway.title} <br/>
            {giveaway.title.includes('|') && (
              <span className="text-purple-500 block mt-1">{giveaway.title.split('|')[1]}</span>
            )}
          </h1>

          <p className="text-[#a0a0a0] mt-6 max-w-md text-sm leading-relaxed font-medium">
            {giveaway.description}
          </p>
        </div>

        {/* Bloco 2: Imagem do Prêmio */}
        <div className="overflow-hidden border-t border-b border-white/5">
          <div className="relative h-[320px] md:h-[450px] w-full bg-black">
            {giveaway.detail_image_url || giveaway.image_url ? (
              <img src={giveaway.detail_image_url || giveaway.image_url} alt={giveaway.title} className={`w-full h-full object-cover ${isClosed ? "grayscale opacity-60" : ""}`} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700"><Gift className="w-20 h-20" /></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-black/20 to-transparent z-10" />
            {isClosed && <ClosedStamp size="lg" />}

            {/* Title Overlay in Image */}
            <div className="absolute bottom-6 left-6 right-6 z-20">
              <div className="flex items-center gap-1.5 mb-2 text-purple-500">
                <Trophy className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-widest uppercase">PRÊMIO</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                <span className="text-white">★</span> {giveaway.title.replace("|", " ")}
              </h3>
              {giveaway.prize_value && (
                <p className="text-purple-400 font-bold text-lg mt-1">R$ {giveaway.prize_value}</p>
              )}
              <p className="text-[#808080] text-[11px] mt-2 font-bold uppercase tracking-wide">{giveaway.shipping_text || "100% grátis · Enviado direto via Steam Trade"}</p>
            </div>
          </div>

          {/* Cronômetro (some quando o sorteio já encerrou) */}
          {!isClosed && (
          <div className="flex border-t border-white/5 p-4 md:p-6 divide-x divide-white/5 justify-center">
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">{timeLeft.days}</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">DIAS</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">{timeLeft.hours}</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">HORAS</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">{timeLeft.minutes}</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">MIN</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-3xl md:text-4xl font-black text-white">{timeLeft.seconds}</div>
              <div className="text-[9px] text-[#505050] uppercase tracking-[0.2em] font-bold mt-1 md:mt-2">SEG</div>
            </div>
          </div>
          )}

          {giveaway.draw_date && (
            <div className={`text-center pb-6 text-[#505050] text-[10px] font-bold uppercase tracking-wider ${isClosed ? "border-t border-white/5 pt-6" : ""}`}>
              {isClosed ? "Sorteio encerrado em" : "Sorteio encerra em"} <span className="text-white">
                {new Date(giveaway.draw_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span> às <span className="text-white">
                {new Date(giveaway.draw_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {/* Bloco 3: Formulário de Participação */}
        <div className="p-6 sm:p-12 text-center flex flex-col items-center">
          {isSuccess ? (
            <div className="flex flex-col items-center text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-6 animate-pulse" />
              <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">Entrada Confirmada!</h3>
              <p className="text-[#a0a0a0]">Sua participação foi registrada. Redirecionando...</p>
            </div>
          ) : isClosed ? (
            <div className="flex flex-col items-center text-center py-4">
              <Trophy className="w-12 h-12 text-gray-600 mb-4" />
              <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">Sorteio Encerrado</h3>
              <p className="text-[#a0a0a0] text-sm">As inscrições para este sorteio já foram fechadas.</p>
            </div>
          ) : !isParticipating ? (
            <>
              <Sparkles className="w-8 h-8 text-purple-500 mb-6" />
              <h3 className="text-2xl font-black text-white tracking-wider uppercase mb-3">
                PARTICIPE AGORA
              </h3>
              <p className="text-[#a0a0a0] text-sm max-w-xs mx-auto mb-8 leading-relaxed font-medium">
                Entre com sua conta da Twitch para garantir sua vaga no sorteio. Uma participação por usuário.
              </p>
              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    signIn('twitch');
                  } else {
                    setIsParticipating(true);
                  }
                }}
                className="w-full max-w-[300px] btn-neon py-3.5 flex items-center justify-center gap-3 text-xs"
              >
                <FaTwitch className="w-4 h-4 text-purple-600" /> {isLoggedIn ? 'PREENCHER DADOS' : 'ENTRAR COM A TWITCH'}
              </button>
            </>
          ) : (
            <form onSubmit={handleConfirm} className="w-full text-left space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-black text-white tracking-wider uppercase mb-2">
                  Preencher Requisitos
                </h3>
              </div>

              <div>
                <label className="block text-[#a0a0a0] text-xs font-bold uppercase tracking-wider mb-2">Seu @ na Twitch</label>
                <input
                  type="text"
                  readOnly
                  value={twitchId}
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-4 py-3 text-gray-400 focus:outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[#a0a0a0] text-xs font-bold uppercase tracking-wider mb-2">Valor em Coins</label>
                <NumberInput
                  required
                  min={0}
                  step={100}
                  value={coinsSpent}
                  onChange={setCoinsSpent}
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Ex: 5000"
                />
              </div>

              <div>
                <label className="block text-[#a0a0a0] text-xs font-bold uppercase tracking-wider mb-2">SEU ID NA CASA</label>
                <input
                  type="text"
                  value={casaId}
                  onChange={(e) => setCasaId(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Ex: 12345678"
                />
              </div>

              <div>
                <label className="block text-[#a0a0a0] text-xs font-bold uppercase tracking-wider mb-2">Comprovante (Obrigatório)</label>
                <div className="w-full border-2 border-dashed border-white/10 rounded-lg p-6 flex flex-col items-center justify-center bg-[#050505] hover:bg-white/5 transition-colors cursor-pointer relative group">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <Upload className="w-6 h-6 text-[#505050] mb-2 group-hover:text-purple-500 transition-colors" />
                  <p className="text-[#a0a0a0] text-sm font-medium">
                    {selectedFile ? selectedFile.name : "Clique ou arraste a imagem aqui"}
                  </p>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm font-bold text-center bg-red-500/10 border border-red-500/30 rounded-lg p-3">{error}</p>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsParticipating(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-wider py-4 rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 btn-neon py-4 text-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Enviando..." : "Confirmar"}
                </button>
              </div>
            </form>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
