import { ZodError } from "zod";
import { AppError, Errors } from "./errors";
import { logger } from "./logger";

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };

/** Parses a JSON body, turning malformed JSON into a 400 instead of a 500. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw Errors.badRequest("The request body must be valid JSON.");
  }
}

export function json<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

/** Converts any thrown value into the standard API error response. Unknown errors are logged, not leaked. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: error.code, message: error.message, details: error.details },
    };
    return Response.json(body, { status: error.status });
  }
  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: "VALIDATION_FAILED",
        message: "Some fields need fixing.",
        details: error.issues,
      },
    };
    return Response.json(body, { status: 422 });
  }
  logger.error({ err: error }, "Unhandled error");
  const body: ApiErrorBody = {
    error: {
      code: "INTERNAL",
      message: "Something failed on our side. Your data was not changed.",
    },
  };
  return Response.json(body, { status: 500 });
}

/** Wraps a controller so every route returns the standard error shape. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
