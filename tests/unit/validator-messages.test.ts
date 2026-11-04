import { describe, expect, it, vi } from "vitest";
import { ZodError, type ZodType } from "zod";
import { passwordChangeSchema, loginSchema } from "@/server/validators/auth.validator";
import { addRollsSchema, removeRollSchema } from "@/server/validators/roll.validator";
import {
  activeSchema,
  inventoryItemFormSchema,
  inventorySettingsSchema,
  stockLineSchema,
  stockUpdateSchema,
} from "@/server/validators/inventory.validator";
import { ingestFieldsSchema } from "@/server/validators/scan.validator";
import {
  defectTypeCreateSchema,
  referenceActiveSchema,
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
  failedPairsSchema,
  lunchBreakSchema,
  pairsSchema,
  parseBatchCounts,
  quotaPairsSchema,
  dayPlanSchema,
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
    "add rolls (Phase 30A)",
    addRollsSchema,
    [
      {},
      { receivedOn: "", rolls: [] },
      { receivedOn: "26/10/2026", rolls: [{ areaSqFt: "" }] },
      { receivedOn: "2026-10-26", rolls: [{ areaSqFt: "big", tagCode: long(41) }] },
      { receivedOn: "2026-10-26", rolls: [{ areaSqFt: "0" }, { areaSqFt: "24.555" }] },
    ],
  ],
  ["remove roll (Floor Manager)", removeRollSchema, [{}, { reason: "  " }, { reason: long(201) }]],
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
      { sku: "LR-1", name: "Roll", category: "LEATHER_ROLL", unit: "roll", reorderLevel: "1" },
      {
        sku: "LR-1",
        name: "Roll",
        category: "LEATHER_ROLL",
        unit: "roll",
        reorderLevel: "1",
        supplierId: "nope",
      },
    ],
  ],
  [
    "stock update",
    stockUpdateSchema,
    [
      {},
      { lines: [] },
      { lines: "all" },
      {
        lines: [
          {
            itemId: "0192f000-0000-7000-8000-000000000001",
            seenQuantity: 1,
            added: "abc",
            used: "1.999",
            correction: "99999999",
            reason: long(301),
          },
        ],
      },
    ],
  ],
  ["reminder days", inventorySettingsSchema, [{}, { reminderDays: [] }, { reminderDays: "Wed" }]],
  ["item active", activeSchema, [{}, { isActive: "yes" }]],
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
        rollId: "nope",
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
      { foundPercent: "abc" },
      { foundPercent: "0" },
      { foundPercent: "101" },
      { foundPercent: "50.55" },
      { foundPercent: "50", rejectPercent: "90", reworkPercent: "60" },
    ],
  ],
  [
    "defect type",
    defectTypeCreateSchema,
    [
      {},
      { key: "Has Spaces!", label: "", sortOrder: "abc" },
      { key: "ok", label: "Ok", outcome: "REWORK" },
      { key: "ok", label: long(41), description: long(201), sortOrder: "-1" },
      { key: "ok", label: "Ok", sortOrder: "1000" },
      { key: "ok", label: "Ok", sortOrder: "1.5" },
    ],
  ],
  [
    "supplier",
    supplierSchema,
    [
      {},
      { name: "x", phone: "call me" },
      { name: "Marikina Leather", code: "m" },
      { name: "Marikina Leather", code: "1AB" },
      { name: "Marikina Leather", code: "TOOLONG" },
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
    [{}, { slotAt: "noon", pairs: "x" }, { slotAt: "2026-10-21T04:00:00.000Z", notes: long(501) }],
  ],
  [
    "production correction",
    correctionSchema,
    [{}, { expectedUpdatedAt: "x", pairs: 3, reason: "oops" }],
  ],
  [
    "day plan",
    dayPlanSchema,
    [
      {},
      { rollsPlanned: "x", quota: "", shiftStart: "8am", shiftEnd: "25:00", intervalMinutes: 90 },
      { rollsPlanned: 2, quota: 5, shiftStart: "17:00", shiftEnd: "08:00", intervalMinutes: 240 },
      { rollsPlanned: 201, quota: 5, shiftStart: "08:00", shiftEnd: "17:00", intervalMinutes: 120 },
    ],
  ],
  ["batch pairs", pairsSchema(2), ["", "abc", "-1", "2.5", "2001"]],
  ["failed pairs", failedPairsSchema(), ["abc", "-1", "2.5", "2001"]],
  ["daily quota", quotaPairsSchema, ["", "0", "1.5", "60000"]],
  [
    "lunch break",
    lunchBreakSchema,
    [{}, { startTime: "noon", endTime: "" }, { startTime: "12:00", endTime: "11:00" }],
  ],
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

  it("uses the brief's wording for the common cases (Phase 29)", () => {
    const line = (fields: Record<string, string>) =>
      messages(stockLineSchema("Nails"), {
        itemId: "0192f000-0000-7000-8000-000000000001",
        seenQuantity: 1,
        ...fields,
      });
    expect(line({ added: "12.345" })).toContain(
      "Enter what was added to Nails as a number with at most 2 decimals, like 6.",
    );
    expect(line({ used: "lots" })).toContain("Enter what was used of Nails as a number, like 3.");
    expect(line({ used: "−3" })).toEqual([]);
    expect(messages(inventorySettingsSchema, { reminderDays: [] })).toEqual([
      "Pick at least one reminder day.",
    ]);
    // Reminders fall on the factory's working days only (D-105).
    for (const day of [6, 7])
      expect(messages(inventorySettingsSchema, { reminderDays: [3, day] })).toEqual([
        "Reminder days are Monday to Friday.",
      ]);
    expect(inventorySettingsSchema.parse({ reminderDays: [5, 1, 5] })).toEqual({
      reminderDays: [1, 5],
    });
    expect(
      messages(inventoryItemFormSchema, {
        sku: "LR-1",
        name: "Roll",
        category: "LEATHER_ROLL",
        unit: "roll",
        reorderLevel: "1",
      }),
    ).toEqual(["Choose the supplier of this leather roll."]);
  });

  it("re-parses the form's own output: a non-leather item's null supplier is fine (QA F1 to F3)", () => {
    // The browser validates first and sends the parsed values, so the server sees supplierId null.
    for (const category of ["THREAD", "NAILS", "OTHER"]) {
      const once = inventoryItemFormSchema.parse({
        sku: "QA29-B",
        name: "Thread",
        category,
        unit: "spool",
        reorderLevel: "0",
        openingStock: "5",
        supplierId: "",
      });
      expect(once.supplierId).toBeNull();
      expect(inventoryItemFormSchema.parse(once)).toMatchObject({ category, supplierId: null });
    }
    // A leather roll sent with a null supplier is still refused.
    expect(
      messages(inventoryItemFormSchema, {
        sku: "LR-1",
        name: "Roll",
        category: "LEATHER_ROLL",
        unit: "roll",
        reorderLevel: "1",
        supplierId: null,
      }),
    ).toEqual(["Choose the supplier of this leather roll."]);
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

describe("batch messages (D-038, Phase 27)", () => {
  it("names the batch for the pairs finished", () => {
    const schema = pairsSchema(2);
    const whole =
      "Enter the pairs finished in Batch 2 as a whole number, like 24. Enter 0 if none.";
    expect(messages(schema, "")).toEqual([whole]);
    expect(messages(schema, "2.5")).toEqual([whole]);
    expect(messages(schema, "-3")).toEqual([whole]);
    expect(messages(schema, "2001")).toEqual([
      "Batch 2 can't be more than 2,000 pairs. Check the number.",
    ]);
    expect(schema.parse("0")).toBe(0);
    expect(schema.parse(" 24 ")).toBe(24);
  });

  it("asks for the failed pairs as a whole number, never more than finished (C-27)", () => {
    expect(messages(failedPairsSchema(), "-1")).toEqual([
      "Enter the pairs that failed inspection as a whole number, like 2. Enter 0 if none.",
    ]);
    expect(parseBatchCounts(1, { pairs: "3", failedPairs: "4" })).toEqual({
      ok: false,
      errors: { failedPairs: "Failed inspection can't be more than the pairs finished (3)." },
    });
    expect(parseBatchCounts(1, { pairs: "3" })).toEqual({
      ok: true,
      pairs: 3,
      failedPairs: 0,
    });
  });

  it("asks for the one daily quota", () => {
    expect(messages(quotaPairsSchema, "0")).toEqual([
      "Enter the daily quota as a whole number of pairs, at least 1.",
    ]);
  });

  it("checks the lunch break, and allows none", () => {
    expect(messages(lunchBreakSchema, { startTime: "12:00", endTime: "11:00" })).toEqual([
      "Lunch must end after it starts.",
    ]);
    expect(lunchBreakSchema.parse({ none: true })).toEqual({ startTime: null, endTime: null });
  });

  it("checks a day plan (D-114, D-115)", () => {
    const base = {
      rollsPlanned: 5,
      quota: 128,
      shiftStart: "08:00",
      shiftEnd: "17:00",
      intervalMinutes: 240,
    };
    expect(messages(dayPlanSchema, { ...base, shiftStart: "17:00", shiftEnd: "08:00" })).toEqual([
      "Shift end must be after shift start.",
    ]);
    expect(messages(dayPlanSchema, { ...base, rollsPlanned: "", intervalMinutes: 120 })).toEqual([
      "Enter the rolls to be used as a whole number, like 5. Enter 0 if none.",
      "Choose the check-in interval: every 4 hours, or once at the end of the day.",
    ]);
    expect(messages(dayPlanSchema, { ...base, rollsPlanned: 201 })).toEqual([
      "Rolls to be used can't be more than 200. Check the number.",
    ]);
    expect(messages(dayPlanSchema, { ...base, quota: "" })).toEqual([
      "Enter the daily quota as a whole number of pairs, at least 1.",
    ]);
    // Every 4 hours and once at the end of the day only; 0 rolls is fine.
    expect(
      dayPlanSchema.parse({ ...base, intervalMinutes: "end", rollsPlanned: "0" }),
    ).toMatchObject({
      intervalMinutes: null,
      rollsPlanned: 0,
      expectedUpdatedAt: null,
      suggestedQuota: null,
    });
  });

  it("keeps a day's shift inside the factory's hours, 08:00 to 17:00 (D-105)", () => {
    const base = {
      rollsPlanned: 2,
      quota: 100,
      shiftStart: "08:00",
      shiftEnd: "17:00",
      intervalMinutes: 240,
    };
    expect(messages(dayPlanSchema, { ...base, shiftStart: "07:00" })).toEqual([
      "Shift start must be 08:00 or later.",
    ]);
    expect(messages(dayPlanSchema, { ...base, shiftEnd: "18:00" })).toEqual([
      "Shift end must be 17:00 or earlier.",
    ]);
    expect(messages(dayPlanSchema, { ...base, shiftStart: "07:30", shiftEnd: "17:30" })).toEqual([
      "Shift start must be 08:00 or later.",
      "Shift end must be 17:00 or earlier.",
    ]);
    // A shorter shift inside the window, and the whole window, are fine.
    expect(dayPlanSchema.safeParse({ ...base, shiftEnd: "16:00" }).success).toBe(true);
    expect(dayPlanSchema.safeParse(base).success).toBe(true);
  });

  it("asks for a reason to correct", () => {
    expect(
      messages(correctionSchema, {
        expectedUpdatedAt: "2026-10-21T04:00:00.000Z",
        pairs: 3,
        reason: "oops",
      }),
    ).toEqual(["Say why you're correcting this batch, at least 5 characters."]);
  });

  it("names the roll and the fix when adding rolls, and asks why one is removed (Phase 30A)", () => {
    expect(
      messages(addRollsSchema, { receivedOn: "2026-10-26", rolls: [{}, { areaSqFt: "x" }] }),
    ).toEqual([
      "Roll 1: enter its area in square feet, like 24.5.",
      "Roll 2: enter the area as a number of square feet, like 24.5.",
    ]);
    expect(messages(removeRollSchema, { reason: "" })).toEqual(["Write why this roll is removed."]);
  });
});
