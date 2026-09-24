"use client";

// PROTÓTIPO DE RIFA (só localhost): dados de exemplo guardados no navegador (localStorage).
// Nada aqui toca no banco. Quando for pra valer, isto vira tabelas no Supabase
// (raffles, raffle_orders) e rotas /api, com a mesma forma de dados.

import { useCallback, useEffect, useState } from "react";

export type Raffle = {
  id: string;
  title: string;
  subtitle: string;
  image: string | null;
  pricePerNumber: number; // em reais
  totalNumbers: number; // números de 1 até totalNumbers
  drawDate: string; // ISO
  pixKey: string; // chave PIX (CNPJ) — fixa
  pixName: string; // favorecido
  qrImage: string | null; // imagem do QR code fixo (o streamer sobe no painel)
  status: "open" | "closed";
};

export type OrderStatus = "pending" | "approved" | "rejected";

export type RaffleOrder = {
  id: string;
  raffleId: string;
  username: string; // login da Twitch
  numbers: number[];
  total: number;
  proofs: string[]; // miniaturas dos comprovantes (data URL, só no protótipo)
  status: OrderStatus;
  createdAt: string;
};

const PIX = { pixKey: "00.000.000/0001-00", pixName: "BARR4K PRODUÇÕES" };

export const SAMPLE_RAFFLES: Raffle[] = [
  {
    id: "banca-csgobig",
    title: "Banca CSGOBIG",
    subtitle: "R$ 1.000 de saldo na CSGOBIG",
    image: "https://tnvlllanpuxvfudtqvwg.supabase.co/storage/v1/object/public/giveaways/premios/7efea48f-796e-4375-938f-f333ece428e4.png",
    pricePerNumber: 10,
    totalNumbers: 200,
    drawDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    qrImage: null,
    status: "open",
    ...PIX,
  },
  {
    id: "faca-doppler",
    title: "Faca Doppler",
    subtitle: "Karambit Doppler FN",
    image: "/bg-video-poster.jpg",
    pricePerNumber: 5,
    totalNumbers: 100,
    drawDate: new Date(Date.now() + 12 * 86_400_000).toISOString(),
    qrImage: null,
    status: "open",
    ...PIX,
  },
];

// Números já vendidos nos exemplos (fixos, para a tela não mudar a cada recarregada)
function seededTaken(raffle: Raffle, ratio: number): number[] {
  let seed = [...raffle.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: raffle.totalNumbers }, (_, i) => i + 1).filter(() => rand() < ratio);
}

const SAMPLE_ORDERS: RaffleOrder[] = SAMPLE_RAFFLES.flatMap((r, ri) => {
  const taken = seededTaken(r, ri === 0 ? 0.38 : 0.62);
  const orders: RaffleOrder[] = [];
  for (let i = 0; i < taken.length; i += 3) {
    const numbers = taken.slice(i, i + 3);
    orders.push({
      id: `${r.id}-exemplo-${i}`,
      raffleId: r.id,
      username: `participante${(i % 37) + 1}`,
      numbers,
      total: numbers.length * r.pricePerNumber,
      proofs: [],
      // alguns ainda esperando aprovação, para mostrar o cinza "reservado"
      status: i % 7 === 0 ? "pending" : "approved",
      createdAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
    });
  }
  return orders;
});

const KEY = "barr4k_rifa_prototipo_v1";
type Store = { raffles: Raffle[]; orders: RaffleOrder[] };

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { raffles: SAMPLE_RAFFLES, orders: SAMPLE_ORDERS };
}

function write(store: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {}
  window.dispatchEvent(new Event("rifa-store"));
}

/** Estado do protótipo compartilhado entre as páginas (e entre abas do navegador). */
export function useRifaStore() {
  const [store, setStore] = useState<Store | null>(null);

  useEffect(() => {
    const sync = () => setStore(read());
    sync();
    window.addEventListener("rifa-store", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rifa-store", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((fn: (s: Store) => Store) => write(fn(read())), []);

  const placeOrder = useCallback(
    (raffle: Raffle, username: string, numbers: number[], proofs: string[]) => {
      const current = read();
      const taken = takenNumbers(current.orders, raffle.id);
      const clash = numbers.filter((n) => taken.has(n));
      if (clash.length) return { ok: false as const, clash };
      const order: RaffleOrder = {
        id: crypto.randomUUID(),
        raffleId: raffle.id,
        username,
        numbers: [...numbers].sort((a, b) => a - b),
        total: numbers.length * raffle.pricePerNumber,
        proofs,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      write({ ...current, orders: [order, ...current.orders] });
      return { ok: true as const, order };
    },
    []
  );

  const setOrderStatus = useCallback(
    (orderId: string, status: OrderStatus) =>
      update((s) => ({ ...s, orders: s.orders.map((o) => (o.id === orderId ? { ...o, status } : o)) })),
    [update]
  );

  const updateRaffle = useCallback(
    (id: string, fields: Partial<Raffle>) =>
      update((s) => ({ ...s, raffles: s.raffles.map((r) => (r.id === id ? { ...r, ...fields } : r)) })),
    [update]
  );

  const reset = useCallback(() => write({ raffles: SAMPLE_RAFFLES, orders: SAMPLE_ORDERS }), []);

  return { store, placeOrder, setOrderStatus, updateRaffle, reset };
}

/** Números que não podem ser escolhidos: pagos ou aguardando aprovação. Recusados voltam a ficar livres. */
export function takenNumbers(orders: RaffleOrder[], raffleId: string): Map<number, OrderStatus> {
  const map = new Map<number, OrderStatus>();
  for (const o of orders) {
    if (o.raffleId !== raffleId || o.status === "rejected") continue;
    for (const n of o.numbers) map.set(n, o.status);
  }
  return map;
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** 7 → "007" num sorteio de 200 números */
export const padNumber = (n: number, total: number) => String(n).padStart(String(total).length, "0");
