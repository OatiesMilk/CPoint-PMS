-- D-108 (Dylan, 2026-11-02): there are no unknown defect classes any more. A class the camera
-- sends with no defect type is dropped at ingest. Past data follows:
--   1. a scan rejected only because of an unknown class becomes Pass;
--   2. an unknown detection whose key is a defect type now (e.g. crease, D-052) joins that type;
--   3. every other unknown detection is deleted;
--   4. the isUnknownClass column goes.
-- One SYSTEM audit row records the counts.

-- 1. Scans rejected only by unknown classes. A scan keeps Reject when one of its known
--    detections rejects it by the rule it was decided with (an older scan with no outcomes in its
--    snapshot keeps Reject when it has any known detection), or when an unknown key is now an
--    active Not accepted type found at or above found-at.
CREATE TEMP TABLE d108_now_pass AS
SELECT s.id
FROM scans s
WHERE s."finalVerdict" = 'REJECT'
  AND EXISTS (SELECT 1 FROM detections d WHERE d."scanId" = s.id AND d."isUnknownClass")
  AND NOT EXISTS (
    SELECT 1 FROM detections d
    WHERE d."scanId" = s.id
      AND NOT d."isUnknownClass"
      AND (
        s."thresholdsSnapshot" -> 'outcomes' IS NULL
        OR (
          s."thresholdsSnapshot" -> 'outcomes' ->> d."rawClassKey" = 'NOT_ACCEPTED'
          AND d.confidence >= COALESCE((s."thresholdsSnapshot" ->> 'foundAtOrAbove')::float8, 0.5)
        )
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM detections d
    JOIN defect_types t ON t.key = d."rawClassKey"
    WHERE d."scanId" = s.id
      AND d."isUnknownClass"
      AND t."isActive"
      AND t.outcome = 'NOT_ACCEPTED'
      AND d.confidence >= COALESCE((s."thresholdsSnapshot" ->> 'foundAtOrAbove')::float8, 0.5)
  );

CREATE TEMP TABLE d108_counts AS
SELECT
  (SELECT count(*) FROM d108_now_pass) AS "scansNowPass",
  (SELECT count(*) FROM detections d
     WHERE d."isUnknownClass" AND EXISTS (SELECT 1 FROM defect_types t WHERE t.key = d."rawClassKey"))
    AS "detectionsJoinedType",
  (SELECT count(*) FROM detections d
     WHERE d."isUnknownClass" AND NOT EXISTS (SELECT 1 FROM defect_types t WHERE t.key = d."rawClassKey"))
    AS "detectionsDeleted";

UPDATE scans SET "aiVerdict" = 'PASS', "finalVerdict" = 'PASS'
WHERE id IN (SELECT id FROM d108_now_pass);

-- 2. Unknown then, a defect type now: it joins the type.
UPDATE detections d
SET "defectTypeId" = t.id
FROM defect_types t
WHERE d."isUnknownClass" AND t.key = d."rawClassKey";

-- 3. The rest are deleted.
DELETE FROM detections WHERE "isUnknownClass" AND "defectTypeId" IS NULL;

-- 4. The column goes.
ALTER TABLE detections DROP COLUMN "isUnknownClass";

INSERT INTO audit_logs (id, "actorType", action, entity, "after", "createdAt")
SELECT gen_random_uuid(), 'SYSTEM', 'scan.unknown_classes_removed', 'Scan',
       jsonb_build_object(
         'decision', 'D-108',
         'scansNowPass', c."scansNowPass",
         'detectionsJoinedType', c."detectionsJoinedType",
         'detectionsDeleted', c."detectionsDeleted"),
       now()
FROM d108_counts c;

DROP TABLE d108_counts;
DROP TABLE d108_now_pass;
