import { describe, expect, it, vi } from "vitest";
import { ZodError, type ZodType } from "zod";
import { passwordChangeSchema, loginSchema } from "@/server/validators/auth.validator";
import {
  batchFormSchema,
  cancelSchema as batchCancelSchema,
  transitionSchema,
} from "@/server/validators/batch.validator";
import {
  activeSchema,
  inventoryItemFormSchema,
  movementSchema,
} from "@/server/validators/inventory.validator";
import {
  reworkMoveSchema,
  salvageAssignSchema,
  salvageDiscardSchema,
  salvageUnassignSchema,
} from "@/server/validators/outcome.validator";
import { decisionSchema, ingestFieldsSchema } from "@/server/validators/scan.validator";
import {
  defectTypeCreateSchema,
  referenceActiveSchema,
  shoeTypeSchema,
  supplierSchema,
  thresholdsSchema,
} from "@/server/validators/settings.validator";
import {
  attendanceDaySchema,
  saveAttendanceSchema,
} from "@/server/validators/attendance.validator";
import {
  checkInSchema,
  correctionSchema,
  pairsSchema,
  quotaPairsSchema,
  quotasSchema,
  scheduleSchema,
} from "@/server/validators/production.validator";
import { createTokenSchema } from "@/server/validators/token.validator";
import { userActiveSchema, userFormSchema } from "@/server/validators/user.validator";

vi.mock("@/server/lib/logger", () => ({ logger: { error: vi.fn() } }));
const { summarizeIssues, Errors } = await import("@/server/lib/errors");
const { toActionError } = await import("@/server/lib/action-result");

/**
 * D-038: every message names its field and says how to fix it. This feeds each form and API
 * schema the mistakes people actually make (empty, too long, wrong kind, out of range) and checks
 * that no answer is generic or one of Zod's built-in English defaults.
 */

const long = (n: number) => "x".repeat(n);

// Whole-message generics, and the openings of Zod's own defaults.
const GENERIC = [
  /^required\.?$/i,
  /^invalid\.?$/i,
  /^invalid (input|option|string|uuid|format|date|type|value|email|url)\b/i,
  /^too (small|big)\b/i,
  /^unrecognized key/i,
  /expected .+, received/i,
  /something went wrong/i,
  /some fields need fixing/i,
  /^that didn't work/i,
  /^error\b/i,
  /^(wrong|bad|not valid|not allowed)\.?$/i,
];

function messages(schema: ZodType, input: unknown): string[] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

