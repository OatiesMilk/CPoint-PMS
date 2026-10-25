import { AuthError, CredentialsSignin } from "next-auth";
import { ROLE_HOME } from "@/lib/domain";
import { AppError } from "@/server/lib/errors";
import { handle, json, readJsonBody } from "@/server/lib/http";
import { signIn } from "@/server/lib/auth";
import { loginErrorMessage } from "@/server/services/auth.service";
import {
  demoReset,
  demoSignInCredentials,
  demoToolsEnabled,
  demoToolsOff,
} from "@/server/services/demo-tools.service";
import { demoResetSchema, demoSignInSchema } from "@/server/validators/demo.validator";

/**
 * The demo tools on the login page (D-101). The only API routes without requireApiPermission:
 * nobody is signed in yet. Both answer 404 before reading the body while the flag is off.
 */
export const demoController = {
  /** POST /api/v1/demo/sign-in  { role }: signs in as that demo account; returns where to go. */
  signIn: handle(async (request: Request) => {
    if (!demoToolsEnabled()) throw demoToolsOff();
    const { role } = demoSignInSchema.parse(await readJsonBody(request));
    const { email, password } = await demoSignInCredentials(role);
    try {
      await signIn("credentials", { email, password, method: "demo", redirect: false });
    } catch (error) {
      if (error instanceof CredentialsSignin)
        throw new AppError(401, "SIGN_IN_FAILED", loginErrorMessage(error.code));
      if (error instanceof AuthError)
        throw new AppError(
          500,
          "SIGN_IN_FAILED",
          "Sign-in failed on our side. Nothing was changed. Try again in a moment.",
        );
      throw error;
    }
    return json({ data: { redirectTo: ROLE_HOME[role] } });
  }),

  /** POST /api/v1/demo/reset  { confirm: "RESET" }: the demo:reset, then a fresh demo week. */
  reset: handle(async (request: Request) => {
    if (!demoToolsEnabled()) throw demoToolsOff();
    demoResetSchema.parse(await readJsonBody(request));
    const result = await demoReset();
    return json({
      data: {
        removed: result.removed,
        demoWeek: result.demoWeek,
      },
    });
  }),
};
