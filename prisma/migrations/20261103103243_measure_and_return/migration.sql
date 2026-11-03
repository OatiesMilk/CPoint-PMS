-- CreateEnum
CREATE TYPE "ReturnDecision" AS ENUM ('RETURNED', 'KEPT');

-- AlterEnum
ALTER TYPE "RollStatus" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "defectAreaSqIn" DOUBLE PRECISION,
ADD COLUMN     "defectSharePct" DOUBLE PRECISION,
ADD COLUMN     "markedForReturn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "returnDecidedAt" TIMESTAMP(3),
ADD COLUMN     "returnDecidedById" UUID,
ADD COLUMN     "returnDecision" "ReturnDecision",
ADD COLUMN     "returnLimitPct" DOUBLE PRECISION,
ADD COLUMN     "returnNote" TEXT,
ADD COLUMN     "returnedOn" DATE;

-- AlterTable
ALTER TABLE "cv_settings" ADD COLUMN     "returnSharePct" DOUBLE PRECISION NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "defect_types" ADD COLUMN     "flatSharePct" DOUBLE PRECISION,
ADD COLUMN     "notAcceptedFromIn" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "detections" ADD COLUMN     "areaSqIn" DOUBLE PRECISION,
ADD COLUMN     "lengthIn" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "defectAreaSqIn" DOUBLE PRECISION,
ADD COLUMN     "flatSharePct" DOUBLE PRECISION,
ADD COLUMN     "imageHeight" INTEGER,
ADD COLUMN     "imageWidth" INTEGER,
ADD COLUMN     "widthIn" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "batches_returnDecidedById_idx" ON "batches"("returnDecidedById");

-- CreateIndex
CREATE INDEX "batches_markedForReturn_returnDecision_idx" ON "batches"("markedForReturn", "returnDecision");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_returnDecidedById_fkey" FOREIGN KEY ("returnDecidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 30C (C-37, D-110): a cut is Not accepted from 3 inches and Usable below; one from 3 inches
-- counts a flat 1% of its roll. Other types keep their outcome and count by box area. The Admin
-- can change both in Settings → Defect types.
UPDATE "defect_types" SET "notAcceptedFromIn" = 3, "flatSharePct" = 1 WHERE "key" = 'cut';
