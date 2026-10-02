import { beforeEach, describe, expect, it, vi } from "vitest";

const users = {
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  recordFailedLogin: vi.fn(),
  recordSuccessfulLogin: vi.fn(),
};
const recordAudit = vi.fn();
const verifyPassword = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/user.model", () => users);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/lib/password", () => ({ verifyPassword, DUMMY_HASH: "dummy" }));

const { verifyCredentials, getActiveSessionUser, MAX_FAILED_ATTEMPTS, LOCK_MINUTES } =
  await import("@/server/services/auth.service");

const now = new Date("2026-10-02T08:00:00.000Z");
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Ivy",
    email: "manager@cpoint.local",
    passwordHash: "hash",
    role: "FLOOR_MANAGER",
    isActive: true,
    failedLoginCount: 0,
    lockedUntil: null,
    ...overrides,
  };
}

const attempt = (password = "pw", email = "Manager@CPoint.local ") =>
  verifyCredentials({ email, password }, { ip: "10.0.0.2" }, now);

beforeEach(() => vi.clearAllMocks());

describe("verifyCredentials", () => {
  it("signs in with the right password, normalising the email and resetting the counter", async () => {
    users.findUserByEmail.mockResolvedValue(user({ failedLoginCount: 3 }));
    verifyPassword.mockResolvedValue(true);
    const result = await attempt();
    expect(users.findUserByEmail).toHaveBeenCalledWith("manager@cpoint.local");
    expect(result).toEqual({
      ok: true,
      user: { id: "u1", name: "Ivy", email: "manager@cpoint.local", role: "FLOOR_MANAGER" },
    });
    expect(users.recordSuccessfulLogin).toHaveBeenCalledWith("u1", now, expect.anything());
    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "user.login" }),
    );
  });

  it("gives an unknown email the same answer as a wrong password, after a real bcrypt compare", async () => {
    users.findUserByEmail.mockResolvedValue(null);
    verifyPassword.mockResolvedValue(false);
    expect(await attempt()).toEqual({ ok: false, reason: "invalid" });
    expect(verifyPassword).toHaveBeenCalledWith("pw", "dummy");
  });

  it("counts a wrong password without locking below the limit", async () => {
    users.findUserByEmail.mockResolvedValue(user({ failedLoginCount: 1 }));
    verifyPassword.mockResolvedValue(false);
    expect(await attempt()).toEqual({ ok: false, reason: "invalid" });
    expect(users.recordFailedLogin).toHaveBeenCalledWith(
      "u1",
      { failedLoginCount: 2, lockedUntil: null },
      expect.anything(),
    );
  });

  it(`locks for ${LOCK_MINUTES} minutes on the ${MAX_FAILED_ATTEMPTS}th wrong password`, async () => {
    users.findUserByEmail.mockResolvedValue(user({ failedLoginCount: MAX_FAILED_ATTEMPTS - 1 }));
    verifyPassword.mockResolvedValue(false);
    expect(await attempt()).toEqual({ ok: false, reason: "locked", minutesLeft: LOCK_MINUTES });
    expect(users.recordFailedLogin).toHaveBeenCalledWith(
      "u1",
      { failedLoginCount: MAX_FAILED_ATTEMPTS, lockedUntil: minutes(LOCK_MINUTES) },
      expect.anything(),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "user.locked" }),
    );
  });

  it("refuses even the right password while locked, without checking it", async () => {
    users.findUserByEmail.mockResolvedValue(
      user({ failedLoginCount: 5, lockedUntil: minutes(7.5) }),
    );
    expect(await attempt()).toEqual({ ok: false, reason: "locked", minutesLeft: 8 });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("starts a fresh count once the lock has expired", async () => {
    users.findUserByEmail.mockResolvedValue(
      user({ failedLoginCount: 5, lockedUntil: minutes(-1) }),
    );
    verifyPassword.mockResolvedValue(false);
    expect(await attempt()).toEqual({ ok: false, reason: "invalid" });
    expect(users.recordFailedLogin).toHaveBeenCalledWith(
      "u1",
      { failedLoginCount: 1, lockedUntil: null },
      expect.anything(),
    );
  });

  it("blocks a deactivated account, but only tells someone who knows the password", async () => {
    users.findUserByEmail.mockResolvedValue(user({ isActive: false }));
    verifyPassword.mockResolvedValue(true);
    expect(await attempt()).toEqual({ ok: false, reason: "inactive" });
    expect(users.recordSuccessfulLogin).not.toHaveBeenCalled();

    verifyPassword.mockResolvedValue(false);
    expect(await attempt()).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("getActiveSessionUser", () => {
  it("returns null for a deactivated or deleted account", async () => {
    users.findUserById.mockResolvedValueOnce(user({ isActive: false })).mockResolvedValueOnce(null);
    expect(await getActiveSessionUser("u1")).toBeNull();
    expect(await getActiveSessionUser("u1")).toBeNull();
  });
});
