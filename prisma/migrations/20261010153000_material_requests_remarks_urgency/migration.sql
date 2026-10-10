-- Phase 11 (D-036, D-037): remarks replace the justification, and urgency comes from neededBy.

-- 1. Each non-empty "Why it's needed" becomes the request's first remark, by the requester, at
--    the time the request was sent.
INSERT INTO "purchase_request_remarks" ("id", "requestId", "authorId", "body", "createdAt")
SELECT gen_random_uuid(), "id", "requestedById", btrim("justification"), "createdAt"
FROM "purchase_requests"
WHERE btrim("justification") <> '';

-- 2. Needed by is now required. Requests sent without one get the day they were sent (Manila
--    date) plus 7 days.
UPDATE "purchase_requests"
SET "neededBy" = (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::date + 7
WHERE "neededBy" IS NULL;

-- 3. Drop what the two changes replace.
ALTER TABLE "purchase_requests"
  ALTER COLUMN "neededBy" SET NOT NULL,
  DROP COLUMN "justification",
  DROP COLUMN "priority";

DROP TYPE "PurchasePriority";
