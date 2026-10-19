import { validateThresholds } from "@/lib/admin-rules";
import { Errors } from "@/server/lib/errors";
import { getCvSettings } from "@/server/models/cv-settings.model";
import { runInTransaction } from "@/server/models/db";
import {
  findReference,
  findReferenceByField,
  insertReference,
  listReference,
  listUnknownClassKeys,
  updateReference,
  updateModelNotice,
  updateThresholds,
  type ReferenceRow,
} from "@/server/models/reference-data.model";
import {
  referenceSchemas,
  type ModelNoticeInput,
  type ReferenceKind,
  type ThresholdsInput,
} from "@/server/validators/settings.validator";
import { recordAudit } from "./audit.service";

type Actor = { id: string };

// ───────────── CV thresholds (D-011, D-024) ─────────────

export async function getThresholds() {
  const s = await getCvSettings();
  if (!s) throw Errors.notFound("The CV settings");
  return {
    rejectAtOrAbove: s.rejectAtOrAbove,
    reworkAtOrAbove: s.reworkAtOrAbove,
    foundAtOrAbove: s.foundAtOrAbove,
    earlyModelNotice: s.earlyModelNotice,
    updatedAt: s.updatedAt,
  };
}

/**
 * Saves new decision thresholds. Scans already taken keep the thresholds in their snapshot, so
 * their decisions stay explainable; only new scans use these.
 */
export async function saveThresholds(input: ThresholdsInput, actor: Actor) {
  const before = await getThresholds();
  const next = {
    rejectAtOrAbove: Math.round(input.rejectPercent * 10) / 1000,
    reworkAtOrAbove: Math.round(input.reworkPercent * 10) / 1000,
    foundAtOrAbove:
      input.foundPercent === undefined
        ? before.foundAtOrAbove
        : Math.round(input.foundPercent * 10) / 1000,
  };
  const FIELD = {
    rejectAtOrAbove: "rejectPercent",
    reworkAtOrAbove: "reworkPercent",
    foundAtOrAbove: "foundPercent",
  } as const;
  const errors = validateThresholds(next).map((e) => ({
    path: [FIELD[e.path[0]]],
    message: e.message,
  }));
  if (errors.length > 0) throw Errors.validation(errors);
  await runInTransaction(async (tx) => {
    await updateThresholds({ ...next, updatedById: actor.id }, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "settings.thresholds",
      entity: "CvSettings",
      entityId: "1",
      before: {
        rejectAtOrAbove: before.rejectAtOrAbove,
        reworkAtOrAbove: before.reworkAtOrAbove,
        foundAtOrAbove: before.foundAtOrAbove,
      },
      after: next,
    });
  });
  return next;
}

/** Turns the Camera page's early-model notice on or off (D-055). */
export async function saveModelNotice(input: ModelNoticeInput, actor: Actor) {
  const before = await getThresholds();
  if (before.earlyModelNotice === input.earlyModelNotice) return input;
  await runInTransaction(async (tx) => {
    await updateModelNotice(
      { earlyModelNotice: input.earlyModelNotice, updatedById: actor.id },
      tx,
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "settings.model_notice",
      entity: "CvSettings",
      entityId: "1",
      before: { earlyModelNotice: before.earlyModelNotice },
      after: { earlyModelNotice: input.earlyModelNotice },
    });
  });
  return input;
}

// ───────────── reference data ─────────────

const AUDIT_PREFIX: Record<ReferenceKind, string> = {
  defectType: "defect_type",
  shoeType: "shoe_type",
  supplier: "supplier",
  componentType: "component_type",
};
const ENTITY: Record<ReferenceKind, string> = {
  defectType: "DefectType",
  shoeType: "ShoeType",
  supplier: "Supplier",
  componentType: "ComponentType",
};
const WHAT: Record<ReferenceKind, string> = {
  defectType: "This defect type",
  shoeType: "This shoe type",
  supplier: "This supplier",
  componentType: "This component type",
};
/** Fields that must be unique per kind, with the message for a clash. */
const UNIQUE: Record<ReferenceKind, { field: string; message: (v: string) => string }[]> = {
  defectType: [
    { field: "key", message: (v) => `"${v}" is already a defect type. Edit that one instead.` },
  ],
  shoeType: [
    { field: "code", message: (v) => `${v} is already used by another shoe type.` },
    { field: "name", message: (v) => `"${v}" is already a shoe type.` },
  ],
  supplier: [{ field: "name", message: (v) => `"${v}" is already a supplier.` }],
  componentType: [],
};

