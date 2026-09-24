import type { Metadata } from "next";

// Rifas ainda escondidas: endereço fora do menu e sem aparecer no Google
export const metadata: Metadata = {
  title: "barr4k",
  robots: { index: false, follow: false },
};

export default function RifasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
