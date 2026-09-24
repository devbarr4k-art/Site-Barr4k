"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import RafflesManager from "@/components/admin/RafflesManager";

// Painel das rifas, fora do painel admin (fica escondido até a rifa ser liberada).
// Só admin entra; as ações também são conferidas no servidor (/api/admin).
export default function RifasPainelPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = !!(session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;

  useEffect(() => {
    if (status !== "loading" && !isAdmin) router.replace("/");
  }, [status, isAdmin, router]);

  if (!isAdmin) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="uiverse-loader" /></div>;

  return (
    <div className="min-h-screen bg-[#050505] pt-10 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm font-bold mb-6">
          <ArrowLeft className="w-4 h-4" /> Painel admin
        </Link>
        <RafflesManager />
      </div>
    </div>
  );
}
