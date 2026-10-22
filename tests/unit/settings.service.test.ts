import { beforeEach, describe, expect, it, vi } from "vitest";

const refs = {
  findReference: vi.fn(),
  findReferenceByField: vi.fn(async () => null as unknown),
  insertReference: vi.fn(async (_kind: string, data: Record<string, unknown>) => ({
    id: "r1",
    isActive: true,
    ...data,
  })),
  listReference: vi.fn(),
  listUnknownClassKeys: vi.fn(),
  updateReference: vi.fn(async (_kind: string, id: string, data: Record<string, unknown>) => ({
    id,
    isActive: true,
    ...data,
  })),
  updateThresholds: vi.fn(),
  updateModelNotice: vi.fn(),
};
const cv = { getCvSettings: vi.fn() };
const recordAudit = vi.fn();
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/reference-data.model", () => refs);
vi.mock("@/server/models/cv-settings.model", () => cv);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const svc = await import("@/server/services/settings.service");
const admin = { id: "a1" };

beforeEach(() => {
  vi.clearAllMocks();
  cv.getCvSettings.mockResolvedValue({
    rejectAtOrAbove: 0.9,
    reworkAtOrAbove: 0.6,
    foundAtOrAbove: 0.5,
    earlyModelNotice: true,
    updatedAt: new Date(),
  });
});

describe("saveThresholds", () => {
  it("stores fractions and audits before/after", async () => {
    await svc.saveThresholds({ rejectPercent: 85, reworkPercent: 50.5, foundPercent: 45 }, admin);
    expect(refs.updateThresholds).toHaveBeenCalledWith(
      { rejectAtOrAbove: 0.85, reworkAtOrAbove: 0.505, foundAtOrAbove: 0.45, updatedById: "a1" },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "settings.thresholds",
        before: { rejectAtOrAbove: 0.9, reworkAtOrAbove: 0.6, foundAtOrAbove: 0.5 },
        after: { rejectAtOrAbove: 0.85, reworkAtOrAbove: 0.505, foundAtOrAbove: 0.45 },
      }),
    );
  });

  it("refuses rework at or above reject, on the rework field", async () => {
    await expect(
      svc.saveThresholds({ rejectPercent: 70, reworkPercent: 70, foundPercent: 50 }, admin),
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["reworkPercent"] }] });
    expect(refs.updateThresholds).not.toHaveBeenCalled();
  });

  it("refuses a found-at value of 100%, on its own field", async () => {
    await expect(
      svc.saveThresholds({ rejectPercent: 90, reworkPercent: 60, foundPercent: 100 }, admin),
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["foundPercent"] }] });
  });
});

describe("saveModelNotice (D-055)", () => {
  it("audits a change and skips a no-op", async () => {
    await svc.saveModelNotice({ earlyModelNotice: false }, admin);
    expect(refs.updateModelNotice).toHaveBeenCalledWith(
      { earlyModelNotice: false, updatedById: "a1" },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "settings.model_notice",
        before: { earlyModelNotice: true },
        after: { earlyModelNotice: false },
      }),
    );
    vi.clearAllMocks();
    await svc.saveModelNotice({ earlyModelNotice: true }, admin);
    expect(refs.updateModelNotice).not.toHaveBeenCalled();
  });
});

describe("reference data", () => {
  it("lower-cases a new defect key and refuses one that exists", async () => {
    await svc.createReferenceRow("defectType", { key: "Scratch", label: "Scratch" }, admin);
    expect(refs.insertReference).toHaveBeenCalledWith(
      "defectType",
      {
        key: "scratch",
        label: "Scratch",
        description: null,
        action: null,
        handling: "CUT_AROUND",
        sortOrder: 0,
      },
      "tx",
    );
    refs.findReferenceByField.mockResolvedValueOnce({ id: "other" });
    await expect(
      svc.createReferenceRow("defectType", { key: "cut", label: "Cut" }, admin),
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["key"] }] });
  });

  it("never changes a defect type's key on edit", async () => {
    refs.findReference.mockResolvedValue({ id: "d1", key: "cut", label: "Cut", isActive: true });
    await svc.updateReferenceRow("defectType", "d1", { key: "slash", label: "Slit" }, admin);
    const data = refs.updateReference.mock.calls[0][2];
    expect(data).not.toHaveProperty("key");
    expect(data).toMatchObject({ label: "Slit" });
  });

  it("checks both shoe type code and name for clashes", async () => {
    refs.findReferenceByField.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "x" });
    await expect(
      svc.createReferenceRow("shoeType", { code: "sch", name: "School Shoe" }, admin),
    ).rejects.toMatchObject({ details: [{ path: ["name"] }] });
  });

  it("clears optional supplier fields to null on edit", async () => {
    refs.findReference.mockResolvedValue({ id: "s1", name: "Acme", phone: "123", isActive: true });
    await svc.updateReferenceRow("supplier", "s1", { name: "Acme", phone: "" }, admin);
    expect(refs.updateReference.mock.calls[0][2]).toMatchObject({ phone: null, notes: null });
  });

  it("deactivates with an audit row, and does nothing when already in that state", async () => {
    refs.findReference.mockResolvedValue({ id: "s1", isActive: true });
    await svc.setReferenceActive("supplier", "s1", false, admin);
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "supplier.deactivate", entity: "Supplier" }),
    );
    vi.clearAllMocks();
    refs.findReference.mockResolvedValue({ id: "s1", isActive: false });
    await svc.setReferenceActive("supplier", "s1", false, admin);
    expect(refs.updateReference).not.toHaveBeenCalled();
  });
});

describe("saveThresholds without a found-at value (API callers before D-053)", () => {
  it("keeps the stored one", async () => {
    await svc.saveThresholds({ rejectPercent: 90, reworkPercent: 60 }, admin);
    expect(refs.updateThresholds).toHaveBeenCalledWith(
      expect.objectContaining({ foundAtOrAbove: 0.5 }),
      "tx",
    );
  });
});
