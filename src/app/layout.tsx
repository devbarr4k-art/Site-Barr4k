import type { Metadata } from "next";
import { Lato, Kanit, Sedgwick_Ave_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
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

// Usada nos títulos via style={{ fontFamily: 'var(--font-kanit)' }}
const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  style: ["normal", "italic"]
});

// Estilo pichação/grafite, usado nos títulos (classe font-graffiti)
const graffiti = Sedgwick_Ave_Display({
  variable: "--font-graffiti",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "BARR4K",
  description: "Plataforma oficial de sorteios e engajamento da comunidade do BARR4K.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark scroll-smooth">
      <body
        className={`${lato.variable} ${kanit.variable} ${graffiti.variable} antialiased bg-black text-slate-100 min-h-screen flex flex-col font-sans`}
      >
        <Providers>
          <Navbar />
          <main className="flex-grow pt-20">
            {children}
          </main>
          <Footer />
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
