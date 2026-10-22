import { describe, expect, it } from "vitest";
import {
  FLOOR_VERDICT,
  cameraProblemFor,
  cameraProblemMessage,
  isAppleMobile,
  isPhoneOrTablet,
  sendFailureMessage,
  shouldRetry,
  spaceCaptures,
} from "@/lib/capture-rules";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

describe("which device is capturing", () => {
  it("calls a phone or tablet PHONE and a PC WEBCAM", () => {
    expect(isPhoneOrTablet(IPHONE)).toBe(true);
    expect(isPhoneOrTablet(IPAD_DESKTOP, 5)).toBe(true); // iPadOS asks for the desktop site
    expect(isPhoneOrTablet(IPAD_DESKTOP, 0)).toBe(false); // a real Mac
    expect(isPhoneOrTablet(WINDOWS)).toBe(false);
  });

  it("knows when to give iPhone settings", () => {
    expect(isAppleMobile(IPHONE)).toBe(true);
    expect(isAppleMobile(WINDOWS)).toBe(false);
  });
});

describe("camera problems", () => {
  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "no_camera"],
    ["OverconstrainedError", "no_camera"],
    ["NotReadableError", "busy"],
    ["TypeError", "unknown"],
    [undefined, "unknown"],
  ] as const)("%s → %s", (name, problem) => {
    expect(cameraProblemFor(name)).toBe(problem);
  });

  const context = { appleMobile: false };

  it("sends an insecure page to the site's https:// link or localhost, with no port to type", () => {
    const { fix } = cameraProblemMessage("insecure", context);
    expect(fix).toContain("https://");
    expect(fix).toContain("localhost");
    expect(fix).not.toMatch(/3443|certificate/);
  });

  it("gives the iPhone's own steps when the camera is refused", () => {
    expect(cameraProblemMessage("denied", { ...context, appleMobile: true }).fix).toMatch(
      /Settings → Apps → Safari → Camera/,
    );
    expect(cameraProblemMessage("denied", context).fix).toMatch(/address bar/);
  });

  it("names what to close when the camera is busy", () => {
    expect(cameraProblemMessage("busy", context).fix).toMatch(/DroidCam/);
  });
});

describe("sending", () => {
  it("retries a dropped connection and server errors, never a refusal or a missing model", () => {
    expect(shouldRetry("network")).toBe(true);
    expect(shouldRetry(500)).toBe(true);
    expect(shouldRetry(502)).toBe(true);
    expect(shouldRetry(503)).toBe(false);
    expect(shouldRetry(409)).toBe(false);
    expect(shouldRetry(422)).toBe(false);
  });

  it("says nothing was saved twice when it can be sent again", () => {
    expect(sendFailureMessage("network")).toMatch(/Nothing was saved twice/);
    expect(sendFailureMessage(409, "No batch is at Preparation.")).toBe(
      "No batch is at Preparation.",
    );
  });

  it("lets Space capture except on controls that use Space themselves", () => {
    expect(spaceCaptures(null)).toBe(true);
    expect(spaceCaptures({ tagName: "BODY" })).toBe(true);
    expect(spaceCaptures({ tagName: "button" })).toBe(false);
    expect(spaceCaptures({ tagName: "SELECT" })).toBe(false);
    expect(spaceCaptures({ tagName: "DIV", isContentEditable: true })).toBe(false);
  });
});

describe("Floor view verdicts (D-074)", () => {
  it("names every verdict with the system's words and the bin it goes to", () => {
    expect(FLOOR_VERDICT.PASS).toEqual({ word: "Pass", next: "Goes on to cutting" });
    expect(FLOOR_VERDICT.REWORK).toEqual({ word: "Fixable", next: "To the Repair Station" });
    expect(FLOOR_VERDICT.REJECT).toEqual({ word: "Reject", next: "To salvage" });
    expect(FLOOR_VERDICT.NEEDS_REVIEW.word).toBe("Needs review");
  });

  it("never says Rework or Hold on the floor", () => {
    const words = Object.values(FLOOR_VERDICT).flatMap((v) => [v.word, v.next]);
    expect(words.join(" ")).not.toMatch(/rework|hold/i);
  });
});
