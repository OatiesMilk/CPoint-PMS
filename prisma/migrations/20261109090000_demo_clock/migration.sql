-- D-125: the demo clock. While the demo tools are on (DEMO_LOGIN_TOOLS), the app's "now" is the real
-- time plus this offset, so a demo can be shown at any day and hour. One row; 0 is real time.

-- CreateTable
CREATE TABLE "demo_clock" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "offsetMs" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_clock_pkey" PRIMARY KEY ("id")
);
