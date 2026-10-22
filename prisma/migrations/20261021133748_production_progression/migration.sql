-- CreateTable
CREATE TABLE "production_schedules" (
    "id" UUID NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "intervalMinutes" INTEGER NOT NULL,
    "workingDays" INTEGER[],
    "effectiveFrom" DATE NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quotas" (
    "id" UUID NOT NULL,
    "shoeTypeId" UUID NOT NULL,
    "pairs" INTEGER NOT NULL,
    "suggestedPairs" INTEGER,
    "effectiveFrom" DATE NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_check_ins" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "slotAt" TIMESTAMP(3) NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enteredById" UUID NOT NULL,
    "constructorsPresent" INTEGER,
    "constructorsOnRoster" INTEGER,
    "notes" TEXT,
    "correctedAt" TIMESTAMP(3),
    "correctedById" UUID,
    "correctionReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_counts" (
    "id" UUID NOT NULL,
    "checkInId" UUID NOT NULL,
    "shoeTypeId" UUID NOT NULL,
    "pairs" INTEGER NOT NULL,

    CONSTRAINT "production_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_schedules_effectiveFrom_idx" ON "production_schedules"("effectiveFrom");

-- CreateIndex
CREATE INDEX "production_schedules_createdById_idx" ON "production_schedules"("createdById");

-- CreateIndex
CREATE INDEX "daily_quotas_shoeTypeId_effectiveFrom_idx" ON "daily_quotas"("shoeTypeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "daily_quotas_createdById_idx" ON "daily_quotas"("createdById");

-- CreateIndex
CREATE INDEX "production_check_ins_enteredById_idx" ON "production_check_ins"("enteredById");

-- CreateIndex
CREATE INDEX "production_check_ins_correctedById_idx" ON "production_check_ins"("correctedById");

-- CreateIndex
CREATE UNIQUE INDEX "production_check_ins_day_slotAt_key" ON "production_check_ins"("day", "slotAt");

-- CreateIndex
CREATE INDEX "production_counts_shoeTypeId_idx" ON "production_counts"("shoeTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "production_counts_checkInId_shoeTypeId_key" ON "production_counts"("checkInId", "shoeTypeId");

-- AddForeignKey
ALTER TABLE "production_schedules" ADD CONSTRAINT "production_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quotas" ADD CONSTRAINT "daily_quotas_shoeTypeId_fkey" FOREIGN KEY ("shoeTypeId") REFERENCES "shoe_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quotas" ADD CONSTRAINT "daily_quotas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_check_ins" ADD CONSTRAINT "production_check_ins_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_check_ins" ADD CONSTRAINT "production_check_ins_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_counts" ADD CONSTRAINT "production_counts_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "production_check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_counts" ADD CONSTRAINT "production_counts_shoeTypeId_fkey" FOREIGN KEY ("shoeTypeId") REFERENCES "shoe_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
