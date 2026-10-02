import { describe, expect, it, vi } from "vitest";

const insertAuditLog = vi.fn();
vi.mock("@/server/models/audit-log.model", () => ({ insertAuditLog }));
vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));

const { recordAudit, redact } = await import("@/server/services/audit.service");

describe("redact", () => {
  it("replaces secrets at any depth and serialises dates", () => {
    const result = redact({
      email: "a@b.c",
      passwordHash: "$2b$12$abc",
      nested: { token: "cpt_secret", list: [{ secret: "x", ok: 1 }] },
      at: new Date("2026-10-02T00:00:00.000Z"),
    });
    expect(result).toEqual({
      email: "a@b.c",
      passwordHash: "[REDACTED]",
      nested: { token: "[REDACTED]", list: [{ secret: "[REDACTED]", ok: 1 }] },
      at: "2026-10-02T00:00:00.000Z",
    });
  });
});

describe("recordAudit", () => {
  it("maps each actor type to the right columns and writes through the given client", async () => {
    const tx = {} as never;
    await recordAudit(tx, {
      actor: { type: "DEVICE", tokenId: "tok-1" },
      action: "scan.create",
      entity: "Scan",
      entityId: "scan-1",
      after: { verdict: "PASS" },
      request: { ip: "10.0.0.5", userAgent: "yolo-client/1.0" },
    });
    expect(insertAuditLog).toHaveBeenCalledWith(
      {
        actorType: "DEVICE",
        actorUserId: null,
        actorTokenId: "tok-1",
        action: "scan.create",
        entity: "Scan",
        entityId: "scan-1",
        before: undefined,
        after: { verdict: "PASS" },
        ip: "10.0.0.5",
        userAgent: "yolo-client/1.0",
      },
      tx,
    );
  });
});
