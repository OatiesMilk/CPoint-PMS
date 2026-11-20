-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('PREPARATION', 'CONSTRUCTION', 'SOLE_ING', 'FINISHING');

-- CreateEnum
CREATE TYPE "Remedy" AS ENUM ('FIXABLE', 'NOT_FIXABLE');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('AT_STAGE', 'BACK_FOR_INSPECTION', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "final_defect_types" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "final_defect_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_findings" (
    "id" UUID NOT NULL,
    "checkInId" UUID NOT NULL,
    "finalDefectTypeId" UUID NOT NULL,
    "pairs" INTEGER NOT NULL,
    "remedy" "Remedy" NOT NULL,
    "returnStage" "ProductionStage",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_jobs" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "findingId" UUID NOT NULL,
    "parentId" UUID,
    "pairs" INTEGER NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'AT_STAGE',
    "sentAt" TIMESTAMP(3) NOT NULL,
    "backAt" TIMESTAMP(3),
    "backById" UUID,
    "inspectedAt" TIMESTAMP(3),
    "inspectedById" UUID,
    "passedPairs" INTEGER,
    "scrappedPairs" INTEGER,
    "resentPairs" INTEGER,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_assignments" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "userId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_counts" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "pairs" INTEGER NOT NULL,
    "enteredById" UUID NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" UUID,

    CONSTRAINT "stage_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "final_defect_types_key_key" ON "final_defect_types"("key");

-- CreateIndex
CREATE INDEX "inspection_findings_checkInId_idx" ON "inspection_findings"("checkInId");

-- CreateIndex
CREATE INDEX "inspection_findings_finalDefectTypeId_createdAt_idx" ON "inspection_findings"("finalDefectTypeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "repair_jobs_code_key" ON "repair_jobs"("code");

-- CreateIndex
CREATE INDEX "repair_jobs_status_stage_idx" ON "repair_jobs"("status", "stage");

-- CreateIndex
CREATE INDEX "repair_jobs_findingId_idx" ON "repair_jobs"("findingId");

-- CreateIndex
CREATE INDEX "repair_jobs_parentId_idx" ON "repair_jobs"("parentId");

-- CreateIndex
CREATE INDEX "repair_jobs_backById_idx" ON "repair_jobs"("backById");

-- CreateIndex
CREATE INDEX "repair_jobs_inspectedById_idx" ON "repair_jobs"("inspectedById");

-- CreateIndex
CREATE INDEX "stage_assignments_day_stage_idx" ON "stage_assignments"("day", "stage");

-- CreateIndex
CREATE INDEX "stage_assignments_assignedById_idx" ON "stage_assignments"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "stage_assignments_day_userId_key" ON "stage_assignments"("day", "userId");

-- CreateIndex
CREATE INDEX "stage_counts_day_stage_enteredAt_idx" ON "stage_counts"("day", "stage", "enteredAt");

-- CreateIndex
CREATE INDEX "stage_counts_enteredById_idx" ON "stage_counts"("enteredById");

-- CreateIndex
CREATE INDEX "stage_counts_batchId_idx" ON "stage_counts"("batchId");

-- AddForeignKey
ALTER TABLE "inspection_findings" ADD CONSTRAINT "inspection_findings_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "production_check_ins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_findings" ADD CONSTRAINT "inspection_findings_finalDefectTypeId_fkey" FOREIGN KEY ("finalDefectTypeId") REFERENCES "final_defect_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "inspection_findings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "repair_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_backById_fkey" FOREIGN KEY ("backById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_assignments" ADD CONSTRAINT "stage_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_assignments" ADD CONSTRAINT "stage_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_counts" ADD CONSTRAINT "stage_counts_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_counts" ADD CONSTRAINT "stage_counts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "production_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

