-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "captureId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "scans_captureId_key" ON "scans"("captureId");

