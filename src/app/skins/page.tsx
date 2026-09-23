"use client";

import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SkinCard, { type Skin } from "@/components/SkinCard";

export default function SkinsPage() {
  const [skins, setSkins] = useState<Skin[] | null>(null);

  useEffect(() => {
    supabase
      .from("skins")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        // Disponíveis primeiro, vendidas no fim
        const list = (data ?? []) as Skin[];
        setSkins([...list.filter((s) => s.status !== "sold"), ...list.filter((s) => s.status === "sold")]);
      });
  }, []);

  return (
    <div className="min-h-screen pt-10 pb-20 bg-[#050505]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-xs tracking-widest uppercase">
            <Crosshair className="w-4 h-4" /> Loja
          </div>
          <h1 className="font-title text-5xl md:text-7xl text-white uppercase">
            Skins do <span className="text-purple-500">BARR4K</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto font-medium">
            Skins à venda direto do inventário do BARR4K. Clique em comprar para falar com ele e fechar negócio.
          </p>
        </div>

        {skins === null ? (
          <div className="flex justify-center py-20"><div className="uiverse-loader"></div></div>
        ) : skins.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-gray-800 p-12 text-center flex flex-col items-center">
            <Crosshair className="w-14 h-14 text-gray-700 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Nenhuma skin à venda no momento</h2>
            <p className="text-gray-400">Volte depois, novas skins entram por aqui.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {skins.map((skin) => (
              <SkinCard key={skin.id} skin={skin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
