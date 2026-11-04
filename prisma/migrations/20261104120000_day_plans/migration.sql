-- Phase 30E-2 (D-114, D-115): the Floor Manager plans each working day on a calendar (rolls to be
-- used, quota, check-in interval, shift), or marks it Non-working / Holiday. A day without a plan
-- has no batches. The old schedules and quotas become one plan per past working day, up to and
-- including today (Manila), so past batches keep matching their finished check-ins and today keeps
-- its batches. Then the two old tables go; their audit rows stay as history.

-- CreateEnum
CREATE TYPE "DayKind" AS ENUM ('PLANNED', 'NON_WORKING');

-- CreateTable
CREATE TABLE "day_plans" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "kind" "DayKind" NOT NULL,
    "rollsPlanned" INTEGER,
    "quota" INTEGER,
    "suggestedQuota" INTEGER,
    "intervalMinutes" INTEGER,
    "shiftStart" TEXT,
    "shiftEnd" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "day_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "day_plans_day_key" ON "day_plans"("day");

-- CreateIndex
CREATE INDEX "day_plans_createdById_idx" ON "day_plans"("createdById");

-- CreateIndex
CREATE INDEX "day_plans_updatedById_idx" ON "day_plans"("updatedById");

-- AddForeignKey
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Convert: from the first day a batch was ever finished (or today) to today, each day the
-- schedule in force made a working day gets a plan with that schedule's shift and interval and
-- the quota in force. The newest save for a day wins, as before (inForceOn). Rolls planned stays
-- empty: nobody recorded it. Nothing from tomorrow on: those days need the Floor Manager's plan.
INSERT INTO "day_plans" (id, day, kind, "quota", "suggestedQuota", "intervalMinutes", "shiftStart", "shiftEnd", "createdAt", "updatedAt")
SELECT gen_random_uuid(), d.day, 'PLANNED', q.pairs, q."suggestedPairs", s."intervalMinutes",
       s."shiftStart", s."shiftEnd", now(), now()
FROM (
  SELECT g::date AS day
  FROM generate_series(
    COALESCE((SELECT min("day") FROM "production_check_ins"),
             (now() AT TIME ZONE 'Asia/Manila')::date),
    (now() AT TIME ZONE 'Asia/Manila')::date,
    interval '1 day') AS g
) d
JOIN LATERAL (
  SELECT * FROM "production_schedules" ps
  WHERE ps."effectiveFrom" <= d.day
  ORDER BY ps."effectiveFrom" DESC, ps."createdAt" DESC
  LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT * FROM "daily_quotas" dq
  WHERE dq."effectiveFrom" <= d.day
  ORDER BY dq."effectiveFrom" DESC, dq."createdAt" DESC
  LIMIT 1
) q ON true
WHERE extract(isodow FROM d.day)::int = ANY (s."workingDays")
  AND s."shiftEnd" > s."shiftStart";

INSERT INTO "audit_logs" (id, "actorType", action, entity, "after", "createdAt")
SELECT gen_random_uuid(), 'SYSTEM', 'production.plan.convert', 'DayPlan',
       jsonb_build_object('decision', 'D-114', 'daysConverted', (SELECT count(*) FROM "day_plans")),
       now();

-- DropForeignKey
ALTER TABLE "daily_quotas" DROP CONSTRAINT "daily_quotas_createdById_fkey";

-- DropForeignKey
ALTER TABLE "production_schedules" DROP CONSTRAINT "production_schedules_createdById_fkey";

-- DropTable
DROP TABLE "daily_quotas";

-- DropTable
DROP TABLE "production_schedules";
