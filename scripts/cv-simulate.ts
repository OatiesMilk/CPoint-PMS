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
import sharp from "sharp";

type Box = { x: number; y: number; width: number; height: number };
type Detection = { classKey: string; confidence: number; box: Box };

const KNOWN = ["cut", "hole", "abrasion", "dirt"] as const;

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const count = Number(arg("count", "20"));
const intervalMs = Number(arg("interval", "3")) * 1000;
const batchId = arg("batch");
const baseUrl = (process.env.CV_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const token = process.env.CV_DEVICE_TOKEN;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
const round = (n: number) => Math.round(n * 1000) / 1000;

function randomBox(): Box {
  const width = rand(0.06, 0.2);
  const height = rand(0.05, 0.18);
  return {
    x: round(rand(0.03, 0.97 - width)),
    y: round(rand(0.03, 0.97 - height)),
    width: round(width),
    height: round(height),
  };
}

function scenario(): Detection[] {
  const r = Math.random();
  const det = (classKey: string, lo: number, hi: number): Detection => ({
    classKey,
    confidence: round(rand(lo, hi)),
    box: randomBox(),
  });
  if (r < 0.3) return [];
  if (r < 0.6) return [det(pick(KNOWN), 0.15, 0.55)];
  if (r < 0.82)
    return [
      det(pick(KNOWN), 0.6, 0.89),
      ...(Math.random() < 0.3 ? [det(pick(KNOWN), 0.2, 0.5)] : []),
    ];
  if (r < 0.95) return [det(pick(KNOWN), 0.9, 0.99)];
  return [det("scratch", 0.7, 0.95)];
}

/** A leather-grain section with each defect drawn inside its box. */
async function renderImage(detections: Detection[]): Promise<Buffer> {
  const W = 960;
  const H = 720;
  const marks = detections
    .map(({ classKey, box }) => {
      const x = box.x * W,
        y = box.y * H,
        w = box.width * W,
        h = box.height * H;
      const cx = x + w / 2,
        cy = y + h / 2;
      switch (classKey) {
        case "cut":
          return `<path d="M${x + w * 0.1} ${y + h * 0.3} L${x + w * 0.9} ${y + h * 0.7}" stroke="#1d0f07" stroke-width="5" stroke-linecap="round"/>`;
        case "hole":
          return `<ellipse cx="${cx}" cy="${cy}" rx="${w * 0.25}" ry="${h * 0.3}" fill="#0f0804"/>`;
        case "abrasion":
          return `<ellipse cx="${cx}" cy="${cy}" rx="${w * 0.45}" ry="${h * 0.4}" fill="#c9a27a" opacity="0.75" filter="url(#rough)"/>`;
        case "dirt":
          return `<ellipse cx="${cx}" cy="${cy}" rx="${w * 0.4}" ry="${h * 0.35}" fill="#2b2118" opacity="0.6" filter="url(#rough)"/>`;
        default:
          return `<path d="M${x} ${y + h * 0.2} l${w} ${h * 0.2} M${x} ${y + h * 0.5} l${w} ${h * 0.15} M${x} ${y + h * 0.8} l${w} ${h * 0.1}" stroke="#e8cfae" stroke-width="2"/>`;
      }
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${Math.floor(rand(1, 999))}"/>
        <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0.35 0"/></filter>
      <filter id="rough"><feTurbulence baseFrequency="0.08" numOctaves="2"/><feDisplacementMap in="SourceGraphic" scale="14"/></filter>
      <linearGradient id="hide" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a4a26"/><stop offset="1" stop-color="#5b341a"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#hide)"/>
    <rect width="${W}" height="${H}" filter="url(#grain)"/>
    ${marks}
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

async function sendOne(n: number) {
  const detections = scenario();
  const image = await renderImage(detections);
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
