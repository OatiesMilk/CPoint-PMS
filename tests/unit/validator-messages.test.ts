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
import {
  approveSchema,
  cancelSchema,
  decideSchema,
  purchaseRequestSchema,
  rejectSchema,
  remarkSchema,
  requesterSchema,
} from "@/server/validators/procurement.validator";
import { decisionSchema, ingestFieldsSchema } from "@/server/validators/scan.validator";
import {
  componentTypeSchema,
  defectTypeCreateSchema,
  referenceActiveSchema,
  shoeTypeSchema,
  supplierSchema,
  thresholdsSchema,
} from "@/server/validators/settings.validator";
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
        targetQuotaPairs: "1.5",
        notes: long(501),
        rollItemId: "nope",
      },
      { rollCode: "R1", shoeTypeId: "nope", receivedAt: "soon", targetQuotaPairs: "abc" },
      { rollCode: "R1", shoeTypeId: "nope", receivedAt: "2026-01-01", targetQuotaPairs: "0" },
      { rollCode: "R1", shoeTypeId: "nope", receivedAt: "2026-01-01", targetQuotaPairs: "999999" },
    ],
  ],
  [
    "batch stage move",
    transitionSchema,
    [
      {},
      { action: "fly", expectedStage: "MOON" },
      { action: "move_back", expectedStage: "PREPARATION" },
      { action: "move_back", expectedStage: "PREPARATION", reason: "x" },
      { action: "advance", expectedStage: "PREPARATION", reason: long(301) },
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
    "material request",
    purchaseRequestSchema,
    [
      {},
      { neededBy: "", lines: [] },
      { neededBy: "tomorrow", lines: [{ quantity: "" }] },
      { neededBy: "2000-01-01", lines: [{ inventoryItemId: "nope", quantity: "0" }] },
      {
        neededBy: "2999-01-01",
        remarks: long(501),
        lines: [{ itemName: "x", category: "ROCKS", unit: long(21), quantity: "1.999" }],
      },
      {
        neededBy: "2999-01-01",
        lines: [{ itemName: long(81), quantity: "abc", note: long(201) }],
      },
      {
        neededBy: "2999-01-01",
        lines: Array.from({ length: 11 }, () => ({
          inventoryItemId: "0199a8f0-0000-7000-8000-000000000001",
          quantity: "99999999",
        })),
      },
    ],
  ],
  ["request approve", approveSchema, [{ note: long(301) }, { note: 5 }]],
  ["request reject", rejectSchema, [{}, { reason: "" }, { reason: "x" }, { reason: long(301) }]],
  [
    "request item decisions",
    decideSchema,
    [
      {},
      { lines: [] },
      { lines: [{}] },
      { lines: [{ lineId: "nope", decision: "MAYBE" }] },
      { lines: [{ lineId: "0199a8f0-0000-7000-8000-000000000001", decision: "REJECTED" }] },
      {
        lines: [
          { lineId: "0199a8f0-0000-7000-8000-000000000001", decision: "REJECTED", reason: "x" },
        ],
      },
      {
        note: long(301),
        lines: [
          {
            lineId: "0199a8f0-0000-7000-8000-000000000001",
            decision: "REJECTED",
            reason: long(301),
          },
        ],
      },
    ],
  ],
  ["request cancel", cancelSchema, [{ note: long(301) }]],
  ["request remark", remarkSchema, [{}, { body: "" }, { body: "   " }, { body: long(501) }]],
  ["leather roll requester", requesterSchema, [{}, { canRequestLeatherRolls: "yes" }]],
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
  [
    "component type",
    componentTypeSchema,
    [{}, { name: "x", shoeTypeId: "nope" }, { name: long(61), sortOrder: "9999" }],
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
    const line = (quantity: string) =>
      messages(purchaseRequestSchema, {
        neededBy: "2999-01-01",
        lines: [{ itemName: "Brass eyelets", category: "OTHER", unit: "pack", quantity }],
      });
    expect(line("0")).toContain("Enter a quantity greater than 0.");
    expect(line("1.234")).toContain("Quantity can have at most 2 decimal places.");
    expect(messages(purchaseRequestSchema, { neededBy: "2000-01-01", lines: [] })).toContain(
      "Needed by can't be in the past. Pick today or a later date.",
    );
    expect(messages(purchaseRequestSchema, { lines: [] })).toContain(
      "Choose the date you need the items by.",
    );
  });

  it("no longer asks for a priority or a justification (D-036, D-037)", () => {
    const parsed = purchaseRequestSchema.parse({
      neededBy: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
      lines: [{ itemName: "Brass eyelets", category: "OTHER", unit: "pack", quantity: "2" }],
    });
    expect(parsed).not.toHaveProperty("priority");
    expect(parsed).not.toHaveProperty("justification");
    expect(parsed.remarks).toBeUndefined();
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
      { message: "Choose the date you need the items by." },
    ]);
    expect(text).toBe(
      "2 fields need fixing. Start with this one: Enter a quantity greater than 0.",
    );
    expect(Errors.validation([{ path: ["a"], message: "Enter the roll code." }]).message).toBe(
      "Enter the roll code.",
    );
    for (const pattern of GENERIC) expect(summarizeIssues([])).not.toMatch(pattern);
  });

  it("keys field errors by the full path, so a line's message lands on that line", () => {
    const error = issues(purchaseRequestSchema, {
      neededBy: "",
      lines: [
        { itemName: "Brass eyelets", category: "OTHER", unit: "pack", quantity: "2" },
        { itemName: "Brass eyelets", category: "OTHER", unit: "pack", quantity: "0" },
      ],
    });
    expect(error).toBeInstanceOf(ZodError);
    const result = toActionError(error, "Material request");
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        neededBy: "Choose the date you need the items by.",
        "lines.1.quantity": "Enter a quantity greater than 0.",
      },
    });
    const fromService = toActionError(
      Errors.validation([{ path: ["lines", 0, "inventoryItemId"], message: "Pick another item." }]),
      "Material request",
    );
    expect(fromService).toMatchObject({
      error: "Pick another item.",
      fieldErrors: { "lines.0.inventoryItemId": "Pick another item." },
    });
  });

  it("names what failed when the server itself breaks", () => {
    const result = toActionError(new Error("boom"), "Material request");
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.error).toContain("Material request couldn't be saved");
      expect(result.error).toContain("Nothing was changed");
    }
  });
});
