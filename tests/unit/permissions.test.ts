import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/domain";
import { navigationFor } from "@/server/policies/navigation";
import {
  PERMISSIONS,
  can,
  canCaptureFor,
  checkInCoverReason,
  mayEnterCheckIns,
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
  "batch:finish": [FM, QI],
  "camera:view": [FM, QI, AD],
  "camera:manage": [FM, QI],
  "camera:capture": [FM, QI],
  "camera:operators": [FM, AD],
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
  "attendance:read": [FM, AD],
  "attendance:manage": [FM],
  "production:read": [FM, QI, AD],
  "production:checkin": [QI, FM],
  "production:plan": [FM],
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

  it("gives the Shoe Constructor no permission in the matrix: Capture comes from the switch (D-075, D-091)", () => {
    const granted = Object.keys(PERMISSIONS).filter((p) => can(SC, p as Permission));
    expect(granted).toEqual([]);
  });
});

describe("production access (Phase 23, Dylan 3B)", () => {
  it("lets the QI enter check-ins, the FM only with no QI present (D-088), and only the FM plan", () => {
    expect(mayEnterCheckIns(QI, true)).toBe(true);
    expect(mayEnterCheckIns(QI, null)).toBe(true);
    expect(mayEnterCheckIns(FM, false)).toBe(true);
    expect(mayEnterCheckIns(FM, true)).toBe(false);
    expect(mayEnterCheckIns(FM, null)).toBe(false); // attendance not taken
    expect(mayEnterCheckIns(AD, false)).toBe(false);
    expect(checkInCoverReason(FM, false)).toBeNull();
    expect(checkInCoverReason(FM, true)).toBe(
      "A Quality Inspector is present today, so they enter the check-ins.",
    );
    expect(can(FM, "production:plan")).toBe(true);
    expect(can(QI, "production:plan")).toBe(false);
    expect(can(SC, "production:read")).toBe(false);
  });

  it("lets the QI finish a roll but not start, edit or cancel one (D-082)", () => {
    expect(can(QI, "batch:finish")).toBe(true);
    expect(can(QI, "batch:manage")).toBe(false);
    expect(can(AD, "batch:finish")).toBe(false);
  });
});

describe("navigationFor", () => {
  const labels = (role: Role) =>
    navigationFor({ role }).flatMap((s) => s.items.map((i) => i.label));

  it("builds each role's sidebar from its permissions", () => {
    expect(labels(FM)).toEqual([
      "Overview",
      "Production",
      "Attendance",
      "Batches",
      "Inventory",
      "Camera",
      "Capture",
      "Scans",
      "Review queue",
      "Repair Station",
      "Salvage",
      "Reports",
    ]);
    expect(labels(QI)).toEqual([
      "Overview",
      "Production",
      "Batches",
      "Camera",
      "Capture",
      "Scans",
      "Review queue",
      "Repair Station",
      "Salvage",
      "Reports",
    ]);
    expect(labels(AD)).toEqual([
      "Overview",
      "Production",
      "Attendance",
      "Batches",
      "Inventory",
      "Camera",
      "Scans",
      "Users",
      "Settings",
      "API tokens",
      "Audit log",
    ]);
    // A constructor without camera access has only Home (D-091).
    expect(labels(SC)).toEqual(["Home"]);
  });

  it("adds Capture for a constructor allowed to capture, and only Capture (D-075)", () => {
    const items = navigationFor({ role: SC, canCapture: true }).flatMap((s) =>
      s.items.map((i) => i.label),
    );
    expect(items).toEqual(["Home", "Capture"]);
    // The switch means nothing for other roles: an admin never gets Capture.
    expect(
      navigationFor({ role: AD, canCapture: true }).flatMap((s) => s.items.map((i) => i.label)),
    ).not.toContain("Capture");
  });

  it("links each role's first item to its own home", () => {
    expect(navigationFor({ role: QI })[0].items[0].href).toBe("/quality-inspector");
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

describe("who may capture at the camera (D-075)", () => {
  it("lets the QI and the Floor Manager capture whatever the switch says", () => {
    expect(canCaptureFor({ role: QI, canCapture: false })).toBe(true);
    expect(canCaptureFor({ role: FM, canCapture: false })).toBe(true);
  });

  it("lets a Shoe Constructor capture only when allowed", () => {
    expect(canCaptureFor({ role: SC, canCapture: false })).toBe(false);
    expect(canCaptureFor({ role: SC, canCapture: true })).toBe(true);
  });

  it("never lets the System Admin capture, even with the switch on", () => {
    expect(canCaptureFor({ role: AD, canCapture: true })).toBe(false);
  });
});
