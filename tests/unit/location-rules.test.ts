import { describe, expect, it } from "vitest";
import {
  awaitsPickup,
  isLocationCode,
  locationQrText,
  locationText,
  mayHoldLocation,
  MOVE_REASON_LABELS,
  noMatchMessage,
  normalizeLocationCode,
  parseScannedCode,
  planCodeChange,
  planDeactivate,
  planMove,
  planPickedUp,
  planSetAside,
  whereText,
} from "@/lib/location-rules";

const inStock = {
  code: "LR-MLT-004",
  status: "IN_STOCK" as const,
  markedForReturn: false,
  returnDecision: null,
  pickedUpAt: null,
  locationId: null as string | null,
};
const returned = {
  ...inStock,
  status: "FINISHED" as const,
  markedForReturn: true,
};
const bin = { id: "b1", code: "R1-B3", isActive: true };
const other = { id: "b2", code: "R2-B1", isActive: true };

describe("location codes (Phase 32, A-53)", () => {
  it("are trimmed and upper-cased, 2 to 20 letters, numbers or dashes", () => {
    expect(normalizeLocationCode("  r1-b3 ")).toBe("R1-B3");
    for (const ok of ["R1-B3", "RETURN", "A1", "RACK-12-BIN-4"])
      expect(isLocationCode(ok)).toBe(true);
    for (const bad of ["", "R", "R1 B3", "-R1", "R1/B3", "X".repeat(21)])
      expect(isLocationCode(bad)).toBe(false);
  });

  it("read as code and name, and a location's QR holds LOC:<code> (A-80)", () => {
    expect(locationText({ code: "R1-B3", name: "Rack 1, bin 3" })).toBe("R1-B3 · Rack 1, bin 3");
    expect(locationText({ code: "R1-B3", name: null })).toBe("R1-B3");
    expect(locationQrText("R1-B3")).toBe("LOC:R1-B3");
  });
});

describe("which rolls are in storage (A-55, A-77)", () => {
  it("is a roll in stock, or one Returned to supplier waiting for the supplier", () => {
    expect(mayHoldLocation(inStock)).toBe(true);
    expect(mayHoldLocation(returned)).toBe(true);
    expect(awaitsPickup(returned)).toBe(true);
    expect(mayHoldLocation({ ...returned, pickedUpAt: new Date() })).toBe(false);
    expect(mayHoldLocation({ ...inStock, status: "OPEN" })).toBe(false);
    expect(mayHoldLocation({ ...inStock, status: "FINISHED" })).toBe(false); // passed: used up
    expect(mayHoldLocation({ ...inStock, status: "CANCELLED" })).toBe(false);
    // A Phase 30C Keep is not Returned to supplier.
    expect(mayHoldLocation({ ...returned, returnDecision: "KEPT" })).toBe(false);
  });
});

describe("planMove (A-56)", () => {
  it("places a roll with no location and moves one that has a place", () => {
    expect(planMove(inStock, bin)).toEqual({ ok: true, reason: "PLACED" });
    expect(planMove({ ...inStock, locationId: "b2" }, bin)).toEqual({ ok: true, reason: "MOVED" });
  });

  it("refuses the same place, a deactivated one, and rolls not in storage, naming the fix", () => {
    expect(planMove({ ...inStock, locationId: "b1" }, bin)).toEqual({
      ok: false,
      reason: "LR-MLT-004 is already in R1-B3.",
    });
    expect(planMove(inStock, { ...other, isActive: false })).toMatchObject({ ok: false });
    expect(planMove({ ...inStock, status: "OPEN" }, bin)).toEqual({
      ok: false,
      reason: "LR-MLT-004 is being scanned at Capture. Put it back first.",
    });
    expect(planMove({ ...inStock, status: "FINISHED" }, bin)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/already scanned and used/),
    });
    expect(planMove({ ...inStock, status: "CANCELLED" }, bin)).toMatchObject({
      reason: expect.stringMatching(/was removed/),
    });
  });
});

