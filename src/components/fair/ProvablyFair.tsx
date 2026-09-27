"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, Hash, Loader2, Lock, ShieldCheck, Trophy, XCircle, Zap } from "lucide-react";
import {
  DRAND_CHAIN, DRAND_RELAYS, drandRandomnessMatches, drandRoundTime, drandRoundUrl, entriesText, FAIR_KIND_LABEL,
  pickWinner, sha256Hex, type FairDraw,
} from "@/lib/fair";

type ListItem = Pick<FairDraw, "id" | "kind" | "target_id" | "title" | "total_weight" | "drand_round" | "winner_label" | "winner_username" | "status" | "created_at" | "drawn_at">;

const STATUS: Record<FairDraw["status"], { label: string; cls: string }> = {
  waiting: { label: "Aguardando número", cls: "bg-gray-800 text-gray-300 border-gray-700" },
  drawn: { label: "Sorteado", cls: "bg-purple-500/15 text-purple-300 border-purple-500/40" },
  confirmed: { label: "Ganhador confirmado", cls: "bg-green-500/15 text-green-300 border-green-500/40" },
  skipped: { label: "Descartado", cls: "bg-red-500/10 text-red-300 border-red-500/30" },
};

const when = (iso: string | number) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const winnerText = (d: Pick<FairDraw, "kind" | "winner_label" | "winner_username">) =>
  d.kind === "rifa" ? `Número ${d.winner_label} · @${d.winner_username}` : `@${d.winner_username}`;

function StatusBadge({ status }: { status: FairDraw["status"] }) {
  const s = STATUS[status];
  return <span className={`shrink-0 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest ${s.cls}`}>{s.label}</span>;
}

export default function ProvablyFair({ id, target }: { id: string | null; target: string | null }) {
  return (
    <div className="min-h-screen bg-black pt-16 pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-600/15 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase tracking-widest mb-6">
            <ShieldCheck className="w-4 h-4" /> Provably Fair
          </span>
          <h1 className="font-title text-5xl md:text-6xl text-white">
            Sorteio <span className="text-purple-500">comprovado</span>
          </h1>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
            Ninguém escolhe o ganhador, nem o BARR4K. A conta usa a lista de participantes e um número aleatório público que ainda não existia quando a lista foi fechada. Você pode refazer a conta aqui mesmo.
          </p>
        </div>

        {id ? <DrawDetail id={id} /> : (
          <>
            <HowItWorks />
            <DrawList target={target} />
          </>
        )}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: <Lock className="w-5 h-5" />, title: "1. A lista é fechada", text: "Na hora de sortear, a lista de participantes (com as chances de cada um) é gravada aqui e ganha uma impressão digital (hash SHA-256). Mudar qualquer nome muda o hash." },
    { icon: <Zap className="w-5 h-5" />, title: "2. Número público do futuro", text: "O sorteio usa uma rodada do drand que só sai segundos depois: um sorteador público mantido por Cloudflare, Protocol Labs, universidades e outros. Ninguém sabe o número antes." },
    { icon: <Hash className="w-5 h-5" />, title: "3. A conta decide", text: "SHA-256(hash da lista : número público) vira um bilhete. Quem tem aquele bilhete na lista ganha. Qualquer pessoa chega no mesmo resultado." },
  ];
  return (
    <div className="grid md:grid-cols-3 gap-4 mb-12">
      {steps.map((s) => (
        <div key={s.title} className="rounded-2xl border border-white/10 bg-[#0c0d10] p-5">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-300 flex items-center justify-center mb-3">{s.icon}</div>
          <p className="text-white font-bold">{s.title}</p>
          <p className="text-sm text-gray-400 mt-1">{s.text}</p>
        </div>
      ))}
    </div>
  );
}

