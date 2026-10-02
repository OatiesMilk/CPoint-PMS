-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FLOOR_MANAGER', 'QUALITY_INSPECTOR', 'SYSTEM_ADMIN', 'SHOE_CONSTRUCTOR');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('PREPARATION', 'UPPER_MAKING', 'SOLEING', 'FINISHING');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('PASS', 'REWORK', 'REJECT', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING_REVIEW', 'DECIDED');

-- CreateEnum
CREATE TYPE "ScanSource" AS ENUM ('SIMULATOR', 'PHONE', 'WEBCAM', 'DEDICATED_CAMERA');

-- CreateEnum
CREATE TYPE "ReworkStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalvageStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'DISCARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('LEATHER_ROLL', 'NAILS', 'ADHESIVE', 'THREAD', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'DEVICE', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorUserId" UUID,
    "actorTokenId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shoe_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shoe_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_types" (
    "id" UUID NOT NULL,
    "shoeTypeId" UUID,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "component_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_types" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defect_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "rejectAtOrAbove" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "reworkAtOrAbove" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_sequences" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "batch_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "rollCode" TEXT NOT NULL,
    "supplierId" UUID,
    "shoeTypeId" UUID NOT NULL,
    "receivedAt" DATE NOT NULL,
    "targetQuotaPairs" INTEGER,
    "status" "BatchStatus" NOT NULL DEFAULT 'PLANNED',
    "currentStage" "Stage" NOT NULL DEFAULT 'PREPARATION',
    "notes" TEXT,
    "cancelledReason" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_stage_logs" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "stage" "Stage" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "startedById" UUID NOT NULL,
    "endedById" UUID,
    "isRollback" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "batch_stage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "imagePath" TEXT,
    "imageMime" TEXT,
    "source" "ScanSource" NOT NULL,
    "modelVersion" TEXT,
    "deviceTokenId" UUID,
    "aiVerdict" "Verdict" NOT NULL,
    "maxConfidence" DOUBLE PRECISION,
    "thresholdsSnapshot" JSONB NOT NULL,
    "finalVerdict" "Verdict",
    "status" "ScanStatus" NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detections" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "defectTypeId" UUID,
    "rawClassKey" TEXT NOT NULL,
    "isUnknownClass" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rework_tickets" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "status" "ReworkStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" UUID,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "rework_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salvage_items" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "originBatchId" UUID NOT NULL,
    "status" "SalvageStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignedBatchId" UUID,
    "assignedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    "handledById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salvage_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "quantityOnHand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantityDelta" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "batchId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_tokenHash_key" ON "api_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "api_tokens_createdById_idx" ON "api_tokens"("createdById");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_actorTokenId_idx" ON "audit_logs"("actorTokenId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "shoe_types_code_key" ON "shoe_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "shoe_types_name_key" ON "shoe_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "component_types_shoeTypeId_idx" ON "component_types"("shoeTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "defect_types_key_key" ON "defect_types"("key");

-- CreateIndex
CREATE INDEX "cv_settings_updatedById_idx" ON "cv_settings"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "batches_code_key" ON "batches"("code");

-- CreateIndex
CREATE INDEX "batches_status_currentStage_idx" ON "batches"("status", "currentStage");

-- CreateIndex
CREATE INDEX "batches_supplierId_idx" ON "batches"("supplierId");

-- CreateIndex
CREATE INDEX "batches_shoeTypeId_idx" ON "batches"("shoeTypeId");

-- CreateIndex
CREATE INDEX "batches_createdById_idx" ON "batches"("createdById");

-- CreateIndex
CREATE INDEX "batches_createdAt_idx" ON "batches"("createdAt");

-- CreateIndex
CREATE INDEX "batch_stage_logs_batchId_startedAt_idx" ON "batch_stage_logs"("batchId", "startedAt");

-- CreateIndex
CREATE INDEX "batch_stage_logs_stage_startedAt_idx" ON "batch_stage_logs"("stage", "startedAt");

-- CreateIndex
CREATE INDEX "batch_stage_logs_startedById_idx" ON "batch_stage_logs"("startedById");

-- CreateIndex
CREATE INDEX "batch_stage_logs_endedById_idx" ON "batch_stage_logs"("endedById");

-- CreateIndex
CREATE INDEX "scans_createdAt_idx" ON "scans"("createdAt");

-- CreateIndex
CREATE INDEX "scans_status_createdAt_idx" ON "scans"("status", "createdAt");

-- CreateIndex
CREATE INDEX "scans_finalVerdict_idx" ON "scans"("finalVerdict");

-- CreateIndex
CREATE INDEX "scans_deviceTokenId_idx" ON "scans"("deviceTokenId");

-- CreateIndex
CREATE INDEX "scans_decidedById_idx" ON "scans"("decidedById");

-- CreateIndex
CREATE UNIQUE INDEX "scans_batchId_sequence_key" ON "scans"("batchId", "sequence");

-- CreateIndex
CREATE INDEX "detections_scanId_idx" ON "detections"("scanId");

-- CreateIndex
CREATE INDEX "detections_defectTypeId_idx" ON "detections"("defectTypeId");

-- CreateIndex
CREATE INDEX "rework_tickets_scanId_idx" ON "rework_tickets"("scanId");

-- CreateIndex
CREATE INDEX "rework_tickets_status_openedAt_idx" ON "rework_tickets"("status", "openedAt");

-- CreateIndex
CREATE INDEX "rework_tickets_completedById_idx" ON "rework_tickets"("completedById");

-- CreateIndex
CREATE INDEX "salvage_items_scanId_idx" ON "salvage_items"("scanId");

-- CreateIndex
CREATE INDEX "salvage_items_originBatchId_idx" ON "salvage_items"("originBatchId");

-- CreateIndex
CREATE INDEX "salvage_items_assignedBatchId_idx" ON "salvage_items"("assignedBatchId");

-- CreateIndex
CREATE INDEX "salvage_items_status_idx" ON "salvage_items"("status");

-- CreateIndex
CREATE INDEX "salvage_items_handledById_idx" ON "salvage_items"("handledById");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_sku_key" ON "inventory_items"("sku");

-- CreateIndex
CREATE INDEX "inventory_items_category_isActive_idx" ON "inventory_items"("category", "isActive");

-- CreateIndex
CREATE INDEX "inventory_movements_itemId_createdAt_idx" ON "inventory_movements"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_batchId_idx" ON "inventory_movements"("batchId");

-- CreateIndex
CREATE INDEX "inventory_movements_createdById_idx" ON "inventory_movements"("createdById");

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorTokenId_fkey" FOREIGN KEY ("actorTokenId") REFERENCES "api_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_types" ADD CONSTRAINT "component_types_shoeTypeId_fkey" FOREIGN KEY ("shoeTypeId") REFERENCES "shoe_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_settings" ADD CONSTRAINT "cv_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_shoeTypeId_fkey" FOREIGN KEY ("shoeTypeId") REFERENCES "shoe_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_stage_logs" ADD CONSTRAINT "batch_stage_logs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_stage_logs" ADD CONSTRAINT "batch_stage_logs_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_stage_logs" ADD CONSTRAINT "batch_stage_logs_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_deviceTokenId_fkey" FOREIGN KEY ("deviceTokenId") REFERENCES "api_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detections" ADD CONSTRAINT "detections_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detections" ADD CONSTRAINT "detections_defectTypeId_fkey" FOREIGN KEY ("defectTypeId") REFERENCES "defect_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_tickets" ADD CONSTRAINT "rework_tickets_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_tickets" ADD CONSTRAINT "rework_tickets_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salvage_items" ADD CONSTRAINT "salvage_items_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salvage_items" ADD CONSTRAINT "salvage_items_originBatchId_fkey" FOREIGN KEY ("originBatchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salvage_items" ADD CONSTRAINT "salvage_items_assignedBatchId_fkey" FOREIGN KEY ("assignedBatchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salvage_items" ADD CONSTRAINT "salvage_items_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
