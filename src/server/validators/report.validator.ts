import { z } from "zod";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

/** Report range from URL params; parseRange (src/lib/report-rules.ts) applies the defaults. */
export const reportQuerySchema = z.object({
  preset: z.enum(["today", "7d", "14d", "30d"]).optional().catch(undefined),
  from: day,
  to: day,
  /** Which report: Operations (Floor Manager) or Quality. */
  view: z.enum(["operations", "quality"]).optional().catch(undefined),
});
