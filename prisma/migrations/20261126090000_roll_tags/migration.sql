-- Phase 42 (D-139): roll tags, a managed list whose codes start every roll code (LR-<tag>-001).
-- Each supplier gets its own short code as its default tag, so today's codes and today's default in
-- Add rolls stay as they are; rolls whose code starts with that tag are linked to it. A roll whose
-- code no longer matches its supplier's code gets no link, which only means "not locked".
-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "tagId" UUID;

-- CreateTable
CREATE TABLE "roll_tags" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "supplierId" UUID,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roll_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roll_tags_code_key" ON "roll_tags"("code");

-- CreateIndex
CREATE INDEX "roll_tags_supplierId_idx" ON "roll_tags"("supplierId");

-- CreateIndex
CREATE INDEX "batches_tagId_idx" ON "batches"("tagId");

-- AddForeignKey
ALTER TABLE "roll_tags" ADD CONSTRAINT "roll_tags_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "roll_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One default tag per existing supplier: its short code (inactive suppliers' tags start inactive).
INSERT INTO "roll_tags" ("id", "code", "supplierId", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), s."code", s."id", true, s."isActive", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "suppliers" s;

-- Link the rolls made from those tags (their code is LR-<tag>-<digits>).
UPDATE "batches" b
SET "tagId" = t."id"
FROM "roll_tags" t
WHERE b."supplierId" = t."supplierId"
  AND b."code" LIKE 'LR-' || t."code" || '-%';
