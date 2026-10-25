-- Phase 27 (D-097 to D-099): a batch is one check-in interval of the working day. A lunch break
-- set by the System Admin pauses it, a schedule may check in once at the end of the day, a
-- finished batch records the pairs finished and the pairs that failed inspection, and shoe types
-- go: one count per batch and one daily quota for the whole line. Existing rows are converted
-- first (A-10): a check-in's pairs are the sum of its per-type counts; for each day a quota
-- changed, the one quota is the sum of the per-type quotas in force that day.

-- 1. Pairs and failed pairs on a finished batch, summed from the per-type counts.
ALTER TABLE "production_check_ins"
  ADD COLUMN "pairs" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedPairs" INTEGER NOT NULL DEFAULT 0;

UPDATE "production_check_ins" c SET "pairs" = coalesce(
  (SELECT sum(p."pairs") FROM "production_counts" p WHERE p."checkInId" = c.id), 0);

ALTER TABLE "production_check_ins" ALTER COLUMN "pairs" DROP DEFAULT;

DROP TABLE "production_counts";

-- 2. One daily quota. For each effectiveFrom, the latest row set that day is kept and carries
--    the sum of every shoe type's quota in force on that day; the other rows of that day go.
CREATE TEMP TABLE "quota_totals" AS
SELECT d."effectiveFrom",
       (SELECT sum(q."pairs") FROM (
          SELECT DISTINCT ON (x."shoeTypeId") x."pairs"
          FROM "daily_quotas" x
          WHERE x."effectiveFrom" <= d."effectiveFrom"
          ORDER BY x."shoeTypeId", x."effectiveFrom" DESC, x."createdAt" DESC
        ) q) AS "pairs",
       (SELECT k.id FROM "daily_quotas" k
          WHERE k."effectiveFrom" = d."effectiveFrom"
          ORDER BY k."createdAt" DESC, k.id DESC LIMIT 1) AS "keepId"
FROM (SELECT DISTINCT "effectiveFrom" FROM "daily_quotas") d;

DELETE FROM "daily_quotas" WHERE id NOT IN (SELECT "keepId" FROM "quota_totals");

UPDATE "daily_quotas" q SET "pairs" = t."pairs", "suggestedPairs" = NULL
FROM "quota_totals" t WHERE q.id = t."keepId";

DROP TABLE "quota_totals";

ALTER TABLE "daily_quotas" DROP CONSTRAINT "daily_quotas_shoeTypeId_fkey";
DROP INDEX "daily_quotas_shoeTypeId_effectiveFrom_idx";
ALTER TABLE "daily_quotas" DROP COLUMN "shoeTypeId";
CREATE INDEX "daily_quotas_effectiveFrom_idx" ON "daily_quotas"("effectiveFrom");

-- 3. No shoe types (C-8). Nothing else references them since Phase 26.
DROP TABLE "shoe_types";

-- 4. "Once at the end of the day": a schedule without an interval (C-2). Existing rows keep theirs.
ALTER TABLE "production_schedules" ALTER COLUMN "intervalMinutes" DROP NOT NULL;

-- 5. The lunch break (C-3). Both times null = no lunch break. The bootstrap adds the default
--    11:00–12:00 (A-4): from the start on a database with no check-ins, otherwise from tomorrow,
--    so past days keep the check-in times they were counted at.
CREATE TABLE "lunch_breaks" (
    "id" UUID NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lunch_breaks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lunch_breaks_effectiveFrom_idx" ON "lunch_breaks"("effectiveFrom");
CREATE INDEX "lunch_breaks_createdById_idx" ON "lunch_breaks"("createdById");

ALTER TABLE "lunch_breaks" ADD CONSTRAINT "lunch_breaks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
