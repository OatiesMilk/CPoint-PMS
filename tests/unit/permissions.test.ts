import { describe, expect, it } from "vitest";
import { ROLE_HOME, type Role } from "@/lib/domain";
import { navigationFor } from "@/server/policies/navigation";
import {
  PERMISSIONS,
  can,
  canCaptureFor,
  checkInCoverReason,
  mayEnterCheckIns,
  type Permission,
} from "@/server/policies/permissions";

const FM: Role = "FLOOR_MANAGER";
const QI: Role = "QUALITY_INSPECTOR";
const AD: Role = "SYSTEM_ADMIN";
const SC: Role = "SHOE_CONSTRUCTOR";

// Mirrors the roles × modules table in docs/prompts/system-rebuild.md (Phase 28, D-100). Change both together.
const EXPECTED: Record<Permission, Role[]> = {
  "roll:read": [FM],
  "roll:manage": [FM],
  "camera:view": [AD],
  "camera:capture": [SC],
  "camera:operators": [AD],
  "scan:read": [FM],
  "inventory:read": [FM],
  "inventory:manage": [FM],
  "report:production": [FM],
  "report:quality": [FM],
  "user:manage": [AD],
  "settings:manage": [AD],
  "token:manage": [AD],
  "audit:read": [AD],
  "system:health": [AD],
  "attendance:read": [FM],
  "attendance:manage": [FM],
  "production:read": [FM, QI],
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

  it("gives the Shoe Constructor only Capture, and only with camera access (D-075, Phase 26)", () => {
    const granted = Object.keys(PERMISSIONS).filter((p) => can(SC, p as Permission));
    expect(granted).toEqual(["camera:capture"]);
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
      "A Quality Inspector is present today, so they finish the batches.",
    );
    expect(can(FM, "production:plan")).toBe(true);
    expect(can(QI, "production:plan")).toBe(false);
    expect(can(SC, "production:read")).toBe(false);
  });

  it("gives rolls in Reports to the Floor Manager only (Phase 26)", () => {
    expect(can(FM, "roll:read")).toBe(true);
    expect(can(QI, "roll:read")).toBe(false);
    expect(can(AD, "roll:read")).toBe(false);
    for (const gone of ["roll:finish", "camera:manage"])
      expect(Object.keys(PERMISSIONS)).not.toContain(gone);
  });
});

describe("navigationFor", () => {
  const labels = (role: Role) =>
    navigationFor({ role }).flatMap((s) => s.items.map((i) => i.label));

  it("gives each role exactly its row of the table, in order (Phase 28, D-100, C-18)", () => {
    expect(labels(SC)).toEqual(["Capture"]);
    expect(labels(QI)).toEqual(["Batches"]);
    expect(labels(FM)).toEqual(["Overview", "Batches", "Attendance", "Reports", "Inventory"]);
    expect(labels(AD)).toEqual([
      "Overview",
      "Users",
      "Settings",
      "Camera",
      "API tokens",
      "Audit log",
    ]);
  });

  it("uses one list without headings, and never the Scans list (A-26)", () => {
    for (const role of [FM, QI, AD, SC]) {
      const sections = navigationFor({ role });
      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBeNull();
      expect(sections[0].items.map((i) => i.href)).not.toContain("/scans");
    }
  });

  it("only links pages the role may open", () => {
    const hrefs = (role: Role) => navigationFor({ role })[0].items.map((i) => i.href);
    expect(hrefs(FM)).toEqual([
      "/floor-manager",
      "/batches",
      "/attendance",
      "/reports",
      "/inventory",
    ]);
    expect(hrefs(AD)).toEqual([
      "/admin",
      "/admin/users",
      "/admin/settings",
      "/camera",
      "/admin/tokens",
      "/admin/audit",
    ]);
  });

  it("gives a constructor one page, Capture, which is also their home (Phase 26)", () => {
    for (const canCapture of [false, true]) {
      const items = navigationFor({ role: SC, canCapture }).flatMap((s) => s.items);
      expect(items.map((i) => [i.label, i.href])).toEqual([["Capture", "/camera/capture"]]);
    }
    // Nobody else captures, whatever the switch says.
    for (const role of [FM, QI, AD]) expect(labels(role)).not.toContain("Capture");
  });

  it("links each role's first item to its own home; Batches is the QI's home", () => {
    expect(ROLE_HOME.QUALITY_INSPECTOR).toBe("/batches");
    for (const role of [FM, QI, AD, SC])
      expect(navigationFor({ role })[0].items[0].href).toBe(ROLE_HOME[role]);
  });
});

describe("the camera's verdict is final (D-093)", () => {
  it("has no permission to decide, review, repair or salvage a section", () => {
    const names = Object.keys(PERMISSIONS);
    for (const gone of [
      "scan:decide",
      "scan:review",
      "rework:manage",
      "salvage:read",
      "salvage:manage",
    ])
      expect(names).not.toContain(gone);
  });
});

describe("who may capture (D-075, Phase 26)", () => {
  it("lets a Shoe Constructor capture only with camera access", () => {
    expect(canCaptureFor({ role: SC, canCapture: false })).toBe(false);
    expect(canCaptureFor({ role: SC, canCapture: true })).toBe(true);
  });

  it("never lets the QI, the Floor Manager or the System Admin capture (C-18)", () => {
    for (const role of [FM, QI, AD]) {
      expect(canCaptureFor({ role, canCapture: true })).toBe(false);
      expect(canCaptureFor({ role, canCapture: false })).toBe(false);
    }
  });
});
