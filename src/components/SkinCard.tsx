import { ArrowUpRight, Crosshair, Gem } from "lucide-react";
import ClosedStamp from "@/components/ui/ClosedStamp";

export interface Skin {
  id?: string;
  name: string;
  wear?: string | null;
  tag?: string | null;
  float_value?: string | null;
  price?: string | null;
  image_url?: string | null;
  buy_url?: string | null;
  status?: "available" | "sold" | string;
}

// Card da loja de skins. O mesmo componente é usado na página /skins e na prévia do painel.
export default function SkinCard({ skin, preview = false }: { skin: Skin; preview?: boolean }) {
  const sold = skin.status === "sold";
  const canBuy = !sold && !!skin.buy_url && !preview;

  const body = (
    <>
      {/* Imagem e etiquetas */}
      <div className="relative h-60 p-3">
        <div className="absolute inset-3 rounded-xl bg-gradient-to-b from-[#15151c] to-[#0d0d12] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(147,51,234,0.18),transparent_65%)]" />
          {skin.image_url ? (
            <img
              src={skin.image_url}
              alt={skin.name}
              className={`absolute inset-0 w-full h-full object-contain p-6 drop-shadow-[0_18px_25px_rgba(0,0,0,0.6)] transition-transform duration-500 ${
                sold ? "grayscale opacity-50" : "group-hover:scale-105 group-hover:-rotate-2"
              }`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-700">
              <Crosshair className="w-16 h-16" />
            </div>
          )}
          {sold && <ClosedStamp text="Vendida" />}
        </div>

        <div className="relative z-30 flex flex-wrap gap-2 p-2">
          {skin.tag && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-200">
              <Gem className="w-3 h-3 text-purple-400" /> {skin.tag}
            </span>
          )}
          {skin.wear && (
            <span className="px-2.5 py-1 rounded-md bg-black/70 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {skin.wear}
            </span>
          )}
        </div>
      </div>

      {/* Informações */}
      <div className="px-6 pb-6 pt-2 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-white leading-snug min-h-[3.2rem]">
          <span className="text-purple-500 mr-1.5">★</span>
          {skin.name || "Nome da skin"}
        </h3>

        <div className="w-full h-px bg-white/5 my-4" />

        <div className="flex justify-between items-end mb-5">
          <div>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Float</p>
            <p className="text-white font-bold text-sm tabular-nums">{skin.float_value || "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Valor</p>
            <p className="text-purple-400 font-black text-xl">{skin.price ? `R$ ${skin.price}` : "—"}</p>
          </div>
        </div>

        <div className={`mt-auto flex items-center justify-between text-[11px] font-bold uppercase tracking-widest transition-colors ${
          sold ? "text-red-400" : "text-gray-500 group-hover:text-purple-300"
        }`}>
          <span>{sold ? "Vendida" : skin.buy_url || preview ? "Comprar" : "Em breve"}</span>
          {!sold && <ArrowUpRight className="w-4 h-4" />}
        </div>
      </div>
    </>
  );

  const className = `group bg-[#0c0d10] rounded-2xl overflow-hidden border flex flex-col transition-all ${
    sold ? "border-white/5 opacity-80" : "border-white/5 hover:border-purple-500/50 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(147,51,234,0.2)]"
  }`;

  return canBuy ? (
    <a href={skin.buy_url!} target="_blank" rel="noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}
