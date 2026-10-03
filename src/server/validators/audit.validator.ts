import { z } from "zod";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

/** Audit log filters (URL search params). Invalid values are dropped rather than erroring. */
export const auditQuerySchema = z.object({
  actor: z.uuid().optional().catch(undefined),
  action: z
    .string()
    .regex(/^[a-z_]+\.[a-z_.]+$/)
    .max(60)
    .optional()
    .catch(undefined),
  entity: z
    .string()
    .regex(/^[A-Za-z]{2,40}$/)
    .optional()
    .catch(undefined),
  entityId: z.string().trim().max(60).optional().catch(undefined),
  from: day,
  to: day,
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;