/** Schema, then inputs that must all be refused. */
const CASES: [string, ZodType, unknown[]][] = [
  ["sign-in", loginSchema, [{}, { email: "", password: "" }, { email: "nope", password: "x" }]],
  [
    "password change",
    passwordChangeSchema,
    [
      {},
      { currentPassword: "", newPassword: "", confirmPassword: "" },
      { currentPassword: "a", newPassword: "short", confirmPassword: "different" },
      { currentPassword: "same-password-1", newPassword: "same-password-1", confirmPassword: "x" },
      { currentPassword: "a", newPassword: long(129), confirmPassword: long(129) },
    ],
  ],
  [
    "batch form",
    batchFormSchema,
    [
      {},
      { rollCode: "", shoeTypeId: "", receivedAt: "" },
      {
        rollCode: long(51),
        shoeTypeId: "nope",
        supplierId: "nope",
        receivedAt: "2999-01-01",
        notes: long(501),
        rollItemId: "nope",
      },
      { rollCode: "R1", shoeTypeId: "nope", receivedAt: "soon" },
    ],
  ],
  [
    "roll start or finish",
    transitionSchema,
    [
      {},
      { action: "fly", expectedStage: "MOON" },
      { action: "advance", expectedStage: "PREPARATION" },
      { action: "move_back", expectedStage: "PREPARATION" },
    ],
  ],
  [
    "batch cancel",
    batchCancelSchema,
    [{}, { reason: "x" }, { reason: long(301), expectedStage: "X" }],
  ],
  [
    "inventory item",
    inventoryItemFormSchema,
    [
      {},
      { sku: "", name: "", category: "", unit: "", reorderLevel: "" },
      { sku: "a b!", name: "x", category: "ROCKS", unit: long(21), reorderLevel: "-1" },
      { sku: long(21), name: long(81), category: "NAILS", unit: "box", reorderLevel: "abc" },
      { sku: "LR-1", name: "Roll", category: "NAILS", unit: "box", reorderLevel: "1.234" },
      {
        sku: "LR-1",
        name: "Roll",
        category: "NAILS",
        unit: "box",
        reorderLevel: "1",
        openingStock: "99999999",
      },
    ],
  ],
  [
    "stock movement",
    movementSchema,
    [
      {},
      { type: "SIDEWAYS" },
      { type: "IN", quantity: "" },
      { type: "IN", quantity: "0" },
      { type: "IN", quantity: "abc", reason: long(301) },
      { type: "OUT", quantity: "1.999", batchId: "nope" },
      { type: "OUT", quantity: "99999999" },
      { type: "ADJUST", counted: "-1", expectedQuantity: "abc", reason: "" },
      { type: "ADJUST", counted: "1", expectedQuantity: 1 },
      { type: "ADJUST", counted: "1", expectedQuantity: 1, reason: long(301) },
    ],
  ],
  ["item active", activeSchema, [{}, { isActive: "yes" }]],
  [
    "repair move",
    reworkMoveSchema,
    [
      {},
      { move: "fly", expectedStatus: "X" },
      { move: "start", expectedStatus: "OPEN", note: long(301) },
    ],
  ],
  [
    "salvage assign",
    salvageAssignSchema,
    [{}, { batchId: "", expectedStatus: "AVAILABLE" }, { batchId: "nope", expectedStatus: "X" }],
  ],
  ["salvage unassign", salvageUnassignSchema, [{}, { expectedStatus: "X" }]],
  [
    "salvage discard",
    salvageDiscardSchema,
    [{}, { reason: "x", expectedStatus: "AVAILABLE" }, { reason: long(301), expectedStatus: "X" }],
  ],
  [
    "scan decision",
    decisionSchema,
    [
      {},
      { verdict: "MAYBE", expectedFinalVerdict: "X" },
      { verdict: "PASS", reason: "x", expectedFinalVerdict: null },
      { verdict: "PASS", reason: long(301), expectedFinalVerdict: null },
    ],
  ],
  [
    "scan ingest (device)",
    ingestFieldsSchema,
    [
      { detections: "not json" },
      { detections: "{}" },
      { detections: JSON.stringify([{ classKey: "", confidence: 2, box: {} }]) },
      {
        detections: JSON.stringify([
          { classKey: long(51), confidence: -1, box: { x: 0.9, y: 0.9, width: 0.5, height: 0.5 } },
        ]),
        batchId: "nope",
        modelVersion: long(61),
        source: "DRONE",
        capturedAt: "yesterday",
      },
      { detections: JSON.stringify(Array.from({ length: 51 }, () => ({}))) },
      { capturedAt: "2999-01-01T00:00:00+08:00" },
    ],
  ],
  [
    "CV thresholds",
    thresholdsSchema,
    [
      {},
      { rejectPercent: "abc", reworkPercent: "" },
      { rejectPercent: "0", reworkPercent: "101" },
      { rejectPercent: "90.55", reworkPercent: "60.123" },
    ],
  ],
  [
    "defect type",
    defectTypeCreateSchema,
    [
      {},
      { key: "Has Spaces!", label: "", sortOrder: "abc" },
      { key: "ok", label: long(41), description: long(201), sortOrder: "-1" },
      { key: "ok", label: "Ok", sortOrder: "1000" },
      { key: "ok", label: "Ok", sortOrder: "1.5" },
    ],
  ],
  [
    "shoe type",
    shoeTypeSchema,
    [{}, { code: "x", name: "x" }, { code: "TOO-LONG-CODE", name: long(41), sortOrder: "x" }],
  ],
  [
    "supplier",
    supplierSchema,
    [
      {},
      { name: "x", phone: "call me" },
      { name: long(81), contactPerson: long(81), phone: long(31), notes: long(301) },
    ],
  ],
  ["reference active", referenceActiveSchema, [{}, { isActive: 1 }]],
  ["API token", createTokenSchema, [{}, { name: "" }, { name: "ab" }, { name: long(61) }]],
  [
    "user form",
    userFormSchema,
    [
      {},
      { name: "", email: "", role: "" },
      { name: "x", email: "nope", role: "KING" },
      { name: long(81), email: `${long(120)}@cpoint.local`, role: "FLOOR_MANAGER" },
    ],
  ],
  ["user active", userActiveSchema, [{}, { isActive: "no" }]],
  [
    "production check-in",
    checkInSchema,
    [
      {},
      { slotAt: "noon", counts: "x" },
      { slotAt: "2026-10-21T04:00:00.000Z", counts: [{ shoeTypeId: "x" }] },
    ],
  ],
  [
    "production correction",
    correctionSchema,
    [{}, { expectedUpdatedAt: "x", counts: [], reason: "oops" }],
  ],
  [
    "production schedule",
    scheduleSchema,
    [
      {},
      { shiftStart: "8am", shiftEnd: "25:00", intervalMinutes: 90, workingDays: [] },
      { shiftStart: "17:00", shiftEnd: "08:00", intervalMinutes: 240, workingDays: [1] },
    ],
  ],
  ["production quotas", quotasSchema, [{}, { quotas: [] }, { quotas: [{ shoeTypeId: "x" }] }]],
  ["check-in pairs", pairsSchema("School Shoes", "10:00"), ["", "abc", "-1", "2.5", "2001"]],
  ["daily quota", quotaPairsSchema("Topsider"), ["", "0", "1.5", "60000"]],
  ["attendance day", attendanceDaySchema, ["", "2026-02-30", "21/10/2026", 5]],
  [
    "attendance save",
    saveAttendanceSchema,
    [
      {},
      { expectedUpdatedAt: "yesterday", marks: [] },
      { expectedUpdatedAt: null, marks: [{ userId: "nope", present: "yes" }] },
      {
        expectedUpdatedAt: null,
        marks: [
          { userId: "0192f000-0000-7000-8000-000000000001", present: true },
          { userId: "0192f000-0000-7000-8000-000000000001", present: false },
        ],
      },
    ],
  ],
];

