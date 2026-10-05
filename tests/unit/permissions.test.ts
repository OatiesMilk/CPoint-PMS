import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/domain";
import { navigationFor } from "@/server/policies/navigation";
import {
  PERMISSIONS,
  can,
  canRequestLeatherRollsFor,
  mayActOnRequest,
  mayRemarkOnRequest,
  requiredDecisionPermission,
  type Permission,
} from "@/server/policies/permissions";

const FM: Role = "FLOOR_MANAGER";
const QI: Role = "QUALITY_INSPECTOR";
const AD: Role = "SYSTEM_ADMIN";
const SC: Role = "SHOE_CONSTRUCTOR";

// Mirrors the roles × modules table in docs/prompts/system-rebuild.md. Change both together.
const EXPECTED: Record<Permission, Role[]> = {
  "batch:read": [FM, QI, AD],
  "batch:manage": [FM],
  "camera:view": [FM, QI, AD],
  "camera:manage": [FM, QI],
  "scan:read": [FM, QI, AD],
  "scan:decide": [FM, QI],
  "scan:review": [QI],
  "rework:manage": [FM, QI],
  "salvage:read": [FM, QI],
  "salvage:manage": [FM],
  "inventory:read": [FM, AD],
  "inventory:manage": [FM],
  "report:production": [FM],
  "report:quality": [FM, QI],
  "user:manage": [AD],
  "settings:manage": [AD],
  "token:manage": [AD],
  "audit:read": [AD],
  "system:health": [AD],
  "procurement:read": [FM, AD, SC],
  "procurement:request": [SC],
  "procurement:decide": [FM],
  "procurement:remark": [FM, SC],
  "procurement:designate": [FM, AD],
};

describe("permissions matrix", () => {
  it("covers exactly the expected permissions", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const role of [FM, QI, AD, SC]) {
    for (const [permission, allowed] of Object.entries(EXPECTED) as [Permission, Role[]][]) {
      it(`${role} ${allowed.includes(role) ? "can" : "cannot"} ${permission}`, () => {
        expect(can(role, permission)).toBe(allowed.includes(role));
      });
    }
  }

  it("gives the Shoe Constructor procurement permissions only (D-031)", () => {
    const granted = Object.keys(PERMISSIONS).filter((p) => can(SC, p as Permission));
    expect(granted.every((p) => p.startsWith("procurement:"))).toBe(true);
  });
});

describe("navigationFor", () => {
  const labels = (role: Role) => navigationFor(role).flatMap((s) => s.items.map((i) => i.label));

  it("builds each role's sidebar from its permissions", () => {
    expect(labels(FM)).toEqual([
      "Overview",
      "Batches",
      "Inventory",
      "Procurement",
      "Camera",
      "Scans",
      "Review queue",
      "Rework",
      "Salvage",
      "Reports",
    ]);
    expect(labels(QI)).toEqual([
      "Overview",
      "Batches",
      "Camera",
      "Scans",
      "Review queue",
      "Rework",
      "Salvage",
      "Reports",
    ]);
    expect(labels(AD)).toEqual([
      "Overview",
      "Batches",
      "Inventory",
      "Procurement",
      "Camera",
      "Scans",
      "Users",
      "Settings",
      "API tokens",
      "Audit log",
    ]);
    expect(labels(SC)).toEqual(["Home", "Procurement"]);
  });

  it("links each role's first item to its own home", () => {
    expect(navigationFor(QI)[0].items[0].href).toBe("/quality-inspector");
  });
});

describe("deciding a scan (D-028)", () => {
  it("needs scan:review for a flagged scan and scan:decide otherwise", () => {
    expect(requiredDecisionPermission({ aiVerdict: "NEEDS_REVIEW" })).toBe("scan:review");
    for (const v of ["PASS", "REWORK", "REJECT"])
      expect(requiredDecisionPermission({ aiVerdict: v })).toBe("scan:decide");
    expect(can(FM, requiredDecisionPermission({ aiVerdict: "NEEDS_REVIEW" }))).toBe(false);
    expect(can(QI, requiredDecisionPermission({ aiVerdict: "NEEDS_REVIEW" }))).toBe(true);
  });
});

describe("procurement access (D-031)", () => {
  const sc = { id: "sc1", role: SC, canRequestLeatherRolls: true };
  const scNoLeather = { ...sc, canRequestLeatherRolls: false };
  const fm = { id: "fm1", role: FM, canRequestLeatherRolls: false };
  const own = { requestedById: "sc1" };
  const other = { requestedById: "sc2" };

  it("lets every Shoe Constructor request; leather rolls need the flag too", () => {
    expect(can(SC, "procurement:request")).toBe(true);
    expect(canRequestLeatherRollsFor(sc)).toBe(true);
    expect(canRequestLeatherRollsFor(scNoLeather)).toBe(false);
    // The flag alone does nothing for another role.
    expect(canRequestLeatherRollsFor({ role: FM, canRequestLeatherRolls: true })).toBe(false);
  });

  it("lets a constructor cancel only their own request, flag or not", () => {
    expect(mayActOnRequest(sc, own, "cancel")).toBe(true);
    expect(mayActOnRequest(scNoLeather, own, "cancel")).toBe(true);
    expect(mayActOnRequest(sc, other, "cancel")).toBe(false);
    expect(mayActOnRequest(fm, own, "cancel")).toBe(false);
  });

  it("lets only the Floor Manager approve, reject and receive", () => {
    for (const action of ["approve", "reject", "receive"] as const) {
      expect(mayActOnRequest(fm, own, action)).toBe(true);
      expect(mayActOnRequest(sc, own, action)).toBe(false);
      expect(
        mayActOnRequest({ id: "a", role: AD, canRequestLeatherRolls: false }, own, action),
      ).toBe(false);
    }
  });

  it("allows remarks from the Floor Manager, and from a constructor on their own", () => {
    expect(mayRemarkOnRequest(fm, other)).toBe(true);
    expect(mayRemarkOnRequest(scNoLeather, own)).toBe(true);
    expect(mayRemarkOnRequest(sc, other)).toBe(false);
    expect(mayRemarkOnRequest({ id: "q", role: QI, canRequestLeatherRolls: false }, own)).toBe(
      false,
    );
  });
});
