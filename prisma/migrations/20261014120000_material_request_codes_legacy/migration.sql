-- D-046, follow-up: requests received before Phase 13 posted their stock as "Received for
-- PR-2026-0001" (the wording then), which the first rename missed. Data only.

-- 1. The old receiving reason takes today's wording and the MR- number.
UPDATE "inventory_movements"
SET "reason" = 'Delivery for MR-' || substring("reason" FROM 17)
WHERE "reason" LIKE 'Received for PR-%';

-- 2. Any other system-written text that still carries a PR- request number.
UPDATE "inventory_movements"
SET "reason" = regexp_replace("reason", '\mPR-(\d{4}-\d{4,})', 'MR-\1', 'g')
WHERE "reason" ~ '\mPR-\d{4}-\d{4,}';

UPDATE "purchase_request_events"
SET "note" = regexp_replace("note", '\mPR-(\d{4}-\d{4,})', 'MR-\1', 'g')
WHERE "note" ~ '\mPR-\d{4}-\d{4,}';
