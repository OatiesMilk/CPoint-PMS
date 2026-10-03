import { handle, json } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import { listAudit } from "@/server/services/audit-query.service";
import { auditQuerySchema } from "@/server/validators/audit.validator";

export const auditController = {
  /** GET /api/v1/audit-logs?actor=&action=&entity=&entityId=&from=&to=&page= (Manila days) */
  index: handle(async (request: Request) => {
    await requireApiPermission("audit:read");
    const query = auditQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return json({ data: await listAudit(query) });
  }),
};
