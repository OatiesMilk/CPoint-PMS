/**
 * Synthetic leather scans for the camera simulator and the demo week (D-026): a realistic mix
 * of detections and a matching JPEG with visible marks. No real camera needed. `random` is
 * injectable so the demo week is reproducible.
 */

export type Box = { x: number; y: number; width: number; height: number };
export type Detection = { classKey: string; confidence: number; box: Box };
export type Random = () => number;

export const KNOWN_CLASSES = ["cut", "hole", "abrasion", "dirt"] as const;
/**
 * A class no defect type covers, so its scans go to the review queue. No camera model emits it:
 * `scratch` was used before it became a real class of yolo-v1 (D-052).
 */
export const UNKNOWN_CLASS = "sim-unknown";

const round = (n: number) => Math.round(n * 1000) / 1000;

export function randomBox(random: Random): Box {
  const rand = (min: number, max: number) => min + random() * (max - min);
  const width = rand(0.06, 0.2);
  const height = rand(0.05, 0.18);
  return {
    x: round(rand(0.03, 0.97 - width)),
    y: round(rand(0.03, 0.97 - height)),
    width: round(width),
    height: round(height),
  };
}

/**
 * One section's detections: ~30% clean, ~30% a low-confidence mark (Pass), ~22% Rework,
 * ~13% Reject, ~5% an unknown class that needs review (with the default 90% / 60% thresholds).
 */
export function scenario(random: Random = Math.random): Detection[] {
  const rand = (min: number, max: number) => min + random() * (max - min);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const det = (classKey: string, lo: number, hi: number): Detection => ({
    classKey,
    confidence: round(rand(lo, hi)),
    box: randomBox(random),
  });
  const r = random();
  if (r < 0.3) return [];
  if (r < 0.6) return [det(pick(KNOWN_CLASSES), 0.15, 0.55)];
  if (r < 0.82)
    return [
      det(pick(KNOWN_CLASSES), 0.6, 0.89),
      ...(random() < 0.3 ? [det(pick(KNOWN_CLASSES), 0.2, 0.5)] : []),
    ];
  if (r < 0.95) return [det(pick(KNOWN_CLASSES), 0.9, 0.99)];
  return [det(UNKNOWN_CLASS, 0.7, 0.95)];
}

/** A JPEG of brown leather grain with a visible mark per detection. */
export async function renderLeatherImage(
  detections: Detection[],
  options: { width?: number; height?: number; random?: Random } = {},
): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const W = options.width ?? 960;
  const H = options.height ?? 720;
  const seed = Math.floor((options.random ?? Math.random)() * 998) + 1;
  const marks = detections
    .map(({ classKey, box }) => {
      const x = box.x * W;
      const y = box.y * H;
      const w = box.width * W;
      const h = box.height * H;
      const cx = x + w / 2;
      const cy = y + h / 2;
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
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${seed}"/>
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
