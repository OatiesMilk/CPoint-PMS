import { beforeEach, describe, expect, it, vi } from "vitest";

const users = {
  countActiveUsersWithRole: vi.fn(),
  findUserByEmail: vi.fn(),
  createUser: vi.fn(async (data: { email: string; role: string }) => ({ id: "u1", ...data })),
};
const env = {
  BOOTSTRAP_ADMIN_EMAIL: undefined as string | undefined,
  BOOTSTRAP_ADMIN_PASSWORD: undefined as string | undefined,
  SEED_DEMO_USERS: false,
  DEMO_USER_PASSWORD: undefined as string | undefined,
};
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/user.model", () => users);
vi.mock("@/server/models/reference-data.model", () => ({}));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock("@/server/lib/env", () => ({ getEnv: () => env }));
vi.mock("@/server/lib/password", () => ({ hashPassword: async (p: string) => `hashed:${p}` }));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const { ensureAdmin, ensureDemoUsers } = await import("@/server/services/bootstrap.service");

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(env, {
    BOOTSTRAP_ADMIN_EMAIL: undefined,
    BOOTSTRAP_ADMIN_PASSWORD: undefined,
    SEED_DEMO_USERS: false,
    DEMO_USER_PASSWORD: undefined,
  });
});

describe("ensureAdmin", () => {
  it("does nothing when an active admin exists", async () => {
    users.countActiveUsersWithRole.mockResolvedValue(1);
    expect(await ensureAdmin()).toBe("exists");
    expect(users.createUser).not.toHaveBeenCalled();
  });

  it("reports missing config instead of inventing credentials", async () => {
    users.countActiveUsersWithRole.mockResolvedValue(0);
    expect(await ensureAdmin()).toBe("missing-config");
    expect(users.createUser).not.toHaveBeenCalled();
  });

  it("never takes over an existing account with the bootstrap email", async () => {
    users.countActiveUsersWithRole.mockResolvedValue(0);
    users.findUserByEmail.mockResolvedValue({ id: "x" });
    Object.assign(env, {
      BOOTSTRAP_ADMIN_EMAIL: "Boss@CPoint.local",
      BOOTSTRAP_ADMIN_PASSWORD: "a-long-password",
    });
    expect(await ensureAdmin()).toBe("email-taken");
    expect(users.createUser).not.toHaveBeenCalled();
  });

  it("creates a hashed, lower-cased admin and audits it as SYSTEM", async () => {
    users.countActiveUsersWithRole.mockResolvedValue(0);
    users.findUserByEmail.mockResolvedValue(null);
    Object.assign(env, {
      BOOTSTRAP_ADMIN_EMAIL: "Boss@CPoint.local",
      BOOTSTRAP_ADMIN_PASSWORD: "a-long-password",
    });
    expect(await ensureAdmin()).toBe("created");
    expect(users.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "boss@cpoint.local",
        passwordHash: "hashed:a-long-password",
        role: "SYSTEM_ADMIN",
      }),
      expect.anything(),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actor: { type: "SYSTEM" }, action: "user.create" }),
    );
  });
});

describe("ensureDemoUsers", () => {
  it("is off unless SEED_DEMO_USERS is set", async () => {
    expect(await ensureDemoUsers()).toBe(0);
    expect(users.findUserByEmail).not.toHaveBeenCalled();
  });

  it("creates only the missing accounts and never resets existing ones", async () => {
    Object.assign(env, { SEED_DEMO_USERS: true, DEMO_USER_PASSWORD: "demo-pass" });
    users.findUserByEmail.mockImplementation(async (email: string) =>
      email === "manager@cpoint.local" ? { id: "existing" } : null,
    );
    expect(await ensureDemoUsers()).toBe(3);
    expect(users.createUser).toHaveBeenCalledTimes(3);
  });

  it("designates only the demo Shoe Constructor as a requester, and only when creating it (D-030)", async () => {
    Object.assign(env, { SEED_DEMO_USERS: true, DEMO_USER_PASSWORD: "demo-pass" });
    users.findUserByEmail.mockResolvedValue(null);
    await ensureDemoUsers();
    const flags = Object.fromEntries(
      users.createUser.mock.calls.map(([data]) => [
        data.role,
        (data as { canRequestMaterials?: boolean }).canRequestMaterials,
      ]),
    );
    expect(flags).toEqual({
      FLOOR_MANAGER: false,
      QUALITY_INSPECTOR: false,
      SYSTEM_ADMIN: false,
      SHOE_CONSTRUCTOR: true,
    });
  });
});
