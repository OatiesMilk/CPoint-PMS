import { describe, expect, it, vi } from "vitest";
import { getHealth } from "@/server/services/health.service";

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));

const now = () => new Date("2026-10-02T04:00:00.000Z");

describe("getHealth", () => {
  it("reports ok when the database answers", async () => {
    const health = await getHealth({ pingDatabase: async () => {}, now });
    expect(health.status).toBe("ok");
    expect(health.checks).toEqual({ app: "up", database: "up" });
    expect(health.time).toBe("2026-10-02T04:00:00.000Z");
  });

  it("reports degraded instead of throwing when the database fails", async () => {
    const health = await getHealth({
      pingDatabase: async () => {
        throw new Error("ECONNREFUSED");
      },
      now,
    });
    expect(health.status).toBe("degraded");
    expect(health.checks.database).toBe("down");
  });

  it("reports degraded when the database hangs past the timeout", async () => {
    vi.useFakeTimers();
    const pending = getHealth({ pingDatabase: () => new Promise(() => {}), now });
    await vi.advanceTimersByTimeAsync(2001);
    const health = await pending;
    vi.useRealTimers();
    expect(health.checks.database).toBe("down");
  });
});
