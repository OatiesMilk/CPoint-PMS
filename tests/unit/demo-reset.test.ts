import { beforeEach, describe, expect, it, vi } from "vitest";

const model = {
  countResetTargets: vi.fn(async () => ({ users: 135, scans: 900 })),
  deleteResetTargets: vi.fn(),
  upsertDefectTypeState: vi.fn(),
  setDemoAccountNames: vi.fn(),
};
const env = { NODE_ENV: "development", BOOTSTRAP_ADMIN_EMAIL: "Owner@CPoint.local" };
const recordAudit = vi.fn();
const seedDemoWeek = vi.fn(async () => ({ seeded: true, rolls: 14, scans: 290 }));
const ensureDemoInventory = vi.fn();
const ensureDemoConstructors = vi.fn();
const clearUploadFolders = vi.fn();
const ensureDefaultLunchBreak = vi.fn();
const runInTransaction = vi.fn(
  async (fn: (tx: unknown) => unknown, _options?: { timeoutMs?: number }) => fn("tx"),
);

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/lib/env", () => ({ getEnv: () => env }));
vi.mock("@/server/lib/storage", () => ({ clearUploadFolders }));
vi.mock("@/server/models/db", () => ({ runInTransaction }));
vi.mock("@/server/models/demo-reset.model", () => model);
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/services/demo-seed.service", () => ({ seedDemoWeek }));
vi.mock("@/server/services/production.service", () => ({ ensureDefaultLunchBreak }));
vi.mock("@/server/services/bootstrap.service", () => ({
  DEMO_USERS: [
    { email: "manager@cpoint.local", name: "Rodel Pascual" },
    { email: "admin@cpoint.local", name: "Jerome Salazar" },
  ],
  DEMO_CONSTRUCTORS: [{ email: "arnel.bautista@cpoint.local" }],
  ensureDemoConstructors,
  REFERENCE_DATA: {
    suppliers: [{ name: "Sample Leather Supplier" }],
    defectTypes: [{ key: "cut" }, { key: "hole" }, { key: "abrasion" }, { key: "dirt" }],
  },
  ensureDemoInventory,
}));

const { MODEL_DEFECT_TYPES, resetDemoData, resetKeep } =
  await import("@/server/services/demo-reset.service");
const { hashDeviceToken } = await import("@/server/lib/device-token");

beforeEach(() => {
  vi.clearAllMocks();
  env.NODE_ENV = "development";
});

describe("resetKeep (D-056)", () => {
  it("keeps the demo accounts, the bootstrap admin and the station's token, never the plain token", () => {
    const keep = resetKeep(["cpt_station_token", "", "cpt_station_token"]);
    expect(keep.emails).toEqual([
      "manager@cpoint.local",
      "admin@cpoint.local",
      "arnel.bautista@cpoint.local",
      "owner@cpoint.local",
    ]);
    expect(keep.tokenHashes).toEqual([hashDeviceToken("cpt_station_token")]);
    expect(JSON.stringify(keep)).not.toContain("cpt_station_token");
    expect(keep).not.toHaveProperty("shoeTypeCodes");
    expect(keep.defectTypeKeys.sort()).toEqual(
      ["abrasion", "crease", "cut", "dirt", "hole", "scratch"].sort(),
    );
  });
});

describe("resetDemoData", () => {
  it("clears, sets the model classes, audits once, clears files, then seeds a week", async () => {
    const keep = resetKeep([]);
    const result = await resetDemoData(keep);
    expect(runInTransaction).toHaveBeenCalledWith(expect.any(Function), { timeoutMs: 120_000 });
    expect(model.deleteResetTargets).toHaveBeenCalledWith(keep, "tx");
    expect(model.upsertDefectTypeState).toHaveBeenCalledTimes(MODEL_DEFECT_TYPES.length);
    // The demo accounts get their names back (D-090).
    expect(model.setDemoAccountNames).toHaveBeenCalledWith(
      [
        { email: "manager@cpoint.local", name: "Rodel Pascual" },
        { email: "admin@cpoint.local", name: "Jerome Salazar" },
      ],
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        actor: { type: "SYSTEM" },
        action: "system.demo_reset",
        before: { users: 135, scans: 900 },
      }),
    );
    // The lunch rows go and the default comes back in force from the start (Phase 27).
    expect(ensureDefaultLunchBreak).toHaveBeenCalledWith("tx", undefined);
    expect(clearUploadFolders).toHaveBeenCalledWith(["scans", "pod"]);
    // The demo constructors come back before the week, so its attendance has a roster (D-081).
    expect(ensureDemoConstructors).toHaveBeenCalled();
    expect(ensureDemoConstructors.mock.invocationCallOrder[0]).toBeLessThan(
      seedDemoWeek.mock.invocationCallOrder[0],
    );
    expect(seedDemoWeek).toHaveBeenCalled();
    expect(result.demoWeek).toMatchObject({ seeded: true });
  });

  it("can skip the demo week", async () => {
    const result = await resetDemoData(resetKeep([]), { demoWeek: false });
    expect(seedDemoWeek).not.toHaveBeenCalled();
    expect(result.demoWeek).toBeNull();
  });

  it("refuses to run in production and changes nothing", async () => {
    env.NODE_ENV = "production";
    await expect(resetDemoData(resetKeep([]))).rejects.toThrow(/NODE_ENV=production/);
    expect(model.deleteResetTargets).not.toHaveBeenCalled();
    expect(clearUploadFolders).not.toHaveBeenCalled();
  });

  it("leaves the model's four classes on with outcomes and the two placeholders off", () => {
    const state = Object.fromEntries(
      MODEL_DEFECT_TYPES.map((d) => [d.key, [d.isActive, d.outcome]]),
    );
    expect(state).toEqual({
      cut: [true, "NOT_ACCEPTED"],
      hole: [true, "NOT_ACCEPTED"],
      crease: [true, "USABLE"],
      scratch: [true, "USABLE"],
      abrasion: [false, "NOT_ACCEPTED"],
      dirt: [false, "NOT_ACCEPTED"],
    });
  });
});
