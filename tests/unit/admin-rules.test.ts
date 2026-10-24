import { describe, expect, it } from "vitest";
import {
  TEMP_PASSWORD_ALPHABET,
  auditDiff,
  checkAccountChange,
  FOUND_AT_MESSAGE,
  generateTemporaryPassword,
  validateFoundAt,
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

describe("validateFoundAt (D-093)", () => {
  it("accepts a found-at value within (0, 1]", () => {
    expect(validateFoundAt(0.5)).toEqual([]);
    expect(validateFoundAt(0.01)).toEqual([]);
    expect(validateFoundAt(1)).toEqual([]);
  });

  it("refuses 0, above 100% and not-a-number with the named message", () => {
    for (const v of [0, 1.2, Number.NaN]) {
      expect(validateFoundAt(v)[0]).toMatchObject({
        path: ["foundAtOrAbove"],
        message: FOUND_AT_MESSAGE,
      });
    }
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
