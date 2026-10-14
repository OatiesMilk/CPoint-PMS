-- Phase 13 (D-041 to D-045): an approved request is ordered from a supplier, then received in one
-- or more deliveries, each with proof-of-delivery files. A request can also be cancelled after
-- approval, closed short, or copied to a new one.

-- 1. Two new statuses between APPROVED and RECEIVED. Neither is used by this migration's data
--    steps, so both can be added in the same transaction.
ALTER TYPE "PurchaseRequestStatus" ADD VALUE 'ORDERED';
ALTER TYPE "PurchaseRequestStatus" ADD VALUE 'PARTIALLY_RECEIVED';

-- 2. The order, the cancellation reason, closing short and "copied from" live on the request.
ALTER TABLE "purchase_requests"
  ADD COLUMN "supplierId" UUID,
  ADD COLUMN "orderReference" TEXT,
  ADD COLUMN "expectedDeliveryOn" DATE,
  ADD COLUMN "orderNote" TEXT,
  ADD COLUMN "orderedById" UUID,
  ADD COLUMN "orderedAt" TIMESTAMP(3),
  ADD COLUMN "cancelReason" TEXT,
  ADD COLUMN "closedShortAt" TIMESTAMP(3),
  ADD COLUMN "closedShortReason" TEXT,
  ADD COLUMN "copiedFromId" UUID;

ALTER TABLE "purchase_request_lines"
  ADD COLUMN "receivedQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "purchase_request_events" ADD COLUMN "deliveryId" UUID;

-- 3. Deliveries, what arrived on each, and their proof files.
CREATE TABLE "purchase_deliveries" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "deliveredOn" DATE NOT NULL,
    "note" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_delivery_lines" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "lineId" UUID NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "movementId" UUID,

    CONSTRAINT "purchase_delivery_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_attachments" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_attachments_pkey" PRIMARY KEY ("id")
);

-- 4. Requests received before this change arrived as a whole (D-029): each becomes one delivery,
--    dated the day it was marked received (Manila) and recorded by whoever marked it. These
--    deliveries have no proof file, because none was asked for then. No stock is touched: each
--    delivery line keeps the stock movement the request line already had.
INSERT INTO "purchase_deliveries" ("id", "requestId", "deliveredOn", "recordedById", "createdAt")
SELECT gen_random_uuid(),
       r."id",
       (COALESCE(r."receivedAt", r."updatedAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date,
       COALESCE(e."actorId", r."decidedById", r."requestedById"),
       COALESCE(r."receivedAt", r."updatedAt")
FROM "purchase_requests" AS r
LEFT JOIN LATERAL (
  SELECT ev."actorId"
  FROM "purchase_request_events" AS ev
  WHERE ev."requestId" = r."id" AND ev."toStatus" = 'RECEIVED'
  ORDER BY ev."createdAt" DESC
  LIMIT 1
) AS e ON true
WHERE r."status" = 'RECEIVED';

INSERT INTO "purchase_delivery_lines" ("id", "deliveryId", "lineId", "quantity", "movementId")
SELECT gen_random_uuid(), d."id", l."id", l."quantity", l."movementId"
FROM "purchase_request_lines" AS l
JOIN "purchase_deliveries" AS d ON d."requestId" = l."requestId"
WHERE l."decision" = 'APPROVED';

UPDATE "purchase_request_lines" AS l
SET "receivedQuantity" = l."quantity"
FROM "purchase_requests" AS r
WHERE r."id" = l."requestId" AND r."status" = 'RECEIVED' AND l."decision" = 'APPROVED';

--    The timeline's "Received" event points at its delivery.
UPDATE "purchase_request_events" AS ev
SET "deliveryId" = d."id"
FROM "purchase_deliveries" AS d
WHERE d."requestId" = ev."requestId" AND ev."toStatus" = 'RECEIVED';

-- 5. The movement now lives on the delivery line.
ALTER TABLE "purchase_request_lines" DROP CONSTRAINT "purchase_request_lines_movementId_fkey";
DROP INDEX "purchase_request_lines_movementId_idx";
ALTER TABLE "purchase_request_lines" DROP COLUMN "movementId";

-- 6. Indexes and foreign keys.
CREATE INDEX "purchase_deliveries_requestId_createdAt_idx" ON "purchase_deliveries"("requestId", "createdAt");
CREATE INDEX "purchase_deliveries_recordedById_idx" ON "purchase_deliveries"("recordedById");
CREATE INDEX "purchase_delivery_lines_lineId_idx" ON "purchase_delivery_lines"("lineId");
CREATE INDEX "purchase_delivery_lines_movementId_idx" ON "purchase_delivery_lines"("movementId");
CREATE UNIQUE INDEX "purchase_delivery_lines_deliveryId_lineId_key" ON "purchase_delivery_lines"("deliveryId", "lineId");
CREATE UNIQUE INDEX "purchase_attachments_storageKey_key" ON "purchase_attachments"("storageKey");
CREATE INDEX "purchase_attachments_deliveryId_createdAt_idx" ON "purchase_attachments"("deliveryId", "createdAt");
CREATE INDEX "purchase_attachments_uploadedById_idx" ON "purchase_attachments"("uploadedById");
CREATE INDEX "purchase_request_events_deliveryId_idx" ON "purchase_request_events"("deliveryId");
CREATE INDEX "purchase_requests_orderedById_idx" ON "purchase_requests"("orderedById");
CREATE INDEX "purchase_requests_supplierId_idx" ON "purchase_requests"("supplierId");
CREATE INDEX "purchase_requests_copiedFromId_idx" ON "purchase_requests"("copiedFromId");

ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_copiedFromId_fkey" FOREIGN KEY ("copiedFromId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_request_events" ADD CONSTRAINT "purchase_request_events_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "purchase_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_deliveries" ADD CONSTRAINT "purchase_deliveries_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_deliveries" ADD CONSTRAINT "purchase_deliveries_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_delivery_lines" ADD CONSTRAINT "purchase_delivery_lines_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "purchase_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_delivery_lines" ADD CONSTRAINT "purchase_delivery_lines_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "purchase_request_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_delivery_lines" ADD CONSTRAINT "purchase_delivery_lines_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_attachments" ADD CONSTRAINT "purchase_attachments_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "purchase_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_attachments" ADD CONSTRAINT "purchase_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
