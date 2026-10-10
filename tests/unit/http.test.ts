import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Errors } from "@/server/lib/errors";
import { handle, toErrorResponse } from "@/server/lib/http";

describe("API error shape", () => {
  it("maps AppError to its status and code", async () => {
    const res = toErrorResponse(Errors.notFound("Batch B-2026-0001"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message:
          "Batch B-2026-0001 was not found. It may have been removed. Go back to the list and open it again.",
      },
    });
  });

  it("maps Zod errors to 422 with the issues as details", async () => {
    const parsed = z.object({ quota: z.number().int().positive() }).safeParse({ quota: -1 });
    const res = toErrorResponse(parsed.error);
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details[0].path).toEqual(["quota"]);
  });

  it("hides unknown errors behind a 500 without leaking the message", async () => {
    const res = await handle(async () => {
      throw new Error("password=hunter2");
    })();
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });
});
