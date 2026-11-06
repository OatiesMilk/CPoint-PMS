import { describe, expect, it } from "vitest";
import { finishedLine } from "@/lib/roll-rules";
import {
  averageMs,
  formatScanningTime,
  inLunch,
  lunchDays,
  lunchLookup,
  scanningMinutes,
  scanningMs,
} from "@/lib/roll-timer";
import { rollScaleFits } from "@/lib/scale-marker";

const MIN = 60_000;
// Times in Manila (UTC+8).
const at = (day: string, time: string) => new Date(`${day}T${time}:00+08:00`);
const lunch = lunchLookup([{ effectiveFrom: "2026-01-01", startTime: "11:00", endTime: "12:00" }]);
const noLunch = lunchLookup([]);

describe("the scanning timer (D-121)", () => {
  it("counts from Start scanning to Finish roll", () => {
    expect(scanningMs(at("2026-11-05", "09:00"), at("2026-11-05", "09:12"), lunch)).toBe(12 * MIN);
  });

  it("counts the same day's time after 17:00, but not the night (A-49, QA run 1 F1)", () => {
    // An evening test, 20:43:50 to 21:04:16: all of it counts.
    expect(
      scanningMs(
        new Date("2026-11-05T20:43:50+08:00"),
        new Date("2026-11-05T21:04:16+08:00"),
        lunch,
      ),
    ).toBe(20 * MIN + 26_000);
    // Left open from 16:30 to 09:00 the next day: 30 minutes, then 60.
    expect(scanningMs(at("2026-11-05", "16:30"), at("2026-11-06", "09:00"), lunch)).toBe(90 * MIN);
    // Started at 20:00, finished at 09:00 the next day: the night doesn't count, the morning does.
    expect(scanningMs(at("2026-11-05", "20:00"), at("2026-11-06", "09:00"), lunch)).toBe(60 * MIN);
  });

  it("leaves the lunch break out (Dylan, 2026-11-05)", () => {
    // 10:40 to 12:20 with lunch 11:00 to 12:00: 20 + 20 minutes.
    expect(scanningMs(at("2026-11-05", "10:40"), at("2026-11-05", "12:20"), lunch)).toBe(40 * MIN);
    expect(scanningMs(at("2026-11-05", "11:10"), at("2026-11-05", "11:50"), lunch)).toBe(0);
    expect(scanningMs(at("2026-11-05", "10:40"), at("2026-11-05", "12:20"), noLunch)).toBe(
      100 * MIN,
    );
  });

  it("uses the lunch in force that day", () => {
    const changed = lunchLookup([
      { effectiveFrom: "2026-01-01", startTime: "11:00", endTime: "12:00" },
      { effectiveFrom: "2026-11-05", startTime: "12:00", endTime: "13:00" },
    ]);
    expect(scanningMs(at("2026-11-05", "10:30"), at("2026-11-05", "11:30"), changed)).toBe(
      60 * MIN,
    );
    expect(scanningMs(at("2026-11-04", "10:30"), at("2026-11-04", "11:30"), changed)).toBe(
      30 * MIN,
    );
  });

  it("doesn't count the night for a roll left open (A-49)", () => {
    // 16:30 to 17:00, then 08:00 to 08:15 the next day.
    expect(scanningMs(at("2026-11-04", "16:30"), at("2026-11-05", "08:15"), lunch)).toBe(45 * MIN);
    // Overtime on the same day still counts.
    expect(scanningMs(at("2026-11-05", "16:50"), at("2026-11-05", "17:20"), lunch)).toBe(30 * MIN);
  });

  it("is zero for an end before the start", () => {
    expect(scanningMs(at("2026-11-05", "10:00"), at("2026-11-05", "09:00"), lunch)).toBe(0);
  });

  it("says when the timer is paused for lunch", () => {
    expect(inLunch(at("2026-11-05", "11:30"), lunch)).toBe(true);
    expect(inLunch(at("2026-11-05", "12:00"), lunch)).toBe(false);
    expect(inLunch(at("2026-11-05", "11:30"), noLunch)).toBe(false);
  });

  it("reads mm:ss, with hours past an hour", () => {
    expect(formatScanningTime(8 * MIN + 42_000)).toBe("08:42");
    expect(formatScanningTime(62 * MIN + 3_000)).toBe("1:02:03");
    expect(formatScanningTime(-5)).toBe("00:00");
  });

  it("gives minutes with two decimals and the average of the rolls with a time", () => {
    expect(scanningMinutes(12 * MIN + 30_000)).toBe(12.5);
    expect(averageMs([10 * MIN, null, 20 * MIN])).toBe(15 * MIN);
    expect(averageMs([null])).toBeNull();
  });

  it("sends the lunch of each day the roll spans", () => {
    expect(lunchDays(at("2026-11-04", "16:00"), at("2026-11-05", "09:00"), lunch)).toEqual({
      "2026-11-04": { startTime: "11:00", endTime: "12:00" },
      "2026-11-05": { startTime: "11:00", endTime: "12:00" },
    });
  });

  it("adds the scanning time to the line after Finish roll", () => {
    const line = finishedLine(
      { code: "LR-MLT-007", shots: 6 },
      { sharePct: 0.6, limitPct: 10, marked: false, notMeasured: null, scanningMs: 754_000 },
    );
    expect(line).toBe(
      "LR-MLT-007 is finished with 6 shots. 0.6% of it has defects. Scanning time: 12:34.",
    );
  });
});

describe("the card once per roll (D-121)", () => {
  const scale = { widthIn: 16.84, width: 1920, height: 1080, shot: 1 };
  it("uses the roll's scale only for a picture of the same size", () => {
    expect(rollScaleFits(scale, 1920, 1080)).toBe(true);
    expect(rollScaleFits(scale, 1280, 720)).toBe(false);
    expect(rollScaleFits(null, 1920, 1080)).toBe(false);
  });
});
