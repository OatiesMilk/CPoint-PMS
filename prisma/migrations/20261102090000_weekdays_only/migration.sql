-- D-105 (Dylan, 2026-11-02): the factory works Monday to Friday, 08:00 to 17:00. Data only, no
-- schema change. Times are "HH:mm" text, so text comparison orders them correctly.
--
-- Past schedule rows are left as they were, so past days (Saturdays included) keep the batches
-- they had. A schedule that starts tomorrow (Manila) or later is fixed in place; if the schedule in
-- force tomorrow has a weekend day or hours outside 08:00 to 17:00, a fixed copy starts tomorrow.

-- 1. Schedules from tomorrow on: weekdays only, times inside the factory's hours.
UPDATE production_schedules
SET "workingDays" = COALESCE(
      NULLIF(ARRAY(SELECT d FROM unnest("workingDays") AS d WHERE d BETWEEN 1 AND 5 ORDER BY d), '{}'::int[]),
      '{1,2,3,4,5}'::int[]),
    "shiftStart" = GREATEST("shiftStart", '08:00'),
    "shiftEnd" = LEAST("shiftEnd", '17:00')
WHERE "effectiveFrom" >= ((now() AT TIME ZONE 'Asia/Manila')::date + 1);

-- A shift squeezed to nothing (it was all outside the window) becomes the full day.
UPDATE production_schedules
SET "shiftStart" = '08:00', "shiftEnd" = '17:00'
WHERE "effectiveFrom" >= ((now() AT TIME ZONE 'Asia/Manila')::date + 1)
  AND "shiftEnd" <= "shiftStart";

-- 2. The schedule in force tomorrow, when it breaks the rule and nothing starts tomorrow yet.
INSERT INTO production_schedules
  (id, "shiftStart", "shiftEnd", "intervalMinutes", "workingDays", "effectiveFrom", "createdById", "createdAt")
SELECT gen_random_uuid(),
       CASE WHEN LEAST(s."shiftEnd", '17:00') <= GREATEST(s."shiftStart", '08:00') THEN '08:00'
            ELSE GREATEST(s."shiftStart", '08:00') END,
       CASE WHEN LEAST(s."shiftEnd", '17:00') <= GREATEST(s."shiftStart", '08:00') THEN '17:00'
            ELSE LEAST(s."shiftEnd", '17:00') END,
       s."intervalMinutes",
       COALESCE(
         NULLIF(ARRAY(SELECT d FROM unnest(s."workingDays") AS d WHERE d BETWEEN 1 AND 5 ORDER BY d), '{}'::int[]),
         '{1,2,3,4,5}'::int[]),
       (now() AT TIME ZONE 'Asia/Manila')::date + 1,
       NULL,
       now()
FROM (
  SELECT *
  FROM production_schedules
  WHERE "effectiveFrom" < ((now() AT TIME ZONE 'Asia/Manila')::date + 1)
  ORDER BY "effectiveFrom" DESC, "createdAt" DESC
  LIMIT 1
) AS s
WHERE (s."workingDays" && '{6,7}'::int[] OR s."shiftStart" < '08:00' OR s."shiftEnd" > '17:00')
  AND NOT EXISTS (
    SELECT 1 FROM production_schedules
    WHERE "effectiveFrom" = ((now() AT TIME ZONE 'Asia/Manila')::date + 1)
  );

-- 3. Stock reminder days: Monday to Friday only; none left → Wednesday and Friday (C-32).
UPDATE inventory_settings
SET "reminderDays" = COALESCE(
      NULLIF(ARRAY(SELECT d FROM unnest("reminderDays") AS d WHERE d BETWEEN 1 AND 5 ORDER BY d), '{}'::int[]),
      '{3,5}'::int[])
WHERE "reminderDays" && '{6,7}'::int[];
