"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/server/lib/auth";
import { loginSchema } from "@/server/validators/auth.validator";

export type LoginResult = { error: string; field?: "email" | "password" };

/** Only same-site relative paths, so a crafted link can't bounce users to another site. */
function safeCallbackUrl(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

function messageFor(error: CredentialsSignin): string {
  if (error.code === "inactive") {
    return "This account is deactivated. Ask a System Admin to reactivate it.";
  }
  if (error.code.startsWith("locked:")) {
    const minutes = Number(error.code.split(":")[1]) || 15;
    return `Too many wrong passwords. This account is locked for ${minutes} more minute${minutes === 1 ? "" : "s"}. Ask a System Admin if you need in sooner.`;
  }
  return "Email or password is incorrect. Check both and try again. After 5 wrong tries the account locks for 15 minutes.";
}

/** Returns an error to show, or redirects (by throwing) to the callback URL on success. */
export async function loginAction(input: {
  email: string;
  password: string;
  callbackUrl?: string;
}): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: issue.path[0] === "password" ? "password" : "email" };
  }
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeCallbackUrl(input.callbackUrl) });
  } catch (error) {
    if (error instanceof CredentialsSignin) return { error: messageFor(error) };
    if (error instanceof AuthError) {
      return { error: "Sign-in failed on our side. Nothing was changed. Try again in a moment." };
    }
    throw error; // includes the success redirect
  }
  return { error: "Sign-in did not complete. Try again." };
}