describe("set aside and pick up (A-77)", () => {
  it("sets aside only a roll Returned to supplier, then the supplier picks it up once", () => {
    expect(planSetAside(returned, bin)).toEqual({ ok: true });
    expect(planSetAside(inStock, bin)).toMatchObject({ ok: false });
    expect(planSetAside({ ...returned, locationId: "b1" }, bin)).toMatchObject({ ok: false });
    expect(planPickedUp(returned)).toEqual({ ok: true });
    expect(planPickedUp({ ...returned, pickedUpAt: new Date() })).toEqual({
      ok: false,
      reason: "LR-MLT-004 is already marked picked up by the supplier.",
    });
    expect(planPickedUp(inStock)).toMatchObject({ ok: false });
  });
});

describe("locations' own rules", () => {
  it("deactivates only an empty location", () => {
    expect(planDeactivate("R1-B3", 0)).toEqual({ ok: true });
    expect(planDeactivate("R1-B3", 1)).toEqual({
      ok: false,
      reason: "R1-B3 still holds 1 roll. Move them first.",
    });
    expect(planDeactivate("R1-B3", 3)).toMatchObject({ reason: expect.stringMatching(/3 rolls/) });
  });

  it("keeps a code once rolls have been kept there, because it is on labels (A-79)", () => {
    expect(planCodeChange("R1-B3", false)).toEqual({ ok: true });
    expect(planCodeChange("R1-B3", true)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/Change its name instead/),
    });
  });
});

describe("parseScannedCode (A-80)", () => {
  it("tells a location label from a roll's", () => {
    expect(parseScannedCode("LOC:R1-B3")).toEqual({ kind: "location", code: "R1-B3" });
    expect(parseScannedCode(" loc:r1-b3 ")).toEqual({ kind: "location", code: "R1-B3" });
    expect(parseScannedCode("LR-MLT-004")).toEqual({ kind: "roll", code: "LR-MLT-004" });
    expect(parseScannedCode("lr-mlt-004")).toEqual({ kind: "roll", code: "LR-MLT-004" });
    expect(parseScannedCode("R-2026-0012")).toEqual({ kind: "roll", code: "R-2026-0012" });
    expect(parseScannedCode("B-2026-0003")).toEqual({ kind: "roll", code: "B-2026-0003" });
  });

  it("gives nothing to look up for blank, broken or very long text", () => {
    expect(parseScannedCode("   ")).toBeNull();
    expect(parseScannedCode("LOC:")).toBeNull();
    expect(parseScannedCode("LOC:R1 B3")).toBeNull();
    expect(parseScannedCode("x".repeat(61))).toBeNull();
    expect(noMatchMessage(" LR-MLT-040 ")).toBe(
      "No roll or location has the code LR-MLT-040. Check the label or type the code.",
    );
  });
});

describe("whereText", () => {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  it("says where a roll is, or why it has no place", () => {
    const loc = { code: "R1-B3", name: "Rack 1, bin 3" };
    expect(whereText({ ...inStock, location: loc }, fmt)).toBe("R1-B3 · Rack 1, bin 3");
    expect(whereText({ ...inStock, location: null }, fmt)).toBe("Not placed yet");
    expect(whereText({ ...inStock, status: "OPEN", location: null }, fmt)).toBe(
      "Being scanned at Capture",
    );
    expect(
      whereText(
        {
          ...inStock,
          status: "FINISHED",
          location: null,
          finishedAt: new Date("2026-11-12T03:00:00Z"),
        },
        fmt,
      ),
    ).toBe("Left storage: scanned on 2026-11-12");
    expect(whereText({ ...returned, location: null }, fmt)).toBe(
      "Waiting for the supplier, not set aside yet",
    );
    expect(
      whereText({ ...returned, pickedUpAt: new Date("2026-11-13T03:00:00Z"), location: null }, fmt),
    ).toBe("Picked up by the supplier on 2026-11-13");
    expect(
      whereText(
        { ...inStock, status: "CANCELLED", location: null, cancelledAt: new Date("2026-11-10") },
        fmt,
      ),
    ).toBe("Removed on 2026-11-10");
  });

  it("names every kind of move in plain words", () => {
    expect(Object.values(MOVE_REASON_LABELS)).toEqual([
      "Placed",
      "Moved",
      "Taken for scanning",
      "Put back",
      "Removed",
      "Set aside for return",
      "Picked up by supplier",
    ]);
  });
});
