-- Phase 30A (D-103, D-104): leather rolls come from Inventory. The Floor Manager adds each roll to
-- its leather item with its own area (square feet, from the stamp or the receipt); a Shoe
-- Constructor picks it at Capture; the Quality Inspector ticks it Fully used at Finish batch. Roll
-- codes read LR-<supplier code>-001, so each supplier gets a short code.
--
-- Existing rows (A-10): suppliers get a code from their initials (Marikina Leather Trading → MLT),
-- with a number added when two clash; rolls from before keep their code, status and times, have
-- no item or area, and are never in the Fully used list. Leather counts are not touched;
-- `npm run demo:reset -- --yes` gives the demo items roll records that match their counts.

-- AlterEnum (the new values are used by the default only after this migration commits)
ALTER TYPE "RollStatus" ADD VALUE IF NOT EXISTS 'IN_STOCK' BEFORE 'OPEN';
ALTER TYPE "RollStatus" ADD VALUE IF NOT EXISTS 'USED' AFTER 'FINISHED';

-- DropIndex
DROP INDEX "batches_status_createdById_idx";

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "areaSqFt" DECIMAL(8,2),
ADD COLUMN     "itemId" UUID,
ADD COLUMN     "startedById" UUID,
ADD COLUMN     "usedAt" TIMESTAMP(3),
ADD COLUMN     "usedById" UUID,
ADD COLUMN     "usedCheckInId" UUID,
ALTER COLUMN "startedAt" DROP NOT NULL,
ALTER COLUMN "startedAt" DROP DEFAULT,
ALTER COLUMN "status" DROP DEFAULT;

-- Before Phase 30A whoever created a roll started it at Capture.
UPDATE "batches" SET "startedById" = "createdById" WHERE "startedAt" IS NOT NULL;

-- Suppliers: a short code from the initials of the words that start with a letter, at most six;
-- a name with fewer than two such letters takes its first letters instead (or SUP). A clash
-- gets 2, 3, … in the order the suppliers were added.
ALTER TABLE "suppliers" ADD COLUMN     "code" TEXT;

WITH initials AS (
  SELECT s.id, s."createdAt",
    left(coalesce((
      SELECT string_agg(upper(left(w, 1)), '' ORDER BY n)
      FROM regexp_split_to_table(s.name, '\s+') WITH ORDINALITY AS t(w, n)
      WHERE w ~ '^[A-Za-z]'
    ), ''), 6) AS code,
    upper(left(regexp_replace(s.name, '[^A-Za-z]', '', 'g'), 3)) AS letters
  FROM "suppliers" s
), base AS (
  SELECT id, "createdAt",
    CASE
      WHEN length(code) >= 2 THEN code
      WHEN length(letters) >= 2 THEN letters
      ELSE 'SUP'
    END AS code
  FROM initials
), numbered AS (
  SELECT id, code, row_number() OVER (PARTITION BY code ORDER BY "createdAt", id) AS n FROM base
)
UPDATE "suppliers" s
SET "code" = CASE WHEN numbered.n = 1 THEN left(numbered.code, 6)
                  ELSE left(numbered.code, 5) || numbered.n::text END
FROM numbered WHERE numbered.id = s.id;

ALTER TABLE "suppliers" ALTER COLUMN "code" SET NOT NULL;

-- CreateTable
CREATE TABLE "roll_code_sequences" (
    "prefix" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "roll_code_sequences_pkey" PRIMARY KEY ("prefix")
);

-- CreateIndex
CREATE INDEX "batches_status_startedById_idx" ON "batches"("status", "startedById");

-- CreateIndex
CREATE INDEX "batches_itemId_status_idx" ON "batches"("itemId", "status");

-- CreateIndex
CREATE INDEX "batches_startedById_idx" ON "batches"("startedById");

-- CreateIndex
CREATE INDEX "batches_usedById_idx" ON "batches"("usedById");

-- CreateIndex
CREATE INDEX "batches_usedCheckInId_idx" ON "batches"("usedCheckInId");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_usedCheckInId_fkey" FOREIGN KEY ("usedCheckInId") REFERENCES "production_check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
