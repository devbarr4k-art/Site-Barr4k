import { markDataChanged } from "@/lib/freshData";

const READ_ACTIONS = new Set(["listParticipants", "participantCounts", "listDailyWinners", "getActiveDaily", "serverCapture", "listSiteUsers", "youtubeInfo", "listRaffles", "listRaffleOrders"]);

// Chamada do painel para a rota /api/admin. Lança erro com a mensagem do servidor.
export async function adminApi<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
  // Leituras não mudam nada; o resto faz a home buscar dados novos, sem cache
  if (!READ_ACTIONS.has(action)) markDataChanged();
  return json as T;
}
