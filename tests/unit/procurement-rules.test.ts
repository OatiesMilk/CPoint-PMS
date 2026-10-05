import { describe, expect, it } from "vitest";
import type { PurchaseRequestStatus } from "@/lib/domain";
import {
  formatRequestCode,
  summarizeItems,
  transition,
  type PurchaseAction,
} from "@/lib/procurement-rules";

const STATUSES: PurchaseRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "RECEIVED",
];
const ALLOWED: Record<PurchaseAction, [PurchaseRequestStatus, PurchaseRequestStatus]> = {
  approve: ["PENDING", "APPROVED"],
  reject: ["PENDING", "REJECTED"],
  cancel: ["PENDING", "CANCELLED"],
  receive: ["APPROVED", "RECEIVED"],
};

describe("purchase request lifecycle (D-029)", () => {
  for (const [action, [from, to]] of Object.entries(ALLOWED) as [
    PurchaseAction,
    [PurchaseRequestStatus, PurchaseRequestStatus],
  ][]) {
    it(`${action}: ${from} → ${to}, refused from every other status`, () => {
      expect(transition(from, action)).toEqual({ ok: true, from, to });
      for (const status of STATUSES.filter((s) => s !== from)) {
        const result = transition(status, action);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toMatch(/^Only (a pending|an approved) request/);
      }
    });
  }

  it("closed requests take no action at all", () => {
    for (const status of ["REJECTED", "CANCELLED", "RECEIVED"] as const)
      for (const action of Object.keys(ALLOWED) as PurchaseAction[])
        expect(transition(status, action).ok).toBe(false);
  });

  it("explains a refusal in plain words", () => {
    expect(transition("RECEIVED", "approve")).toEqual({
      ok: false,
      reason: "Only a pending request can be approved. This one is received.",
    });
  });
});

describe("helpers", () => {
  it("formats codes like batch codes", () => {
    expect(formatRequestCode(2026, 7)).toBe("PR-2026-0007");
    expect(formatRequestCode(2026, 12345)).toBe("PR-2026-12345");
  });

  it("summarizes items for a table cell", () => {
    expect(summarizeItems([{ itemName: "Nails" }])).toBe("Nails");
    expect(summarizeItems([{ itemName: "Nails" }, { itemName: "Thread" }])).toBe("Nails, Thread");
    expect(
      summarizeItems([
        { itemName: "Nails" },
        { itemName: "Thread" },
        { itemName: "Cement" },
        { itemName: "Leather" },
      ]),
    ).toBe("Nails, Thread +2 more");
  });
});
