"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import tmi from "tmi.js";
import {
  Bot, Clock, Gift, Pause, Play, Radio, Search, Star, Trophy, Upload, User, Users, Volume2, VolumeX, X, CheckCircle2, RotateCcw, Cloud, CloudOff,
} from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { uploadGiveawayImage } from "@/lib/image";
import { avatarFor, chancesFor, isCommand, tierFromBadgeVersion } from "@/lib/daily";
import DailyHistory from "@/components/admin/DailyHistory";
import { useDialog } from "@/components/ui/Dialog";
import { signIn } from "next-auth/react";
import { useSounds } from "@/lib/useSounds";
import NumberInput from "@/components/ui/NumberInput";

interface Daily {
  id: string;
  title: string;
  image_url: string | null;
  capture_open: boolean;
  bot_command: string | null;
  twitch_channel: string | null;
  response_seconds: number;
  chance_t1: number;
  chance_t2: number;
  chance_t3: number;
}

interface Participant {
  id: string;
  twitch_username: string;
  sub_tier: number;
  avatar_url: string | null;
  status: string;
  created_at: string;
}

type BotStatus = "disconnected" | "connecting" | "connected";
// Captação pelo servidor (webhook da Twitch): segue funcionando com o painel fechado
type ServerCapture = "checking" | "on" | "pending" | "off" | "needs_auth" | "unavailable" | "error";

// Roleta: largura do card + espaço entre eles
const CARD_W = 128;
const STEP = CARD_W + 12;
const REEL_SIZE = 64;
const WIN_INDEX = 56;
const SPIN_MS = 8500;

// Tier do sub pelo badge do chat (founder conta como sub)
function getSubTier(tags: tmi.ChatUserstate): number {
  const version = tags.badges?.subscriber ?? tags.badges?.founder;
  if (version === undefined) return tags.subscriber ? 1 : 0;
  return tierFromBadgeVersion(version);
}

function SubBadge({ tier }: { tier: number }) {
  if (tier > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/50 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-300" title={`Sub Tier ${tier}`}>
        <Star className="h-3 w-3 fill-purple-400 text-purple-400" /> Sub T{tier}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400" title="Não é sub">
      <User className="h-3 w-3" /> Não sub
    </span>
  );
}

