import type { LocationKind, Prisma } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

// ───────────── Storage locations (Phase 32, D-128) ─────────────

const locationSelect = {
  id: true,
  code: true,
  name: true,
  kind: true,
  notes: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  _count: { select: { rolls: true } },
} satisfies Prisma.StorageLocationSelect;

export type LocationRow = Prisma.StorageLocationGetPayload<{ select: typeof locationSelect }>;

/** Every location (or only the active ones), in the Floor Manager's order, then by code. */
export function listLocations(
  filters: { activeOnly?: boolean } = {},
  db: Db = defaultDb(),
): Promise<LocationRow[]> {
  return db.storageLocation.findMany({
    where: filters.activeOnly ? { isActive: true } : undefined,
    select: locationSelect,
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    take: 500,
  });
}

export function findLocation(id: string, db: Db = defaultDb()): Promise<LocationRow | null> {
  return db.storageLocation.findUnique({ where: { id }, select: locationSelect });
}

export function findLocationByCode(
  code: string,
  db: Db = defaultDb(),
): Promise<LocationRow | null> {
  return db.storageLocation.findUnique({ where: { code }, select: locationSelect });
}

export function findLocationsByIds(ids: string[], db: Db = defaultDb()): Promise<LocationRow[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return db.storageLocation.findMany({
    where: { id: { in: ids } },
    select: locationSelect,
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export function insertLocation(
  data: {
    code: string;
    name: string | null;
    kind: LocationKind;
    notes: string | null;
    sortOrder: number;
    createdById: string;
  },
  db: Db = defaultDb(),
): Promise<LocationRow> {
  return db.storageLocation.create({ data, select: locationSelect });
}

export function updateLocation(
  id: string,
  data: Partial<{
    code: string;
    name: string | null;
    kind: LocationKind;
    notes: string | null;
    isActive: boolean;
  }>,
  db: Db = defaultDb(),
): Promise<LocationRow> {
  return db.storageLocation.update({ where: { id }, data, select: locationSelect });
}

/** The next sort position: new locations go last. */
export async function nextLocationSortOrder(db: Db = defaultDb()): Promise<number> {
  const last = await db.storageLocation.aggregate({ _max: { sortOrder: true } });
  return (last._max.sortOrder ?? 0) + 1;
}

/** The rolls kept in a location now. */
export function countRollsIn(id: string, db: Db = defaultDb()): Promise<number> {
  return db.roll.count({ where: { locationId: id } });
}

/** Whether any roll was ever placed in (or taken from) this location: its code is on labels. */
export async function locationEverUsed(id: string, db: Db = defaultDb()): Promise<boolean> {
  const used = await db.rollMove.findFirst({
    where: { OR: [{ toLocationId: id }, { fromLocationId: id }] },
    select: { id: true },
  });
  return used !== null;
}

/** The locations any roll was ever placed in or taken from (their codes are on labels, A-79). */
export async function listUsedLocationIds(db: Db = defaultDb()): Promise<Set<string>> {
  const [to, from] = await Promise.all([
    db.rollMove.findMany({
      where: { toLocationId: { not: null } },
      distinct: ["toLocationId"],
      select: { toLocationId: true },
    }),
    db.rollMove.findMany({
      where: { fromLocationId: { not: null } },
      distinct: ["fromLocationId"],
      select: { fromLocationId: true },
    }),
  ]);
  const out = new Set<string>();
  for (const m of to) if (m.toLocationId) out.add(m.toLocationId);
  for (const m of from) if (m.fromLocationId) out.add(m.fromLocationId);
  return out;
}
