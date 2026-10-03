import { handlers, requestMeta, signOut, auth } from "@/server/lib/auth";
import { recordSignOut } from "@/server/services/auth.service";

const LOGOUT_REASONS = new Set(["deactivated", "signed-out", "password-reset"]);

export const authController = {
  handlers,

  /**
   * GET /logout?reason=deactivated: clears the session cookie for a token that is still valid but
   * whose account was deactivated, then shows the reason on the login page.
   */
  async logout(request: Request): Promise<Response> {
    const reasonParam = new URL(request.url).searchParams.get("reason") ?? "signed-out";
    const reason = LOGOUT_REASONS.has(reasonParam) ? reasonParam : "signed-out";
    const userId = (await auth())?.user?.id;
    if (userId) await recordSignOut(userId, requestMeta(request));
    await signOut({ redirectTo: `/login?reason=${reason}` });
    return new Response(null, { status: 204 }); // not reached: signOut redirects
  },
};
