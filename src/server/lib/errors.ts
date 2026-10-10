/**
 * Application errors carry an HTTP status and a stable machine-readable code.
 * Controllers convert them to the one API error shape: { error: { code, message, details? } }.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

type IssueLike = { message?: unknown };

/**
 * The form-level line for a failed validation. It is never a bare "something is wrong": one issue
 * is shown as itself, several are counted and the first one is quoted so the person knows where
 * to start. Each field's own message still sits under that field.
 */
export function summarizeIssues(issues: unknown): string {
  const messages = Array.isArray(issues)
    ? (issues as IssueLike[]).flatMap((i) => (typeof i?.message === "string" ? [i.message] : []))
    : [];
  if (messages.length === 0)
    return "One of the fields can't be saved as it is. Check each field and try again.";
  if (messages.length === 1) return messages[0];
  return `${messages.length} fields need fixing. Start with this one: ${messages[0]}`;
}

export const Errors = {
  badRequest: (message: string, details?: unknown) =>
    new AppError(400, "BAD_REQUEST", message, details),
  unauthenticated: (message = "Sign in to continue.") =>
    new AppError(401, "UNAUTHENTICATED", message),
  forbidden: (
    message = "Your role doesn't have access to this. Ask the System Admin if you need it.",
  ) => new AppError(403, "FORBIDDEN", message),
  notFound: (what: string) =>
    new AppError(
      404,
      "NOT_FOUND",
      `${what} was not found. It may have been removed. Go back to the list and open it again.`,
    ),
  tooLarge: (message: string) => new AppError(413, "PAYLOAD_TOO_LARGE", message),
  conflict: (message: string, details?: unknown) => new AppError(409, "CONFLICT", message, details),
  /** Optimistic-concurrency miss: someone else changed the record after the caller loaded it. */
  stale: (message: string) => new AppError(409, "STALE", message),
  validation: (details: unknown) =>
    new AppError(422, "VALIDATION_FAILED", summarizeIssues(details), details),
};
