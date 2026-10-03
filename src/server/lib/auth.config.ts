import type { NextAuthConfig } from "next-auth";

export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // one shift

/**
 * The part of the Auth.js config that needs no database: used by src/proxy.ts for fast,
 * cookie-only checks. src/server/lib/auth.ts adds the credentials provider on top.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.authAt = Date.now();
        token.sid = crypto.randomUUID();
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid && token.role) {
        session.user.id = token.uid;
        session.user.role = token.role;
        session.user.authAt = token.authAt;
        session.user.sid = token.sid;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
