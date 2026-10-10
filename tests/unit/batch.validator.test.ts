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
    expect(
      batchFormSchema.parse({ ...base, supplierId: "", targetQuotaPairs: "", notes: "  " }),
    ).toEqual({
      rollCode: "ROLL-1",
      shoeTypeId: base.shoeTypeId,
      receivedAt: "2026-10-01",
      supplierId: undefined,
      targetQuotaPairs: undefined,
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

  it.each([
    ["0", "The target quota must be at least 1 pair."],
    ["2.5", "Enter the target quota as a whole number of pairs, like 120."],
    ["100001", "The target quota can't be more than 100,000 pairs. Check the number."],
  ])("rejects quota %s", (quota, message) => {
    const result = batchFormSchema.safeParse({ ...base, targetQuotaPairs: quota });
    expect(result.error?.issues[0].message).toBe(message);
  });

  it("coerces a numeric quota from a form string", () => {
    expect(batchFormSchema.parse({ ...base, targetQuotaPairs: "480" }).targetQuotaPairs).toBe(480);
  });
});

describe("transitionSchema", () => {
  it("requires a reason only when moving back", () => {
    expect(
      transitionSchema.safeParse({ action: "advance", expectedStage: "SOLEING" }).success,
    ).toBe(true);
    const result = transitionSchema.safeParse({
      action: "move_back",
      expectedStage: "SOLEING",
      reason: " ",
    });
    expect(result.error?.issues[0].path).toEqual(["reason"]);
  });
});

describe("batchListQuerySchema", () => {
  it("drops invalid filter values instead of failing the page", () => {
    expect(
      batchListQuerySchema.parse({ status: "NOPE", stage: "SOLEING", page: "-3", shoeTypeId: "x" }),
    ).toEqual({
      status: undefined,
      stage: "SOLEING",
      page: undefined,
      shoeTypeId: undefined,
    });
  });
});
