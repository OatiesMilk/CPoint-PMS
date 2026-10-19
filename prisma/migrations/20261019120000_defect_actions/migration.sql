-- CreateEnum
CREATE TYPE "DefectAction" AS ENUM ('REWORK', 'REJECT');

-- AlterTable
ALTER TABLE "cv_settings" ADD COLUMN     "earlyModelNotice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "foundAtOrAbove" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- AlterTable
ALTER TABLE "defect_types" ADD COLUMN     "action" "DefectAction";

