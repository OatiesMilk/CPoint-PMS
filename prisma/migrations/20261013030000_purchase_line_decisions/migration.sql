-- Phase 12 (D-039): the Floor Manager decides each item of a request, not the request as a whole.

-- 1. The decision lives on the line.
CREATE TYPE "PurchaseLineDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "purchase_request_lines"
  ADD COLUMN "decision" "PurchaseLineDecision" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "decidedById" UUID,
  ADD COLUMN "decidedAt" TIMESTAMP(3);

CREATE INDEX "purchase_request_lines_decidedById_idx" ON "purchase_request_lines"("decidedById");

ALTER TABLE "purchase_request_lines"
  ADD CONSTRAINT "purchase_request_lines_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Requests decided before this change were decided as a whole, so every line takes the
--    request's outcome, decider and time. Approved and received requests: every line approved.
UPDATE "purchase_request_lines" AS l
SET "decision" = 'APPROVED', "decidedById" = r."decidedById", "decidedAt" = r."decidedAt"
FROM "purchase_requests" AS r
WHERE r."id" = l."requestId" AND r."status" IN ('APPROVED', 'RECEIVED');

--    Rejected requests: every line rejected, with the request's reason copied to each.
UPDATE "purchase_request_lines" AS l
SET "decision" = 'REJECTED',
    "rejectionReason" = r."rejectionReason",
    "decidedById" = r."decidedById",
    "decidedAt" = r."decidedAt"
FROM "purchase_requests" AS r
WHERE r."id" = l."requestId" AND r."status" = 'REJECTED';

--    Pending and cancelled requests were never decided: their lines stay PENDING.
