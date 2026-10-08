import { parseRange } from "@/lib/report-rules";
import { handle, json } from "@/server/lib/http";
import {
  operationsCsv,
  operationsReport,
  repairStation,
  stockCsv,
  suppliersCsv,
} from "@/server/services/ops-report.service";
import { requireApiPermission } from "@/server/policies/guard";
import {
  dailyCsv,
  defectsCsv,
  productionReport,
  qualityReport,
  stagesCsv,
} from "@/server/services/report.service";
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
  /** GET /api/v1/reports/quality?preset=|from=&to= */
  quality: handle(async (request: Request) => {
    await requireApiPermission("report:quality");
    return json({ data: await qualityReport(rangeFrom(request)) });
  }),

  /** GET /api/v1/reports/production?preset=|from=&to= (Floor Manager) */
  production: handle(async (request: Request) => {
    await requireApiPermission("report:production");
    return json({ data: await productionReport(rangeFrom(request)) });
  }),

  /** GET /api/v1/reports/operations?preset=|from=&to= (Floor Manager) */
  operations: handle(async (request: Request) => {
    await requireApiPermission("report:production");
    return json({ data: await operationsReport(rangeFrom(request)) });
  }),

  /** GET /api/v1/reports/repairs?preset=|from=&to= (Floor Manager, Quality Inspector) */
  repairs: handle(async (request: Request) => {
    await requireApiPermission("report:quality");
    return json({ data: await repairStation(rangeFrom(request)) });
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

  stagesCsv: handle(async (request: Request) => {
    await requireApiPermission("report:production");
    const range = rangeFrom(request);
    return csv(await stagesCsv(range), "stages", range);
  }),
};
