import ProvablyFair from "@/components/fair/ProvablyFair";

export const metadata = {
  title: "barr4k",
  description: "Provably fair: confira como cada sorteio do BARR4K foi feito e refaça a conta você mesmo.",
};

export default async function ProvablyFairPage({ searchParams }: { searchParams: Promise<{ id?: string; target?: string }> }) {
  const { id, target } = await searchParams;
  return <ProvablyFair id={id ?? null} target={target ?? null} />;
}
