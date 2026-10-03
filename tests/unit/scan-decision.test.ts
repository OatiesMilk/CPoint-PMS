import { beforeEach, describe, expect, it, vi } from "vitest";

const scans = { findScanById: vi.fn(), updateScanDecision: vi.fn(async () => ({ count: 1 })) };
const outcomes = {
  findLiveOutcomes: vi.fn(),
  cancelReworkTicket: vi.fn(),
  cancelSalvageItem: vi.fn(),
  insertReworkTicket: vi.fn(),
  insertSalvageItem: vi.fn(),
};
const recordAudit = vi.fn();
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/scan.model", () => scans);
vi.mock("@/server/models/outcome.model", () => outcomes);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const { decideScan } = await import("@/server/services/scan-decision.service");
const qi = { id: "qi1" };
const now = new Date("2026-10-02T08:00:00.000Z");

function scan(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    batchId: "b1",
    aiVerdict: "REJECT",
    finalVerdict: "REJECT",
    status: "DECIDED",
    batch: { id: "b1", code: "B-2026-0001", status: "IN_PROGRESS" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  outcomes.findLiveOutcomes.mockResolvedValue({ rework: null, salvage: null });
});

describe("overriding an automatic decision", () => {
  it("requires a reason", async () => {
    scans.findScanById.mockResolvedValue(scan());
    await expect(
      decideScan("s1", { verdict: "REWORK", expectedFinalVerdict: "REJECT" }, qi, now),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("swaps the salvage item for a rework ticket and marks the override", async () => {
    scans.findScanById.mockResolvedValue(scan());
    outcomes.findLiveOutcomes.mockResolvedValue({
      rework: null,
      salvage: { id: "sv1", status: "AVAILABLE" },
    });
    const result = await decideScan(
      "s1",
      { verdict: "REWORK", reason: "Only a surface scuff", expectedFinalVerdict: "REJECT" },
      qi,
      now,
    );
    expect(result).toEqual({ id: "s1", finalVerdict: "REWORK", isOverride: true });
    expect(scans.updateScanDecision).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        finalVerdict: "REWORK",
        isOverride: true,
        overrideReason: "Only a surface scuff",
        decidedById: "qi1",
      }),
      { finalVerdict: "REJECT" },
      "tx",
    );
    expect(outcomes.cancelSalvageItem).toHaveBeenCalledWith("sv1", "tx");
    expect(outcomes.insertReworkTicket).toHaveBeenCalledWith("s1", "tx", now);
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "scan.override" }),
    );
  });

  it("an override back to the AI's verdict is not counted as an override", async () => {
    scans.findScanById.mockResolvedValue(scan({ finalVerdict: "REWORK", aiVerdict: "REJECT" }));
    outcomes.findLiveOutcomes.mockResolvedValue({
      rework: { id: "rw1", status: "OPEN" },
      salvage: null,
    });
    const result = await decideScan(
      "s1",
      { verdict: "REJECT", reason: "Looked again, it is a hole", expectedFinalVerdict: "REWORK" },
      qi,
      now,
    );
    expect(result.isOverride).toBe(false);
    expect(outcomes.cancelReworkTicket).toHaveBeenCalledWith("rw1", now, "tx");
    expect(outcomes.insertSalvageItem).toHaveBeenCalledWith(
      { scanId: "s1", originBatchId: "b1", createdAt: now },
      "tx",
    );
  });

  it("refuses once the repair station has started", async () => {
    scans.findScanById.mockResolvedValue(scan({ aiVerdict: "REWORK", finalVerdict: "REWORK" }));
    outcomes.findLiveOutcomes.mockResolvedValue({
      rework: { id: "rw1", status: "IN_PROGRESS" },
      salvage: null,
    });
    await expect(
      decideScan(
        "s1",
        { verdict: "PASS", reason: "Fine", expectedFinalVerdict: "REWORK" },
        qi,
        now,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("refuses once the rejected section was reused", async () => {
    scans.findScanById.mockResolvedValue(scan());
    outcomes.findLiveOutcomes.mockResolvedValue({
      rework: null,
      salvage: { id: "sv1", status: "ASSIGNED" },
    });
    await expect(
      decideScan(
        "s1",
        { verdict: "PASS", reason: "Fine", expectedFinalVerdict: "REJECT" },
        qi,
        now,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("refuses the same verdict again", async () => {
    scans.findScanById.mockResolvedValue(scan());
    await expect(
      decideScan(
        "s1",
        { verdict: "REJECT", reason: "Sure", expectedFinalVerdict: "REJECT" },
        qi,
        now,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("resolving a NEEDS_REVIEW scan", () => {
  const pending = () =>
    scan({ aiVerdict: "NEEDS_REVIEW", finalVerdict: null, status: "PENDING_REVIEW" });

  it("needs no reason, isn't an override, and opens the matching outcome", async () => {
    scans.findScanById.mockResolvedValue(pending());
    const result = await decideScan(
      "s1",
      { verdict: "REWORK", expectedFinalVerdict: null },
      qi,
      now,
    );
    expect(result.isOverride).toBe(false);
    expect(outcomes.insertReworkTicket).toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "scan.review" }),
    );
  });

  it("returns 409 STALE when someone decided first", async () => {
    scans.findScanById.mockResolvedValue(pending());
    scans.updateScanDecision.mockResolvedValueOnce({ count: 0 });
    await expect(
      decideScan("s1", { verdict: "PASS", expectedFinalVerdict: null }, qi, now),
    ).rejects.toMatchObject({
      status: 409,
      code: "STALE",
    });
  });

  it("returns 409 STALE when the page showed an older decision", async () => {
    scans.findScanById.mockResolvedValue(scan());
    await expect(
      decideScan("s1", { verdict: "PASS", expectedFinalVerdict: null }, qi, now),
    ).rejects.toMatchObject({
      code: "STALE",
    });
  });
});

it("refuses changes on a closed batch", async () => {
  scans.findScanById.mockResolvedValue(
    scan({ batch: { id: "b1", code: "B-2026-0001", status: "COMPLETED" } }),
  );
  await expect(
    decideScan("s1", { verdict: "PASS", reason: "x y z", expectedFinalVerdict: "REJECT" }, qi, now),
  ).rejects.toMatchObject({ status: 409 });
});
