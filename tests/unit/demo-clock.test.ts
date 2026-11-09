import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The demo clock (D-125): the app's "now" is the real time plus an offset while the demo tools
// are on; sign-in and sessions keep real time.
const env = { NODE_ENV: "production", DEMO_LOGIN_TOOLS: true, SEED_DEMO_USERS: true };
const getDemoClockOffset = vi.fn(async () => 0);
const saveDemoClockOffset = vi.fn(async () => {});
const recordAudit = vi.fn(async () => {});
const getCurrentUser = vi.fn(async () => null as { id: string } | null);

vi.mock("next-auth", () => {
  class AuthError extends Error {}
  class CredentialsSignin extends AuthError {}
  return { AuthError, CredentialsSignin };
});
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/lib/env", () => ({ getEnv: () => env }));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/models/demo-clock.model", () => ({ getDemoClockOffset, saveDemoClockOffset }));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/policies/guard", () => ({ getCurrentUser }));
vi.mock("@/server/lib/auth", () => ({ signIn: vi.fn() }));
vi.mock("@/server/services/demo-reset.service", () => ({
  resetDemoData: vi.fn(),
  resetKeep: vi.fn(),
}));
vi.mock("@/server/services/bootstrap.service", () => ({
  DEMO_USERS: [
    { email: "manager@cpoint.local", name: "Rodel Pascual", role: "FLOOR_MANAGER" },
    { email: "inspector@cpoint.local", name: "Maricel Dizon", role: "QUALITY_INSPECTOR" },
    { email: "admin@cpoint.local", name: "Jerome Salazar", role: "SYSTEM_ADMIN" },
    { email: "constructor@cpoint.local", name: "Noel Manalo", role: "SHOE_CONSTRUCTOR" },
  ],
}));

const { appNow, appNowMs, clockOffsetMs, setClockOffsetMs } = await import("@/lib/clock");
const { manilaToday } = await import("@/lib/format");
const { syncDemoClock, setDemoClock, demoClockView } =
  await import("@/server/services/demo-clock.service");
const { POST: clockRoute } = await import("@/app/api/v1/demo/clock/route");
const { ingestFieldsSchema } = await import("@/server/validators/scan.validator");

const REAL = new Date("2026-11-09T07:00:00.000Z"); // Mon 15:00 in Manila
const DAY = 86_400_000;
const post = (body: unknown) =>
  new Request("http://localhost/api/v1/demo/clock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const forget = () => {
  delete (globalThis as Record<string, unknown>).__cpointDemoClockLoaded;
  setClockOffsetMs(0);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(REAL);
  env.DEMO_LOGIN_TOOLS = true;
  forget();
});
afterEach(() => {
  vi.useRealTimers();
  forget();
});

describe("the app's clock", () => {
  it("is the real time until an offset is set, then runs ahead by it", () => {
    expect(clockOffsetMs()).toBe(0);
    expect(appNow().getTime()).toBe(REAL.getTime());
    setClockOffsetMs(2 * DAY);
    expect(appNowMs()).toBe(REAL.getTime() + 2 * DAY);
    // It keeps ticking from there.
    vi.advanceTimersByTime(5 * 60_000);
    expect(appNow().toISOString()).toBe("2026-11-11T07:05:00.000Z");
    // Days follow it, so "today" moves with the clock.
    expect(manilaToday()).toBe("2026-11-11");
  });

  it("ignores an offset that isn't a number", () => {
    setClockOffsetMs(Number.NaN);
    expect(clockOffsetMs()).toBe(0);
  });
});

