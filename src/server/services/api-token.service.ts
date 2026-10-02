import {
  generateDeviceToken,
  hashDeviceToken,
  parseBearer,
  type DeviceScope,
} from "@/server/lib/device-token";
import { Errors } from "@/server/lib/errors";
import {
  findApiTokenByHash,
  findApiTokenById,
  insertApiToken,
  listApiTokens,
  markApiTokenRevoked,
  touchApiToken,
} from "@/server/models/api-token.model";
import { runInTransaction } from "@/server/models/db";
import { recordAudit } from "./audit.service";

type Actor = { id: string };
export type DeviceIdentity = { id: string; name: string };

/** Creates a token and returns the plain value. It is never retrievable again. */
export async function createDeviceToken(
  input: { name: string; scopes?: DeviceScope[]; expiresAt?: Date | null },
  actor: Actor,
): Promise<{ token: string; id: string; name: string; tokenPrefix: string }> {
  const { token, hash, prefix } = generateDeviceToken();
  return runInTransaction(async (tx) => {
    const record = await insertApiToken(
      {
        name: input.name,
        tokenPrefix: prefix,
        tokenHash: hash,
        scopes: input.scopes ?? ["scans:create"],
        createdById: actor.id,
        expiresAt: input.expiresAt ?? null,
      },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "token.create",
      entity: "ApiToken",
      entityId: record.id,
      after: { name: record.name, tokenPrefix: record.tokenPrefix, scopes: record.scopes },
    });
    return { token, id: record.id, name: record.name, tokenPrefix: record.tokenPrefix };
  });
}

export function listDeviceTokens() {
  return listApiTokens();
}

export async function revokeDeviceToken(id: string, actor: Actor, now: Date = new Date()) {
  const token = await findApiTokenById(id);
  if (!token) throw Errors.notFound("This token");
  if (token.revokedAt) throw Errors.conflict("This token is already revoked.");
  await runInTransaction(async (tx) => {
    await markApiTokenRevoked(id, now, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "token.revoke",
      entity: "ApiToken",
      entityId: id,
      before: { name: token.name, tokenPrefix: token.tokenPrefix },
    });
  });
}

/**
 * Authenticates a camera/device request from its Authorization header.
 * 401 for a missing, unknown, revoked or expired token; 403 when the token lacks the scope.
 */
export async function authenticateDevice(
  authorization: string | null,
  scope: DeviceScope,
  now: Date = new Date(),
): Promise<DeviceIdentity> {
  const plain = parseBearer(authorization);
  if (!plain) throw Errors.unauthenticated("Send a device token: Authorization: Bearer cpt_…");
  const token = await findApiTokenByHash(hashDeviceToken(plain));
  if (!token || token.revokedAt || (token.expiresAt && token.expiresAt <= now)) {
    throw Errors.unauthenticated(
      "This device token is invalid, revoked or expired. Ask an admin for a new one.",
    );
  }
  if (!token.scopes.includes(scope))
    throw Errors.forbidden(`This device token can't ${scope.replace(":", " ")}.`);
  await touchApiToken(token.id, now);
  return { id: token.id, name: token.name };
}
