import { type Db, defaultDb } from "./db";

// Create-if-missing upserts: an existing row is never overwritten, so edits made by an admin
// (labels, thresholds, active flags) survive every restart.

export function ensureDefectType(
  data: {
    key: string;
    label: string;
    description: string;
    sortOrder: number;
    outcome: "USABLE" | "NOT_ACCEPTED";
    notAcceptedFromIn?: number;
    flatSharePct?: number;
  },
  db: Db = defaultDb(),
) {
  return db.defectType.upsert({ where: { key: data.key }, create: data, update: {} });
}

/** Adds a supplier by name if missing; an existing one keeps its code and notes. */
export function ensureSupplier(
  data: { name: string; notes: string; code: string },
  db: Db = defaultDb(),
) {
  return db.supplier.upsert({ where: { name: data.name }, create: data, update: {} });
}

export function findSupplierByName(name: string, db: Db = defaultDb()) {
  return db.supplier.findUnique({ where: { name } });
}

/** Every supplier's short code, for picking a free one (Phase 30A). */
export async function listSupplierCodes(db: Db = defaultDb()): Promise<string[]> {
  return (await db.supplier.findMany({ select: { code: true } })).map((s) => s.code);
}

export function ensureCvSettings(data: { foundAtOrAbove: number }, db: Db = defaultDb()) {
  return db.cvSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: {} });
}

export function listActiveSuppliers(db: Db = defaultDb()) {
  return db.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

export function findSupplier(id: string, db: Db = defaultDb()) {
  return db.supplier.findUnique({ where: { id } });
}

export function listDefectTypes(db: Db = defaultDb()) {
  return db.defectType.findMany({
    select: {
      id: true,
      key: true,
      label: true,
      isActive: true,
      outcome: true,
      notAcceptedFromIn: true,
      flatSharePct: true,
    },
    orderBy: { sortOrder: "asc" },
  });
}

// ───────────── admin CRUD (D-024) ─────────────

export type ReferenceKind = "defectType" | "supplier" | "finalDefectType";

export type ReferenceRow = { id: string; isActive: boolean } & Record<string, unknown>;

/** The two delegates share the calls used here; one cast keeps the services generic. */
type RefDelegate = {
  findMany(args: { orderBy: object[] }): Promise<ReferenceRow[]>;
  findUnique(args: { where: { id: string } }): Promise<ReferenceRow | null>;
  findFirst(args: { where: object; select: { id: true } }): Promise<{ id: string } | null>;
  create(args: { data: object }): Promise<ReferenceRow>;
  update(args: { where: { id: string }; data: object }): Promise<ReferenceRow>;
};

function delegate(kind: ReferenceKind, db: Db): RefDelegate {
  const delegates = {
    defectType: db.defectType,
    supplier: db.supplier,
    finalDefectType: db.finalDefectType,
  };
  return delegates[kind] as unknown as RefDelegate;
}

const ORDER: Record<ReferenceKind, object[]> = {
  defectType: [{ sortOrder: "asc" }, { label: "asc" }],
  supplier: [{ isActive: "desc" }, { name: "asc" }],
  finalDefectType: [{ sortOrder: "asc" }, { label: "asc" }],
};

/** Every row of a kind, active first where it matters, inactive ones included. */
export function listReference(kind: ReferenceKind, db: Db = defaultDb()) {
  return delegate(kind, db).findMany({ orderBy: ORDER[kind] });
}

export function findReference(kind: ReferenceKind, id: string, db: Db = defaultDb()) {
  return delegate(kind, db).findUnique({ where: { id } });
}

/** Another row with this unique value (case-insensitive), for a friendly field error. */
export function findReferenceByField(
  kind: ReferenceKind,
  field: string,
  value: string,
  exceptId?: string,
  db: Db = defaultDb(),
) {
  return delegate(kind, db).findFirst({
    where: {
      [field]: { equals: value, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
}

export function insertReference(kind: ReferenceKind, data: object, db: Db = defaultDb()) {
  return delegate(kind, db).create({ data });
}

export function updateReference(
  kind: ReferenceKind,
  id: string,
  data: object,
  db: Db = defaultDb(),
) {
  return delegate(kind, db).update({ where: { id }, data });
}

export function updateThresholds(
  data: {
    foundAtOrAbove: number;
    earlyModelNotice: boolean;
    returnSharePct: number;
    updatedById: string;
  },
  db: Db = defaultDb(),
) {
  return db.cvSettings.update({ where: { id: 1 }, data });
}

export function updateModelNotice(
  data: { earlyModelNotice: boolean; updatedById: string },
  db: Db = defaultDb(),
) {
  return db.cvSettings.update({ where: { id: 1 }, data });
}
