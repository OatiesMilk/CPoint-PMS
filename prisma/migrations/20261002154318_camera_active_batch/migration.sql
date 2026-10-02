-- AlterTable
ALTER TABLE "cv_settings" ADD COLUMN     "activeBatchId" UUID;

-- CreateIndex
CREATE INDEX "cv_settings_activeBatchId_idx" ON "cv_settings"("activeBatchId");

-- AddForeignKey
ALTER TABLE "cv_settings" ADD CONSTRAINT "cv_settings_activeBatchId_fkey" FOREIGN KEY ("activeBatchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
