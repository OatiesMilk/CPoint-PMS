import { z } from "zod";
import { ScanSource, Verdict } from "@/lib/domain";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DETECTIONS = 50;

const fraction = z.number().min(0).max(1);

export const detectionSchema = z
  .object({
    classKey: z.string().trim().min(1).max(50),
    confidence: fraction,
    box: z.object({ x: fraction, y: fraction, width: fraction, height: fraction }),
  })
  .refine((d) => d.box.x + d.box.width <= 1.0001 && d.box.y + d.box.height <= 1.0001, {
    message: "The box must lie inside the image (fractions of width and height).",
    path: ["box"],
  });

export type DetectionValues = z.infer<typeof detectionSchema>;

/** The non-file fields of POST /api/v1/scans (multipart/form-data). */
export const ingestFieldsSchema = z.object({
  detections: z
    .string()
    .default("[]")
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "detections must be a JSON array." });
        return z.NEVER;
      }
    })
    .pipe(
      z
        .array(detectionSchema)
        .max(MAX_DETECTIONS, `At most ${MAX_DETECTIONS} detections per scan.`),
    ),
  batchId: z.uuid().optional(),
  modelVersion: z.string().trim().max(60).optional(),
  source: z.enum(ScanSource).default("WEBCAM"),
  capturedAt: z.iso
    .datetime({ offset: true })
    .transform((v) => new Date(v))
    .refine((d) => d.getTime() <= Date.now() + 5 * 60_000, "capturedAt can't be in the future.")
    .optional(),
});

export type IngestFields = z.infer<typeof ingestFieldsSchema>;

/** Human decision on a scan: resolve a NEEDS_REVIEW scan or override an automatic one. */
export const decisionSchema = z.object({
  verdict: z.enum(["PASS", "REWORK", "REJECT"]),
  reason: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().min(3, "Give a short reason (at least 3 characters).").max(300).optional(),
  ),
  /** The final verdict the person was looking at (null = pending review). Mismatch → 409 STALE. */
  expectedFinalVerdict: z.enum(Verdict).nullable(),
});

export type DecisionInput = z.infer<typeof decisionSchema>;

export const scanListQuerySchema = z.object({
  verdict: z.enum(Verdict).optional().catch(undefined),
  status: z.enum(["PENDING_REVIEW", "DECIDED"]).optional().catch(undefined),
  source: z.enum(ScanSource).optional().catch(undefined),
  batch: z.string().trim().max(30).optional().catch(undefined), // batch code, e.g. B-2026-0001
  override: z.enum(["1"]).optional().catch(undefined),
  /** A defect class key (from Reports → Defects by type): scans with a detection of it. */
  defect: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]{0,39}$/)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(50).optional().catch(undefined),
});

export type ScanListQuery = z.infer<typeof scanListQuerySchema>;

export const isScanId = (value: string) => z.uuid().safeParse(value).success;
