-- Phase 30E (D-111 to D-113): a roll leaves stock when its scan is finished at Capture. Nobody
-- ticks rolls Fully used and the Floor Manager no longer returns or keeps them. Rolls not scanned
-- yet stay in stock and are picked at Capture as before; old Fully used, Returned and Kept rolls
-- stay as history. Data only.

-- Rolls scanned but not yet ticked Fully used leave stock now (−1), as a roll finished from now on
-- does. Their status stays Scanned.
CREATE TEMP TABLE d113_scanned AS
  SELECT id, "itemId", code, COALESCE("finishedById", "createdById") AS "byId"
  FROM "batches"
  WHERE status = 'FINISHED' AND "itemId" IS NOT NULL;

INSERT INTO "inventory_movements" (id, "itemId", type, "quantityDelta", reason, "batchId", "createdById", "createdAt")
SELECT gen_random_uuid(), s."itemId", 'OUT', -1,
       'Roll ' || s.code || ' scanned before rolls left stock at Capture', s.id, s."byId", now()
FROM d113_scanned s;

UPDATE "inventory_items" i
SET "quantityOnHand" = i."quantityOnHand" - c.n, "updatedAt" = now()
FROM (SELECT "itemId", count(*) AS n FROM d113_scanned GROUP BY "itemId") c
WHERE i.id = c."itemId";

INSERT INTO "audit_logs" (id, "actorType", action, entity, "after", "createdAt")
SELECT gen_random_uuid(), 'SYSTEM', 'roll.leave_stock_at_capture', 'Roll',
       jsonb_build_object('decision', 'D-112', 'scannedTakenOff', (SELECT count(*) FROM d113_scanned)),
       now();

DROP TABLE d113_scanned;
