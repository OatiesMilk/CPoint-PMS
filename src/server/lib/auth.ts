import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/server/validators/auth.validator";
import { verifyCredentials } from "@/server/services/auth.service";
import { authConfig } from "./auth.config";

/** Error codes surfaced to the login form (never the reason for an unknown email). */
export class InactiveAccountError extends CredentialsSignin {
  code = "inactive";
}
export class LockedAccountError extends CredentialsSignin {
  code: string;
  constructor(minutesLeft: number) {
    super();
    this.code = `locked:${minutesLeft}`;
  }
}

export function requestMeta(request: Request) {
  return {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const result = await verifyCredentials(parsed.data, requestMeta(request));
        if (result.ok) return result.user;
        if (result.reason === "inactive") throw new InactiveAccountError();
        if (result.reason === "locked") throw new LockedAccountError(result.minutesLeft);
        return null; // generic "Email or password is incorrect"
      },
    }),
  ],
});
