import { FaInstagram, FaSteam, FaYoutube } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { UserRound } from "lucide-react";

export const metadata = {
  title: "barr4k",
  description: "Conheça a história do BARR4K e sua jornada como criador de conteúdo.",
};

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header Profile Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 to-black pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10">

            {/* Profile Picture */}
            <div className="w-48 h-48 md:w-64 md:h-64 flex-shrink-0 rounded-full border-4 border-purple-500/50 flex items-center justify-center relative shadow-[0_0_50px_rgba(126,34,206,0.3)] overflow-hidden">
              <img src="/barr4k_perfil.png" alt="BARR4K" className="w-full h-full object-cover" />
            </div>

            {/* Intro Content */}
            <div className="text-center md:text-left pt-4 flex flex-col justify-center">
              <span className="self-center md:self-start inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-bold text-xs tracking-widest uppercase">
                <UserRound className="w-4 h-4" /> Conheça o BARR4K
              </span>
              <h1 className="font-title text-5xl md:text-7xl text-white mb-2 uppercase drop-shadow-md">
                BARR4K
              </h1>
              <p className="text-xl text-purple-400 font-bold tracking-widest uppercase">Streamer & Criador de Conteúdo</p>

              {/* Social Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 max-w-xl mx-auto md:mx-0">
                {[
                  { href: "https://www.youtube.com/@barr4k/", label: "YouTube", icon: <FaYoutube className="w-5 h-5" /> },
                  { href: "https://www.instagram.com/barr4k", label: "Instagram", icon: <FaInstagram className="w-5 h-5" /> },
                  { href: "https://x.com/jpbarrak", label: "X", icon: <FaXTwitter className="w-5 h-5" /> },
                  { href: "https://steamcommunity.com/id/barr4k/", label: "Steam", icon: <FaSteam className="w-5 h-5" /> },
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-neon flex items-center justify-center gap-3 px-6 py-4 text-sm"
                  >
                    {s.icon} {s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}


