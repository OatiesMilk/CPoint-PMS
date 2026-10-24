/**
 * The Capture page's rules (Phase 18): which state the camera is in and what to tell the person,
 * when a failed send is retried, and whether this browser counts as a phone. Pure, so every
 * message is unit-tested.
 */

export type CameraProblem = "insecure" | "denied" | "no_camera" | "busy" | "unknown";

/** A phone or tablet sends `PHONE` as the scan's source; anything else `WEBCAM`. */
export function isPhoneOrTablet(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(userAgent)) return true;
  // iPadOS asks for the desktop site: it says "Macintosh" but has a touch screen.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export const isAppleMobile = (userAgent: string, maxTouchPoints = 0) =>
  /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);

/** What getUserMedia's error means for the person (DOMException names). */
export function cameraProblemFor(errorName: string | undefined): CameraProblem {
  switch (errorName) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "no_camera";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    default:
      return "unknown";
  }
}

export function cameraProblemMessage(
  problem: CameraProblem,
  context: { appleMobile: boolean },
): { title: string; fix: string } {
  switch (problem) {
    case "insecure":
      return {
        title: "The camera only works on a secure address.",
        fix: "Open this site through its https:// link (the Cloudflare Tunnel address), or use this page on the server PC at localhost.",
      };
    case "denied":
      return {
        title: "This browser isn’t allowed to use the camera.",
        fix: context.appleMobile
          ? "On the iPhone, open Settings → Apps → Safari → Camera and choose Allow (or tap “aA” in the address bar → Website Settings → Camera → Allow), then press Try again."
          : "Click the camera icon at the right of the address bar, choose Allow, then press Try again.",
      };
    case "no_camera":
      return {
        title: "No camera was found.",
        fix: "Plug in a webcam, or open this page on your phone, then press Try again.",
      };
    case "busy":
      return {
        title: "Another app is using this camera.",
        fix: "Close it (DroidCam or a video call), then press Try again.",
      };
    case "unknown":
      return {
        title: "The camera couldn’t be started.",
        fix: "Press Try again. If it keeps failing, choose another camera or reload the page.",
      };
  }
}

/** How many times a capture is sent before the page asks the person to send it again. */
export const SEND_ATTEMPTS = 3;

/**
 * Whether a failed send is tried again with the same captureId (a repeat never makes a second
 * scan, D-051): yes for a dropped connection and a server error, no for anything the app refused
 * on purpose, including 503 (the model is missing, which a retry won't fix).
 */
export function shouldRetry(status: number | "network"): boolean {
  if (status === "network") return true;
  return status >= 500 && status !== 503;
}

/** "Space also captures", unless the key went to a control that uses Space itself. */
export function spaceCaptures(target: { tagName?: string; isContentEditable?: boolean } | null) {
  if (!target) return true;
  if (target.isContentEditable) return false;
  return !["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(
    (target.tagName ?? "").toUpperCase(),
  );
}

/**
 * What the Floor view says for a verdict (D-074, two results since D-093): the word and where the
 * piece goes next. A rejected section is reported for salvage (A-11).
 */
export const FLOOR_VERDICT = {
  PASS: { word: "Pass", next: "Goes on to cutting" },
  REJECT: { word: "Reject", next: "Set aside for salvage" },
} as const satisfies Record<"PASS" | "REJECT", { word: string; next: string }>;

/** The line under a failed send, by what happened. */
export function sendFailureMessage(status: number | "network", appMessage?: string): string {
  if (status === "network")
    return "Not sent: the server didn’t answer. Check the Wi-Fi, then press Send again. Nothing was saved twice.";
  if (status >= 500 && status !== 503)
    return "Not sent: the server hit an error. Press Send again in a moment. Nothing was saved twice.";
  return appMessage ?? "The app refused this capture. Press Capture to take it again.";
}
