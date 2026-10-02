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

export const Errors = {
  badRequest: (message: string, details?: unknown) =>
    new AppError(400, "BAD_REQUEST", message, details),
  unauthenticated: (message = "Sign in to continue.") =>
    new AppError(401, "UNAUTHENTICATED", message),
  forbidden: (message = "Your role can't do this.") => new AppError(403, "FORBIDDEN", message),
  notFound: (what: string) => new AppError(404, "NOT_FOUND", `${what} was not found.`),
  conflict: (message: string, details?: unknown) => new AppError(409, "CONFLICT", message, details),
  /** Optimistic-concurrency miss: someone else changed the record after the caller loaded it. */
  stale: (message: string) => new AppError(409, "STALE", message),
  validation: (details: unknown) =>
    new AppError(422, "VALIDATION_FAILED", "Some fields need fixing.", details),
};
