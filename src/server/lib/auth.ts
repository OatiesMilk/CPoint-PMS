import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/server/validators/auth.validator";
import { verifyCredentials } from "@/server/services/auth.service";
import { isDemoSignIn } from "@/server/services/demo-tools.service";
import { authConfig } from "./auth.config";
import { logger } from "./logger";

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
  // Route Auth.js logs through pino. Wrong passwords are expected (and audited), not errors.
  logger: {
    error(error) {
      if (error instanceof CredentialsSignin || error.name === "CredentialsSignin") return;
      logger.error({ err: error }, "Auth.js error");
    },
    warn(code) {
      logger.warn({ code }, "Auth.js warning");
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
        method: { type: "text" },
      },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        // Only a demo account with the demo tools on is labelled a demo sign-in (D-101).
        const method =
          raw?.method === "demo" && isDemoSignIn(parsed.data.email) ? ("demo" as const) : undefined;
        const result = await verifyCredentials({ ...parsed.data, method }, requestMeta(request));
        if (result.ok) return result.user;
        if (result.reason === "inactive") throw new InactiveAccountError();
        if (result.reason === "locked") throw new LockedAccountError(result.minutesLeft);
        return null; // generic "Email or password is incorrect"
      },
    }),
  ],
});
