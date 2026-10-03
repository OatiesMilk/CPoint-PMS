/**
 * Camera simulator: posts realistic scans to POST /api/v1/scans exactly as the real YOLO service
 * will, so dashboards can be demoed without a camera.
 *
 *   npm run cv:simulate -- --count 20 --interval 3 [--batch <batchId>]
 *
 * Needs CV_DEVICE_TOKEN (create one: `npm run cv:token`) and optionally CV_BASE_URL in .env.
 * Mix: ~60% pass, ~22% rework, ~13% reject, ~5% an unknown class ("scratch") that needs review.
 */
import "dotenv/config";
import { renderLeatherImage, scenario } from "../src/server/lib/leather-scan";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const count = Number(arg("count", "20"));
const intervalMs = Number(arg("interval", "3")) * 1000;
const batchId = arg("batch");
const baseUrl = (process.env.CV_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const token = process.env.CV_DEVICE_TOKEN;

async function sendOne(n: number) {
  const detections = scenario();
  const image = await renderLeatherImage(detections);
  const form = new FormData();
  form.set("image", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), `sim-${n}.jpg`);
  form.set("detections", JSON.stringify(detections));
  form.set("source", "SIMULATOR");
  form.set("modelVersion", "simulator-1");
  if (batchId) form.set("batchId", batchId);

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
    `#${String(n).padStart(3)}  ${d.batchCode} · section ${String(d.sequence).padStart(3)}  ${String(d.verdict).padEnd(12)} ${top ? `${top.classKey} ${top.confidence.toFixed(2)}` : "no defects"}`,
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
    `Sending ${count} scans to ${baseUrl} every ${intervalMs / 1000}s${batchId ? ` (batch ${batchId})` : ""}…\n`,
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
