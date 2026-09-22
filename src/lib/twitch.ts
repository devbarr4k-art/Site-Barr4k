// Acesso à API Helix com token de app (client credentials). Só no servidor.

let appToken: { value: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string | null> {
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
