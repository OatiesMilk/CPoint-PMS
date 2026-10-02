import { ZodError } from "zod";
import { AppError } from "./errors";
import { logger } from "./logger";

/** What a server action returns to its form or button. Never carries internals. */
export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

type Issue = { path: PropertyKey[]; message: string };

function fieldErrorsFrom(issues: Issue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export function toActionError(error: unknown, context: string): ActionResult<never> {
  if (error instanceof ZodError) {
    return {
      ok: false,
      error: "Some fields need fixing.",
      fieldErrors: fieldErrorsFrom(error.issues),
    };
  }
  if (error instanceof AppError) {
    const fieldErrors = Array.isArray(error.details)
      ? fieldErrorsFrom(error.details as Issue[])
      : undefined;
    return { ok: false, error: error.message, code: error.code, fieldErrors };
  }
  logger.error({ err: error }, `${context} failed`);
  return { ok: false, error: "Something failed on our side. Nothing was changed. Try again." };
}
