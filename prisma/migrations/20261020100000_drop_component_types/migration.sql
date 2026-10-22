-- Component tracking is out of scope (Phase 20, D-071). The table only held optional names.
-- DropForeignKey
ALTER TABLE "component_types" DROP CONSTRAINT "component_types_shoeTypeId_fkey";

-- DropTable
DROP TABLE "component_types";
