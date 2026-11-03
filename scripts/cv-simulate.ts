/**
 * Camera simulator: posts realistic scans to POST /api/v1/scans exactly as the real YOLO service
 * will, so dashboards can be demoed without a camera.
 *
 *   npm run cv:simulate -- --count 20 --interval 3 [--roll <rollId>] [--classes <list>]
 *
 * Without --roll each scan goes to the roll open the longest, so start a roll at Capture first
 * (Phase 26). Needs CV_DEVICE_TOKEN (create one: `npm run cv:token`) and optionally CV_BASE_URL in .env.
 * Mix: about 82% Pass (clean, a faint mark, or a found Usable defect) and 18% Reject (a found Not
 * accepted defect). Classes default to the yolo-v1 ones with the outcomes `npm run demo:reset`
 * sets; give your own as --classes crease:USABLE,cut:NOT_ACCEPTED. A class with no defect type in
 * Settings is dropped by the app (D-108).
 */
import "dotenv/config";
import {
  MODEL_CLASSES,
  renderLeatherImage,
  scenario,
  type SceneClass,
} from "../src/server/lib/leather-scan";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const count = Number(arg("count", "20"));
const intervalMs = Number(arg("interval", "3")) * 1000;
const rollId = arg("roll");
const baseUrl = (process.env.CV_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const token = process.env.CV_DEVICE_TOKEN;
const classesArg = arg("classes");
const classes: SceneClass[] = classesArg
  ? classesArg
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const [key, outcome] = c.split(":");
        const upper = outcome?.trim().toUpperCase();
        if (upper && upper !== "USABLE" && upper !== "NOT_ACCEPTED") {
          console.error(`--classes: "${c}" must be key, key:USABLE or key:NOT_ACCEPTED.`);
          process.exit(2);
        }
        return { key: key.trim(), outcome: (upper as SceneClass["outcome"]) ?? null };
      })
  : MODEL_CLASSES;

async function sendOne(n: number) {
  const detections = scenario(Math.random, classes);
  const image = await renderLeatherImage(detections);
  const form = new FormData();
  form.set("image", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), `sim-${n}.jpg`);
  form.set("detections", JSON.stringify(detections));
  form.set("source", "SIMULATOR");
  form.set("modelVersion", "simulator-1");
  if (rollId) form.set("rollId", rollId);

  const res = await fetch(`${baseUrl}/api/v1/scans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: Record<string, unknown>;
    error?: { message: string };
  };
  if (!res.ok) {
    console.error(`✗ ${res.status} ${body.error?.message ?? res.statusText}`);
    if (res.status === 401)
      console.error("  Create a token with `npm run cv:token` and set CV_DEVICE_TOKEN in .env.");
    process.exit(1);
  }
  const top = [...detections].sort((a, b) => b.confidence - a.confidence)[0];
  const d = body.data!;
  console.log(
    `#${String(n).padStart(3)}  ${d.rollCode} · section ${String(d.sequence).padStart(3)}  ${String(d.verdict).padEnd(12)} ${top ? `${top.classKey} ${top.confidence.toFixed(2)}` : "no defects"}`,
  );
}

async function main() {
  if (!token) {
    console.error(
      "CV_DEVICE_TOKEN is not set. Create one with `npm run cv:token` and add it to .env.",
    );
    process.exit(1);
  }
  console.log(
    `Sending ${count} scans to ${baseUrl} every ${intervalMs / 1000}s${rollId ? ` (roll ${rollId})` : ""}…\n`,
  );
  for (let n = 1; n <= count; n++) {
    await sendOne(n);
    if (n < count) await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
