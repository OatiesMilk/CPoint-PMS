import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findRollPhotos = vi.fn();
const read = vi.fn(async (key: string) => Buffer.from(`image ${key}`));
vi.mock("@/server/models/roll.model", () => ({ findRollPhotos }));
vi.mock("@/server/lib/storage", () => ({ getStorage: () => ({ read }) }));

const { exportRollPhotos, manilaIso, RollPhotosError } =
  await import("@/server/services/roll-photos.service");

const area = (v: string) => ({ toString: () => v });
const roll = {
  code: "LR-MLT-001",
  areaSqFt: area("24.50"),
  item: { name: "Brown cowhide" },
  supplier: { name: "Marikina Leather Trading" },
  scans: [
    {
      sequence: 1,
      capturedAt: new Date("2026-11-02T01:00:00Z"),
      imagePath: "scans/a.jpg",
      imageMime: "image/jpeg",
      finalVerdict: "PASS",
    },
    {
      sequence: 2,
      capturedAt: new Date("2026-11-02T01:01:30Z"),
      imagePath: null,
      imageMime: null,
      finalVerdict: "REJECT",
    },
    {
      sequence: 3,
      capturedAt: new Date("2026-11-02T01:02:00Z"),
      imagePath: "scans/c.png",
      imageMime: "image/png",
      finalVerdict: "REJECT",
    },
  ],
};

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "roll-photos-"));
  findRollPhotos.mockReset();
  read.mockClear();
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("exportRollPhotos", () => {
  it("copies the shots with their times and writes roll.toml with the code and area", async () => {
    findRollPhotos.mockResolvedValue(roll);
    const out = path.join(dir, "LR-MLT-001");
    const result = await exportRollPhotos(" LR-MLT-001 ", out, new Date("2026-11-02T06:00:00Z"));

    expect(findRollPhotos).toHaveBeenCalledWith("LR-MLT-001");
    expect(result.shots.map((s) => s.file)).toEqual(["shot-01.jpg", "shot-03.png"]);
    expect((await readdir(out)).sort()).toEqual([
      "roll.toml",
      "shot-01.jpg",
      "shot-03.png",
      "shots.csv",
    ]);
    expect(await readFile(path.join(out, "shot-03.png"), "utf8")).toBe("image scans/c.png");

    const toml = await readFile(path.join(out, "roll.toml"), "utf8");
    expect(toml).toContain('code = "LR-MLT-001"');
    expect(toml).toContain("area_sq_ft = 24.5");
    expect(toml).toContain("# Item: Brown cowhide");
    expect(toml).toContain("2026-11-02T14:00:00+08:00");

    expect(await readFile(path.join(out, "shots.csv"), "utf8")).toBe(
      "file,shot,captured_at,verdict\n" +
        "shot-01.jpg,1,2026-11-02T09:00:00+08:00,PASS\n" +
        "shot-03.png,3,2026-11-02T09:02:00+08:00,REJECT\n",
    );
  });

  it("refuses a roll with no area by name, before copying anything", async () => {
    findRollPhotos.mockResolvedValue({ ...roll, code: "R-2026-0004", areaSqFt: null });
    const out = path.join(dir, "old");
    await expect(exportRollPhotos("R-2026-0004", out)).rejects.toThrow(
      "Roll R-2026-0004 has no area.",
    );
    expect(read).not.toHaveBeenCalled();
    await expect(readdir(out)).rejects.toThrow();
  });

  it("refuses an unknown code and a folder that isn't empty", async () => {
    findRollPhotos.mockResolvedValue(null);
    await expect(exportRollPhotos("LR-XX-009", dir)).rejects.toBeInstanceOf(RollPhotosError);

    findRollPhotos.mockResolvedValue(roll);
    await writeFile(path.join(dir, "keep.txt"), "x");
    await expect(exportRollPhotos("LR-MLT-001", dir)).rejects.toThrow("isn't empty");
    expect(read).not.toHaveBeenCalled();
  });

  it("refuses a roll with no photos", async () => {
    findRollPhotos.mockResolvedValue({ ...roll, scans: [roll.scans[1]] });
    await expect(exportRollPhotos("LR-MLT-001", path.join(dir, "n"))).rejects.toThrow(
      "has no shots with a photo",
    );
  });

  it("leaves out a shot whose photo is missing on this computer and names it", async () => {
    findRollPhotos.mockResolvedValue(roll);
    read.mockImplementationOnce(async () => {
      throw Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    });
    const out = path.join(dir, "part");
    const result = await exportRollPhotos("LR-MLT-001", out);
    expect(result.missing).toEqual([1]);
    expect(result.shots.map((s) => s.file)).toEqual(["shot-03.png"]);
    expect((await readdir(out)).sort()).toEqual(["roll.toml", "shot-03.png", "shots.csv"]);
  });

  it("refuses when no photo is on this computer, and makes no folder", async () => {
    findRollPhotos.mockResolvedValue(roll);
    read.mockImplementation(async () => {
      throw Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    });
    const out = path.join(dir, "none");
    await expect(exportRollPhotos("LR-MLT-001", out)).rejects.toThrow(
      "None of roll LR-MLT-001's 2 photos is in the uploads folder",
    );
    await expect(readdir(out)).rejects.toThrow();
    read.mockImplementation(async (key: string) => Buffer.from(`image ${key}`));
  });

  it("writes Manila time", () => {
    expect(manilaIso(new Date("2026-11-02T16:30:05.123Z"))).toBe("2026-11-03T00:30:05+08:00");
  });
});
