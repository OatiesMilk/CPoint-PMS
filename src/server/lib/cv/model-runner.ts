/**
 * Runs the camera model inside the app for captures from the website (Phase 18, D-064).
 *
 * `ModelRunner` is the port; `createOnnxModelRunner` is the only code that imports
 * `onnxruntime-node`. The model loads on first use and stays loaded; captures run one at a time,
 * so two people pressing Capture together just wait a moment longer. Unit tests use a fake runner
 * (`setModelRunner`), so CI never loads ONNX.
 */
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/server/lib/errors";
import { getEnv } from "@/server/lib/env";
import { logger } from "@/server/lib/logger";
import { mapDetections, type MappedDetection } from "./mapper";
import { parseModelInfo, sidecarPath, type ModelInfo } from "./model-info";
import { decodeEndToEnd, letterbox, toModelInput } from "./yolo-output";

export type ModelStatus =
  { state: "ready"; modelVersion: string } | { state: "missing"; message: string };

export type ModelResult = {
  detections: MappedDetection[];
  modelVersion: string;
  inferenceMs: number;
};

export interface ModelRunner {
  /** Cheap: are the model files there (and readable)? Doesn't load the model. */
  status(): Promise<ModelStatus>;
  /** Runs the model on one photo (JPEG, PNG or WebP bytes). */
  detect(image: Uint8Array): Promise<ModelResult>;
}

export const MODEL_MISSING_MESSAGE =
  "The camera model isn't installed on the server. Put yolo-v1.onnx and yolo-v1.json in cv/models/ (see cv/README.md, “Capture from the website”), then restart the app.";

export const modelUnavailable = (message = MODEL_MISSING_MESSAGE) =>
  new AppError(503, "MODEL_UNAVAILABLE", message);

type Loaded = {
  info: ModelInfo;
  run: (
    input: Float32Array,
    width: number,
    height: number,
  ) => Promise<{ data: ArrayLike<number>; dims: readonly number[] }>;
};

export function createOnnxModelRunner(modelPath: string): ModelRunner {
  const file = path.resolve(modelPath);
  const infoFile = sidecarPath(file);
  let loading: Promise<Loaded> | null = null;
  // One capture at a time: each run waits for the one before it.
  let queue: Promise<unknown> = Promise.resolve();

  async function load(): Promise<Loaded> {
    try {
      await Promise.all([access(file), access(infoFile)]);
    } catch {
      throw modelUnavailable();
    }
    const info = parseModelInfo(await readFile(infoFile, "utf8"), path.basename(infoFile));
    const ort = await import("onnxruntime-node");
    const session = await ort.InferenceSession.create(file, { graphOptimizationLevel: "all" });
    const input = session.inputNames[0];
    const output = session.outputNames[0];
    logger.info({ model: info.modelVersion, file }, "Camera model loaded");
    return {
      info,
      async run(tensor, width, height) {
        const result = await session.run({
          [input]: new ort.Tensor("float32", tensor, [1, 3, height, width]),
        });
        const out = result[output];
        return { data: out.data as Float32Array, dims: out.dims };
      },
    };
  }

  function loaded(): Promise<Loaded> {
    loading ??= load().catch((error: unknown) => {
      loading = null; // try again next time: the files may be put in place meanwhile
      if (error instanceof AppError) throw error;
      logger.error({ err: error, file }, "The camera model couldn't be loaded");
      const detail = error instanceof Error ? error.message : String(error);
      throw modelUnavailable(
        `The camera model couldn't be loaded (${detail}). Export it again with export-onnx, put both files in cv/models/, then restart the app.`,
      );
    });
    return loading;
  }

  async function runOnce(image: Uint8Array): Promise<ModelResult> {
    const model = await loaded();
    const started = performance.now();
    const sharp = (await import("sharp")).default;
    const source = sharp(image).rotate(); // phone photos may carry an EXIF rotation
    const meta = await source.metadata();
    if (!meta.width || !meta.height) throw new Error("The image has no size.");
    // EXIF orientations 5 to 8 turn the photo a quarter, which swaps its width and height.
    const turned = (meta.orientation ?? 1) >= 5;
    const width = turned ? meta.height : meta.width;
    const height = turned ? meta.width : meta.height;
    const box = letterbox(width, height, model.info.imgsz, model.info.stride);
    const rgb = await source.removeAlpha().toColourspace("srgb").raw().toBuffer();
    const output = await model.run(
      toModelInput(new Uint8Array(rgb.buffer, rgb.byteOffset, rgb.length), box),
      box.inputWidth,
      box.inputHeight,
    );
    const [, rows, cols] = output.dims;
    const raw = decodeEndToEnd(output.data, rows, cols, model.info.confidenceFloor, box);
    const detections = mapDetections(raw, model.info.names, {
      confidenceFloor: model.info.confidenceFloor,
      rename: model.info.rename,
      maxDetections: 50,
      overlapIou: model.info.overlapIou,
    });
    return {
      detections,
      modelVersion: model.info.modelVersion,
      inferenceMs: Math.round(performance.now() - started),
    };
  }

  return {
    async status() {
      try {
        await Promise.all([access(file), access(infoFile)]);
      } catch {
        return { state: "missing", message: MODEL_MISSING_MESSAGE };
      }
      try {
        const info = parseModelInfo(await readFile(infoFile, "utf8"), path.basename(infoFile));
        return { state: "ready", modelVersion: info.modelVersion };
      } catch (error) {
        return { state: "missing", message: (error as Error).message };
      }
    },
    detect(image) {
      const next = queue.then(() => runOnce(image));
      queue = next.catch(() => undefined);
      return next;
    },
  };
}

let runner: ModelRunner | undefined;

export function getModelRunner(): ModelRunner {
  runner ??= createOnnxModelRunner(getEnv().CV_MODEL_PATH);
  return runner;
}

/** Tests replace the runner with a fake. */
export function setModelRunner(next: ModelRunner | undefined): void {
  runner = next;
}
