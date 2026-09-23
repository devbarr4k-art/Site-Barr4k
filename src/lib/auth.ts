import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import TwitchProvider from "next-auth/providers/twitch";
import { isAdmin } from "@/lib/admins";

// O preferred_username da Twitch é o nome de exibição (pode ter maiúsculas ou até
// caracteres não latinos). O bot do chat enxerga o "login", então buscamos o login
// na API Helix para que site e chat identifiquem o usuário do mesmo jeito.
async function fetchTwitchLogin(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        "Client-Id": process.env.TWITCH_CLIENT_ID || "",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.[0]?.login ?? null;
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    TwitchProvider({
      clientId: process.env.TWITCH_CLIENT_ID || "",
      clientSecret: process.env.TWITCH_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid user:read:email user:read:chat user:bot channel:bot channel:read:subscriptions",
          // Sempre mostra a tela da Twitch com a conta atual e o link "Não é você?",
          // senão quem já autorizou entra direto e não consegue trocar de conta
          force_verify: "true",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.providerAccountId = account.providerAccountId;
        const login = account.access_token ? await fetchTwitchLogin(account.access_token) : null;
        const displayName = (profile as any)?.preferred_username as string | undefined;
        token.username = (login || displayName || "").toLowerCase();
      }
      if (profile) {
        token.picture = (profile as any).picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).username = token.username;
        (session.user as any).providerAccountId = token.providerAccountId;
        (session.user as any).accessToken = token.accessToken;
        (session.user as any).isAdmin = isAdmin(token.username as string | undefined);
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/** Login da Twitch (minúsculo) do usuário da requisição atual, ou null. */
export async function getSessionUsername(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const username = (session?.user as any)?.username || session?.user?.name;
  return username ? String(username).toLowerCase() : null;
}

/** Token de acesso da Twitch do usuário logado na sessão, ou null. */
export async function getSessionAccessToken(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return ((session?.user as any)?.accessToken as string) || null;
}

