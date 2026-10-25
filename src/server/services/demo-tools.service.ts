/**
 * The demo tools on the login page (Phase 28, D-101, C-17, A-23): sign in as a demo account, and
 * Reset demo data. For the demo only: they exist when DEMO_LOGIN_TOOLS and SEED_DEMO_USERS are both
 * on, and answer 404 otherwise. Nobody is signed in when they run, so the fence is the flag, four
 * fixed accounts, a password that stays on the server, one reset at a time and the audit log.
 */
import { ROLE_LABELS, type Role } from "@/lib/domain";
import { getEnv } from "@/server/lib/env";
import { AppError } from "@/server/lib/errors";
import { findUserByEmail } from "@/server/models/user.model";
import { DEMO_USERS } from "./bootstrap.service";
import { resetDemoData, resetKeep, type ResetResult } from "./demo-reset.service";

/** The four buttons, in this order. */
const SIGN_IN_ORDER: Role[] = [
  "FLOOR_MANAGER",
  "QUALITY_INSPECTOR",
  "SYSTEM_ADMIN",
  "SHOE_CONSTRUCTOR",
];

export type DemoSignIn = { role: Role; email: string; name: string; label: string };

export const DEMO_SIGN_INS: DemoSignIn[] = SIGN_IN_ORDER.map((role) => {
  const user = DEMO_USERS.find((u) => u.role === role)!;
  return { role, email: user.email, name: user.name, label: `${ROLE_LABELS[role]} · ${user.name}` };
});

/** Are the demo tools on? Both flags: the tools need the demo accounts (A-23). */
export function demoToolsEnabled(): boolean {
  const env = getEnv();
  return env.DEMO_LOGIN_TOOLS && env.SEED_DEMO_USERS;
}

/** Is this a demo sign-in the tools may label `method: "demo"` in the audit log? */
export function isDemoSignIn(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return demoToolsEnabled() && DEMO_SIGN_INS.some((d) => d.email === normalized);
}

/** The same answer as any unknown path, so nothing tells a visitor the tools exist. */
export function demoToolsOff(): AppError {
  return new AppError(404, "NOT_FOUND", "This page was not found.");
}

/**
 * The account and password for a demo sign-in. The password is the server's DEMO_USER_PASSWORD and
 * never goes to the browser; the sign-in itself takes the normal credentials path.
 */
export async function demoSignInCredentials(
  role: Role,
): Promise<{ email: string; password: string }> {
  if (!demoToolsEnabled()) throw demoToolsOff();
  const demo = DEMO_SIGN_INS.find((d) => d.role === role)!;
  const password = getEnv().DEMO_USER_PASSWORD;
  if (!password)
    throw new AppError(
      409,
      "DEMO_PASSWORD_MISSING",
      "DEMO_USER_PASSWORD isn't set on the server. Add it to .env and restart the app.",
    );
  const user = await findUserByEmail(demo.email);
  if (!user)
    throw new AppError(
      409,
      "DEMO_ACCOUNT_MISSING",
      `${demo.name}'s account (${demo.email}) isn't on this database. Start the app with SEED_DEMO_USERS=true to create it.`,
    );
  return { email: demo.email, password };
}

let running: Promise<ResetResult> | null = null;

/** Is a reset from the login page running now? */
export function demoResetRunning(): boolean {
  return running !== null;
}

/**
 * Reset demo data: the same as `npm run demo:reset -- --yes` (D-056), one at a time. A production
 * build may run it only here, while the flag is on (D-101). The app runs as one process (one `app`
 * container), so a lock in memory is enough.
 */
export async function demoReset(): Promise<ResetResult> {
  if (!demoToolsEnabled()) throw demoToolsOff();
  if (running)
    throw new AppError(
      409,
      "RESET_RUNNING",
      "A reset is already running. Wait for it to finish (about a minute), then sign in.",
    );
  const token = getEnv().CV_DEVICE_TOKEN;
  running = resetDemoData(resetKeep(token ? [token] : []), {
    origin: "login page",
    allowInProduction: true,
  });
  try {
    return await running;
  } finally {
    running = null;
  }
}
