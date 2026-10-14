import { describe, expect, it } from "vitest";
import type { PurchaseRequestStatus } from "@/lib/domain";
import {
  daysLeftLabel,
  decisionEventNote,
  decisionSummary,
  deriveRequestStatus,
  formatRequestCode,
  isWellStocked,
  isWorkingDay,
  NEEDED_BY_MAX_DAYS,
  requestLabelsFor,
  stockGuidanceLine,
  suggestedDecision,
  summarizeItems,
  transition,
  URGENCY_BANDS,
  urgencyCutoffs,
  urgencyDateRange,
  urgencyFor,
  urgencyOf,
  WELL_STOCKED_FACTOR,
  wellStockedReason,
  WORKING_WEEKDAYS,
  workingDaysUntil,
  deriveReceiptStatus,
  isDeliveryLate,
  OPEN_STATUSES,
  outstandingQuantity,
  shortfallNote,
  STATUS_LABELS,
  STATUS_ORDER,
  type PurchaseAction,
  type Urgency,
} from "@/lib/procurement-rules";

const STATUSES: PurchaseRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "REJECTED",
  "CANCELLED",
  "RECEIVED",
];
const ALLOWED: Record<
  PurchaseAction,
  { from: PurchaseRequestStatus[]; to: PurchaseRequestStatus }
> = {
  approve: { from: ["PENDING"], to: "APPROVED" },
  reject: { from: ["PENDING"], to: "REJECTED" },
  cancel: { from: ["PENDING", "APPROVED", "ORDERED"], to: "CANCELLED" },
  order: { from: ["APPROVED"], to: "ORDERED" },
  receive: { from: ["ORDERED", "PARTIALLY_RECEIVED"], to: "RECEIVED" },
  close_short: { from: ["PARTIALLY_RECEIVED"], to: "RECEIVED" },
};

