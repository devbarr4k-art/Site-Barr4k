// Carimbo por cima da imagem de um sorteio que já fechou.
export default function ClosedStamp({ size = "md", text = "Encerrado" }: { size?: "md" | "lg"; text?: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 pointer-events-none">
      <span
        className={`-rotate-12 rounded-lg border-4 border-red-500 bg-black/50 font-black uppercase tracking-[0.2em] text-red-500 not-italic shadow-[0_0_30px_rgba(239,68,68,0.45)] ${
          size === "lg" ? "px-8 py-3 text-4xl md:text-5xl" : "px-5 py-2 text-2xl"
        }`}
        style={{ fontFamily: "var(--font-kanit)", textShadow: "0 0 12px rgba(239,68,68,0.6)" }}
      >
        {text}
      </span>
    </div>
  );
}
