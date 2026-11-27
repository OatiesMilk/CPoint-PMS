import type { Prisma } from "@/generated/prisma/client";
import { type Db, defaultDb } from "./db";

// ───────────── Roll tags (Phase 42, D-139) ─────────────

const tagSelect = {
  id: true,
  code: true,
  supplierId: true,
  isDefault: true,
  isActive: true,
  createdAt: true,
  supplier: { select: { id: true, name: true } },
  _count: { select: { rolls: true } },
} satisfies Prisma.RollTagSelect;

export type RollTagRow = Prisma.RollTagGetPayload<{ select: typeof tagSelect }>;

/** Every tag (or only the active ones), by code. */
export function listRollTags(
  filters: { activeOnly?: boolean } = {},
  db: Db = defaultDb(),
): Promise<RollTagRow[]> {
  return db.rollTag.findMany({
    where: filters.activeOnly ? { isActive: true } : undefined,
    select: tagSelect,
    orderBy: [{ code: "asc" }],
    take: 500,
  });
}

export function findRollTag(id: string, db: Db = defaultDb()): Promise<RollTagRow | null> {
  return db.rollTag.findUnique({ where: { id }, select: tagSelect });
}

export function findRollTagByCode(code: string, db: Db = defaultDb()): Promise<RollTagRow | null> {
  return db.rollTag.findUnique({ where: { code }, select: tagSelect });
}

/** A supplier's default tag, active or not (the caller checks). */
export function findDefaultRollTag(
  supplierId: string,
  db: Db = defaultDb(),
): Promise<RollTagRow | null> {
  return db.rollTag.findFirst({ where: { supplierId, isDefault: true }, select: tagSelect });
}

export function insertRollTag(
  data: { code: string; supplierId: string | null; isDefault: boolean },
  db: Db = defaultDb(),
): Promise<RollTagRow> {
  return db.rollTag.create({ data, select: tagSelect });
}

export function updateRollTag(
  id: string,
  data: Partial<{ code: string; supplierId: string | null; isDefault: boolean; isActive: boolean }>,
  db: Db = defaultDb(),
): Promise<RollTagRow> {
  return db.rollTag.update({ where: { id }, data, select: tagSelect });
}

export async function deleteRollTag(id: string, db: Db = defaultDb()): Promise<void> {
  await db.rollTag.delete({ where: { id } });
}

/** A supplier has one default: every other tag of it stops being one. */
export async function clearOtherDefaults(
  supplierId: string,
  exceptId: string | null,
  db: Db = defaultDb(),
): Promise<number> {
  const { count } = await db.rollTag.updateMany({
    where: { supplierId, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isDefault: false },
  });
  return count;
}

/** The rolls whose code was made from this tag: their labels carry its code (A-122). */
export function countRollsMadeFrom(id: string, db: Db = defaultDb()): Promise<number> {
  return db.roll.count({ where: { tagId: id } });
}