function DrawList({ target }: { target: string | null }) {
  const [draws, setDraws] = useState<ListItem[] | null>(null);
  useEffect(() => {
    fetch(`/api/provably-fair${target ? `?target=${encodeURIComponent(target)}` : ""}`)
      .then((r) => r.json())
      .then((j) => setDraws(j.draws ?? []))
      .catch(() => setDraws([]));
  }, [target]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-title text-2xl text-white">{target ? "Giros deste sorteio" : "Últimos sorteios"}</h2>
        {target && <Link href="/provably-fair" className="text-sm text-purple-400 hover:text-purple-300 font-bold">Ver todos</Link>}
      </div>
      {!draws ? (
        <div className="flex justify-center py-16"><div className="uiverse-loader" /></div>
      ) : draws.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-10 text-center text-gray-400">Nenhum sorteio registrado ainda.</div>
      ) : (
        <div className="space-y-2">
          {draws.map((d) => (
            <Link key={d.id} href={`/provably-fair?id=${d.id}`}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl border border-white/10 bg-[#0c0d10] hover:border-purple-500/50 px-4 py-3 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold truncate">{d.title}</p>
                <p className="text-xs text-gray-500">{FAIR_KIND_LABEL[d.kind]} · {when(d.created_at)} · {d.total_weight} {d.total_weight === 1 ? "chance" : "chances"}</p>
              </div>
              {d.winner_username && <p className="text-sm text-gray-200 font-bold truncate">{winnerText(d)}</p>}
              <StatusBadge status={d.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type Check = { ok: boolean; label: string; detail?: string };

function DrawDetail({ id }: { id: string }) {
  const [draw, setDraw] = useState<FairDraw | null | undefined>(undefined);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetch(`/api/provably-fair?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => setDraw(j.draw ?? null))
      .catch(() => setDraw(null));
  }, [id]);

  // Faixa de bilhetes de cada participante (na ordem da lista)
  const ranges = useMemo(() => {
    let acc = 0;
    return (draw?.entries ?? []).map((e) => {
      const from = acc;
      acc += e.weight;
      return { ...e, from, to: acc - 1 };
    });
  }, [draw]);

  // Refaz tudo no navegador, buscando o número público direto no drand (sem passar pelo site)
  const verify = async () => {
    if (!draw) return;
    setVerifying(true);
    const out: Check[] = [];
    try {
      const hash = await sha256Hex(entriesText(draw.entries));
      out.push({ ok: hash === draw.entries_hash, label: "A lista publicada é a mesma que foi fechada", detail: `hash calculado: ${hash}` });

      const roundAt = drandRoundTime(draw.drand_round);
      out.push({
        ok: new Date(draw.created_at).getTime() < roundAt,
        label: "A lista foi fechada antes de o número público existir",
        detail: `lista: ${when(draw.created_at)} · número saiu: ${when(roundAt)}`,
      });

      const relay = DRAND_RELAYS[DRAND_RELAYS.length - 1];
      const res = await fetch(drandRoundUrl(draw.drand_round, relay), { cache: "no-store" });
      const beacon = await res.json();
      const sigOk = await drandRandomnessMatches(beacon.signature, beacon.randomness);
      out.push({
        ok: sigOk && beacon.randomness === draw.drand_randomness,
        label: `O número público confere com o drand (${new URL(relay).host})`,
        detail: `rodada ${draw.drand_round}: ${beacon.randomness}`,
      });

      const { ticket, index } = await pickWinner(draw.entries, draw.entries_hash, beacon.randomness);
      const label = draw.entries[index].label;
      out.push({
        ok: ticket.toString() === draw.ticket && label === draw.winner_label,
        label: "A conta leva ao mesmo ganhador",
        detail: `bilhete ${ticket.toString()} de 0 a ${draw.total_weight - 1} → ${label}`,
      });
    } catch (err) {
      out.push({ ok: false, label: "Não foi possível terminar a verificação", detail: err instanceof Error ? err.message : String(err) });
    }
    setChecks(out);
    setVerifying(false);
  };

  if (draw === undefined) return <div className="flex justify-center py-20"><div className="uiverse-loader" /></div>;
  if (draw === null) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-10 text-center text-gray-400">
        Sorteio não encontrado. <Link href="/provably-fair" className="text-purple-400 font-bold">Ver todos</Link>
      </div>
    );
  }

  const allOk = checks && checks.every((c) => c.ok);
  const winnerIndex = draw.entries.findIndex((e) => e.label === draw.winner_label);

  return (
    <div className="space-y-6">
      <Link href={`/provably-fair?target=${draw.target_id}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm font-bold">
        <ArrowLeft className="w-4 h-4" /> Todos os giros deste sorteio
      </Link>

      <div className="rounded-2xl border border-purple-500/30 bg-[#0c0d10] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-purple-400 font-bold uppercase tracking-widest">{FAIR_KIND_LABEL[draw.kind]}</p>
            <h2 className="font-title text-3xl text-white">{draw.title}</h2>
            <p className="text-sm text-gray-500 mt-1">Lista fechada em {when(draw.created_at)}</p>
          </div>
          <StatusBadge status={draw.status} />
        </div>
        {draw.winner_username && (
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-3">
            <Trophy className="w-6 h-6 text-yellow-400 shrink-0" />
            <p className="text-white font-bold text-lg break-all">{winnerText(draw)}</p>
          </div>
        )}
        {draw.status === "skipped" && (
          <p className="mt-3 text-sm text-gray-400">Este giro foi descartado (ex.: o sorteado não respondeu no chat) e outro giro foi feito em seguida.</p>
        )}
      </div>

      {/* Dados da prova */}
      <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 space-y-3 text-sm">
        <Field label="Hash da lista (SHA-256)" value={draw.entries_hash} />
        <Field label="Rodada do drand" value={
          <a href={drandRoundUrl(draw.drand_round)} target="_blank" rel="noreferrer" className="text-purple-300 hover:text-purple-200 inline-flex items-center gap-1">
            {draw.drand_round} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        } />
        <Field label="Número público (randomness)" value={draw.drand_randomness ?? "ainda não saiu"} />
        <Field label="Bilhete sorteado" value={draw.ticket !== null ? `${draw.ticket} (de 0 a ${draw.total_weight - 1})` : "-"} />
        <p className="text-xs text-gray-500 pt-2">
          Conta: bilhete = SHA-256(&quot;hash da lista:número público&quot;) em número, resto da divisão por {draw.total_weight}. Rede do drand: quicknet ({DRAND_CHAIN.slice(0, 12)}...).
        </p>
      </div>

      {draw.drand_randomness && (
        <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6">
          <button onClick={verify} disabled={verifying} className="btn-neon px-6 py-3 rounded-lg font-bold flex items-center gap-2 disabled:opacity-60">
            {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />} Verificar agora
          </button>
          {checks && (
            <div className="mt-5 space-y-3">
              {checks.map((c) => (
                <div key={c.label} className="flex gap-3">
                  {c.ok ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className={`font-bold ${c.ok ? "text-white" : "text-red-300"}`}>{c.label}</p>
                    {c.detail && <p className="text-xs text-gray-500 break-all">{c.detail}</p>}
                  </div>
                </div>
              ))}
              <p className={`pt-2 font-black uppercase tracking-widest text-sm ${allOk ? "text-green-400" : "text-red-400"}`}>
                {allOk ? "Tudo confere: sorteio justo" : "Algo não conferiu"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Lista fechada */}
      <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6">
        <h3 className="font-title text-xl text-white mb-1">Lista fechada ({draw.entries.length})</h3>
        <p className="text-xs text-gray-500 mb-4">Cada linha tem uma faixa de bilhetes do tamanho das chances. O texto que vira o hash é cada linha como &quot;nome:chances&quot;, uma embaixo da outra.</p>
        <div className="max-h-[480px] overflow-y-auto rounded-lg border border-white/5 divide-y divide-white/5">
          {ranges.map((e, i) => (
            <div key={i} className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${i === winnerIndex ? "bg-yellow-500/10" : ""}`}>
              <span className={`truncate ${i === winnerIndex ? "text-yellow-300 font-bold" : "text-gray-200"}`}>{draw.kind === "rifa" ? `Número ${e.label}` : `@${e.label}`}</span>
              <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                {e.weight} {e.weight === 1 ? "chance" : "chances"} · bilhete{e.weight > 1 ? `s ${e.from}–${e.to}` : ` ${e.from}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <span className="sm:w-56 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-200 font-mono text-xs sm:text-sm break-all">{value}</span>
    </div>
  );
}
