/**
 * Runs the app's ONNX model (the Capture page's path) on photos and, given the station's
 * `predict --json` output for the same photos, checks the two agree (Phase 18, D-064).
 *
 *   cd cv && .venv/Scripts/python -m cpoint_cv predict <folder> --json > ../storage/py.jsonl
 *   npm run cv:parity -- <folder> --compare storage/py.jsonl
 *
 * Agreement: the same class keys in the same order, confidence within 0.02, and every box edge
 * within 0.01 of the image size. Without --compare it prints the detections and the time per
 * photo (the CPU time a capture takes on this machine). Exits 1 when a photo disagrees.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createOnnxModelRunner } from "../src/server/lib/cv/model-runner";
import type { MappedDetection } from "../src/server/lib/cv/mapper";

const CONFIDENCE_TOLERANCE = 0.02;
const BOX_TOLERANCE = 0.01;

const args = process.argv.slice(2);
const compareAt = args.indexOf("--compare");
const compareFile = compareAt >= 0 ? args[compareAt + 1] : undefined;
const modelAt = args.indexOf("--model");
const modelPath =
  modelAt >= 0 ? args[modelAt + 1] : (process.env.CV_MODEL_PATH ?? "cv/models/yolo-v1.onnx");
const target = args.find(
  (a, i) => !a.startsWith("--") && args[i - 1] !== "--compare" && args[i - 1] !== "--model",
);

if (!target) {
  console.error("Give a photo or a folder: npm run cv:parity -- <folder> [--compare file.jsonl]");
  process.exit(2);
}

const images = statSync(target).isDirectory()
  ? readdirSync(target)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()
      .map((f) => path.join(target, f))
  : [target];

type PyLine = { image: string; detections: MappedDetection[] };
const expected = new Map<string, MappedDetection[]>();
if (compareFile) {
  for (const line of readFileSync(compareFile, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as PyLine;
    expected.set(row.image, row.detections);
  }
}

function differences(ours: MappedDetection[], theirs: MappedDetection[]): string[] {
  const problems: string[] = [];
  if (ours.length !== theirs.length)
    problems.push(`${ours.length} detections here, ${theirs.length} from the station`);
  const n = Math.min(ours.length, theirs.length);
  for (let i = 0; i < n; i++) {
    const a = ours[i];
    const b = theirs[i];
    if (a.classKey !== b.classKey) problems.push(`#${i + 1}: ${a.classKey} vs ${b.classKey}`);
    if (Math.abs(a.confidence - b.confidence) > CONFIDENCE_TOLERANCE)
      problems.push(`#${i + 1}: confidence ${a.confidence} vs ${b.confidence}`);
    const edges = (d: MappedDetection) => [
      d.box.x,
      d.box.y,
      d.box.x + d.box.width,
      d.box.y + d.box.height,
    ];
    const far = edges(a).some((v, k) => Math.abs(v - edges(b)[k]) > BOX_TOLERANCE);
    if (far) problems.push(`#${i + 1}: box ${JSON.stringify(a.box)} vs ${JSON.stringify(b.box)}`);
  }
  return problems;
}

async function main() {
  const runner = createOnnxModelRunner(modelPath);
  const status = await runner.status();
  if (status.state !== "ready") {
    console.error(status.message);
    process.exit(2);
  }
  console.log(`Model ${status.modelVersion} from ${modelPath}`);
  let failed = 0;
  const times: number[] = [];
  for (const image of images) {
    const result = await runner.detect(new Uint8Array(readFileSync(image)));
    times.push(result.inferenceMs);
    const name = path.basename(image);
    const summary = result.detections
      .map((d) => `${d.classKey} ${d.confidence.toFixed(2)}`)
      .join(", ");
    const theirs = expected.get(name);
    const problems = theirs ? differences(result.detections, theirs) : [];
    const verdict = !theirs ? "" : problems.length ? "  DIFFERS" : "  agrees";
    console.log(`${name}  ${result.inferenceMs} ms  ${summary || "nothing found"}${verdict}`);
    for (const p of problems) console.log(`    ${p}`);
    if (problems.length) failed++;
  }
  const sorted = [...times].sort((a, b) => a - b);
  // The first photo includes loading the model, so the median is the fair number.
  console.log(
    `\n${images.length} photos, median ${sorted[Math.floor(sorted.length / 2)]} ms, slowest ${sorted.at(-1)} ms (the first includes loading the model).`,
  );
  if (compareFile) {
    console.log(
      failed
        ? `${failed} of ${images.length} photos differ from the station beyond the tolerance.`
        : `All ${images.length} photos agree with the station (confidence ±${CONFIDENCE_TOLERANCE}, box edges ±${BOX_TOLERANCE}).`,
    );
  }
  process.exit(failed ? 1 : 0);
}

void main();
