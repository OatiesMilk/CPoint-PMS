-- Phase 29 (D-102): inventory by stock updates. The Floor Manager saves what was added (+), used
-- (−) or corrected per item on the Update stock sheet; each save is a stock_updates row and its
-- entries stay ledger movements (D-023). Leather-roll items carry their supplier, and a single
-- settings row holds the reminder days (Wednesday and Friday, C-32). Nothing is converted:
-- existing leather items get their supplier when next edited (A-10).
-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "supplierId" UUID;

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "updateId" UUID;

-- CreateTable
CREATE TABLE "stock_updates" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "createdById" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "reminderDays" INTEGER[] DEFAULT ARRAY[3, 5]::INTEGER[],
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_updates_day_idx" ON "stock_updates"("day");

-- CreateIndex
CREATE INDEX "stock_updates_createdById_idx" ON "stock_updates"("createdById");

-- CreateIndex
CREATE INDEX "inventory_settings_updatedById_idx" ON "inventory_settings"("updatedById");

-- CreateIndex
CREATE INDEX "inventory_items_supplierId_idx" ON "inventory_items"("supplierId");

-- CreateIndex
CREATE INDEX "inventory_movements_updateId_idx" ON "inventory_movements"("updateId");

-- CreateIndex
CREATE INDEX "inventory_movements_type_createdAt_idx" ON "inventory_movements"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "stock_updates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_updates" ADD CONSTRAINT "stock_updates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_settings" ADD CONSTRAINT "inventory_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The reminder days' row, so a new or existing database starts with Wednesday and Friday.
INSERT INTO "inventory_settings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
