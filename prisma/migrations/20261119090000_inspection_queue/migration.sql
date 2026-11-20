-- Phase 33 (D-129): the Inspection queue. Every batch of a planned day gets a row and a code,
-- B-YYMMDD-N (A-57). Rows are made by the app from each day's plan and lunch break (the batch rules
-- live in TypeScript), so this migration adds the tables, marks when the queue began (A-61) and
-- renames the old B- and R- roll codes to the LR- format so that B- means a batch only.

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('OPEN', 'INSPECTING', 'INSPECTED', 'VOID');

-- CreateEnum
CREATE TYPE "BatchPriority" AS ENUM ('NORMAL', 'URGENT');

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "formerCode" TEXT;

-- AlterTable
ALTER TABLE "production_check_ins" ADD COLUMN     "batchId" UUID;

-- CreateTable
CREATE TABLE "production_batches" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "number" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "slotAt" TIMESTAMP(3) NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "BatchPriority" NOT NULL DEFAULT 'NORMAL',
    "priorityReason" TEXT,
    "prioritySetAt" TIMESTAMP(3),
    "prioritySetById" UUID,
    "inspectionStartedAt" TIMESTAMP(3),
    "inspectionStartedById" UUID,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_queue_start" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_queue_start_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_code_key" ON "production_batches"("code");

-- CreateIndex
CREATE INDEX "production_batches_status_priority_idx" ON "production_batches"("status", "priority");

-- CreateIndex
CREATE INDEX "production_batches_inspectionStartedById_idx" ON "production_batches"("inspectionStartedById");

-- CreateIndex
CREATE INDEX "production_batches_prioritySetById_idx" ON "production_batches"("prioritySetById");

-- CreateIndex
CREATE INDEX "production_batches_voidedById_idx" ON "production_batches"("voidedById");

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_day_slotAt_key" ON "production_batches"("day", "slotAt");

-- CreateIndex
CREATE UNIQUE INDEX "batches_formerCode_key" ON "batches"("formerCode");

-- CreateIndex
CREATE UNIQUE INDEX "production_check_ins_batchId_key" ON "production_check_ins"("batchId");

-- AddForeignKey
ALTER TABLE "production_check_ins" ADD CONSTRAINT "production_check_ins_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "production_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_inspectionStartedById_fkey" FOREIGN KEY ("inspectionStartedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_prioritySetById_fkey" FOREIGN KEY ("prioritySetById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The queue begins now on a database that already has batches: one that ended before this and was
-- never inspected is Void, "Not inspected, from before the queue" (A-61). A database migrated empty
-- (Docker's first boot, CI) gets no row, so the demo week's batches queue like any other.
INSERT INTO "inspection_queue_start" ("id", "startedAt")
SELECT 1, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "day_plans") OR EXISTS (SELECT 1 FROM "production_check_ins");

-- Old roll codes (B-YYYY-NNNN before Phase 26, R-YYYY-NNNN in Phases 26 to 29) become
-- LR-<supplier code>-NNN, numbered after the highest LR- number of that prefix (code or sequence),
-- oldest roll first; a roll with no supplier gets LR-OLD-NNN (A-85). The old code is kept in
-- "formerCode" so Find roll still finds an old label or claim sheet.
WITH old AS (
  SELECT r."id", r."code", r."createdAt", 'LR-' || COALESCE(s."code", 'OLD') AS "prefix"
  FROM "batches" r
  LEFT JOIN "suppliers" s ON s."id" = r."supplierId"
  WHERE r."code" NOT LIKE 'LR-%'
),
base AS (
  SELECT p."prefix", GREATEST(
    COALESCE((SELECT q."lastValue" FROM "roll_code_sequences" q WHERE q."prefix" = p."prefix"), 0),
    COALESCE((
      SELECT MAX(CAST(substring(b."code" FROM length(p."prefix") + 2) AS INTEGER))
      FROM "batches" b
      WHERE b."code" LIKE p."prefix" || '-%'
        AND substring(b."code" FROM length(p."prefix") + 2) ~ '^[0-9]+$'
    ), 0)
  ) AS "start"
  FROM (SELECT DISTINCT "prefix" FROM old) p
),
numbered AS (
  SELECT old."id", old."code", old."prefix",
    base."start" + ROW_NUMBER() OVER (PARTITION BY old."prefix" ORDER BY old."createdAt", old."code") AS "n"
  FROM old JOIN base ON base."prefix" = old."prefix"
),
renamed AS (
  UPDATE "batches" r
  SET "formerCode" = numbered."code",
      "code" = numbered."prefix" || '-' ||
        CASE WHEN numbered."n" < 1000 THEN lpad(numbered."n"::text, 3, '0') ELSE numbered."n"::text END
  FROM numbered
  WHERE r."id" = numbered."id"
  RETURNING r."id", r."code", r."formerCode"
),
audited AS (
  INSERT INTO "audit_logs" ("id", "actorType", "action", "entity", "entityId", "before", "after", "createdAt")
  SELECT gen_random_uuid(), 'SYSTEM', 'roll.recode', 'Roll', renamed."id"::text,
    jsonb_build_object('code', renamed."formerCode"),
    jsonb_build_object('code', renamed."code", 'reason', 'Old roll codes match the LR- format; B- now means a batch (D-129)'),
    CURRENT_TIMESTAMP
  FROM renamed
  RETURNING 1
)
SELECT count(*) FROM audited;

-- The next LR- number of every prefix is past the renamed rolls.
INSERT INTO "roll_code_sequences" ("prefix", "lastValue")
SELECT substring(b."code" FROM 1 FOR length(b."code") - position('-' IN reverse(b."code"))) AS "prefix",
       MAX(CAST(substring(b."code" FROM length(b."code") - position('-' IN reverse(b."code")) + 2) AS INTEGER))
FROM "batches" b
WHERE b."formerCode" IS NOT NULL
GROUP BY 1
ON CONFLICT ("prefix") DO UPDATE
SET "lastValue" = GREATEST("roll_code_sequences"."lastValue", EXCLUDED."lastValue");
