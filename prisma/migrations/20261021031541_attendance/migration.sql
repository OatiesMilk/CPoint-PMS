-- CreateTable
CREATE TABLE "attendance_days" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "takenById" UUID NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_marks" (
    "id" UUID NOT NULL,
    "attendanceDayId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "present" BOOLEAN NOT NULL,

    CONSTRAINT "attendance_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_days_day_key" ON "attendance_days"("day");

-- CreateIndex
CREATE INDEX "attendance_days_takenById_idx" ON "attendance_days"("takenById");

-- CreateIndex
CREATE INDEX "attendance_marks_userId_idx" ON "attendance_marks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_marks_attendanceDayId_userId_key" ON "attendance_marks"("attendanceDayId", "userId");

-- AddForeignKey
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_marks" ADD CONSTRAINT "attendance_marks_attendanceDayId_fkey" FOREIGN KEY ("attendanceDayId") REFERENCES "attendance_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_marks" ADD CONSTRAINT "attendance_marks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
