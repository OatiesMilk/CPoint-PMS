import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDeviceToken, hashDeviceToken, parseBearer } from "@/server/lib/device-token";

const tokens = {
  insertApiToken: vi.fn(async (data: Record<string, unknown>) => ({ id: "tok1", ...data })),
  findApiTokenByHash: vi.fn(),
  findApiTokenById: vi.fn(),
  listApiTokens: vi.fn(),
  markApiTokenRevoked: vi.fn(),
  touchApiToken: vi.fn(),
};
const recordAudit = vi.fn();
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/api-token.model", () => tokens);
vi.mock("@/server/models/user.model", () => ({ findFirstActiveUserWithRole: vi.fn() }));
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));

const svc = await import("@/server/services/api-token.service");
const now = new Date("2026-10-02T08:00:00.000Z");

beforeEach(() => vi.clearAllMocks());

describe("device token format", () => {
  it("is cpt_ + 43 base64url chars, hashed with SHA-256, with a 12-char prefix", () => {
    const { token, hash, prefix } = generateDeviceToken();
    expect(token).toMatch(/^cpt_[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(hashDeviceToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(prefix).toBe(token.slice(0, 12));
    expect(generateDeviceToken().token).not.toBe(token);
  });

  it("reads only Bearer device tokens", () => {
    expect(parseBearer("Bearer cpt_abc")).toBe("cpt_abc");
    expect(parseBearer("bearer   cpt_abc")).toBe("cpt_abc");
    expect(parseBearer("Bearer something-else")).toBeNull();
    expect(parseBearer("Basic abc")).toBeNull();
    expect(parseBearer(null)).toBeNull();
  });
});

describe("createDeviceToken", () => {
  it("stores only the hash, returns the plain token once, and audits without the secret", async () => {
    const result = await svc.createDeviceToken({ name: "Prep phone" }, { id: "admin1" });
    const stored = tokens.insertApiToken.mock.calls[0][0];
    expect(stored.tokenHash).toBe(hashDeviceToken(result.token));
    expect(stored).not.toHaveProperty("token");
    expect(stored.scopes).toEqual(["scans:create"]);
    const audit = recordAudit.mock.calls[0][1];
    expect(JSON.stringify(audit)).not.toContain(result.token);
  });
});

describe("authenticateDevice", () => {
  const valid = {
    id: "tok1",
    name: "Prep phone",
    scopes: ["scans:create"],
    revokedAt: null,
    expiresAt: null,
  };

  it("accepts a valid token and records its use", async () => {
    tokens.findApiTokenByHash.mockResolvedValue(valid);
    expect(await svc.authenticateDevice("Bearer cpt_x", "scans:create", now)).toEqual({
      id: "tok1",
      name: "Prep phone",
    });
    expect(tokens.findApiTokenByHash).toHaveBeenCalledWith(hashDeviceToken("cpt_x"));
    expect(tokens.touchApiToken).toHaveBeenCalledWith("tok1", now);
  });

  it.each([
    ["missing header", null, undefined],
    ["unknown token", "Bearer cpt_x", null],
    ["revoked token", "Bearer cpt_x", { ...valid, revokedAt: now }],
    ["expired token", "Bearer cpt_x", { ...valid, expiresAt: now }],
  ])("401 for a %s", async (_label, header, record) => {
    tokens.findApiTokenByHash.mockResolvedValue(record);
    await expect(svc.authenticateDevice(header, "scans:create", now)).rejects.toMatchObject({
      status: 401,
    });
    expect(tokens.touchApiToken).not.toHaveBeenCalled();
  });

  it("403 when the token lacks the scope", async () => {
    tokens.findApiTokenByHash.mockResolvedValue({ ...valid, scopes: [] });
    await expect(svc.authenticateDevice("Bearer cpt_x", "scans:create", now)).rejects.toMatchObject(
      { status: 403 },
    );
  });
});

describe("revokeDeviceToken", () => {
  it("refuses to revoke twice", async () => {
    tokens.findApiTokenById.mockResolvedValue({ id: "tok1", revokedAt: now });
    await expect(svc.revokeDeviceToken("tok1", { id: "a" }, now)).rejects.toMatchObject({
      status: 409,
    });
  });
});
