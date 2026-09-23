import type { Metadata } from "next";
import { Lato } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { RECAPTCHA_SITE_KEY } from "@/lib/recaptcha";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Providers } from "@/components/Providers";
import "./globals.css";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
  style: ["normal", "italic"]
});

export const metadata: Metadata = {
  title: "barr4k",
  description: "Plataforma oficial de sorteios e engajamento da comunidade do BARR4K.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark scroll-smooth" data-scroll-behavior="smooth">
      <body
        className={`${lato.variable} antialiased bg-black text-slate-100 min-h-screen flex flex-col font-sans italic`}
      >
        <Providers>
          <Navbar />
          <main className="flex-grow pt-20">
            {children}
          </main>
          <Footer />
          <Analytics />
          <SpeedInsights />
          {/* reCAPTCHA v3 (selo "protegido por reCAPTCHA"); só carrega com a chave configurada na Vercel */}
          {RECAPTCHA_SITE_KEY && (
            <Script src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`} strategy="afterInteractive" />
          )}
        </Providers>
      </body>
    </html>
  );
}
