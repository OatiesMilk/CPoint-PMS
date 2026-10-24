-- Material requests and procurement are removed (Phase 24, D-091). Stock movements that deliveries
-- posted stay, with their reason text; proof files on disk are left to demo:reset.
-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_decidedById_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_orderedById_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_copiedFromId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_request_lines" DROP CONSTRAINT "purchase_request_lines_requestId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_request_lines" DROP CONSTRAINT "purchase_request_lines_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_request_lines" DROP CONSTRAINT "purchase_request_lines_decidedById_fkey";

-- DropForeignKey
ALTER TABLE "purchase_request_events" DROP CONSTRAINT "purchase_request_events_requestId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_request_events" DROP CONSTRAINT "purchase_request_events_actorId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_request_events" DROP CONSTRAINT "purchase_request_events_deliveryId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_deliveries" DROP CONSTRAINT "purchase_deliveries_requestId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_deliveries" DROP CONSTRAINT "purchase_deliveries_recordedById_fkey";

-- DropForeignKey
ALTER TABLE "purchase_delivery_lines" DROP CONSTRAINT "purchase_delivery_lines_deliveryId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_delivery_lines" DROP CONSTRAINT "purchase_delivery_lines_lineId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_delivery_lines" DROP CONSTRAINT "purchase_delivery_lines_movementId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_attachments" DROP CONSTRAINT "purchase_attachments_deliveryId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_attachments" DROP CONSTRAINT "purchase_attachments_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "purchase_request_remarks" DROP CONSTRAINT "purchase_request_remarks_requestId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_request_remarks" DROP CONSTRAINT "purchase_request_remarks_authorId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "canRequestLeatherRolls";

-- DropTable
DROP TABLE "purchase_request_sequences";

-- DropTable
DROP TABLE "purchase_requests";

-- DropTable
DROP TABLE "purchase_request_lines";

-- DropTable
DROP TABLE "purchase_request_events";

-- DropTable
DROP TABLE "purchase_deliveries";

-- DropTable
DROP TABLE "purchase_delivery_lines";

-- DropTable
DROP TABLE "purchase_attachments";

-- DropTable
DROP TABLE "purchase_request_remarks";

-- DropEnum
DROP TYPE "PurchaseRequestStatus";

-- DropEnum
DROP TYPE "PurchaseLineDecision";
