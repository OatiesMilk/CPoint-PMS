-- D-031: every Shoe Constructor can request materials; only designated ones can request leather
-- rolls. Rename the flag (keeping who was designated) instead of dropping and re-adding it.
ALTER TABLE "users" RENAME COLUMN "canRequestMaterials" TO "canRequestLeatherRolls";

-- Each request line records its category, so a typed "leather roll" is still recognised.
ALTER TABLE "purchase_request_lines" ADD COLUMN "category" "InventoryCategory";
UPDATE "purchase_request_lines" l
SET "category" = COALESCE(i."category", 'OTHER')
FROM "purchase_request_lines" l2
LEFT JOIN "inventory_items" i ON i."id" = l2."inventoryItemId"
WHERE l."id" = l2."id";
ALTER TABLE "purchase_request_lines" ALTER COLUMN "category" SET NOT NULL;