export default function LiveGiveaway({ defaultChannel }: { defaultChannel: string }) {
  const [phase, setPhase] = useState<"loading" | "setup" | "live">("loading");
  const [daily, setDaily] = useState<Daily | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");
  const [botStatus, setBotStatus] = useState<BotStatus>("disconnected");
  const [serverCapture, setServerCapture] = useState<ServerCapture>("checking");
  const [busy, setBusy] = useState(false);

  // Formulário de configuração
  const [title, setTitle] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [command, setCommand] = useState("!sorteio");
  const [channel, setChannel] = useState(defaultChannel);
  const [responseSeconds, setResponseSeconds] = useState<number | "">(60);
  const [chanceT1, setChanceT1] = useState<number | "">(2);
  const [chanceT2, setChanceT2] = useState<number | "">(3);
  const [chanceT3, setChanceT3] = useState<number | "">(5);
  // Ajustes editáveis durante a live (espelham o sorteio aberto)
  const [liveSettings, setLiveSettings] = useState<Record<"response_seconds" | "chance_t1" | "chance_t2" | "chance_t3", number | "">>({
    response_seconds: 60, chance_t1: 2, chance_t2: 3, chance_t3: 5,
  });

  // Roleta e resultado
  const [reel, setReel] = useState<Participant[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [drawn, setDrawn] = useState<Participant | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [winnerReply, setWinnerReply] = useState<string | null>(null);
  const [confirmedWinner, setConfirmedWinner] = useState<Participant | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const reelRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<tmi.Client | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  // Refs lidos pelo handler do chat, que é registrado uma vez só
  const dailyRef = useRef<Daily | null>(null);
  const awaitingRef = useRef<string | null>(null);
  const sounds = useSounds();
  const dialog = useDialog();

  useEffect(() => {
    dailyRef.current = daily;
    if (daily) {
      setLiveSettings({
        response_seconds: daily.response_seconds,
        chance_t1: daily.chance_t1,
        chance_t2: daily.chance_t2,
        chance_t3: daily.chance_t3,
      });
    }
  }, [daily]);

  const eligible = participants.filter((p) => p.status !== "rejected");

  // Carrega o sorteio da live que estiver aberto (painel recarregado no meio ou sorteio reaberto)
  const loadActiveDaily = useCallback(() => {
    adminApi<{ data: Daily | null }>("getActiveDaily")
      .then(({ data }) => {
        if (data) {
          seenRef.current = new Set();
          setParticipants([]);
          setDaily(data);
          setPhase("live");
        } else {
          setPhase("setup");
        }
      })
      .catch((err) => {
        dialog.error(err, "Não foi possível carregar o sorteio diário");
        setPhase("setup");
      });
  }, []);

  useEffect(() => {
    loadActiveDaily();
  }, [loadActiveDaily]);

  const loadParticipants = useCallback(async (giveawayId: string) => {
    try {
      const { data } = await adminApi<{ data: Participant[] }>("listParticipants", { giveawayId });
      setParticipants(data);
      data.forEach((p) => seenRef.current.add(p.twitch_username));
    } catch {
      // mantém a lista atual; tenta de novo no próximo ciclo
    }
  }, []);

  // Lista atualiza sozinha (também pega entradas registradas por outra aba)
  useEffect(() => {
    if (phase !== "live" || !daily) return;
    loadParticipants(daily.id);
    const interval = setInterval(() => loadParticipants(daily.id), 3000);
    return () => clearInterval(interval);
  }, [phase, daily?.id, loadParticipants]);

  // Bot do chat: conecta enquanto a tela ao vivo estiver aberta
  useEffect(() => {
    if (phase !== "live" || !daily?.twitch_channel) return;
    const client = new tmi.Client({
      channels: [daily.twitch_channel],
      connection: { reconnect: true, secure: true },
    });
    clientRef.current = client;
    setBotStatus("connecting");

    client.on("connected", () => setBotStatus("connected"));
    client.on("disconnected", () => setBotStatus("disconnected"));
    client.on("reconnect", () => setBotStatus("connecting"));

    client.on("message", (_channel, tags, message, self) => {
      const username = tags.username;
      const current = dailyRef.current;
      if (self || !username || !current) return;

      // Ganhador sorteado respondeu no chat
      if (awaitingRef.current === username) {
        awaitingRef.current = null;
        setWinnerReply(message);
      }

      if (!current.capture_open) return;
      if (!isCommand(message, current.bot_command || "!sorteio")) return;
      if (seenRef.current.has(username)) return;
      seenRef.current.add(username);

      adminApi<{ data?: Participant }>("chatEntry", { giveawayId: current.id, username, tier: getSubTier(tags) })
        .then(({ data }) => {
          if (data) setParticipants((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
        })
        .catch(() => seenRef.current.delete(username));
    });

    client.connect().catch(() => setBotStatus("disconnected"));
    return () => {
      client.removeAllListeners();
      client.disconnect().catch(() => {});
      clientRef.current = null;
      setBotStatus("disconnected");
    };
  }, [phase, daily?.id, daily?.twitch_channel]);

  // Cronômetro para o ganhador responder (para quando ele responde)
  useEffect(() => {
    if (!showPopup || winnerReply !== null || timeLeft <= 0) return;
    const t = setTimeout(() => {
      setTimeLeft((s) => s - 1);
      if (timeLeft - 1 === 0) sounds.alarm();
    }, 1000);
    return () => clearTimeout(t);
  }, [showPopup, timeLeft, winnerReply]); // eslint-disable-line react-hooks/exhaustive-deps

  // Confere a captação pelo servidor ao abrir a tela e a cada 30s; se a captação está
  // aberta mas a escuta do servidor caiu (ou acabou de autorizar), tenta ligar de novo
  useEffect(() => {
    if (phase !== "live" || !daily?.id) return;
    const id = daily.id;
    const check = async (retry: boolean) => {
      try {
        const { status } = await adminApi<{ status: ServerCapture }>("serverCapture", { id, retry });
        setServerCapture(status);
        return status;
      } catch {
        return "error" as ServerCapture;
      }
    };
    check(false).then((status) => {
      if (dailyRef.current?.capture_open && status === "off") check(true);
    });
    const interval = setInterval(() => check(false), 30000);
    return () => clearInterval(interval);
  }, [phase, daily?.id]);

  // Autoriza o site a ler o chat (escopo user:read:chat) e volta para esta aba
  const connectChat = () =>
    signIn("twitch", { callbackUrl: "/admin?tab=twitch" }, { scope: "openid user:read:email user:read:chat" });

  const updateDaily = async (fields: Partial<Daily>) => {
    if (!daily) return;
    setDaily({ ...daily, ...fields }); // atualiza já na tela; o servidor confirma em seguida
    try {
      const res = await adminApi<{ data: Daily; serverCapture?: ServerCapture }>("updateDaily", { id: daily.id, fields });
      setDaily(res.data);
      if (res.serverCapture) setServerCapture(res.serverCapture);
    } catch (err) {
      dialog.error(err, "Não foi possível salvar o ajuste");
    }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !channel.trim()) {
      dialog.alert({
        title: !title.trim() ? "Falta o prêmio do sorteio" : "Falta o canal da Twitch",
        message: !title.trim() ? "Escreva qual é o prêmio de hoje." : "Informe o canal que o bot vai ler, ex: barr4k.",
        tone: "warning",
      });
      return;
    }
    setBusy(true);
    try {
      const image_url = image ? await uploadGiveawayImage(image) : null;
      const { data, serverCapture: capture } = await adminApi<{ data: Daily; serverCapture: ServerCapture }>("startDaily", {
        fields: {
          title, image_url, bot_command: command, twitch_channel: channel,
          response_seconds: responseSeconds, chance_t1: chanceT1, chance_t2: chanceT2, chance_t3: chanceT3,
        },
      });
      seenRef.current = new Set();
      setParticipants([]);
      setServerCapture(capture);
      setDaily(data);
      setPhase("live");
    } catch (err) {
      dialog.error(err, "Não foi possível iniciar a captação");
    }
    setBusy(false);
  };

  const handleEndWithoutWinner = async () => {
    if (!daily) return;
    const ok = await dialog.confirm({
      title: "Encerrar sem ganhador?",
      message: `O sorteio "${daily.title.replace("|", " ")}" e a lista de ${eligible.length} participante(s) serão apagados. Não dá para desfazer.`,
      confirmText: "Encerrar e apagar",
      tone: "danger",
    });
    if (!ok) return;
    try {
      // Sem ganhador não há o que guardar no histórico: apaga sorteio e participantes
      await adminApi("deleteGiveaway", { id: daily.id });
      resetToSetup();
    } catch (err) {
      dialog.error(err);
    }
  };

  const resetToSetup = () => {
    setDaily(null);
    setParticipants([]);
    setConfirmedWinner(null);
    setDrawn(null);
    setShowPopup(false);
    setTitle("");
    setImage(null);
    setImagePreview(null);
    setPhase("setup");
  };

  // Sorteio ponderado: cada participante entra na roleta tantas vezes quanto suas chances
  const startDraw = (pool: Participant[] = eligible) => {
    if (!daily || isSpinning) return;
    if (pool.length === 0) {
      dialog.alert({ title: "Ninguém na lista", message: "Espere alguém digitar o comando no chat antes de sortear.", tone: "warning" });
      return;
    }
    sounds.unlock();

    const tickets: Participant[] = [];
    pool.forEach((p) => {
      for (let i = 0; i < chancesFor(p.sub_tier, daily); i++) tickets.push(p);
    });
    const winner = tickets[Math.floor(Math.random() * tickets.length)];
    const items = Array.from({ length: REEL_SIZE }, () => tickets[Math.floor(Math.random() * tickets.length)]);
    items[WIN_INDEX] = winner;

    setDrawn(winner);
    setWinnerReply(null);
    setShowPopup(false);
    setReel(items);
    setIsSpinning(true);

    // Espera a roleta renderizar para medir e animar
    setTimeout(() => spin(winner), 60);
  };

  const spin = (winner: Participant) => {
    const reelEl = reelRef.current;
    const trackEl = trackRef.current;
    if (!reelEl || !trackEl || !daily) return;

    const width = trackEl.clientWidth;
    // Para perto da borda do card às vezes, para dar suspense
    const jitter = (Math.random() - 0.5) * (CARD_W * 0.7);
    const target = WIN_INDEX * STEP + CARD_W / 2 - width / 2 + jitter;
    const start = performance.now();
    let lastIndex = -1;
    let finished = false;

    reelEl.style.transform = "translateX(0px)";
    // Só visual: se a aba ficar em segundo plano o navegador pausa os frames,
    // mas o resultado sai pelo setTimeout abaixo mesmo assim.
    const frame = (now: number) => {
      if (finished) return;
      const t = Math.min(1, (now - start) / SPIN_MS);
      const eased = 1 - Math.pow(1 - t, 5); // desacelera bem devagar no final
      const x = target * eased;
      reelEl.style.transform = `translateX(${-x}px)`;

      const index = Math.floor((x + width / 2) / STEP);
      if (index !== lastIndex) {
        lastIndex = index;
        sounds.tick(t);
      }
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    setTimeout(() => {
      finished = true;
      reelEl.style.transform = `translateX(${-target}px)`;
      sounds.win();
      setTimeout(() => {
        setIsSpinning(false);
        awaitingRef.current = winner.twitch_username;
        setTimeLeft(daily.response_seconds);
        setShowPopup(true);
      }, 900);
    }, SPIN_MS);
  };

  const handleNoAnswer = async () => {
    if (!drawn || !daily) return;
    awaitingRef.current = null;
    setShowPopup(false);
    try {
      await adminApi("updateParticipant", { id: drawn.id, fields: { status: "rejected" } });
    } catch (err) {
      dialog.error(err, "Não foi possível tirar da lista");
      return;
    }
    const remaining = eligible.filter((p) => p.id !== drawn.id);
    setParticipants((prev) => prev.map((p) => (p.id === drawn.id ? { ...p, status: "rejected" } : p)));
    setTimeout(() => startDraw(remaining), 400);
  };

  const handleConfirmWinner = async () => {
    if (!drawn || !daily) return;
    setBusy(true);
    try {
      await adminApi("finishDaily", { giveawayId: daily.id, participantId: drawn.id });
      awaitingRef.current = null;
      setShowPopup(false);
      setConfirmedWinner(drawn);
      setHistoryKey((k) => k + 1);
      clientRef.current?.disconnect().catch(() => {});
    } catch (err) {
      dialog.error(err, "Não foi possível salvar o ganhador");
    }
    setBusy(false);
  };

  const handleClosePopup = () => {
    awaitingRef.current = null;
    setShowPopup(false);
  };

  if (phase === "loading") {
    return <div className="flex justify-center py-20"><div className="uiverse-loader"></div></div>;
  }

  // ---------------------------------------------------------------- Configuração
  if (phase === "setup") {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-white">Sorteio Diário (Live)</h1>
          <p className="text-gray-400">Configure o prêmio e abra a captação. Quem digitar o comando no chat entra na lista.</p>
        </div>

        <form onSubmit={handleStart} className="glass-panel rounded-xl border border-purple-500/30 p-6 md:p-8 space-y-6 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400">Prêmio do sorteio</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Faca Butterfly | Fade"
                  className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-400">Comando no chat</label>
                  <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="!sorteio"
                    className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-400">Canal da Twitch</label>
                  <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="barr4k"
                    className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none" />
                </div>
              </div>
            </div>

            <label className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-700 hover:border-purple-500 bg-[#0a0a0b] cursor-pointer overflow-hidden min-h-[160px] transition-colors">
              <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setImage(file);
                  setImagePreview(file ? URL.createObjectURL(file) : null);
                }} />
              {imagePreview ? (
                <img src={imagePreview} alt="" className="absolute inset-0 w-full h-full object-contain p-2" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-500 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Imagem (opcional)</span>
                </>
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-800">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Tempo p/ responder</label>
              <NumberInput value={responseSeconds} onChange={setResponseSeconds} min={5} suffix="s"
                className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg px-4 py-2.5 text-white outline-none focus:border-purple-500" />
            </div>
            {([["Tier 1", chanceT1, setChanceT1], ["Tier 2", chanceT2, setChanceT2], ["Tier 3", chanceT3, setChanceT3]] as const).map(([label, value, setter]) => (
              <div key={label} className="space-y-2">
                <label className="text-xs font-bold text-purple-400 uppercase flex items-center gap-1"><Star className="w-3 h-3" /> Chances Sub {label}</label>
                <NumberInput value={value} onChange={setter} min={1}
                  className="w-full bg-[#0a0a0b] border border-purple-500/30 rounded-lg px-4 py-2.5 text-white outline-none focus:border-purple-500" />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">Quem não é sub tem 1 chance. As chances podem ser ajustadas durante a live.</p>

          <button type="submit" disabled={busy}
            className="w-full btn-neon font-black tracking-widest uppercase py-4 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            <Radio className="w-5 h-5" /> {busy ? "Abrindo..." : "Iniciar Captação"}
          </button>
        </form>

        <div className="max-w-3xl">
          <DailyHistory refreshKey={historyKey} canReopen onReopened={loadActiveDaily} />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- Ao vivo
  if (!daily) return null;
  const totalTickets = eligible.reduce((sum, p) => sum + chancesFor(p.sub_tier, daily), 0);
  const subsCount = eligible.filter((p) => p.sub_tier > 0).length;
  const visibleList = [...eligible]
    .reverse()
    .filter((p) => p.twitch_username.includes(search.trim().toLowerCase()));
  const timeUp = timeLeft <= 0 && winnerReply === null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Sorteio Diário (Live)</h1>
          <p className="text-gray-400 text-sm">Deixe esta tela aberta durante a live: é ela que lê o chat.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => sounds.setEnabled(!sounds.enabled)} title={sounds.enabled ? "Desligar som" : "Ligar som"}
            className="p-2.5 rounded-lg border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">
            {sounds.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
            botStatus === "connected" ? "border-green-500/40 bg-green-500/10 text-green-400"
              : botStatus === "connecting" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
              : "border-red-500/40 bg-red-500/10 text-red-400"}`}>
            <Bot className="w-4 h-4" />
            {botStatus === "connected" ? `Lendo #${daily.twitch_channel}` : botStatus === "connecting" ? "Conectando ao chat..." : "Chat desconectado"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Controles */}
        <div className="space-y-4">
          <div className="glass-panel rounded-xl border border-purple-500/30 p-6 text-center">
            {daily.image_url ? (
              <img src={daily.image_url} alt="" className="w-28 h-28 object-contain mx-auto mb-3" />
            ) : (
              <Gift className="w-14 h-14 text-purple-500 mx-auto mb-3" />
            )}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Prêmio de hoje</p>
            <h2 className="text-2xl font-black text-white uppercase">{daily.title.replace("|", " ")}</h2>
            <div className="mt-4 rounded-lg border border-gray-800 bg-black/50 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Comando no chat</p>
              <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500">
                {daily.bot_command}
              </p>
            </div>
          </div>

          <div className={`rounded-xl border p-4 flex items-center gap-3 ${daily.capture_open ? "border-red-500/40 bg-red-500/10" : "border-gray-800 bg-gray-900/50"}`}>
            <span className="relative flex h-3 w-3 shrink-0">
              {daily.capture_open && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${daily.capture_open ? "bg-red-500" : "bg-gray-600"}`} />
            </span>
            <div className="flex-1 text-left">
              <p className={`font-black uppercase tracking-wider text-sm ${daily.capture_open ? "text-red-400" : "text-gray-400"}`}>
                {daily.capture_open ? "Captação aberta" : "Captação pausada"}
              </p>
              <p className="text-xs text-gray-500">{daily.capture_open ? "Entradas do chat estão sendo registradas." : "Novos comandos no chat são ignorados."}</p>
            </div>
          </div>

          {/* Captação pelo servidor: independe desta aba ficar aberta */}
          {daily.capture_open && (
            serverCapture === "on" ? (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex items-start gap-3">
                <Cloud className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-green-400 text-sm">Captação pelo servidor ativa</p>
                  <p className="text-xs text-gray-400">Pode fechar esta aba: as entradas do chat continuam sendo registradas. Abra de novo na hora de sortear.</p>
                </div>
              </div>
            ) : serverCapture === "checking" || serverCapture === "pending" ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 flex items-center gap-3 text-sm text-gray-400">
                <Cloud className="w-5 h-5 text-gray-500 animate-pulse" /> Ativando captação pelo servidor...
              </div>
            ) : serverCapture === "unavailable" ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 flex items-start gap-3 text-xs text-gray-400">
                <CloudOff className="w-5 h-5 text-gray-500 shrink-0" /> A captação pelo servidor só funciona no site publicado. Aqui, mantenha esta aba aberta.
              </div>
            ) : (
              <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <CloudOff className="w-5 h-5 text-purple-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-purple-200 text-sm">Só captando com esta aba aberta</p>
                    <p className="text-xs text-gray-400">
                      Para continuar captando mesmo se a aba fechar, autorize o site a ler o chat. Precisa ser feito uma vez, logado com a conta do canal <b className="text-purple-300">#{daily.twitch_channel}</b>.
                    </p>
                  </div>
                </div>
                <button
                  onClick={connectChat}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.35)] transition-colors"
                >
                  <Cloud className="w-4 h-4" /> Conectar chat da Twitch
                </button>
              </div>
            )
          )}

          {daily.capture_open ? (
            <button onClick={() => updateDaily({ capture_open: false })}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold uppercase tracking-widest text-sm bg-orange-600/20 text-orange-300 border border-orange-500/50 hover:bg-orange-600/30 transition-colors">
              <Pause className="w-4 h-4" /> Parar Captação
            </button>
          ) : (
            <button onClick={() => updateDaily({ capture_open: true })}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold uppercase tracking-widest text-sm bg-green-600/20 text-green-300 border border-green-500/50 hover:bg-green-600/30 transition-colors">
              <Play className="w-4 h-4" /> Voltar Captação
            </button>
          )}

          <button onClick={() => startDraw()} disabled={isSpinning || eligible.length === 0}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-xl font-black uppercase tracking-widest text-lg text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_30px_rgba(168,85,247,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            <Trophy className="w-6 h-6" /> Iniciar Sorteio
          </button>

          <div className="glass-panel rounded-xl border border-gray-800 p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ajustes (salvam na hora)</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["response_seconds", "Tempo (s)", 5],
                ["chance_t1", "Chances Sub T1", 1],
                ["chance_t2", "Chances Sub T2", 1],
                ["chance_t3", "Chances Sub T3", 1],
              ] as const).map(([field, label, min]) => (
                <div key={field} className="space-y-1">
                  <label className={`text-[10px] font-bold uppercase ${field === "response_seconds" ? "text-gray-400" : "text-purple-400"}`}>{label}</label>
                  <NumberInput
                    value={liveSettings[field]}
                    min={min}
                    onChange={(v) => setLiveSettings((prev) => ({ ...prev, [field]: v }))}
                    onCommit={(v) => { if (v !== daily[field]) updateDaily({ [field]: v }); }}
                    className={`w-full bg-[#0a0a0b] border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500 ${field === "response_seconds" ? "border-gray-800" : "border-purple-500/30"}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleEndWithoutWinner}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase tracking-widest text-xs text-red-300 bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 transition-colors"
          >
            <X className="w-4 h-4" /> Encerrar sorteio sem ganhador
          </button>
        </div>

        {/* Lista ao vivo */}
        <div className="glass-panel rounded-xl border border-gray-800 flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
          <div className="p-5 border-b border-gray-800 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" /> Participantes
              </h2>
              <div className="flex gap-2 text-xs font-bold">
                <span className="rounded-full bg-purple-500/15 text-purple-300 px-3 py-1">{eligible.length} pessoas</span>
                <span className="rounded-full bg-gray-800 text-gray-300 px-3 py-1">{subsCount} subs</span>
                <span className="rounded-full bg-gray-800 text-gray-300 px-3 py-1">{totalTickets} chances</span>
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar participante"
                className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {visibleList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center px-6">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-bold">{eligible.length === 0 ? "Ninguém entrou ainda" : "Nenhum resultado"}</p>
                {eligible.length === 0 && <p className="text-sm">Peça para o chat digitar <b className="text-purple-400">{daily.bot_command}</b></p>}
              </div>
            ) : (
              visibleList.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/40 p-2.5 animate-fade-in">
                  <img src={avatarFor(p.twitch_username, p.avatar_url)} alt="" className="w-10 h-10 rounded-full border border-gray-700 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">@{p.twitch_username}</p>
                    <SubBadge tier={p.sub_tier} />
                  </div>
                  <span className="shrink-0 text-xs font-black text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded px-2 py-1">
                    {chancesFor(p.sub_tier, daily)}x
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <DailyHistory refreshKey={historyKey} canReopen={false} onReopened={loadActiveDaily} />

      {/* Overlays vão direto no body para ficar acima do menu fixo do site */}
      {typeof document !== "undefined" && createPortal(<>
      {/* Roleta */}
      {isSpinning && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md px-4 animate-fade-in">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-wider text-white mb-10 animate-pulse">Sorteando...</h2>
          <div ref={trackRef} className="relative w-full max-w-5xl h-48 overflow-hidden rounded-2xl border-y-2 border-purple-500/40 bg-[#0c0c10]">
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0c0c10] to-transparent z-20 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0c0c10] to-transparent z-20 pointer-events-none" />
            <div className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 bg-yellow-400 z-30 shadow-[0_0_20px_rgba(250,204,21,0.9)]" />
            <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-30 w-0 h-0 border-x-[10px] border-x-transparent border-t-[14px] border-t-yellow-400" />
            <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 z-30 w-0 h-0 border-x-[10px] border-x-transparent border-b-[14px] border-b-yellow-400" />
            <div ref={reelRef} className="absolute inset-y-0 left-0 flex items-center gap-3 will-change-transform">
              {reel.map((p, i) => (
                <div key={i} style={{ width: CARD_W }} className="h-36 shrink-0 rounded-xl border border-gray-800 bg-[#15151b] flex flex-col items-center justify-center gap-2 px-2">
                  <img src={avatarFor(p.twitch_username, p.avatar_url)} alt="" className="w-16 h-16 rounded-full border-2 border-gray-700 object-cover" />
                  <span className="w-full truncate text-center text-xs font-bold text-white">@{p.twitch_username}</span>
                  {p.sub_tier > 0 && <Star className="w-3 h-3 fill-purple-400 text-purple-400" />}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-8 text-gray-500 text-sm font-bold uppercase tracking-widest">{eligible.length} pessoas · {totalTickets} chances</p>
        </div>
      )}

      {/* Popup do sorteado */}
      {showPopup && drawn && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-purple-500/50 bg-[#101014] p-8 text-center shadow-[0_0_80px_rgba(168,85,247,0.35)] animate-scale-up overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-purple-600/25 blur-[90px] pointer-events-none" />
            <button onClick={handleClosePopup} title="Voltar à lista" className="absolute top-4 right-4 text-gray-500 hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>

            <p className="relative text-xs font-black uppercase tracking-[0.3em] text-purple-400 mb-5">Sorteado!</p>
            <img src={avatarFor(drawn.twitch_username, drawn.avatar_url)} alt=""
              className="relative w-28 h-28 rounded-full mx-auto border-4 border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.5)] object-cover" />
            <h3 className="relative mt-4 text-4xl md:text-5xl font-black text-white break-all">@{drawn.twitch_username}</h3>
            <div className="relative mt-3 flex justify-center gap-2">
              <SubBadge tier={drawn.sub_tier} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-gray-700 rounded-md px-1.5 py-0.5">{chancesFor(drawn.sub_tier, daily)} {chancesFor(drawn.sub_tier, daily) === 1 ? "chance" : "chances"}</span>
            </div>

            <div className="relative mt-6">
              {winnerReply !== null ? (
                <div className="rounded-2xl border border-green-500/40 bg-green-500/10 p-4">
                  <p className="text-green-400 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Respondeu no chat!
                  </p>
                  <p className="mt-2 text-white break-words">&ldquo;{winnerReply}&rdquo;</p>
                </div>
              ) : timeUp ? (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                  <p className="text-red-400 font-black uppercase tracking-widest">Tempo esgotado</p>
                  <p className="text-sm text-gray-400 mt-1">@{drawn.twitch_username} não respondeu no chat.</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Tempo para responder no chat</p>
                  <div className={`text-7xl font-black tabular-nums ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-white"}`}>{timeLeft}s</div>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-[width] duration-1000 ease-linear"
                      style={{ width: `${(timeLeft / daily.response_seconds) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="relative mt-6 space-y-3">
              <button onClick={handleConfirmWinner} disabled={busy}
                className="w-full py-4 rounded-xl font-black uppercase tracking-widest bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5" /> Confirmar ganhador
              </button>
              {timeUp && (
                <button onClick={handleNoAnswer}
                  className="w-full py-4 rounded-xl font-black uppercase tracking-widest bg-red-600/20 border border-red-500/60 text-red-300 hover:bg-red-600/30 transition-colors flex items-center justify-center gap-2 animate-fade-in">
                  <RotateCcw className="w-5 h-5" /> Não respondeu, sortear de novo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ganhador confirmado */}
      {confirmedWinner && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-yellow-500/50 bg-[#101014] p-8 text-center shadow-[0_0_80px_rgba(250,204,21,0.25)] animate-scale-up">
            <Trophy className="w-14 h-14 text-yellow-400 mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400">Ganhador do dia</p>
            <img src={avatarFor(confirmedWinner.twitch_username, confirmedWinner.avatar_url)} alt=""
              className="w-24 h-24 rounded-full mx-auto mt-4 border-4 border-yellow-400 object-cover" />
            <h3 className="mt-3 text-4xl font-black text-white break-all">@{confirmedWinner.twitch_username}</h3>
            <p className="mt-2 text-gray-400">{daily.title.replace("|", " ")}</p>
            <p className="mt-4 text-sm text-gray-500">Salvo no histórico de 30 dias da página Sorteio Diário.</p>
            <button onClick={resetToSetup} className="mt-6 w-full btn-neon py-4 rounded-xl font-black uppercase tracking-widest text-sm">
              Novo sorteio
            </button>
          </div>
        </div>
      )}
      </>, document.body)}
    </div>
  );
}
