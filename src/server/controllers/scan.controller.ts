import { AppError, Errors } from "@/server/lib/errors";
import { handle, json } from "@/server/lib/http";
import { sniffImageType } from "@/server/lib/image-type";
import { requireApiPermission, requireDevice } from "@/server/policies/guard";
import { NO_BATCH_MESSAGE, resolveCameraBatch } from "@/server/services/camera.service";
import { ingestScan } from "@/server/services/scan-ingest.service";
import { ingestFieldsSchema, MAX_IMAGE_BYTES } from "@/server/validators/scan.validator";

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

export const scanController = {
  /** POST /api/v1/scans: camera ingestion (multipart/form-data, device token). */
  ingest: handle(async (request: Request) => {
    const device = await requireDevice(request, "scans:create");
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

    const fields = ingestFieldsSchema.parse({
      detections: text(form.get("detections")),
      batchId: text(form.get("batchId")),
      modelVersion: text(form.get("modelVersion")),
      source: text(form.get("source")),
      capturedAt: text(form.get("capturedAt")),
    });

    const result = await ingestScan({ image: { bytes, type }, ...fields }, device);
    return json({ data: result }, 201);
  }),

  /** GET /api/v1/batches/current: where the next scan will go. Device token or a signed-in viewer. */
  currentBatch: handle(async (request: Request) => {
    if (request.headers.get("authorization")) await requireDevice(request, "scans:create");
    else await requireApiPermission("camera:view");

    const batch = await resolveCameraBatch();
    if (!batch) throw new AppError(404, "NO_BATCH_AT_PREPARATION", NO_BATCH_MESSAGE);
    return json({
      data: {
        batchId: batch.id,
        batchCode: batch.code,
        rollCode: batch.rollCode,
        shoeType: batch.shoeType.name,
        selection: batch.selection,
        stageStartedAt: batch.stageLogs[0]?.startedAt ?? null,
      },
    });
  }),
};
