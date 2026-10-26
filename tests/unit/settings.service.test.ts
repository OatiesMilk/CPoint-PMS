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
const suggestSupplierCode = vi.fn(async () => "MLT");
vi.mock("@/server/services/supplier-code.service", () => ({ suggestSupplierCode }));

const svc = await import("@/server/services/settings.service");
const admin = { id: "a1" };

beforeEach(() => {
  vi.clearAllMocks();
  cv.getCvSettings.mockResolvedValue({
    foundAtOrAbove: 0.5,
    earlyModelNotice: true,
    updatedAt: new Date(),
  });
});

describe("saveThresholds (D-093: found-at only)", () => {
  it("stores the fraction and audits before/after", async () => {
    await svc.saveThresholds({ foundPercent: 45, earlyModelNotice: undefined }, admin);
    expect(refs.updateThresholds).toHaveBeenCalledWith(
      { foundAtOrAbove: 0.45, earlyModelNotice: true, updatedById: "a1" },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "settings.thresholds",
        before: { foundAtOrAbove: 0.5, earlyModelNotice: true },
        after: { foundAtOrAbove: 0.45, earlyModelNotice: true },
      }),
    );
  });

  it("refuses a found-at value of 0, on its own field", async () => {
    await expect(
      svc.saveThresholds({ foundPercent: 0, earlyModelNotice: undefined }, admin),
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["foundPercent"] }] });
    expect(refs.updateThresholds).not.toHaveBeenCalled();
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
    await svc.createReferenceRow(
      "defectType",
      { key: "Scratch", label: "Scratch", outcome: "USABLE" },
      admin,
    );
    expect(refs.insertReference).toHaveBeenCalledWith(
      "defectType",
      {
        key: "scratch",
        label: "Scratch",
        description: null,
        outcome: "USABLE",
        sortOrder: 0,
      },
      "tx",
    );
    refs.findReferenceByField.mockResolvedValueOnce({ id: "other" });
    await expect(
      svc.createReferenceRow(
        "defectType",
        { key: "cut", label: "Cut", outcome: "NOT_ACCEPTED" },
        admin,
      ),
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["key"] }] });
  });

  it("needs an outcome for a new defect type (D-093)", async () => {
    await expect(
      svc.createReferenceRow("defectType", { key: "stain", label: "Stain" }, admin),
    ).rejects.toThrow("Choose whether a found Stain is Usable or Not accepted.");
    expect(refs.insertReference).not.toHaveBeenCalled();
  });

  it("never changes a defect type's key on edit", async () => {
    refs.findReference.mockResolvedValue({ id: "d1", key: "cut", label: "Cut", isActive: true });
    await svc.updateReferenceRow(
      "defectType",
      "d1",
      { key: "slash", label: "Slit", outcome: "NOT_ACCEPTED" },
      admin,
    );
    const data = refs.updateReference.mock.calls[0][2];
    expect(data).not.toHaveProperty("key");
    expect(data).toMatchObject({ label: "Slit" });
  });

  it("gives a new supplier a code from its initials when none is typed (Phase 30A)", async () => {
    await svc.createReferenceRow("supplier", { name: "Marikina Leather Trading" }, admin);
    expect(suggestSupplierCode).toHaveBeenCalledWith("Marikina Leather Trading");
    expect(refs.insertReference.mock.calls[0][1]).toMatchObject({ code: "MLT" });
  });

  it("takes a typed code in capitals, and refuses one another supplier has", async () => {
    await svc.createReferenceRow("supplier", { name: "JM Leather", code: " jml " }, admin);
    expect(refs.insertReference.mock.calls[0][1]).toMatchObject({ code: "JML" });
    expect(suggestSupplierCode).not.toHaveBeenCalled();
    refs.findReferenceByField.mockImplementation(async (...args: unknown[]) =>
      args[1] === "code" ? { id: "other" } : null,
    );
    await expect(
      svc.createReferenceRow("supplier", { name: "New One", code: "MT" }, admin),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        {
          path: ["code"],
          message: expect.stringContaining("MT is already another supplier’s code"),
        },
      ],
    });
    refs.findReferenceByField.mockImplementation(async () => null);
  });

  it("keeps a supplier's code when the edit leaves it blank", async () => {
    refs.findReference.mockResolvedValue({ id: "s1", name: "Acme", code: "AC", isActive: true });
    await svc.updateReferenceRow("supplier", "s1", { name: "Acme", code: "" }, admin);
    expect(refs.updateReference.mock.calls[0][2]).not.toHaveProperty("code");
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
