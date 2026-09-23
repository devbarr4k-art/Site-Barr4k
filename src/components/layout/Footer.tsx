"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { handleSectionLink } from "@/lib/sectionNav";
import Image from "next/image";
import { FaTwitch, FaInstagram, FaYoutube } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

export default function Footer() {
  const pathname = usePathname();

  return (
    <footer className="bg-[#050505] border-t-2 border-purple-500 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-center text-center md:text-left">

          {/* Brand/Logo Area */}
          <div className="flex flex-col items-center md:items-start">
            <Link href="/" onClick={(e) => handleSectionLink(e, "/", pathname)} className="flex items-center gap-3 group mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500/50 group-hover:border-purple-400 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-300 relative">
                <Image
                  src="/barr4k-avatar.png"
                  alt="BARR4K"
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <span className="font-title text-2xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 animate-pulse-glow flex items-center">
                BARR4K
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col items-center md:items-start">
            <h4 className="text-white font-bold tracking-widest uppercase mb-4 text-sm">Navegação</h4>
            <nav className="flex flex-col gap-3">
              <Link href="/" onClick={(e) => handleSectionLink(e, "/", pathname)} className="text-gray-400 hover:text-purple-400 hover:translate-x-1 transition-all text-sm flex items-center gap-2">
                <span className="w-1 h-1 bg-purple-500 rounded-full"></span> Home
              </Link>
              <Link href="/#active-giveaways" onClick={(e) => handleSectionLink(e, "/#active-giveaways", pathname)} className="text-gray-400 hover:text-purple-400 hover:translate-x-1 transition-all text-sm flex items-center gap-2">
                <span className="w-1 h-1 bg-purple-500 rounded-full"></span> Sorteios Ativos
              </Link>
              <Link href="/diario" onClick={(e) => handleSectionLink(e, "/diario", pathname)} className="text-gray-400 hover:text-purple-400 hover:translate-x-1 transition-all text-sm flex items-center gap-2">
                <span className="w-1 h-1 bg-purple-500 rounded-full"></span> Sorteio Diário
              </Link>
              <Link href="/skins" onClick={(e) => handleSectionLink(e, "/skins", pathname)} className="text-gray-400 hover:text-purple-400 hover:translate-x-1 transition-all text-sm flex items-center gap-2">
                <span className="w-1 h-1 bg-purple-500 rounded-full"></span> Venda
              </Link>
              <Link href="/sobre" onClick={(e) => handleSectionLink(e, "/sobre", pathname)} className="text-gray-400 hover:text-purple-400 hover:translate-x-1 transition-all text-sm flex items-center gap-2">
                <span className="w-1 h-1 bg-purple-500 rounded-full"></span> Biografia
              </Link>
              <Link href="/#parceiros" onClick={(e) => handleSectionLink(e, "/#parceiros", pathname)} className="text-gray-400 hover:text-purple-400 hover:translate-x-1 transition-all text-sm flex items-center gap-2">
                <span className="w-1 h-1 bg-purple-500 rounded-full"></span> Parceiros
              </Link>
              <Link href="/meus-tickets" onClick={(e) => handleSectionLink(e, "/meus-tickets", pathname)} className="text-gray-400 hover:text-purple-400 hover:translate-x-1 transition-all text-sm flex items-center gap-2">
                <span className="w-1 h-1 bg-purple-500 rounded-full"></span> Meus Tickets
              </Link>
            </nav>
          </div>

          {/* Social Links */}
          <div className="flex flex-col items-center md:items-start h-full">
            <h4 className="text-white font-bold tracking-widest uppercase mb-4 text-sm">Redes Sociais</h4>
            <div className="flex items-center gap-4">
              <a
                href="https://twitch.tv/barr4k"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-purple-600 hover:border-purple-500 transition-all shadow-[0_0_0_rgba(147,51,234,0)] hover:shadow-[0_0_15px_rgba(147,51,234,0.5)]"
              >
                <FaTwitch className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com/barr4k"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gradient-to-tr hover:from-purple-500 hover:via-pink-500 hover:to-orange-500 hover:border-pink-500 transition-all shadow-[0_0_0_rgba(236,72,153,0)] hover:shadow-[0_0_15px_rgba(236,72,153,0.5)]"
              >
                <FaInstagram className="w-4 h-4" />
              </a>
              <a
                href="https://x.com/jpbarrak"
                target="_blank"
                rel="noreferrer"
                aria-label="X (Twitter)"
                className="w-10 h-10 rounded-full border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-black hover:border-white/60 transition-all shadow-[0_0_0_rgba(255,255,255,0)] hover:shadow-[0_0_15px_rgba(255,255,255,0.25)]"
              >
                <FaXTwitter className="w-4 h-4" />
              </a>
              <a
                href="https://www.youtube.com/@barr4k/"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="w-10 h-10 rounded-full border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all shadow-[0_0_0_rgba(220,38,38,0)] hover:shadow-[0_0_15px_rgba(220,38,38,0.5)]"
              >
                <FaYoutube className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-900 text-center flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-600 text-xs font-medium">
            © {new Date().getFullYear()} BARR4K. Todos os direitos reservados.
          </p>
          <div className="text-gray-600 text-xs font-medium">
            Feito para a comunidade com 💜
          </div>
        </div>
      </div>
    </footer>
  );
}
