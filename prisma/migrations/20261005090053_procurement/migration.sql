-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "PurchasePriority" AS ENUM ('NORMAL', 'URGENT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "canRequestMaterials" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "purchase_request_sequences" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_request_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "requestedById" UUID NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "PurchasePriority" NOT NULL DEFAULT 'NORMAL',
    "neededBy" DATE,
    "justification" TEXT NOT NULL,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "approvalNote" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_lines" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "inventoryItemId" UUID,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "onHandAtRequest" DECIMAL(12,2),
    "reorderLevelAtRequest" DECIMAL(12,2),
    "movementId" UUID,
    "position" INTEGER NOT NULL,

    CONSTRAINT "purchase_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_events" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "fromStatus" "PurchaseRequestStatus",
    "toStatus" "PurchaseRequestStatus" NOT NULL,
    "actorId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_remarks" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_request_remarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_code_key" ON "purchase_requests"("code");

-- CreateIndex
CREATE INDEX "purchase_requests_status_createdAt_idx" ON "purchase_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_requests_requestedById_idx" ON "purchase_requests"("requestedById");

-- CreateIndex
CREATE INDEX "purchase_requests_decidedById_idx" ON "purchase_requests"("decidedById");

-- CreateIndex
CREATE INDEX "purchase_request_lines_requestId_idx" ON "purchase_request_lines"("requestId");

-- CreateIndex
CREATE INDEX "purchase_request_lines_inventoryItemId_idx" ON "purchase_request_lines"("inventoryItemId");

-- CreateIndex
CREATE INDEX "purchase_request_lines_movementId_idx" ON "purchase_request_lines"("movementId");

-- CreateIndex
CREATE INDEX "purchase_request_events_requestId_createdAt_idx" ON "purchase_request_events"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_request_events_actorId_idx" ON "purchase_request_events"("actorId");

-- CreateIndex
CREATE INDEX "purchase_request_remarks_requestId_createdAt_idx" ON "purchase_request_remarks"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_request_remarks_authorId_idx" ON "purchase_request_remarks"("authorId");

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_events" ADD CONSTRAINT "purchase_request_events_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_events" ADD CONSTRAINT "purchase_request_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_remarks" ADD CONSTRAINT "purchase_request_remarks_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_remarks" ADD CONSTRAINT "purchase_request_remarks_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