describe("syncDemoClock", () => {
  it("loads the saved offset once per process while the demo tools are on", async () => {
    getDemoClockOffset.mockResolvedValueOnce(3 * DAY);
    await syncDemoClock();
    await syncDemoClock();
    expect(getDemoClockOffset).toHaveBeenCalledTimes(1);
    expect(clockOffsetMs()).toBe(3 * DAY);
  });

  it("is the real time with the demo tools off, whatever the database holds", async () => {
    env.DEMO_LOGIN_TOOLS = false;
    setClockOffsetMs(DAY);
    await syncDemoClock();
    expect(clockOffsetMs()).toBe(0);
    expect(getDemoClockOffset).not.toHaveBeenCalled();
  });

  it("falls back to real time when the offset can't be read, and tries again later", async () => {
    getDemoClockOffset.mockRejectedValueOnce(new Error("no table"));
    await syncDemoClock();
    expect(clockOffsetMs()).toBe(0);
    getDemoClockOffset.mockResolvedValueOnce(DAY);
    await syncDemoClock();
    expect(clockOffsetMs()).toBe(DAY);
  });
});

describe("setDemoClock", () => {
  it("moves the clock to the time picked, saves it and writes the audit log", async () => {
    const at = new Date("2026-11-13T03:00:00.000Z"); // Fri 11:00 in Manila
    const view = await setDemoClock(at, { id: "fm" });
    const offset = at.getTime() - REAL.getTime();
    expect(saveDemoClockOffset).toHaveBeenCalledWith(offset, "tx");
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        actor: { type: "USER", userId: "fm" },
        action: "demo_clock.set",
        entity: "DemoClock",
      }),
    );
    expect(view).toEqual({ on: true, offsetMs: offset, now: at.toISOString() });
    expect(appNow().toISOString()).toBe(at.toISOString());
    expect((await demoClockView()).on).toBe(true);
  });

  it("goes back to real time, and records a login-page change as the system", async () => {
    setClockOffsetMs(DAY);
    const view = await setDemoClock(null, null);
    expect(view.on).toBe(false);
    expect(clockOffsetMs()).toBe(0);
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ actor: { type: "SYSTEM" } }),
    );
  });

  it("refuses a date more than a year away, naming the date field", async () => {
    await expect(setDemoClock(new Date(REAL.getTime() + 400 * DAY), null)).rejects.toMatchObject({
      status: 422,
      details: [expect.objectContaining({ path: ["date"] })],
    });
    expect(saveDemoClockOffset).not.toHaveBeenCalled();
  });

  it("is not there with the demo tools off", async () => {
    env.DEMO_LOGIN_TOOLS = false;
    await expect(setDemoClock(REAL, null)).rejects.toMatchObject({ status: 404 });
  });
});

describe("POST /api/v1/demo/clock", () => {
  it("sets a Manila date and time, and the clock runs from it", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: "qi" });
    const res = await clockRoute(post({ date: "2026-11-13", time: "16:50" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.now).toBe("2026-11-13T08:50:00.000Z");
    expect(body.data.on).toBe(true);
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ actor: { type: "USER", userId: "qi" } }),
    );
  });

  it("goes back to real time", async () => {
    setClockOffsetMs(DAY);
    const res = await clockRoute(post({ realTime: true }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ on: false, offsetMs: 0 });
  });

  it("says how to fix a time it can't read", async () => {
    const res = await clockRoute(post({ date: "2026-11-13", time: "25:00" }));
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).toContain("HH:MM");
  });

  it("answers 404 with the demo tools off", async () => {
    env.DEMO_LOGIN_TOOLS = false;
    const res = await clockRoute(post({ realTime: true }));
    expect(res.status).toBe(404);
  });
});

describe("scans on a moved clock", () => {
  it("accept a capture time in the demo's day, not more than 5 minutes past the app's time", () => {
    setClockOffsetMs(2 * DAY);
    const base = { rollId: "0195f4a2-6c1e-7a00-8000-000000000001" };
    const ok = ingestFieldsSchema.safeParse({
      ...base,
      capturedAt: new Date(REAL.getTime() + 2 * DAY).toISOString(),
    });
    expect(ok.success).toBe(true);
    const ahead = ingestFieldsSchema.safeParse({
      ...base,
      capturedAt: new Date(REAL.getTime() + 2 * DAY + 10 * 60_000).toISOString(),
    });
    expect(ahead.success).toBe(false);
  });
});
