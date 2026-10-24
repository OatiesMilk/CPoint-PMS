import { AppError, Errors } from "@/server/lib/errors";
import { handle, json } from "@/server/lib/http";
import { sniffImageType } from "@/server/lib/image-type";
import {
  requireApiCapture,
  requireApiPermission,
  requireApiUser,
  requireDevice,
} from "@/server/policies/guard";
import { can, canCaptureFor } from "@/server/policies/permissions";
import {
  NO_BATCH_MESSAGE,
  resolveCameraBatch,
  setCameraOperator,
} from "@/server/services/camera.service";
import { getStorage } from "@/server/lib/storage";
import { captureScan } from "@/server/services/capture.service";
import { ingestScan } from "@/server/services/scan-ingest.service";
import { getScanDetail, latestScans, listScans } from "@/server/services/scan-query.service";
import { readJsonBody } from "@/server/lib/http";
import {
  cameraOperatorSchema,
  captureFieldsSchema,
  ingestFieldsSchema,
  isScanId,
  MAX_IMAGE_BYTES,
  scanListQuerySchema,
} from "@/server/validators/scan.validator";

type IdContext = { params: Promise<{ id: string }> };
type UserContext = { params: Promise<{ userId: string }> };

async function scanIdFrom(ctx: IdContext): Promise<string> {
  const { id } = await ctx.params;
  if (!isScanId(id)) throw Errors.notFound("This scan");
  return id;
}

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

/** The multipart body of a scan: the form, and its 'image' checked by size and by its bytes. */
async function readImageForm(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES + 1024 * 1024) {
    throw Errors.tooLarge("The upload is larger than 10 MB.");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw Errors.badRequest(
      "Send multipart/form-data with the captured image in the 'image' field.",
    );
  }
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    throw Errors.validation([
      { path: ["image"], message: "Attach the captured image as 'image'." },
    ]);
  }
  if (file.size > MAX_IMAGE_BYTES) throw Errors.tooLarge("The image is larger than 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type)
    throw Errors.validation([
      { path: ["image"], message: "The image must be a JPEG, PNG or WebP file." },
    ]);
  return { form, image: { bytes, type } };
}

export const scanController = {
  /** GET /api/v1/scans?verdict=&source=&batch=&defect=&page=  or  ?limit=8 (latest, for the live widget). */
  index: handle(async (request: Request) => {
    await requireApiPermission("scan:read");
    const query = scanListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (query.limit) return json({ data: await latestScans(query.limit) });
    const { rows, total, page, pageCount } = await listScans(query);
    return json({ data: rows, meta: { total, page, pageCount } });
  }),

  /** GET /api/v1/scans/{id}: the scan, its detections and the rule used. */
  show: handle(async (_request: Request, ctx: IdContext) => {
    await requireApiPermission("scan:read");
    const scan = await getScanDetail(await scanIdFrom(ctx));
    if (!scan) throw Errors.notFound("This scan");
    return json({ data: scan });
  }),

  /** GET /api/v1/scans/{id}/image: the captured image (private, cacheable: keys are never reused). */
  image: handle(async (_request: Request, ctx: IdContext) => {
    await requireApiPermission("scan:read");
    const scan = await getScanDetail(await scanIdFrom(ctx));
    if (!scan?.imagePath) throw Errors.notFound("This scan's image");
    let bytes: Buffer;
    try {
      bytes = await getStorage().read(scan.imagePath);
    } catch {
      throw Errors.notFound("This scan's image file");
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": scan.imageMime ?? "application/octet-stream",
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }),

  /** POST /api/v1/scans: camera ingestion (multipart/form-data, device token). */
  ingest: handle(async (request: Request) => {
    const device = await requireDevice(request, "scans:create");
    const { form, image } = await readImageForm(request);
    const fields = ingestFieldsSchema.parse({
      detections: text(form.get("detections")),
      batchId: text(form.get("batchId")),
      captureId: text(form.get("captureId")),
      modelVersion: text(form.get("modelVersion")),
      source: text(form.get("source")),
      capturedAt: text(form.get("capturedAt")),
    });

    const result = await ingestScan({ image, ...fields }, device);
    // A repeated captureId returns the first scan unchanged (D-051).
    return json({ data: result }, result.duplicate ? 200 : 201);
  }),

  /**
   * POST /api/v1/scans/capture: a capture from the website's Capture page (multipart/form-data,
   * signed-in session). The app runs the model, then decides as for any scan (Phase 18).
   */
  capture: handle(async (request: Request) => {
    const user = await requireApiCapture();
    const { form, image } = await readImageForm(request);
    const fields = captureFieldsSchema.parse({
      batchId: text(form.get("batchId")),
      captureId: text(form.get("captureId")),
      source: text(form.get("source")),
      capturedAt: text(form.get("capturedAt")),
    });
    const result = await captureScan(image, fields, user);
    return json({ data: result }, result.duplicate ? 200 : 201);
  }),

  /** PUT /api/v1/camera/operators/{userId}  { canCapture }: may this constructor capture (D-075)? */
  setCameraOperator: handle(async (request: Request, ctx: UserContext) => {
    const user = await requireApiPermission("camera:operators");
    const { userId } = await ctx.params;
    if (!isScanId(userId)) throw Errors.notFound("This person");
    const { canCapture } = cameraOperatorSchema.parse(await readJsonBody(request));
    return json({ data: await setCameraOperator(userId, canCapture, user) });
  }),

  /** GET /api/v1/batches/current: where the next scan will go. Device token or a signed-in viewer. */
  currentBatch: handle(async (request: Request) => {
    if (request.headers.get("authorization")) await requireDevice(request, "scans:create");
    else {
      // Camera viewers, and anyone who may capture (an allowed constructor, D-075).
      const user = await requireApiUser();
      if (!can(user.role, "camera:view") && !canCaptureFor(user)) throw Errors.forbidden();
    }

    const batch = await resolveCameraBatch();
    if (!batch) throw new AppError(404, "NO_BATCH_AT_PREPARATION", NO_BATCH_MESSAGE);
    return json({
      data: {
        batchId: batch.id,
        batchCode: batch.code,
        rollCode: batch.rollCode,
        shoeType: batch.shoeType.name,
        selection: batch.selection,
        scanned: batch._count.scans,
        stageStartedAt: batch.stageLogs[0]?.startedAt ?? null,
      },
    });
  }),
};
