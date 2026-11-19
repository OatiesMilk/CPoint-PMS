-- Phase 32 (D-128): storage locations (racks, bins, areas) for leather rolls, and each roll's
-- location history. Existing rolls stay unplaced (locationId null); nothing is back-filled.
-- CreateEnum
CREATE TYPE "LocationKind" AS ENUM ('RACK', 'BIN', 'AREA');

-- CreateEnum
CREATE TYPE "RollMoveReason" AS ENUM ('PLACED', 'MOVED', 'TAKEN_FOR_USE', 'PUT_BACK', 'REMOVED', 'SET_ASIDE_FOR_RETURN', 'PICKED_UP_BY_SUPPLIER');

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "locatedAt" TIMESTAMP(3),
ADD COLUMN     "locationId" UUID,
ADD COLUMN     "pickedUpAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "kind" "LocationKind" NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roll_moves" (
    "id" UUID NOT NULL,
    "rollId" UUID NOT NULL,
    "fromLocationId" UUID,
    "toLocationId" UUID,
    "reason" "RollMoveReason" NOT NULL,
    "note" TEXT,
    "byId" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roll_moves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_code_key" ON "storage_locations"("code");

-- CreateIndex
CREATE INDEX "storage_locations_isActive_sortOrder_idx" ON "storage_locations"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "storage_locations_createdById_idx" ON "storage_locations"("createdById");

-- CreateIndex
CREATE INDEX "roll_moves_rollId_at_idx" ON "roll_moves"("rollId", "at");

-- CreateIndex
CREATE INDEX "roll_moves_fromLocationId_idx" ON "roll_moves"("fromLocationId");

-- CreateIndex
CREATE INDEX "roll_moves_toLocationId_idx" ON "roll_moves"("toLocationId");

-- CreateIndex
CREATE INDEX "roll_moves_byId_idx" ON "roll_moves"("byId");

-- CreateIndex
CREATE INDEX "batches_locationId_idx" ON "batches"("locationId");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roll_moves" ADD CONSTRAINT "roll_moves_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roll_moves" ADD CONSTRAINT "roll_moves_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roll_moves" ADD CONSTRAINT "roll_moves_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roll_moves" ADD CONSTRAINT "roll_moves_byId_fkey" FOREIGN KEY ("byId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

