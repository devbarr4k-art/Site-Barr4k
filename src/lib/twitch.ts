// Acesso à API Helix com token de app (client credentials). Só no servidor.

let appToken: { value: string; expiresAt: number } | null = null;

export async function getAppToken(): Promise<string | null> {
  if (appToken && appToken.expiresAt > Date.now() + 60_000) return appToken.value;
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID || "",
    client_secret: process.env.TWITCH_CLIENT_SECRET || "",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: "POST" });
  if (!res.ok) return null;
  const json = await res.json();
  appToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return appToken.value;
}

/** Fotos de perfil de vários logins de uma vez (a Helix aceita até 100 por chamada). */
export async function fetchTwitchAvatars(logins: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unique = [...new Set(logins.map((l) => l.toLowerCase()))];
  try {
    const token = await getAppToken();
    if (!token) return result;
    for (let i = 0; i < unique.length; i += 100) {
      const query = unique.slice(i, i + 100).map((l) => `login=${encodeURIComponent(l)}`).join("&");
      const res = await fetch(`https://api.twitch.tv/helix/users?${query}`, {
        headers: { "Client-Id": process.env.TWITCH_CLIENT_ID || "", Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) appToken = null;
      if (!res.ok) continue;
      const json = await res.json();
      for (const u of json?.data ?? []) result[u.login] = u.profile_image_url;
    }
  } catch {
    // sem foto não impede nada: o site usa o avatar com a inicial
  }
  return result;
}

/** Foto de perfil da Twitch pelo login, ou null se não achar. */
export async function fetchTwitchAvatar(login: string): Promise<string | null> {
  try {
    const token = await getAppToken();
    if (!token) return null;
    const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, {
      headers: { "Client-Id": process.env.TWITCH_CLIENT_ID || "", Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) appToken = null; // token expirou antes da hora: busca outro na próxima
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.[0]?.profile_image_url ?? null;
  } catch {
    return null;
  }
}

/** Consulta na API da Twitch (Helix) o tier de sub dos participantes no canal do streamer. */
export async function checkTwitchSubscriptions(
  channelLogin: string,
  usernames: string[],
  userAccessToken: string
): Promise<{ ok: true; subs: Record<string, number> } | { ok: false; message: string; needsAuth?: boolean }> {
  try {
    const clientId = process.env.TWITCH_CLIENT_ID || "";
    // 1. Obter broadcaster ID
    const bRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channelLogin.toLowerCase())}`, {
      headers: { "Client-Id": clientId, Authorization: `Bearer ${userAccessToken}` },
    });
    if (bRes.status === 401 || bRes.status === 403) {
      return { ok: false, message: "Autorização da Twitch necessária para ler subs do canal.", needsAuth: true };
    }
    const bJson = await bRes.json();
    const broadcasterId = bJson?.data?.[0]?.id;
    if (!broadcasterId) return { ok: false, message: "Canal da Twitch não encontrado." };

    // 2. Obter user IDs dos participantes (em lotes de até 100)
    const uniqueUsers = [...new Set(usernames.map((u) => u.toLowerCase()))];
    const userMap: Record<string, string> = {}; // username -> user_id
    for (let i = 0; i < uniqueUsers.length; i += 100) {
      const chunk = uniqueUsers.slice(i, i + 100);
      const query = chunk.map((u) => `login=${encodeURIComponent(u)}`).join("&");
      const uRes = await fetch(`https://api.twitch.tv/helix/users?${query}`, {
        headers: { "Client-Id": clientId, Authorization: `Bearer ${userAccessToken}` },
      });
      if (uRes.ok) {
        const uJson = await uRes.json();
        for (const u of uJson?.data ?? []) {
          userMap[u.login.toLowerCase()] = u.id;
        }
      }
    }

    // 3. Consultar sub de cada participante no canal (em lotes de até 100)
    const subs: Record<string, number> = {};
    const userIds = Object.values(userMap);
    for (let i = 0; i < userIds.length; i += 100) {
      const chunkIds = userIds.slice(i, i + 100);
      const query = `broadcaster_id=${broadcasterId}&` + chunkIds.map((id) => `user_id=${id}`).join("&");
      const subRes = await fetch(`https://api.twitch.tv/helix/subscriptions?${query}`, {
        headers: { "Client-Id": clientId, Authorization: `Bearer ${userAccessToken}` },
      });
      if (subRes.status === 401 || subRes.status === 403) {
        return { ok: false, message: "Permissão insuficiente para ler inscritos do canal.", needsAuth: true };
      }
      if (subRes.ok) {
        const subJson = await subRes.json();
        for (const s of subJson?.data ?? []) {
          const login = (s.user_login || s.user_name || "").toLowerCase();
          const tierStr = String(s.tier || "1000");
          const tierNum = tierStr === "3000" ? 3 : tierStr === "2000" ? 2 : 1;
          if (login) subs[login] = tierNum;
        }
      }
    }

    // Preenche 0 para quem não é sub
    for (const u of uniqueUsers) {
      if (!(u in subs)) subs[u] = 0;
    }

    return { ok: true, subs };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Erro ao consultar assinaturas da Twitch." };
  }
}

