import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    id_token?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          hd: "churadata.okinawa",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email ?? "";
      if (!email.endsWith("@churadata.okinawa")) {
        return false;
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account?.id_token) {
        return { ...token, id_token: account.id_token };
      }
      return token;
    },
    async session({ session, token }) {
      session.id_token = (token as { id_token?: string }).id_token;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
