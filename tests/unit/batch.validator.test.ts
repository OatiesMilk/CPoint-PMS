import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  batchFormSchema,
  batchListQuerySchema,
  transitionSchema,
} from "@/server/validators/batch.validator";

const base = {
  rollCode: " ROLL-1 ",
  shoeTypeId: "0199a000-0000-7000-8000-000000000001",
  receivedAt: "2026-10-01",
};

beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-02T04:00:00.000Z") }));
afterEach(() => vi.useRealTimers());

describe("batchFormSchema", () => {
  it("trims text and turns blank optional fields into undefined", () => {
    expect(batchFormSchema.parse({ ...base, supplierId: "", notes: "  " })).toEqual({
      rollCode: "ROLL-1",
      shoeTypeId: base.shoeTypeId,
      receivedAt: "2026-10-01",
      supplierId: undefined,
      notes: undefined,
    });
  });

  it("accepts today (Manila) but not tomorrow", () => {
    expect(batchFormSchema.safeParse({ ...base, receivedAt: "2026-10-02" }).success).toBe(true);
    const result = batchFormSchema.safeParse({ ...base, receivedAt: "2026-10-03" });
    expect(result.error?.issues[0].message).toBe(
      "The arrival date can't be in the future. Pick today or an earlier date.",
    );
  });

  it("ignores the old target quota (Phase 23: the daily quota replaced it)", () => {
    expect(batchFormSchema.parse({ ...base, targetQuotaPairs: "480" })).not.toHaveProperty(
      "targetQuotaPairs",
    );
  });
});

describe("transitionSchema (D-082)", () => {
  it("takes start and finish only", () => {
    expect(
      transitionSchema.safeParse({ action: "start", expectedStage: "PREPARATION" }).success,
    ).toBe(true);
    expect(transitionSchema.safeParse({ action: "finish", expectedStage: "SOLEING" }).success).toBe(
      true,
    );
    for (const action of ["advance", "move_back", "complete"]) {
      const result = transitionSchema.safeParse({ action, expectedStage: "PREPARATION" });
      expect(result.error?.issues[0].message).toBe(
        "Choose start or finish. A roll no longer moves through stages.",
      );
    }
  });
});

describe("batchListQuerySchema", () => {
  it("drops invalid filter values instead of failing the page", () => {
    expect(
      batchListQuerySchema.parse({ status: "NOPE", stage: "SOLEING", page: "-3", shoeTypeId: "x" }),
    ).toEqual({
      status: undefined,
      page: undefined,
      shoeTypeId: undefined,
    });
  });
});
