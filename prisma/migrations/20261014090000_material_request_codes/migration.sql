-- D-046: request numbers read "MR-YYYY-NNNN" (material request) instead of "PR-YYYY-NNNN".
-- Data only, no schema change. The running number per year is kept, so MR-2026-0007 follows
-- PR-2026-0006. The audit log keeps the old numbers: it is history, never rewritten.

-- 1. The request numbers themselves. "code" is unique; the year and number part is unchanged,
--    so no two rows can collide.
UPDATE "purchase_requests"
SET "code" = 'MR-' || substring("code" FROM 4)
WHERE "code" LIKE 'PR-%';

-- 2. The stock ledger reason posted for each delivery ("Delivery for PR-2026-0001").
UPDATE "inventory_movements"
SET "reason" = 'Delivery for MR-' || substring("reason" FROM 17)
WHERE "reason" LIKE 'Delivery for PR-%';

-- 3. The timeline note on a request copied from another ("Copied from PR-2026-0003.").
UPDATE "purchase_request_events"
SET "note" = 'Copied from MR-' || substring("note" FROM 16)
WHERE "note" LIKE 'Copied from PR-%';
