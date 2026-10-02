import { type Db, defaultDb } from "./db";

export function insertApiToken(
  data: {
    name: string;
    tokenPrefix: string;
    tokenHash: string;
    scopes: string[];
    createdById: string;
    expiresAt?: Date | null;
  },
  db: Db = defaultDb(),
) {
  return db.apiToken.create({ data });
}

export function findApiTokenByHash(tokenHash: string, db: Db = defaultDb()) {
  return db.apiToken.findUnique({ where: { tokenHash } });
}

export function findApiTokenById(id: string, db: Db = defaultDb()) {
  return db.apiToken.findUnique({ where: { id } });
}

export function listApiTokens(db: Db = defaultDb()) {
  return db.apiToken.findMany({
    orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });
}

export function markApiTokenRevoked(id: string, at: Date, db: Db = defaultDb()) {
  return db.apiToken.update({ where: { id }, data: { revokedAt: at } });
}

/** Records use without a write on every request: only if the last recorded use is over a minute old. */
export function touchApiToken(id: string, at: Date, db: Db = defaultDb()) {
  const minuteAgo = new Date(at.getTime() - 60_000);
  return db.apiToken.updateMany({
    where: { id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: minuteAgo } }] },
    data: { lastUsedAt: at },
  });
}
