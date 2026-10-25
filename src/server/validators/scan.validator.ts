import { z } from "zod";
import { ScanSource } from "@/lib/domain";
import { OUT_OF_DATE } from "./shared";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DETECTIONS = 50;

// The camera device reads these, not a person at a form, so each one names the JSON field.
const fraction = (field: string) =>
  z
    .number({ error: `${field} must be a number between 0 and 1.` })
    .min(0, `${field} can't be below 0. Send a fraction between 0 and 1.`)
    .max(1, `${field} can't be above 1. Send a fraction between 0 and 1.`);

export const detectionSchema = z
  .object({
    classKey: z
      .string({ error: "classKey must be the defect class name, as text." })
      .trim()
      .min(1, "classKey can't be empty. Send the defect class name.")
      .max(50, "classKey can be at most 50 characters."),
    confidence: fraction("confidence"),
    box: z.object(
      {
        x: fraction("box.x"),
        y: fraction("box.y"),
        width: fraction("box.width"),
        height: fraction("box.height"),
      },
      { error: "box must be an object with x, y, width and height." },
    ),
  })
  .refine((d) => d.box.x + d.box.width <= 1.0001 && d.box.y + d.box.height <= 1.0001, {
    message: "The box must lie inside the image (fractions of width and height).",
    path: ["box"],
  });

export type DetectionValues = z.infer<typeof detectionSchema>;

/** The non-file fields of POST /api/v1/scans (multipart/form-data). */
export const ingestFieldsSchema = z.object({
  detections: z
    .string({ error: "detections must be a JSON array, sent as text." })
    .default("[]")
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "detections must be a JSON array, e.g. [] when nothing was found.",
        });
        return z.NEVER;
      }
    })
    .pipe(
      z
        .array(detectionSchema, {
          error: "detections must be a JSON array, e.g. [] when nothing was found.",
        })
        .max(
          MAX_DETECTIONS,
          `detections can have at most ${MAX_DETECTIONS} entries per scan. Send the strongest ones.`,
        ),
    ),
  rollId: z.uuid("rollId must be a roll id from this system, or left out.").optional(),
  /** The camera's own id for this capture, so a retry never creates a second scan (D-051). */
  captureId: z
    .uuid("captureId must be a UUID the camera made for this capture, or left out.")
    .optional(),
  modelVersion: z
    .string({ error: "modelVersion must be text, e.g. yolo-v8-2026-10." })
    .trim()
    .max(60, "modelVersion can be at most 60 characters.")
    .optional(),
  source: z
    .enum(ScanSource, { error: `source must be one of: ${Object.values(ScanSource).join(", ")}.` })
    .default("WEBCAM"),
  capturedAt: z.iso
    .datetime({
      offset: true,
      error:
        "capturedAt must be an ISO date and time with an offset, e.g. 2026-10-10T09:30:00+08:00.",
    })
    .transform((v) => new Date(v))
    .refine(
      (d) => d.getTime() <= Date.now() + 5 * 60_000,
      "capturedAt can't be in the future. Check the device clock.",
    )
    .optional(),
});

export type IngestFields = z.infer<typeof ingestFieldsSchema>;

export const isScanId = (value: string) => z.uuid().safeParse(value).success;

/**
 * The non-file fields of POST /api/v1/scans/capture: a capture from the website's Capture page
 * (Phase 18). The server runs the model, so there are no `detections` or `modelVersion` here.
 * The page always makes a captureId, so a retry never makes a second scan (D-051).
 */
export const captureFieldsSchema = ingestFieldsSchema
  .pick({ rollId: true, capturedAt: true })
  .extend({
    captureId: z.uuid("captureId must be the UUID this page made for the capture."),
    source: z
      .enum(["WEBCAM", "PHONE"], { error: "source must be WEBCAM or PHONE." })
      .default("WEBCAM"),
  });

export type CaptureFields = z.infer<typeof captureFieldsSchema>;

/** PUT /api/v1/camera/operators/{userId}: may this constructor capture (D-075)? */
export const cameraOperatorSchema = z.object({
  canCapture: z.boolean({ error: OUT_OF_DATE }),
});
