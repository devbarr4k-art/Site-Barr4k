"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { FaTwitch, FaWhatsapp } from "react-icons/fa";
import { Mail, UserPlus, X } from "lucide-react";
import { formatWhatsapp, isValidEmail, normalizeWhatsapp } from "@/lib/siteUsers";

const CHECKED_KEY = "signup_checked";   // já consultou o cadastro nesta sessão
const DISMISSED_KEY = "signup_dismissed"; // clicou em "Agora não" nesta sessão

const session_ = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch {} },
};

// Quem entra com a Twitch e ainda não tem cadastro recebe o convite para criar
export default function SignupPrompt() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const user = session?.user as { username?: string; name?: string | null; image?: string | null } | undefined;
  const nick = String(user?.username || user?.name || "").toLowerCase();

  useEffect(() => {
    if (status !== "authenticated" || !nick || pathname?.startsWith("/admin")) return;
    if (session_.get(DISMISSED_KEY) === nick) return;
    // O acesso conta uma vez por sessão; as outras páginas só conferem o cadastro
    const firstThisSession = session_.get(CHECKED_KEY) !== nick;
    fetch("/api/perfil" + (firstThisSession ? "?visit=1" : ""))
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        session_.set(CHECKED_KEY, nick);
        if (json && !json.registered) setOpen(true);
      })
      .catch(() => {});
  }, [status, nick, pathname]);

  if (!open) return null;

  const dismiss = () => {
    session_.set(DISMISSED_KEY, nick);
    setOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!normalizeWhatsapp(whatsapp)) return setError("Digite um WhatsApp válido, com DDD.");
    if (!isValidEmail(email.trim())) return setError("Digite um e-mail válido.");
    setSaving(true);
    try {
      const res = await fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp, email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Não foi possível salvar agora.");
      setDone(true);
      setTimeout(() => setOpen(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar agora.");
    }
    setSaving(false);
  };

  const inputClass =
    "w-full bg-[#0a0a0b] border border-gray-800 rounded-lg pl-11 pr-4 py-3 text-white placeholder:text-gray-600 focus:border-purple-500 outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-purple-500/50 bg-[#101012] shadow-[0_0_60px_rgba(147,51,234,0.25)] p-6 sm:p-8 animate-scale-up">
        <button onClick={dismiss} aria-label="Fechar" className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        {done ? (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-purple-600/20 border border-purple-500/50 flex items-center justify-center">
              <UserPlus className="w-7 h-7 text-purple-300" />
            </div>
            <h2 className="font-title text-2xl text-white">Conta criada!</h2>
            <p className="text-gray-400 mt-2 text-sm">Valeu, @{nick}. Boa sorte nos sorteios!</p>
          </div>
        ) : (
          <>
            <div className="mb-6 pr-6">
              <div className="mb-4 w-12 h-12 rounded-full bg-purple-600/20 border border-purple-500/50 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-purple-300" />
              </div>
              <h2 className="font-title text-2xl text-white leading-tight">
                Notei que você não tem conta criada no site, <span className="text-purple-400">bora criar?</span>
              </h2>
            </div>

            <form onSubmit={submit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nick da Twitch</label>
                <div className="relative">
                  <FaTwitch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                  <input value={nick} readOnly className={`${inputClass} text-gray-300 cursor-not-allowed`} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">WhatsApp</label>
                <div className="relative">
                  <FaWhatsapp className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                    placeholder="(11) 99123-4567"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@gmail.com"
                    className={inputClass}
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm font-bold">{error}</p>}

              <button type="submit" disabled={saving} className="w-full btn-neon py-3.5 rounded-lg font-black uppercase tracking-widest text-sm disabled:opacity-50">
                {saving ? "Criando..." : "Criar minha conta"}
              </button>
              <button type="button" onClick={dismiss} className="w-full text-gray-500 hover:text-gray-300 text-xs font-bold uppercase tracking-widest transition-colors">
                Agora não
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
