import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/domain";
import { navigationFor } from "@/server/policies/navigation";
import { PERMISSIONS, can, type Permission } from "@/server/policies/permissions";

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

  it("gives the Shoe Constructor no module permissions (placeholder role)", () => {
    expect(Object.keys(PERMISSIONS).some((p) => can(SC, p as Permission))).toBe(false);
  });
});

describe("navigationFor", () => {
  const labels = (role: Role) => navigationFor(role).flatMap((s) => s.items.map((i) => i.label));

  it("builds each role's sidebar from its permissions", () => {
    expect(labels(FM)).toEqual([
      "Overview",
      "Batches",
      "Inventory",
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
      "Camera",
      "Scans",
      "Users",
      "Settings",
      "API tokens",
      "Audit log",
    ]);
    expect(labels(SC)).toEqual(["Home"]);
  });

  it("links each role's first item to its own home", () => {
    expect(navigationFor(QI)[0].items[0].href).toBe("/quality-inspector");
  });
});
