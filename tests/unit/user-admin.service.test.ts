import { beforeEach, describe, expect, it, vi } from "vitest";

const users = {
  countActiveUsersWithRole: vi.fn(async () => 2),
  createUser: vi.fn(async (data: Record<string, unknown>) => ({ id: "u9", ...data })),
  findUserByEmail: vi.fn(async () => null as unknown),
  findUserById: vi.fn(),
  listUsers: vi.fn(),
  setPassword: vi.fn(),
  unlockUser: vi.fn(),
  updateUser: vi.fn(async (id: string, data: Record<string, unknown>) => ({ id, ...data })),
  userCounts: vi.fn(),
};
const recordAudit = vi.fn();
const hashPassword = vi.fn(async (p: string) => `hashed:${p}`);
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/user.model", () => users);
vi.mock("@/server/lib/password", () => ({ hashPassword }));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const svc = await import("@/server/services/user-admin.service");
const admin = { id: "a1" };
const now = new Date("2026-10-03T08:00:00.000Z");
const account = (overrides: Record<string, unknown> = {}) => ({
  id: "u1",
  name: "Ivy",
  email: "ivy@cpoint.local",
  role: "FLOOR_MANAGER",
  isActive: true,
  mustChangePassword: false,
  failedLoginCount: 0,
  lockedUntil: null,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe("createAccount", () => {
  it("returns a temporary password once, stores only its hash, and forces a change", async () => {
    const result = await svc.createAccount(
      { name: "Ana", email: "ana@cpoint.local", role: "QUALITY_INSPECTOR" },
      admin,
    );
    expect(result.temporaryPassword).toMatch(/^[A-Za-z2-9]{12}$/);
    const data = users.createUser.mock.calls[0][0];
    expect(data).toMatchObject({
      email: "ana@cpoint.local",
      passwordHash: `hashed:${result.temporaryPassword}`,
      mustChangePassword: true,
    });
    expect(JSON.stringify(recordAudit.mock.calls)).not.toContain(result.temporaryPassword);
  });

  it("refuses an email that already has an account, as a field error", async () => {
    users.findUserByEmail.mockResolvedValueOnce(account());
    await expect(
      svc.createAccount({ name: "Ivy", email: "ivy@cpoint.local", role: "FLOOR_MANAGER" }, admin),
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["email"] }] });
  });
});

describe("account changes", () => {
  it("ends requester designation when a Shoe Constructor gets another role (D-030)", async () => {
    users.findUserById.mockResolvedValue(
      account({ role: "SHOE_CONSTRUCTOR", canRequestMaterials: true }),
    );
    await svc.updateAccount(
      "u1",
      { name: "Ivy", email: "ivy@cpoint.local", role: "QUALITY_INSPECTOR" },
      admin,
    );
    expect(users.updateUser.mock.calls[0][1]).toMatchObject({
      role: "QUALITY_INSPECTOR",
      canRequestMaterials: false,
    });
    expect(recordAudit.mock.calls[0][1]).toMatchObject({
      before: { canRequestMaterials: true },
      after: { canRequestMaterials: false },
    });
  });

  it("leaves the flag alone when a constructor's other details change", async () => {
    users.findUserById.mockResolvedValue(
      account({ role: "SHOE_CONSTRUCTOR", canRequestMaterials: true }),
    );
    await svc.updateAccount(
      "u1",
      { name: "Ivy B", email: "ivy@cpoint.local", role: "SHOE_CONSTRUCTOR" },
      admin,
    );
    expect(users.updateUser.mock.calls[0][1]).not.toHaveProperty("canRequestMaterials");
  });

  it("refuses deactivating the last active System Admin", async () => {
    users.findUserById.mockResolvedValue(account({ id: "a2", role: "SYSTEM_ADMIN" }));
    users.countActiveUsersWithRole.mockResolvedValueOnce(1);
    await expect(svc.setAccountActive("a2", false, admin)).rejects.toMatchObject({ status: 409 });
    expect(users.updateUser).not.toHaveBeenCalled();
  });

  it("re-checks inside the transaction so two admins can't remove each other at once", async () => {
    users.findUserById.mockResolvedValue(account({ id: "a2", role: "SYSTEM_ADMIN" }));
    users.countActiveUsersWithRole.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    await expect(svc.setAccountActive("a2", false, admin)).rejects.toMatchObject({ status: 409 });
  });

  it("refuses changing your own role", async () => {
    users.findUserById.mockResolvedValue(account({ id: "a1", role: "SYSTEM_ADMIN" }));
    await expect(
      svc.updateAccount(
        "a1",
        { name: "Me", email: "ivy@cpoint.local", role: "FLOOR_MANAGER" },
        admin,
      ),
    ).rejects.toMatchObject({ message: "You can't change your own role." });
  });

  it("deactivates and audits", async () => {
    users.findUserById.mockResolvedValue(account());
    await svc.setAccountActive("u1", false, admin);
    expect(users.updateUser).toHaveBeenCalledWith("u1", { isActive: false }, "tx");
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        action: "user.deactivate",
        after: { email: "ivy@cpoint.local", isActive: false },
      }),
    );
  });
});

describe("resetAccountPassword", () => {
  it("issues a new temporary password, forces a change and ends every session", async () => {
    users.findUserById.mockResolvedValue(account({ lockedUntil: now }));
    const result = await svc.resetAccountPassword("u1", admin, now);
    expect(users.setPassword).toHaveBeenCalledWith(
      "u1",
      {
        passwordHash: `hashed:${result.temporaryPassword}`,
        mustChangePassword: true,
        sessionsValidFrom: now,
      },
      "tx",
    );
    expect(recordAudit).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ action: "user.password_reset" }),
    );
  });

  it("refuses resetting your own password (use Change password)", async () => {
    users.findUserById.mockResolvedValue(account({ id: "a1" }));
    await expect(svc.resetAccountPassword("a1", admin, now)).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("listUsers", () => {
  it("shows Locked only while the lock lasts", async () => {
    users.listUsers.mockResolvedValue({
      rows: [
        {
          ...account(),
          lastLoginAt: null,
          createdAt: now,
          lockedUntil: new Date(now.getTime() + 60_000),
        },
        {
          ...account({ id: "u2" }),
          lastLoginAt: null,
          createdAt: now,
          lockedUntil: new Date(now.getTime() - 1),
        },
        { ...account({ id: "u3", isActive: false }), lastLoginAt: null, createdAt: now },
      ],
      total: 3,
    });
    const { rows } = await svc.listUsers({}, now);
    expect(rows.map((r) => r.status)).toEqual(["LOCKED", "ACTIVE", "DEACTIVATED"]);
  });
});
