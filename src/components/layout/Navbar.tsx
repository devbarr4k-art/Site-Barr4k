"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { FaTwitch, FaHandshake, FaGamepad, FaHome } from "react-icons/fa";
import { ShieldAlert, Ticket, LogOut, ChevronDown, Menu, X, Gift, UserRound } from "lucide-react";
import { GiAk47 } from "react-icons/gi";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { handleSectionLink } from "@/lib/sectionNav";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const isAdmin = !!(session?.user as any)?.isAdmin;

  const navLinks = [
    { name: "HOME", href: "/", icon: <FaHome className="w-4 h-4" /> },
    { name: "SORTEIOS ATIVOS", href: "/#active-giveaways", icon: <Gift className="w-4 h-4" /> },
    { name: "SORTEIO DIÁRIO", href: "/diario", icon: <FaGamepad className="w-4 h-4" /> },
    { name: "VENDAS", href: "/skins", icon: <GiAk47 className="w-5 h-5" /> },
    { name: "BIOGRAFIA", href: "/sobre", icon: <UserRound className="w-4 h-4" /> },
    { name: "PARCEIROS", href: "/#parceiros", icon: <FaHandshake className="w-4 h-4" /> },
  ];

  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    setIsOpen(false);
    handleSectionLink(e, href, pathname);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#050505] border-b border-purple-900/50 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* Logo (Avatar BARR4K) */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/50 group-hover:border-purple-400 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-300 relative">
                <Image
                  src="/barr4k-avatar.png"
                  alt="BARR4K"
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <span className="font-title text-2xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 animate-pulse-glow flex items-center">
                BARR4K
              </span>
            </Link>
          </div>

          {/* Desktop Navigation (Center) */}
          <nav className="hidden xl:flex items-center gap-5 ml-10 mr-auto pr-4 shrink-0">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="flex items-center gap-2 text-gray-300 hover:text-white font-black text-sm tracking-wider 2xl:tracking-widest whitespace-nowrap transition-colors duration-200 hover-underline-anim py-2 uppercase"
              >
                {link.icon}
                {link.name}
              </Link>
            ))}
          </nav>

          {/* User Section (Right) */}
          <div className="hidden xl:flex items-center border-l border-white/10 pl-6">
            {!isLoggedIn ? (
              <button
                onClick={() => signIn('twitch')}
                className="btn-neon px-6 py-2.5 rounded font-black tracking-widest uppercase transition-all flex items-center gap-2"
              >
                <FaTwitch className="w-4 h-4" /> Entrar
              </button>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-3 hover:bg-white/5 p-2 rounded-lg transition-colors focus:outline-none"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-900 border border-purple-500 flex items-center justify-center font-bold text-white overflow-hidden relative">
                    <Image src={session?.user?.image || "/avatar.png"} alt="" fill sizes="40px" className="object-cover" />
                  </div>
                  <div className="text-left hidden 2xl:block">
                    <p className="text-sm font-bold text-white uppercase">{session?.user?.name || "Usuário"}</p>
                    <p className="text-xs text-gray-400">Minha Conta</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-56 bg-[#0a0a0c] border border-gray-800 rounded-xl shadow-2xl py-2 animate-fade-in z-50">
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-purple-400 font-bold hover:bg-white/5 transition-colors"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        Painel Admin
                      </Link>
                    )}
                    <Link
                      href="/meus-tickets"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Ticket className="w-4 h-4" />
                      Meus Tickets
                    </Link>
                    <div className="border-t border-gray-800 my-1"></div>
                    <button
                      onClick={() => {
                        signOut();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="xl:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
              className="text-gray-300 hover:text-white focus:outline-none p-2"
            >
              {isOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      <div
        className={`xl:hidden fixed left-0 right-0 top-20 bg-[#050505] shadow-2xl transition-all duration-300 ease-in-out overflow-hidden border-b border-gray-800 ${
          isOpen ? "max-h-[80vh] opacity-100 pb-6" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pt-4 flex flex-col h-full">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="flex items-center gap-3 px-4 py-4 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors uppercase font-bold text-sm tracking-widest"
              >
                {link.icon}
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="mt-6 pt-6 border-t border-gray-800">
            {!isLoggedIn ? (
              <button
                onClick={() => signIn('twitch')}
                className="w-full btn-neon text-white px-5 py-4 rounded font-black uppercase flex items-center justify-center gap-3 transition-all"
              >
                <FaTwitch className="w-5 h-5" /> Entrar com a Twitch
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                {isAdmin && (
                  <Link href="/admin" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 text-purple-400 font-bold bg-white/5 rounded-lg">
                    <ShieldAlert className="w-4 h-4" /> Painel Admin
                  </Link>
                )}
                <Link href="/meus-tickets" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 text-white font-bold bg-white/5 rounded-lg">
                  <Ticket className="w-4 h-4" /> Meus Tickets
                </Link>
                <button onClick={() => signOut()} className="w-full flex items-center justify-center gap-3 px-4 py-3 text-red-400 font-bold bg-red-500/10 rounded-lg mt-2">
                  <LogOut className="w-4 h-4" /> Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
