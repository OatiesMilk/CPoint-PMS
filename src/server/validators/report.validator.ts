import { z } from "zod";
import { STAGES } from "@/lib/repair-rules";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

const short = z.string().trim().max(60).optional().catch(undefined);

/**
 * The URL params every report takes. The period is read by parseRange (src/lib/report-rules.ts),
 * which applies the defaults; the filters and the sort (Phase 35) are dropped when invalid.
 */
export const periodQuerySchema = z.object({
  preset: z.enum(["today", "7d", "14d", "30d"]).optional().catch(undefined),
  from: day,
  to: day,
  /** Phase 35: a day, a week of the month, a month, or the custom from/to above. */
  period: z.enum(["day", "week", "month", "custom"]).optional().catch(undefined),
  day,
  year: short,
  month: short,
  week: short,
});

export const sortQuerySchema = z.object({
  sort: z
    .string()
    .regex(/^[a-z][a-z-]*\.[a-z][a-z-]*$/)
    .optional()
    .catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
});

export const reportQuerySchema = periodQuerySchema.extend({
  /** Which report: Operations (Floor Manager) or Quality. */
  view: z.enum(["operations", "quality"]).optional().catch(undefined),
  /** Operations → the defect cards: a final defect type's key (Quality: a leather defect's key). */
  defect: short,
  remedy: z.enum(["FIXABLE", "NOT_FIXABLE"]).optional().catch(undefined),
  stage: z.enum(STAGES).optional().catch(undefined),
  /** Operations → Supplier quality. */
  supplierId: z.uuid().optional().catch(undefined),
  ...sortQuerySchema.shape,
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
