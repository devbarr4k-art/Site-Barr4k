import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nomes antigos das páginas (links já compartilhados continuam funcionando)
  async redirects() {
    return [
      { source: "/skins", destination: "/vendas", permanent: true },
      { source: "/sobre", destination: "/biografia", permanent: true },
    ];
  },
  images: {
    // Fotos de perfil da Twitch exibidas na navbar
    remotePatterns: [{ protocol: "https", hostname: "static-cdn.jtvnw.net" }],
  },
};

export default nextConfig;
