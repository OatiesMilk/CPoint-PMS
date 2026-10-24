-- Pass or Reject (Phase 25, D-093, D-094). Every section is Pass or Reject and the camera's
-- verdict is final; the Review queue, the Repair Station and Salvage are removed. Rows are
-- converted first (A-10): Fixable becomes Pass, Needs review becomes Reject, a pending scan is
-- decided. Audit rows of the removed modules stay as history.

-- 1. Convert the verdicts while the old enum still allows every value.
UPDATE "scans" SET "aiVerdict" = 'PASS' WHERE "aiVerdict" = 'REWORK';
UPDATE "scans" SET "aiVerdict" = 'REJECT' WHERE "aiVerdict" = 'NEEDS_REVIEW';
UPDATE "scans" SET "finalVerdict" = 'PASS' WHERE "finalVerdict" = 'REWORK';
UPDATE "scans" SET "finalVerdict" = 'REJECT' WHERE "finalVerdict" = 'NEEDS_REVIEW';
UPDATE "scans" SET "finalVerdict" = "aiVerdict" WHERE "finalVerdict" IS NULL;

-- 2. The repair tickets and salvage items go (their scans stay).
DROP TABLE "rework_tickets";
DROP TABLE "salvage_items";
DROP TYPE "ReworkStatus";
DROP TYPE "SalvageStatus";

-- 3. Verdict is PASS or REJECT. Postgres can't drop enum values, so the type is rebuilt.
DROP INDEX "scans_finalVerdict_idx";
CREATE TYPE "Verdict_new" AS ENUM ('PASS', 'REJECT');
ALTER TABLE "scans"
  ALTER COLUMN "aiVerdict" TYPE "Verdict_new" USING ("aiVerdict"::text::"Verdict_new"),
  ALTER COLUMN "finalVerdict" TYPE "Verdict_new" USING ("finalVerdict"::text::"Verdict_new");
DROP TYPE "Verdict";
ALTER TYPE "Verdict_new" RENAME TO "Verdict";
ALTER TABLE "scans" ALTER COLUMN "finalVerdict" SET NOT NULL;
CREATE INDEX "scans_finalVerdict_idx" ON "scans"("finalVerdict");

-- 4. No review status and no corrections (C-21).
ALTER TABLE "scans" DROP CONSTRAINT "scans_decidedById_fkey";
DROP INDEX "scans_status_createdAt_idx";
DROP INDEX "scans_decidedById_idx";
ALTER TABLE "scans"
  DROP COLUMN "status",
  DROP COLUMN "isOverride",
  DROP COLUMN "overrideReason",
  DROP COLUMN "decidedById",
  DROP COLUMN "decidedAt";
DROP TYPE "ScanStatus";

-- 5. Each defect type is Usable or Not accepted when found. Rework → Usable, Reject → Not
--    accepted, no action → Not accepted (ASSUMPTION; the Admin can change it in Settings).
CREATE TYPE "DefectOutcome" AS ENUM ('USABLE', 'NOT_ACCEPTED');
ALTER TABLE "defect_types" ADD COLUMN "outcome" "DefectOutcome";
UPDATE "defect_types" SET "outcome" = CASE
  WHEN "action" = 'REWORK' THEN 'USABLE'::"DefectOutcome"
  ELSE 'NOT_ACCEPTED'::"DefectOutcome"
END;
ALTER TABLE "defect_types" ALTER COLUMN "outcome" SET NOT NULL;
ALTER TABLE "defect_types" DROP COLUMN "action", DROP COLUMN "handling";
DROP TYPE "DefectAction";
DROP TYPE "DefectHandling";

-- 6. The two confidence thresholds go; "counts as found at" and the notice stay.
ALTER TABLE "cv_settings" DROP COLUMN "rejectAtOrAbove", DROP COLUMN "reworkAtOrAbove";
