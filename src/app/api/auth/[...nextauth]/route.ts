import NextAuth from "next-auth"
import TwitchProvider from "next-auth/providers/twitch"

const handler = NextAuth({
  providers: [
    TwitchProvider({
      clientId: process.env.TWITCH_CLIENT_ID || "",
      clientSecret: process.env.TWITCH_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid user:read:email",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.providerAccountId = account.providerAccountId;
      }
      if (profile) {
        token.username = (profile as any).preferred_username;
        token.picture = (profile as any).picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).username = token.username;
        (session.user as any).providerAccountId = token.providerAccountId;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
