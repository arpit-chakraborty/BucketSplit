import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db, ensureDbTables } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authConfig } from "@/auth.config";
import { hashPassword } from "@/lib/auth-utils";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const username = String(credentials.username).trim().toLowerCase();
        const password = String(credentials.password);

        await ensureDbTables();

        const user = await db.query.users.findFirst({
          where: eq(users.username, username),
        });

        if (!user) return null;

        const hashed = await hashPassword(password);
        if (hashed !== user.passwordHash) return null;

        return {
          id: user.id,
          name: user.name || user.username,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      if (token.name) {
        session.user.name = token.name as string;
      }
      return session;
    },
  },
});
