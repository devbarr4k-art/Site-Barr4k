import { FaWhatsapp, FaSteam } from "react-icons/fa";
import { Crosshair, MessageCircle, Package, BadgeDollarSign } from "lucide-react";

export const metadata = {
  title: "BARR4K",
  description: "Venda suas skins de CS2 para o BARR4K. Chame no WhatsApp ou na Steam e receba uma proposta.",
};

const WHATSAPP_URL =
  "https://wa.me/5511991238144?text=" +
  encodeURIComponent("Fala BARR4K! Vim pelo site e quero vender minhas skins.");
const STEAM_URL = "https://steamcommunity.com/id/barr4k/";

const STEPS = [
  { icon: MessageCircle, title: "Chama o BARR4K", text: "No WhatsApp ou na Steam, do jeito que for melhor pra você." },
  { icon: Package, title: "Mostra o inventário", text: "Manda o link do inventário ou o print das skins que quer vender." },
  { icon: BadgeDollarSign, title: "Recebe a proposta", text: "Ele avalia e te passa o valor. Fechou, é só fazer a troca." },
];

// Página SKINS: o streamer compra skins da comunidade
export default function SkinsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      {/* Brilho roxo de fundo */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-purple-700/25 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full bg-pink-600/10 blur-[120px]" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-bold text-xs tracking-widest uppercase mb-8">
          <Crosshair className="w-4 h-4" /> O BARR4K compra suas skins
        </div>

        <h1 className="font-title text-5xl sm:text-6xl md:text-8xl text-white drop-shadow-md">
          Venda suas <br className="sm:hidden" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 animate-pulse-glow">
            skins!
          </span>
        </h1>

        <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-gray-300 font-medium">
          Tem skin parada no inventário? Transforma em dinheiro. Chama o BARR4K e recebe uma proposta pelo seu inventário de CS2.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-neon w-full sm:w-auto px-10 py-5 text-lg flex items-center justify-center gap-3"
          >
            <FaWhatsapp className="w-6 h-6" /> Chamar no WhatsApp
          </a>
          <a
            href={STEAM_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-neon w-full sm:w-auto px-10 py-5 text-lg flex items-center justify-center gap-3"
          >
            <FaSteam className="w-6 h-6" /> Perfil da Steam
          </a>
        </div>

        {/* Como funciona */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {STEPS.map((step, i) => (
            <div key={step.title} className="glass-panel rounded-2xl border border-purple-500/20 p-6 relative overflow-hidden">
              <span className="absolute -right-2 -top-6 text-[7rem] font-black text-purple-500/10 leading-none select-none">
                {i + 1}
              </span>
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center mb-4">
                  <step.icon className="w-6 h-6 text-purple-300" />
                </div>
                <h3 className="font-title text-xl text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
