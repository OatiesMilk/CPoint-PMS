/**
 * The model's sidecar file (`yolo-v1.json` beside `yolo-v1.onnx`), written by the station's
 * `python -m cpoint_cv export-onnx`. ONNX Runtime for Node doesn't expose the model's own
 * metadata, so the class names, input size and `modelVersion` travel in this file (D-064).
 */
import { z } from "zod";

const classNames = z
  .record(z.string().regex(/^\d+$/), z.string().trim().min(1).max(50))
  .refine((names) => Object.keys(names).length > 0, "names must list at least one class.")
  .transform((names): Record<number, string> =>
    Object.fromEntries(Object.entries(names).map(([k, v]) => [Number(k), v])),
  );

export const modelInfoSchema = z.object({
  /** The weights' version, `<name>-<sha8>` of the `.pt` file, so station and website scans match. */
  modelVersion: z.string().trim().min(1).max(60),
  names: classNames,
  imgsz: z.number().int().min(32).max(4096),
  /** The model's stride: a photo is padded to a multiple of it (a dynamic-size export). */
  stride: z.number().int().min(1).max(256).default(32),
  onnxSha256: z.string().regex(/^[0-9a-f]{64}$/),
  confidenceFloor: z.number().min(0).max(1).default(0.25),
  overlapIou: z.number().min(0).max(1).default(0.7),
  rename: z.record(z.string(), z.string().trim().min(1).max(50)).default({}),
});

export type ModelInfo = z.infer<typeof modelInfoSchema>;

/** `models/yolo-v1.onnx` → `models/yolo-v1.json`. */
export function sidecarPath(modelPath: string): string {
  return modelPath.replace(/\.onnx$/i, "") + ".json";
}

/** Parses the sidecar's text, or throws a message that names the file and the fix. */
export function parseModelInfo(text: string, file: string): ModelInfo {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`${file} isn't valid JSON. Export the model again with export-onnx.`);
  }
  const parsed = modelInfoSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `${file} is missing or has a wrong "${first?.path.join(".") || "value"}". Export the model again with export-onnx.`,
    );
  }
  return parsed.data;
}