export function listReferenceRows(kind: ReferenceKind): Promise<ReferenceRow[]> {
  return listReference(kind);
}

async function assertUnique(
  kind: ReferenceKind,
  values: Record<string, unknown>,
  exceptId?: string,
) {
  const clashes = [];
  for (const u of UNIQUE[kind]) {
    const value = values[u.field];
    if (typeof value !== "string") continue;
    if (await findReferenceByField(kind, u.field, value, exceptId))
      clashes.push({ path: [u.field], message: u.message(value) });
  }
  if (clashes.length > 0) throw Errors.validation(clashes);
}

/** A unique-index race becomes the same field error as the pre-check. */
function uniqueRace(kind: ReferenceKind, error: unknown): never {
  if ((error as { code?: string })?.code === "P2002") {
    const field = UNIQUE[kind][0]?.field ?? "name";
    throw Errors.validation([{ path: [field], message: "That's already used. Choose another." }]);
  }
  throw error;
}

/** Optional fields left blank are stored as null, so clearing a field on edit works. */
function toColumns(kind: ReferenceKind, values: Record<string, unknown>) {
  const nullable: Record<ReferenceKind, string[]> = {
    defectType: ["description", "action"],
    shoeType: [],
    supplier: ["contactPerson", "phone", "notes"],
    componentType: ["shoeTypeId"],
  };
  const out: Record<string, unknown> = { ...values };
  for (const key of nullable[kind]) out[key] = values[key] ?? null;
  return out;
}

export async function createReferenceRow(kind: ReferenceKind, input: unknown, actor: Actor) {
  const values = referenceSchemas[kind].create.parse(input) as Record<string, unknown>;
  await assertUnique(kind, values);
  return runInTransaction(async (tx) => {
    const row = await insertReference(kind, toColumns(kind, values), tx).catch((e: unknown) =>
      uniqueRace(kind, e),
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: `${AUDIT_PREFIX[kind]}.create`,
      entity: ENTITY[kind],
      entityId: row.id,
      after: row,
    });
    return row;
  });
}

export async function updateReferenceRow(
  kind: ReferenceKind,
  id: string,
  input: unknown,
  actor: Actor,
) {
  const before = await findReference(kind, id);
  if (!before) throw Errors.notFound(WHAT[kind]);
  const values = referenceSchemas[kind].update.parse(input) as Record<string, unknown>;
  await assertUnique(kind, values, id);
  return runInTransaction(async (tx) => {
    const after = await updateReference(kind, id, toColumns(kind, values), tx).catch((e: unknown) =>
      uniqueRace(kind, e),
    );
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: `${AUDIT_PREFIX[kind]}.update`,
      entity: ENTITY[kind],
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

/**
 * No deletes: batches, scans and components reference these rows. An inactive one disappears
 * from pickers (and an inactive defect type is ignored by the decision engine, D-011).
 */
export async function setReferenceActive(
  kind: ReferenceKind,
  id: string,
  isActive: boolean,
  actor: Actor,
) {
  const before = await findReference(kind, id);
  if (!before) throw Errors.notFound(WHAT[kind]);
  if (before.isActive === isActive) return before;
  return runInTransaction(async (tx) => {
    const after = await updateReference(kind, id, { isActive }, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: `${AUDIT_PREFIX[kind]}.${isActive ? "reactivate" : "deactivate"}`,
      entity: ENTITY[kind],
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive },
    });
    return after;
  });
}

/** Class keys the camera sent that no defect type covers yet (for the YOLO retraining). */
export async function unknownClasses() {
  const rows = await listUnknownClassKeys();
  return rows.map((r) => ({ ...r, lastSeen: r.lastSeen.toISOString() }));
}
