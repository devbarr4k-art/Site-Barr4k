import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nomes antigos das páginas (links já compartilhados continuam funcionando)
  async redirects() {
    return [
      { source: "/skins", destination: "/vendas", permanent: true },
      { source: "/sobre", destination: "/biografia", permanent: true },
      // Endereço usado enquanto as rifas estavam escondidas
      { source: "/ragi09/painel", destination: "/admin?tab=rifas", permanent: false },
      { source: "/ragi09/:path*", destination: "/rifas/:path*", permanent: false },
    ];
  },
  // barr4k.com/trader = página de links (projeto Site-Barr4k-Links na Vercel, que mora em /trader)
  async rewrites() {
    return [
      { source: "/trader", destination: "https://site-barr4k-links.vercel.app/trader" },
      { source: "/trader/:path*", destination: "https://site-barr4k-links.vercel.app/trader/:path*" },
    ];
  },
  images: {
    // Fotos de perfil da Twitch exibidas na navbar
    remotePatterns: [{ protocol: "https", hostname: "static-cdn.jtvnw.net" }],
  },
};

export default nextConfig;
