import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/domain";

// The JWT and session carry only the user id and role. Everything else is re-read from the
// database on each request by the guard (src/server/policies/guard.ts).
declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
  }
}
