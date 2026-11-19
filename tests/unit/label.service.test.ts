import { describe, expect, it, vi } from "vitest";
import jsQR from "jsqr";

const rolls = {
  findRollsByIds: vi.fn(async (): Promise<unknown[]> => [
    {
      id: "r2",
      code: "LR-MLT-005",
      tagCode: null,
      areaSqFt: 6.25,
      receivedAt: new Date("2026-11-16T00:00:00Z"),
      item: { name: "Brown suede" },
      supplier: { name: "Marikina Supplier A" },
    },
    {
      id: "r1",
      code: "LR-MLT-004",
      tagCode: "T1116-1",
      areaSqFt: 5.5,
      receivedAt: new Date("2026-11-16T00:00:00Z"),
      item: { name: "Brown suede" },
      supplier: { name: "Marikina Supplier A" },
    },
  ]),
  listInStockRollIds: vi.fn(async () => ["r1"]),
};
const locations = {
  findLocationsByIds: vi.fn(async (): Promise<unknown[]> => [
    { id: "l1", code: "R1-B3", name: "Rack 1, bin 3", kind: "BIN" },
  ]),
};
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/roll.model", () => rolls);
vi.mock("@/server/models/location.model", () => locations);

const { LABELS_MAX, locationLabels, qrSvg, rollLabels } =
  await import("@/server/services/label.service");

describe("roll labels (Phase 32, D-128)", () => {
  it("print each roll's code, leather, supplier, area, arrival and tag, by code", async () => {
    const labels = await rollLabels(["r1", "r2", "r1"]);
    expect(rolls.findRollsByIds).toHaveBeenCalledWith(["r1", "r2"]);
    expect(labels.map((l) => l.code)).toEqual(["LR-MLT-004", "LR-MLT-005"]);
    expect(labels[0]).toMatchObject({
      qrText: "LR-MLT-004",
      item: "Brown suede",
      supplier: "Marikina Supplier A",
      area: "5.5 sq ft",
      tagCode: "T1116-1",
    });
    expect(labels[0].receivedOn).toMatch(/2026/);
    expect(labels[0].qrSvg).toMatch(/^<svg/);
  });

  it("never take more than a few sheets at once", async () => {
    const many = Array.from({ length: LABELS_MAX + 10 }, (_, i) => `id${i}`);
    await rollLabels(many);
    expect((rolls.findRollsByIds.mock.calls.at(-1) as unknown as [string[]])[0]).toHaveLength(
      LABELS_MAX,
    );
  });
});

describe("location labels (A-80)", () => {
  it("hold LOC:<code> in the QR, with the name and kind", async () => {
    const [label] = await locationLabels(["l1"]);
    expect(label).toMatchObject({
      code: "R1-B3",
      qrText: "LOC:R1-B3",
      name: "Rack 1, bin 3",
      kind: "Bin",
    });
  });
});

describe("qrSvg", () => {
  it("draws a QR code that reads back as the same text", async () => {
    const svg = await qrSvg("LOC:R1-B3");
    expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 (\d+) \1"/);
    // Paint the SVG's modules into pixels and read them with jsQR, as the scanner does.
    const size = Number(/viewBox="0 0 (\d+)/.exec(svg)![1]);
    const scale = 8;
    const px = size * scale;
    const data = new Uint8ClampedArray(px * px * 4).fill(255);
    const path = /<path[^>]*stroke="#000000"[^>]*d="([^"]+)"/.exec(svg)![1];
    // Dark modules are horizontal runs: M/m move the pen (absolute / relative), h draws n cells.
    let cx = 0;
    let cy = 0;
    for (const [, op, args] of path.matchAll(/([MmHh])([^MmHh]*)/g)) {
      const n = args.trim().split(/[ ,]+/).map(Number);
      if (op === "M") [cx, cy] = n;
      else if (op === "m") [cx, cy] = [cx + n[0], cy + n[1]];
      else {
        const y = Math.floor(cy);
        for (let x = cx; x < cx + n[0]; x++)
          for (let dy = 0; dy < scale; dy++)
            for (let dx = 0; dx < scale; dx++) {
              const i = ((y * scale + dy) * px + (x * scale + dx)) * 4;
              data[i] = data[i + 1] = data[i + 2] = 0;
            }
        cx += n[0];
      }
    }
    expect(jsQR(data, px, px)?.data).toBe("LOC:R1-B3");
  });
});
