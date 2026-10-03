import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/domain";

// The JWT and session carry only the user id, role and sign-in time. Everything else is re-read from the
// database on each request by the guard (src/server/policies/guard.ts).
declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: { id: string; role: Role; authAt?: number; sid?: string } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    /** When the user signed in (ms). Unlike `iat`, it isn't renewed when the token is refreshed (D-024). */
    authAt?: number;
    /** This sign-in's id; sign-out revokes it server-side, so a stale cookie can't come back. */
    sid?: string;
  }
}