describe("validator messages are specific (D-038)", () => {
  for (const [name, schema, inputs] of CASES) {
    it(`${name}: no generic or built-in message`, () => {
      for (const input of inputs) {
        const found = messages(schema, input);
        expect(found.length, `${name} accepted ${JSON.stringify(input)}`).toBeGreaterThan(0);
        for (const message of found) {
          for (const pattern of GENERIC)
            expect(message, `${name}: "${message}"`).not.toMatch(pattern);
          // A full sentence with something to act on, not a one-word verdict.
          expect(message.split(/\s+/).length, `${name}: "${message}"`).toBeGreaterThanOrEqual(3);
          expect(message, `${name}: "${message}"`).toMatch(/[.”"?]$/);
        }
      }
    });
  }

  it("uses the brief's wording for the common cases", () => {
    const received = (quantity: string) =>
      messages(movementSchema, { type: "IN", quantity, reason: "Delivery received" });
    expect(received("0")).toContain("Enter a quantity greater than 0.");
    expect(received("1.234")).toContain("Quantity can have at most 2 decimal places.");
  });
});

describe("form-level messages (D-038)", () => {
  const issues = (schema: ZodType, input: unknown) => {
    const result = schema.safeParse(input);
    if (result.success) throw new Error("expected a failure");
    return result.error;
  };

  it("shows a single problem as itself", () => {
    expect(summarizeIssues([{ message: "Enter a quantity greater than 0." }])).toBe(
      "Enter a quantity greater than 0.",
    );
  });

  it("counts several and quotes the first, never a bare generic line", () => {
    const text = summarizeIssues([
      { message: "Enter a quantity greater than 0." },
      { message: "Pick a real date, like 2026-10-21." },
    ]);
    expect(text).toBe(
      "2 fields need fixing. Start with this one: Enter a quantity greater than 0.",
    );
    expect(Errors.validation([{ path: ["a"], message: "Enter the roll code." }]).message).toBe(
      "Enter the roll code.",
    );
    for (const pattern of GENERIC) expect(summarizeIssues([])).not.toMatch(pattern);
  });

  it("keys field errors by the full path, so a row's message lands on that row", () => {
    const error = issues(saveAttendanceSchema, {
      expectedUpdatedAt: "yesterday",
      marks: [
        { userId: "0192f000-0000-7000-8000-000000000001", present: true },
        { userId: "0192f000-0000-7000-8000-000000000002", present: "yes" },
      ],
    });
    expect(error).toBeInstanceOf(ZodError);
    const result = toActionError(error, "Attendance");
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        expectedUpdatedAt: "This page is out of date. Refresh it and try again.",
        "marks.1.present": "Tick Present or leave it empty for each person.",
      },
    });
    const fromService = toActionError(
      Errors.validation([{ path: ["marks", 0, "userId"], message: "Pick another person." }]),
      "Attendance",
    );
    expect(fromService).toMatchObject({
      error: "Pick another person.",
      fieldErrors: { "marks.0.userId": "Pick another person." },
    });
  });

  it("names what failed when the server itself breaks", () => {
    const result = toActionError(new Error("boom"), "Attendance");
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.error).toContain("Attendance couldn't be saved");
      expect(result.error).toContain("Nothing was changed");
    }
  });
});