describe("purchase request lifecycle (D-029, D-041 to D-043)", () => {
  for (const [action, { from, to }] of Object.entries(ALLOWED) as [
    PurchaseAction,
    { from: PurchaseRequestStatus[]; to: PurchaseRequestStatus },
  ][]) {
    it(`${action}: from ${from.join(" or ")} only, with a one-sentence refusal elsewhere`, () => {
      for (const status of from)
        expect(transition(status, action)).toEqual({ ok: true, from: status, to });
      for (const status of STATUSES.filter((s) => !from.includes(s))) {
        const result = transition(status, action);
        expect(result.ok).toBe(false);
        // Every refusal says what the rule is, or what to do instead.
        if (!result.ok)
          expect(result.reason).toMatch(
            /\.( This one is [a-z ]+\.| Use Close short[^.]+\.)?$|^Mark this request/,
          );
      }
    });
  }

  it("covers every status and every action", () => {
    expect([...STATUS_ORDER].sort()).toEqual([...STATUSES].sort());
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...STATUSES].sort());
    expect(OPEN_STATUSES).toEqual(["PENDING", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED"]);
  });

  it("says why a request can't be cancelled, and what to do instead (D-043)", () => {
    expect(transition("RECEIVED", "cancel")).toEqual({
      ok: false,
      reason: "Only pending, approved or ordered requests can be cancelled. This one is received.",
    });
    expect(transition("PARTIALLY_RECEIVED", "cancel")).toEqual({
      ok: false,
      reason:
        "Part of this request has already arrived, so it can't be cancelled. Use Close short for what won't come.",
    });
  });

  it("asks for the order before a delivery", () => {
    expect(transition("APPROVED", "receive")).toEqual({
      ok: false,
      reason: "Mark this request as ordered first, then record the delivery.",
    });
    expect(transition("PENDING", "order")).toEqual({
      ok: false,
      reason: "Only an approved request can be marked as ordered. This one is pending.",
    });
    expect(transition("ORDERED", "close_short")).toEqual({
      ok: false,
      reason: "Only a partly received request can be closed short. This one is ordered.",
    });
  });

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

describe("urgency from the needed-by date (D-037)", () => {
  const monday = "2026-10-05";

  it("counts working days, Monday to Friday", () => {
    expect(isWorkingDay("2026-10-09")).toBe(true); // Friday
    expect(isWorkingDay("2026-10-10")).toBe(false); // Saturday
    expect(isWorkingDay("2026-10-11")).toBe(false); // Sunday
    expect(workingDaysUntil(monday, monday)).toBe(0);
    expect(workingDaysUntil("2026-10-09", monday)).toBe(4);
    expect(workingDaysUntil("2026-10-12", monday)).toBe(5); // over the weekend
    expect(workingDaysUntil("2026-10-12", "2026-10-09")).toBe(1); // Friday → Monday
    expect(workingDaysUntil("2026-10-02", monday)).toBe(-1); // Friday was one working day ago
  });

  it("is High up to 3 working days, Medium up to 7, Low after that", () => {
    const cases: [string, Urgency][] = [
      ["2026-10-05", "HIGH"], // today
      ["2026-10-08", "HIGH"], // 3 working days
      ["2026-10-09", "MEDIUM"], // 4
      ["2026-10-14", "MEDIUM"], // 7
      ["2026-10-15", "LOW"], // 8
      ["2027-04-03", "LOW"], // 180 days ahead
    ];
    for (const [neededBy, urgency] of cases) expect(urgencyFor(neededBy, monday)).toBe(urgency);
  });

  it("is High when overdue, and when only a weekend is left", () => {
    expect(urgencyFor("2026-10-02", monday)).toBe("HIGH");
    expect(urgencyFor("2026-01-01", monday)).toBe("HIGH");
    expect(urgencyFor("2026-10-11", "2026-10-09")).toBe("HIGH"); // Friday, needed Sunday
    expect(urgencyFor("2026-10-14", "2026-10-09")).toBe("HIGH"); // Friday → Wednesday: 3
    expect(urgencyFor("2026-10-15", "2026-10-09")).toBe("MEDIUM");
  });

  it("stops once a request is closed", () => {
    const date = new Date("2026-10-06T00:00:00.000Z");
    expect(urgencyOf("PENDING", date, monday)).toBe("HIGH");
    expect(urgencyOf("APPROVED", date, monday)).toBe("HIGH");
    for (const status of ["RECEIVED", "REJECTED", "CANCELLED"] as const)
      expect(urgencyOf(status, date, monday)).toBeNull();
  });

  it("says how long is left in plain words", () => {
    expect(daysLeftLabel(monday, monday)).toBe("today");
    expect(daysLeftLabel("2026-10-06", monday)).toBe("in 1 working day");
    expect(daysLeftLabel("2026-10-07", monday)).toBe("in 2 working days");
    expect(daysLeftLabel("2026-10-02", monday)).toBe("overdue by 1 working day");
    expect(daysLeftLabel("2026-09-28", monday)).toBe("overdue by 5 working days");
    expect(daysLeftLabel("2026-10-11", "2026-10-09")).toBe("this weekend");
    expect(daysLeftLabel("2026-10-10", "2026-10-11")).toBe("overdue");
  });

  it("gives the date ranges the list filters and counts by, matching urgencyFor", () => {
    expect(urgencyCutoffs(monday)).toEqual({
      highThrough: "2026-10-08",
      mediumThrough: "2026-10-14",
    });
    // From a Friday the High band runs over the weekend to Wednesday.
    expect(urgencyCutoffs("2026-10-09").highThrough).toBe("2026-10-14");
    expect(urgencyDateRange("HIGH", monday)).toEqual({ through: "2026-10-08" });
    expect(urgencyDateRange("MEDIUM", monday)).toEqual({
      after: "2026-10-08",
      through: "2026-10-14",
    });
    expect(urgencyDateRange("LOW", monday)).toEqual({ after: "2026-10-14" });
    // Every day of the next four weeks lands in the band its range says, from any weekday.
    for (let start = 0; start < 7; start += 1) {
      const today = new Date(Date.UTC(2026, 9, 5 + start)).toISOString().slice(0, 10);
      const { highThrough, mediumThrough } = urgencyCutoffs(today);
      for (let d = 0; d < 28; d += 1) {
        const day = new Date(Date.UTC(2026, 9, 5 + start + d)).toISOString().slice(0, 10);
        const expected = day <= highThrough ? "HIGH" : day <= mediumThrough ? "MEDIUM" : "LOW";
        expect(urgencyFor(day, today)).toBe(expected);
      }
    }
  });

  it("keeps the thresholds in one place", () => {
    expect(URGENCY_BANDS).toEqual({ highMaxDays: 3, mediumMaxDays: 7 });
    expect(WORKING_WEEKDAYS).toEqual([1, 2, 3, 4, 5]);
    expect(NEEDED_BY_MAX_DAYS).toBe(180);
  });
});

describe("item decisions (D-039)", () => {
  it("derives the request's status from its items", () => {
    expect(deriveRequestStatus(["APPROVED", "APPROVED"])).toBe("APPROVED"); // all approved
    expect(deriveRequestStatus(["APPROVED", "REJECTED", "REJECTED"])).toBe("APPROVED"); // mixed
    expect(deriveRequestStatus(["REJECTED", "REJECTED"])).toBe("REJECTED"); // all rejected
    expect(deriveRequestStatus(["APPROVED"])).toBe("APPROVED");
    expect(deriveRequestStatus(["REJECTED"])).toBe("REJECTED");
  });

  it("stays pending until every item has a decision", () => {
    expect(deriveRequestStatus(["PENDING", "PENDING"])).toBe("PENDING");
    expect(deriveRequestStatus(["APPROVED", "PENDING"])).toBe("PENDING");
    expect(deriveRequestStatus(["REJECTED", "PENDING"])).toBe("PENDING");
    expect(deriveRequestStatus([])).toBe("PENDING");
  });

  it("summarizes the decision for the requester", () => {
    const lines = (...d: ("PENDING" | "APPROVED" | "REJECTED")[]) =>
      d.map((decision) => ({ decision }));
    expect(decisionSummary(lines("APPROVED", "REJECTED"))).toEqual({
      approved: 1,
      rejected: 1,
      total: 2,
      label: "1 of 2 items approved",
    });
    expect(decisionSummary(lines("APPROVED", "APPROVED", "REJECTED")).label).toBe(
      "2 of 3 items approved",
    );
    expect(decisionSummary(lines("APPROVED")).label).toBe("1 of 1 item approved");
    expect(decisionSummary(lines("REJECTED", "REJECTED")).label).toBe("0 of 2 items approved");
  });

  it("writes one timeline note that lists the items, grouped by reason", () => {
    expect(
      decisionEventNote(
        [
          { itemName: "Adhesive", decision: "APPROVED" },
          { itemName: "Nails", decision: "REJECTED", reason: "Stock is still high." },
          { itemName: "Thread", decision: "REJECTED", reason: "Stock is still high." },
          { itemName: "Eyelets", decision: "REJECTED", reason: "Not needed" },
        ],
        "Ordering today",
      ),
    ).toBe(
      "Approved: Adhesive.\nRejected: Nails, Thread. Stock is still high.\nRejected: Eyelets. Not needed\nOrdering today",
    );
    expect(decisionEventNote([{ itemName: "Adhesive", decision: "APPROVED" }])).toBe(
      "Approved: Adhesive.",
    );
  });
});

describe("stock guidance (D-040)", () => {
  it("keeps the factor in one place", () => {
    expect(WELL_STOCKED_FACTOR).toBe(2);
  });

  it("calls an item well stocked only above twice its reorder level", () => {
    expect(isWellStocked(20, 10)).toBe(false); // exactly 2×: not well stocked
    expect(isWellStocked(20.01, 10)).toBe(true); // just above
    expect(isWellStocked(40, 10)).toBe(true);
    expect(isWellStocked(19.99, 10)).toBe(false);
    expect(isWellStocked(0.3, 0.1)).toBe(true); // hundredths, so 0.1 × 2 stays exact
    expect(isWellStocked(0.2, 0.1)).toBe(false);
  });

  it("never calls an item well stocked when no reorder level is set", () => {
    expect(isWellStocked(500, 0)).toBe(false);
    expect(isWellStocked(0, 0)).toBe(false);
  });

  it("suggests Reject for a well-stocked item and Approve for a low or empty one", () => {
    expect(suggestedDecision({ onHand: 40, reorderLevel: 10 })).toBe("REJECTED");
    expect(suggestedDecision({ onHand: 10, reorderLevel: 10 })).toBe("APPROVED"); // low
    expect(suggestedDecision({ onHand: 3, reorderLevel: 10 })).toBe("APPROVED");
    expect(suggestedDecision({ onHand: 0, reorderLevel: 10 })).toBe("APPROVED"); // out
    expect(suggestedDecision({ onHand: 0, reorderLevel: 0 })).toBe("APPROVED"); // out, no level
  });

  it("suggests nothing in between, with no reorder level, or for an item not in inventory", () => {
    expect(suggestedDecision({ onHand: 15, reorderLevel: 10 })).toBeNull();
    expect(suggestedDecision({ onHand: 20, reorderLevel: 10 })).toBeNull(); // exactly 2×
    expect(suggestedDecision({ onHand: 500, reorderLevel: 0 })).toBeNull();
    expect(suggestedDecision(null)).toBeNull();
  });

  it("words the reason and the stock line for the Floor Manager", () => {
    expect(wellStockedReason(40, 10, "box")).toBe(
      "Stock is still high (40 boxes on hand, reorder at 10).",
    );
    expect(stockGuidanceLine({ onHand: 40, reorderLevel: 10, unit: "box" }, 38)).toBe(
      "On hand 40 boxes · reorder at 10 · was 38 when requested",
    );
    expect(stockGuidanceLine({ onHand: 1, reorderLevel: 5, unit: "roll" }, null)).toBe(
      "On hand 1 roll · reorder at 5",
    );
  });
});

describe("names by role (D-035)", () => {
  it("calls it Material requests for a Shoe Constructor and Procurement for the rest", () => {
    expect(requestLabelsFor("SHOE_CONSTRUCTOR")).toMatchObject({
      nav: "Material requests",
      create: "New material request",
      one: "material request",
    });
    for (const role of ["FLOOR_MANAGER", "SYSTEM_ADMIN", "QUALITY_INSPECTOR"] as const)
      expect(requestLabelsFor(role)).toMatchObject({
        nav: "Procurement",
        create: "New purchase request",
      });
  });
});

describe("deliveries (D-042)", () => {
  const line = (quantity: number, receivedQuantity: number, decision = "APPROVED") => ({
    itemName: "Black cowhide",
    unit: "roll",
    decision: decision as "APPROVED" | "REJECTED",
    quantity,
    receivedQuantity,
  });

  it("works out what is still to come in hundredths, never below zero", () => {
    expect(outstandingQuantity(6, 0)).toBe(6);
    expect(outstandingQuantity(6, 2.5)).toBe(3.5);
    expect(outstandingQuantity(6, 6)).toBe(0);
    // 0.1 + 0.2 is not 0.3 in floating point; in hundredths it is.
    expect(outstandingQuantity(0.3, 0.1 + 0.2)).toBe(0);
    expect(outstandingQuantity(1.1, 0.4)).toBe(0.7);
    expect(outstandingQuantity(2, 2.01)).toBe(0);
  });

  it("is partly received while an approved item is outstanding, received once none is", () => {
    expect(deriveReceiptStatus([line(4, 0), line(2, 2)])).toBe("PARTIALLY_RECEIVED");
    expect(deriveReceiptStatus([line(4, 3.99)])).toBe("PARTIALLY_RECEIVED");
    expect(deriveReceiptStatus([line(4, 4), line(2, 2)])).toBe("RECEIVED");
    // A rejected item isn't coming, so it never keeps a request open.
    expect(deriveReceiptStatus([line(4, 4), line(9, 0, "REJECTED")])).toBe("RECEIVED");
  });

  it("lists what never arrived, per item, skipping what did", () => {
    expect(
      shortfallNote([
        line(4, 2),
        { ...line(5, 5), itemName: "Shoe tacks", unit: "box" },
        { ...line(1, 0), itemName: "Brass eyelets", unit: "pack" },
        { ...line(3, 0, "REJECTED"), itemName: "Thread", unit: "spool" },
      ]),
    ).toBe("2 rolls of Black cowhide, 1 pack of Brass eyelets");
    expect(shortfallNote([line(4, 4)])).toBe("");
  });

  it("is late only while a delivery is awaited and the expected date has passed (D-041)", () => {
    const today = "2026-10-09";
    for (const status of ["ORDERED", "PARTIALLY_RECEIVED"] as const) {
      expect(isDeliveryLate(status, "2026-10-08", today)).toBe(true);
      expect(isDeliveryLate(status, new Date("2026-10-08T00:00:00.000Z"), today)).toBe(true);
      // Due today is not late yet.
      expect(isDeliveryLate(status, "2026-10-09", today)).toBe(false);
      expect(isDeliveryLate(status, "2026-10-10", today)).toBe(false);
      expect(isDeliveryLate(status, null, today)).toBe(false);
    }
    for (const status of ["PENDING", "APPROVED", "RECEIVED", "REJECTED", "CANCELLED"] as const)
      expect(isDeliveryLate(status, "2026-10-01", today)).toBe(false);
  });

  it("keeps urgency counting until the request is closed", () => {
    for (const status of OPEN_STATUSES)
      expect(urgencyOf(status, "2026-10-08", "2026-10-05")).toBe("HIGH");
  });
});

describe("helpers", () => {
  it("formats codes like batch codes", () => {
    expect(formatRequestCode(2026, 7)).toBe("MR-2026-0007");
    expect(formatRequestCode(2026, 12345)).toBe("MR-2026-12345");
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
