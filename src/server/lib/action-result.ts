import { ZodError } from "zod";
import { AppError, summarizeIssues } from "./errors";
import { logger } from "./logger";

/** What a server action returns to its form or button. Never carries internals. */
export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

type Issue = { path: PropertyKey[]; message: string };

/**
 * One message per field, keyed by the field's full path joined with dots ("quantity",
 * "lines.2.quantity"), so a form can put each message under the exact input it is about.
 */
function fieldErrorsFrom(issues: Issue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export function toActionError(error: unknown, context: string): ActionResult<never> {
  if (error instanceof ZodError) {
    return {
      ok: false,
      error: summarizeIssues(error.issues),
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
  return {
    ok: false,
    error: `${context} couldn't be saved because the server hit an error. Nothing was changed. Try again in a moment.`,
  };
}