describe("attendance messages (D-038, D-079)", () => {
  it("asks for a real date", () => {
    expect(messages(attendanceDaySchema, "2026-02-30")).toEqual([
      "Pick a real date, like 2026-10-21.",
    ]);
  });

  it("says when the same person is sent twice", () => {
    const id = "0192f000-0000-7000-8000-000000000001";
    expect(
      messages(saveAttendanceSchema, {
        expectedUpdatedAt: null,
        marks: [
          { userId: id, present: true },
          { userId: id, present: false },
        ],
      }),
    ).toEqual(["The same person is in the list twice. Refresh the page and save again."]);
  });

  it("refuses an empty list", () => {
    expect(messages(saveAttendanceSchema, { expectedUpdatedAt: null, marks: [] })).toEqual([
      "There's nobody on the list to save. Refresh the page.",
    ]);
  });
});

describe("production messages (D-038, Phase 23)", () => {
  it("names the shoe type and the check-in for a count", () => {
    const schema = pairsSchema("School Shoes", "10:00");
    const whole =
      "Enter the School Shoes finished since 10:00 as a whole number, like 24. Enter 0 if none.";
    expect(messages(schema, "")).toEqual([whole]);
    expect(messages(schema, "2.5")).toEqual([whole]);
    expect(messages(schema, "-3")).toEqual([whole]);
    expect(messages(schema, "2001")).toEqual([
      "School Shoes can't be more than 2,000 pairs in one check-in. Check the number.",
    ]);
    expect(schema.parse("0")).toBe(0);
    expect(schema.parse(" 24 ")).toBe(24);
  });

  it("names the shoe type for a quota", () => {
    expect(messages(quotaPairsSchema("Topsider"), "0")).toEqual([
      "Enter the daily quota for Topsider as a whole number of pairs, at least 1.",
    ]);
  });

  it("checks the schedule", () => {
    expect(
      messages(scheduleSchema, {
        shiftStart: "17:00",
        shiftEnd: "08:00",
        intervalMinutes: 240,
        workingDays: [1],
      }),
    ).toEqual(["Shift end must be after shift start."]);
    expect(
      messages(scheduleSchema, {
        shiftStart: "08:00",
        shiftEnd: "17:00",
        intervalMinutes: 90,
        workingDays: [],
      }),
    ).toEqual(["Pick an interval of 1, 2, 3 or 4 hours.", "Pick at least one working day."]);
  });

  it("asks for a reason to correct", () => {
    expect(
      messages(correctionSchema, {
        expectedUpdatedAt: "2026-10-21T04:00:00.000Z",
        counts: [],
        reason: "oops",
      }),
    ).toEqual(["Say why you're correcting this check-in, at least 5 characters."]);
  });

  it("refuses the old stage moves with one sentence", () => {
    expect(messages(transitionSchema, { action: "advance", expectedStage: "PREPARATION" })).toEqual(
      ["Choose start or finish. A roll no longer moves through stages."],
    );
  });
});
