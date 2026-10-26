import { parseRange } from "@/lib/report-rules";
import { handle, json } from "@/server/lib/http";
import {
  operationsCsv,
  operationsReport,
  stockCsv,
  supplierRollsCsv,
  suppliersCsv,
} from "@/server/services/ops-report.service";
import { requireApiPermission } from "@/server/policies/guard";
import { materialsCsv, materialsReport } from "@/server/services/materials.service";
import { productionCsv, productionReport } from "@/server/services/production.service";
import { dailyCsv, defectsCsv, qualityReport } from "@/server/services/report.service";
import { reportQuerySchema } from "@/server/validators/report.validator";

function rangeFrom(request: Request) {
  const params = reportQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return parseRange(params);
}

/** A CSV download (UTF-8 with BOM, opens correctly in Excel). */
function csv(body: string, name: string, range: { from: string; to: string }): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cpoint-${name}-${range.from}_${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export const reportController = {
  /** GET /api/v1/reports/materials: what each material was used for, the last 8 weeks (Phase 29) */
  materials: handle(async () => {
    await requireApiPermission("report:production");
    return json({ data: await materialsReport() });
  }),

  /** GET /api/v1/reports/materials-used.csv: one row per item and week */
  materialsCsv: handle(async () => {
    await requireApiPermission("report:production");
    const { body, from, to } = await materialsCsv();
    return csv(body, "materials-used", { from, to });
  }),

  /** GET /api/v1/reports/quality?preset=|from=&to= */
  quality: handle(async (request: Request) => {
    await requireApiPermission("report:quality");
    return json({ data: await qualityReport(rangeFrom(request)) });
  }),

  /** GET /api/v1/reports/production?preset=|from=&to=: per day pairs finished, failed and passed vs the quota */
  production: handle(async (request: Request) => {
    await requireApiPermission("report:production");
    return json({ data: await productionReport(rangeFrom(request)) });
  }),

  /** GET /api/v1/reports/operations?preset=|from=&to= (Floor Manager) */
  operations: handle(async (request: Request) => {
    await requireApiPermission("report:production");
    return json({ data: await operationsReport(rangeFrom(request)) });
  }),

  operationsCsv: handle(async (request: Request) => {
    await requireApiPermission("report:production");
    const range = rangeFrom(request);
    return csv(await operationsCsv(range), "operations", range);
  }),

  suppliersCsv: handle(async (request: Request) => {
    await requireApiPermission("report:production");
    const range = rangeFrom(request);
    return csv(await suppliersCsv(range), "suppliers", range);
  }),

  supplierRollsCsv: handle(async (request: Request) => {
    await requireApiPermission("report:production");
    const range = rangeFrom(request);
    return csv(await supplierRollsCsv(range), "supplier-rolls", range);
  }),

  stockCsv: handle(async (request: Request) => {
    await requireApiPermission("report:production");
    const range = rangeFrom(request);
    return csv(await stockCsv(range), "stock", range);
  }),

  dailyCsv: handle(async (request: Request) => {
    await requireApiPermission("report:quality");
    const range = rangeFrom(request);
    return csv(await dailyCsv(range), "daily", range);
  }),

  defectsCsv: handle(async (request: Request) => {
    await requireApiPermission("report:quality");
    const range = rangeFrom(request);
    return csv(await defectsCsv(range), "defects", range);
  }),

  /** One row a day: pairs finished, failed and passed, the quota, batches, constructors present. */
  productionCsv: handle(async (request: Request) => {
    await requireApiPermission("report:production");
    const range = rangeFrom(request);
    return csv(await productionCsv(range), "production", range);
  }),
};
