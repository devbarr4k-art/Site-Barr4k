import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Fotos de perfil da Twitch exibidas na navbar
    remotePatterns: [{ protocol: "https", hostname: "static-cdn.jtvnw.net" }],
  },
};

export default nextConfig;
