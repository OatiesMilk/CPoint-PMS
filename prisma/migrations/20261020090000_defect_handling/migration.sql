-- CreateEnum
CREATE TYPE "DefectHandling" AS ENUM ('CLEAN', 'CUT_AROUND');

-- AlterTable
ALTER TABLE "defect_types" ADD COLUMN     "handling" "DefectHandling" NOT NULL DEFAULT 'CUT_AROUND';

-- Dirt is cleaned, not cut around (D-070). Other types keep the default; Settings changes any.
UPDATE "defect_types" SET "handling" = 'CLEAN' WHERE "key" = 'dirt';
