import { describe, expect, it } from "vitest";
import {
  TEMP_PASSWORD_ALPHABET,
  auditDiff,
  checkAccountChange,
  describeThresholds,
  generateTemporaryPassword,
  validateThresholds,
} from "@/lib/admin-rules";

describe("generateTemporaryPassword", () => {
  it("is 12 characters from an alphabet without look-alikes, and different each time", () => {
    const a = generateTemporaryPassword();
    expect(a).toHaveLength(12);
    expect([...a].every((c) => TEMP_PASSWORD_ALPHABET.includes(c))).toBe(true);
    expect(TEMP_PASSWORD_ALPHABET).not.toMatch(/[0O1lI]/);
    expect(new Set(Array.from({ length: 50 }, () => generateTemporaryPassword())).size).toBe(50);
  });
});

describe("checkAccountChange", () => {
  const admin = { id: "a1", role: "SYSTEM_ADMIN" as const, isActive: true };
  const fm = { id: "f1", role: "FLOOR_MANAGER" as const, isActive: true };

  it("stops admins from deactivating or demoting themselves", () => {
    expect(checkAccountChange("a1", admin, { isActive: false }, 3)).toMatchObject({ ok: false });
    expect(checkAccountChange("a1", admin, { role: "FLOOR_MANAGER" }, 3)).toMatchObject({
      ok: false,
    });
    expect(checkAccountChange("a1", admin, { role: "SYSTEM_ADMIN" }, 1)).toEqual({ ok: true });
  });

  it("never removes the last active System Admin", () => {
    const other = { ...admin, id: "a2" };
    expect(checkAccountChange("a1", other, { isActive: false }, 1)).toMatchObject({
      ok: false,
      reason: expect.stringContaining("last active System Admin"),
    });
    expect(checkAccountChange("a1", other, { isActive: false }, 2)).toEqual({ ok: true });
  });

  it("lets admins manage everyone else", () => {
    expect(checkAccountChange("a1", fm, { isActive: false, role: "QUALITY_INSPECTOR" }, 1)).toEqual(
      { ok: true },
    );
  });
});

describe("thresholds", () => {
  it("accepts rework below reject, within (0, 1]", () => {
    expect(validateThresholds({ rejectAtOrAbove: 0.9, reworkAtOrAbove: 0.6 })).toEqual([]);
    expect(validateThresholds({ rejectAtOrAbove: 1, reworkAtOrAbove: 0.99 })).toEqual([]);
  });

  it("refuses rework at or above reject, and out-of-range values", () => {
    expect(validateThresholds({ rejectAtOrAbove: 0.8, reworkAtOrAbove: 0.8 })[0]).toMatchObject({
      path: ["reworkAtOrAbove"],
      message: "Fixable must start below Reject (80%).",
    });
    expect(validateThresholds({ rejectAtOrAbove: 0, reworkAtOrAbove: 0.5 })[0].path).toEqual([
      "rejectAtOrAbove",
    ]);
    expect(validateThresholds({ rejectAtOrAbove: 0.9, reworkAtOrAbove: 0 })[0].path).toEqual([
      "reworkAtOrAbove",
    ]);
  });

  it("describes the bands in words", () => {
    expect(describeThresholds({ rejectAtOrAbove: 0.9, reworkAtOrAbove: 0.6 })).toEqual({
      reject: "90% and above",
      rework: "60% to 89.9%",
      pass: "below 60%",
    });
  });
});

describe("auditDiff", () => {
  it("lists only changed keys, including added and removed ones", () => {
    expect(auditDiff({ a: 1, b: { x: 1 }, c: 3 }, { a: 1, b: { x: 2 }, d: 4 })).toEqual([
      { key: "b", before: { x: 1 }, after: { x: 2 } },
      { key: "c", before: 3, after: undefined },
      { key: "d", before: undefined, after: 4 },
    ]);
    expect(auditDiff(null, { a: 1 })).toEqual([{ key: "a", before: undefined, after: 1 }]);
  });
});
