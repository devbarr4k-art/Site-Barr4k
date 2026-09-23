import { FaInstagram, FaSteam, FaYoutube } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import Link from "next/link";
import { Crosshair } from "lucide-react";

export const metadata = {
  title: "BARR4K",
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
              <Link
                href="/skins"
                className="self-center md:self-start inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400 font-bold text-xs tracking-widest uppercase transition-colors"
              >
                <Crosshair className="w-4 h-4" /> O BARR4K compra suas skins
              </Link>
              <h1 className="font-title text-5xl md:text-7xl text-white mb-2 uppercase drop-shadow-md">
                BARR4K
              </h1>
              <p className="text-xl text-purple-400 font-bold mb-8 tracking-widest uppercase">Streamer & Criador de Conteúdo</p>

              <div className="space-y-6 text-gray-300 font-medium leading-relaxed max-w-3xl">
                <p>
                  Fala galera! Eu sou o BARR4K, apaixonado por CS2 e por criar conteúdo para a nossa comunidade. Comecei minha jornada nos games bem cedo e, desde então, o cenário competitivo e a diversão com os amigos sempre foram minha maior motivação.
                </p>
                <p>
                  Nas minhas lives, o foco principal é trazer entretenimento, abrir umas caixas, jogar aquele CS de qualidade (com um pouco de rage às vezes) e, claro, interagir o máximo possível com vocês no chat. Acredito que a stream não é só sobre quem está jogando, mas sobre todo mundo que está assistindo e participando.
                </p>
                <p>
                  A comunidade BARR4K sempre foi o pilar central de tudo. Mais do que apenas jogar, nosso objetivo é criar um ambiente onde todos se sintam bem-vindos, possam dar risadas e se desconectar dos problemas do dia a dia. Esta plataforma de sorteios foi criada especialmente para retribuir todo o carinho e apoio que vocês me dão todos os dias.
                </p>

                <blockquote className="border-l-4 border-purple-500 pl-6 py-4 my-8 text-white font-bold text-xl bg-purple-900/10 rounded-r-xl">
                  "A verdadeira magia das lives não está no jogo, mas sim nas pessoas que estão no chat compartilhando aquele momento com você."
                </blockquote>

                <p>
                  Obrigado por fazerem parte dessa história. Se você ainda não me acompanha nas outras redes, clica nos links abaixo e bora colar junto!
                </p>
              </div>

              {/* Social Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12 pt-8 border-t border-gray-800/50 max-w-xl mx-auto md:mx-0">
                {[
                  { href: "https://x.com/jpbarrak", label: "X (Twitter)", icon: <FaXTwitter className="w-5 h-5" /> },
                  { href: "https://www.youtube.com/@barr4k/shorts", label: "YouTube", icon: <FaYoutube className="w-5 h-5" /> },
                  { href: "https://www.instagram.com/barr4k", label: "Instagram", icon: <FaInstagram className="w-5 h-5" /> },
                  { href: "https://steamcommunity.com/id/barr4k/", label: "Steam", icon: <FaSteam className="w-5 h-5" /> },
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-neon flex items-center justify-center gap-3 px-6 py-4 text-sm"
                  >
                    {s.icon} Me siga no {s.label}
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


