import { beforeEach, describe, expect, it, vi } from "vitest";

const users = {
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  recordFailedLogin: vi.fn(),
  recordSuccessfulLogin: vi.fn(),
  setPassword: vi.fn(),
  isSessionRevoked: vi.fn(async () => false),
  revokeSession: vi.fn(),
};
const recordAudit = vi.fn();
const verifyPassword = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/user.model", () => users);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
const hashPassword = vi.fn(async (p: string) => `hashed:${p}`);
vi.mock("@/server/lib/password", () => ({ verifyPassword, hashPassword, DUMMY_HASH: "dummy" }));

const {
  verifyCredentials,
  getActiveSessionUser,
  checkSession,
  changeOwnPassword,
  recordSignOut,
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
} = await import("@/server/services/auth.service");

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
    mustChangePassword: false,
    sessionsValidFrom: null,
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
      user: {
        id: "u1",
        name: "Ivy",
        email: "manager@cpoint.local",
        role: "FLOOR_MANAGER",
        mustChangePassword: false,
      },
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

describe("checkSession (D-024)", () => {
  it("ends sessions that signed in before a password reset or change", async () => {
    users.findUserById.mockResolvedValue(user({ sessionsValidFrom: now }));
    expect(await checkSession("u1", now.getTime() - 1)).toEqual({
      ok: false,
      reason: "password-reset",
    });
    expect(await checkSession("u1")).toMatchObject({ ok: false, reason: "password-reset" });
    expect(await checkSession("u1", now.getTime())).toMatchObject({ ok: true });
  });

  it("says deactivated for a deactivated account, and carries mustChangePassword", async () => {
    users.findUserById.mockResolvedValueOnce(user({ isActive: false }));
    expect(await checkSession("u1", 1)).toEqual({ ok: false, reason: "deactivated" });
    users.findUserById.mockResolvedValueOnce(user({ mustChangePassword: true }));
    expect(await checkSession("u1", 1)).toMatchObject({
      ok: true,
      user: { mustChangePassword: true },
    });
  });
});

describe("checkSession and the requester flag (D-030)", () => {
  it("reads the flag fresh on every request, so turning it off applies at once", async () => {
    users.findUserById.mockResolvedValueOnce(
      user({ role: "SHOE_CONSTRUCTOR", canRequestMaterials: true }),
    );
    expect(await checkSession("u1", 1)).toMatchObject({
      ok: true,
      user: { canRequestMaterials: true },
    });
    // The Floor Manager un-designates them: same token, next request, still signed in.
    users.findUserById.mockResolvedValueOnce(
      user({ role: "SHOE_CONSTRUCTOR", canRequestMaterials: false }),
    );
    expect(await checkSession("u1", 1)).toMatchObject({
      ok: true,
      user: { canRequestMaterials: false },
    });
  });
});

describe("changeOwnPassword (D-024)", () => {
  it("checks the current password before changing anything", async () => {
    users.findUserById.mockResolvedValue(user());
    verifyPassword.mockResolvedValueOnce(false);
    await expect(
      changeOwnPassword("u1", { currentPassword: "wrong", newPassword: "a long new phrase" }),
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["currentPassword"] }] });
    expect(users.setPassword).not.toHaveBeenCalled();
  });

  it("stores the new hash, clears mustChangePassword, ends other sessions and audits", async () => {
    users.findUserById.mockResolvedValue(user({ mustChangePassword: true }));
    verifyPassword.mockResolvedValueOnce(true);
    await changeOwnPassword(
      "u1",
      { currentPassword: "temp", newPassword: "a long new phrase" },
      {},
      now,
    );
    expect(users.setPassword).toHaveBeenCalledWith(
      "u1",
      {
        passwordHash: "hashed:a long new phrase",
        mustChangePassword: false,
        sessionsValidFrom: now,
      },
      expect.anything(),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "user.password_change" }),
    );
  });
});

describe("sign-out revocation (D-025)", () => {
  it("ends a session whose sid was signed out, even with a valid token", async () => {
    users.findUserById.mockResolvedValue(user());
    users.isSessionRevoked.mockResolvedValueOnce(true);
    expect(await checkSession("u1", now.getTime(), "sid-1")).toEqual({
      ok: false,
      reason: "signed-out",
    });
    expect(users.isSessionRevoked).toHaveBeenCalledWith("sid-1");
    expect(await checkSession("u1", now.getTime(), "sid-2")).toMatchObject({ ok: true });
  });

  it("revokes the sid until the token would expire, and audits the sign-out", async () => {
    await recordSignOut("u1", {}, "sid-1", now);
    expect(users.revokeSession).toHaveBeenCalledWith(
      { sid: "sid-1", userId: "u1", expiresAt: new Date(now.getTime() + 12 * 3_600_000) },
      now,
      expect.anything(),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "user.logout" }),
    );
  });
});
