import type { Stage } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

export function openStageLog(
  data: {
    batchId: string;
    stage: Stage;
    startedById: string;
    startedAt: Date;
    isRollback?: boolean;
    reason?: string;
  },
  db: Db = defaultDb(),
) {
  return db.batchStageLog.create({ data });
}

/** Ends whatever stage the batch is in. A batch has at most one open log (enforced by the service). */
export function closeOpenStageLog(
  batchId: string,
  endedById: string,
  endedAt: Date,
  db: Db = defaultDb(),
) {
  return db.batchStageLog.updateMany({
    where: { batchId, endedAt: null },
    data: { endedAt, endedById },
  });
}
