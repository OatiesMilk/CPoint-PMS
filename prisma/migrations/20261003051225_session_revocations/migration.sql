-- CreateTable
CREATE TABLE "session_revocations" (
    "sid" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_revocations_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE INDEX "session_revocations_userId_idx" ON "session_revocations"("userId");

-- CreateIndex
CREATE INDEX "session_revocations_expiresAt_idx" ON "session_revocations"("expiresAt");

-- AddForeignKey
ALTER TABLE "session_revocations" ADD CONSTRAINT "session_revocations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
