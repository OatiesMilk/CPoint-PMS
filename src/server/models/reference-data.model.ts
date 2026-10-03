import { type Db, defaultDb } from "./db";

// Create-if-missing upserts: an existing row is never overwritten, so edits made by an admin
// (labels, thresholds, active flags) survive every restart.

export function ensureShoeType(
  data: { code: string; name: string; sortOrder: number },
  db: Db = defaultDb(),
) {
  return db.shoeType.upsert({ where: { code: data.code }, create: data, update: {} });
}

export function ensureDefectType(
  data: { key: string; label: string; description: string; sortOrder: number },
  db: Db = defaultDb(),
) {
  return db.defectType.upsert({ where: { key: data.key }, create: data, update: {} });
}

export function ensureSupplier(data: { name: string; notes: string }, db: Db = defaultDb()) {
  return db.supplier.upsert({ where: { name: data.name }, create: data, update: {} });
}

export function ensureCvSettings(
  data: { rejectAtOrAbove: number; reworkAtOrAbove: number },
  db: Db = defaultDb(),
) {
  return db.cvSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: {} });
}

export function listActiveShoeTypes(db: Db = defaultDb()) {
  return db.shoeType.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
}

export function listActiveSuppliers(db: Db = defaultDb()) {
  return db.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function findShoeType(id: string, db: Db = defaultDb()) {
  return db.shoeType.findUnique({ where: { id } });
}

export function findSupplier(id: string, db: Db = defaultDb()) {
  return db.supplier.findUnique({ where: { id } });
}

export function listDefectTypes(db: Db = defaultDb()) {
  return db.defectType.findMany({
    select: { id: true, key: true, label: true, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

// ───────────── admin CRUD (D-024) ─────────────

export type ReferenceKind = "defectType" | "shoeType" | "supplier" | "componentType";

export type ReferenceRow = { id: string; isActive: boolean } & Record<string, unknown>;

/** The four delegates share the calls used here; one cast keeps the services generic. */
type RefDelegate = {
  findMany(args: { orderBy: object[]; include?: object }): Promise<ReferenceRow[]>;
  findUnique(args: { where: { id: string } }): Promise<ReferenceRow | null>;
  findFirst(args: { where: object; select: { id: true } }): Promise<{ id: string } | null>;
  create(args: { data: object }): Promise<ReferenceRow>;
  update(args: { where: { id: string }; data: object }): Promise<ReferenceRow>;
};

function delegate(kind: ReferenceKind, db: Db): RefDelegate {
  const delegates = {
    defectType: db.defectType,
    shoeType: db.shoeType,
    supplier: db.supplier,
    componentType: db.componentType,
  };
  return delegates[kind] as unknown as RefDelegate;
}

const ORDER: Record<ReferenceKind, object[]> = {
  defectType: [{ sortOrder: "asc" }, { label: "asc" }],
  shoeType: [{ sortOrder: "asc" }, { name: "asc" }],
  supplier: [{ isActive: "desc" }, { name: "asc" }],
  componentType: [{ sortOrder: "asc" }, { name: "asc" }],
};

/** Every row of a kind, active first where it matters, inactive ones included. */
export function listReference(kind: ReferenceKind, db: Db = defaultDb()) {
  return delegate(kind, db).findMany({
    orderBy: ORDER[kind],
    ...(kind === "componentType" ? { include: { shoeType: { select: { name: true } } } } : {}),
  });
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

export type UnknownClassRow = { rawClassKey: string; detections: number; lastSeen: Date };

/**
 * Class keys the camera sent that aren't defect types (yet): how often, and when last seen.
 * Keys added as defect types since then drop out of the list.
 */
export async function listUnknownClassKeys(db: Db = defaultDb()): Promise<UnknownClassRow[]> {
  const rows = await db.$queryRaw<{ rawClassKey: string; detections: bigint; lastSeen: Date }[]>`
    SELECT d."rawClassKey", count(*) AS detections, max(s."capturedAt") AS "lastSeen"
    FROM detections d JOIN scans s ON s.id = d."scanId"
    WHERE d."isUnknownClass"
      AND NOT EXISTS (SELECT 1 FROM defect_types t WHERE t.key = d."rawClassKey")
    GROUP BY d."rawClassKey"
    ORDER BY max(s."capturedAt") DESC
    LIMIT 50`;
  return rows.map((r) => ({ ...r, detections: Number(r.detections) }));
}

export function updateThresholds(
  data: { rejectAtOrAbove: number; reworkAtOrAbove: number; updatedById: string },
  db: Db = defaultDb(),
) {
  return db.cvSettings.update({ where: { id: 1 }, data });
}
