-- Phase 26 (D-095): a roll is started, captured shot by shot and finished at Capture.
-- The leather-roll "batch" is a Roll in the code; the table keeps its name. Existing rows are
-- converted (A-10): PLANNED and IN_PROGRESS become OPEN, COMPLETED becomes FINISHED; start and
-- finish times come from the stage logs before they are dropped.

-- 1. New status type and the new columns.
CREATE TYPE "RollStatus" AS ENUM ('OPEN', 'FINISHED', 'CANCELLED');

ALTER TABLE "batches"
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "finishedAt" TIMESTAMP(3),
  ADD COLUMN "finishedById" UUID,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" UUID,
  ADD COLUMN "rollStatus" "RollStatus";

-- 2. Convert the rows while the stage logs still exist.
UPDATE "batches" b SET
  "rollStatus" = CASE b."status"::text
    WHEN 'COMPLETED' THEN 'FINISHED'::"RollStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"RollStatus"
    ELSE 'OPEN'::"RollStatus"
  END,
  "startedAt" = coalesce(
    (SELECT min(l."startedAt") FROM "batch_stage_logs" l WHERE l."batchId" = b.id),
    b."createdAt"
  );

UPDATE "batches" b SET
  "finishedAt" = coalesce(last."endedAt", b."updatedAt"),
  "finishedById" = coalesce(last."endedById", b."createdById")
FROM "batches" b2
LEFT JOIN LATERAL (
  SELECT l."endedAt", l."endedById" FROM "batch_stage_logs" l
  WHERE l."batchId" = b2.id AND l."endedAt" IS NOT NULL
  ORDER BY l."endedAt" DESC LIMIT 1
) last ON true
WHERE b2.id = b.id AND b."rollStatus" = 'FINISHED';

-- Who cancelled an old roll is in the audit log; the row gets its creator as the best guess.
UPDATE "batches" SET "cancelledAt" = "updatedAt", "cancelledById" = "createdById"
WHERE "rollStatus" = 'CANCELLED';

-- 3. Swap the status column.
DROP INDEX "batches_status_currentStage_idx";
ALTER TABLE "batches" DROP COLUMN "status";
ALTER TABLE "batches" RENAME COLUMN "rollStatus" TO "status";
ALTER TABLE "batches" ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'OPEN';
ALTER TABLE "batches" ALTER COLUMN "startedAt" SET NOT NULL,
  ALTER COLUMN "startedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- 4. What rolls no longer have (A-17): stages, the target quota, notes, the shoe type, and the
--    camera's chosen batch. Shoe types themselves go in Phase 27.
ALTER TABLE "batch_stage_logs" DROP CONSTRAINT "batch_stage_logs_batchId_fkey";
ALTER TABLE "batch_stage_logs" DROP CONSTRAINT "batch_stage_logs_endedById_fkey";
ALTER TABLE "batch_stage_logs" DROP CONSTRAINT "batch_stage_logs_startedById_fkey";
DROP TABLE "batch_stage_logs";

ALTER TABLE "batches" DROP CONSTRAINT "batches_shoeTypeId_fkey";
DROP INDEX "batches_shoeTypeId_idx";
ALTER TABLE "batches"
  DROP COLUMN "currentStage",
  DROP COLUMN "notes",
  DROP COLUMN "shoeTypeId",
  DROP COLUMN "targetQuotaPairs",
  ALTER COLUMN "rollCode" DROP NOT NULL,
  ALTER COLUMN "receivedAt" DROP NOT NULL;

ALTER TABLE "cv_settings" DROP CONSTRAINT "cv_settings_activeBatchId_fkey";
DROP INDEX "cv_settings_activeBatchId_idx";
ALTER TABLE "cv_settings" DROP COLUMN "activeBatchId";

DROP TYPE "BatchStatus";
DROP TYPE "Stage";

-- 5. Indexes and keys for the new columns.
CREATE INDEX "batches_status_startedAt_idx" ON "batches"("status", "startedAt");
CREATE INDEX "batches_status_createdById_idx" ON "batches"("status", "createdById");
CREATE INDEX "batches_finishedById_idx" ON "batches"("finishedById");
CREATE INDEX "batches_cancelledById_idx" ON "batches"("cancelledById");
ALTER TABLE "batches" ADD CONSTRAINT "batches_finishedById_fkey" FOREIGN KEY ("finishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "batches" ADD CONSTRAINT "batches_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
