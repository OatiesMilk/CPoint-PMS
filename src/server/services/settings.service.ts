import { validateFoundAt } from "@/lib/admin-rules";
import { Errors } from "@/server/lib/errors";
import { getCvSettings } from "@/server/models/cv-settings.model";
import { runInTransaction } from "@/server/models/db";
import {
  findReference,
  findReferenceByField,
  insertReference,
  listReference,
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
import { suggestSupplierCode } from "./supplier-code.service";

type Actor = { id: string };

// ───────────── the CV rule (D-053, D-093) ─────────────

export async function getThresholds() {
  const s = await getCvSettings();
  if (!s) throw Errors.notFound("The CV settings");
  return {
    foundAtOrAbove: s.foundAtOrAbove,
    earlyModelNotice: s.earlyModelNotice,
    returnSharePct: s.returnSharePct,
    updatedAt: s.updatedAt,
  };
}

/**
 * Saves "A defect counts as found at" and the supplier limit (Phase 30C; and the early-model
 * notice when the API sends it). Scans
 * already taken keep the rule in their snapshot, so their verdicts stay explainable; only new
 * scans use this.
 */
export async function saveThresholds(input: ThresholdsInput, actor: Actor) {
  const before = await getThresholds();
  const foundAtOrAbove = Math.round(input.foundPercent * 10) / 1000;
  const errors = validateFoundAt(foundAtOrAbove).map((e) => ({
    path: ["foundPercent"],
    message: e.message,
  }));
  if (errors.length > 0) throw Errors.validation(errors);
  const next = {
    foundAtOrAbove,
    earlyModelNotice: input.earlyModelNotice ?? before.earlyModelNotice,
    returnSharePct: input.returnPercent ?? before.returnSharePct,
  };
  await runInTransaction(async (tx) => {
    await updateThresholds({ ...next, updatedById: actor.id }, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "settings.thresholds",
      entity: "CvSettings",
      entityId: "1",
      before: {
        foundAtOrAbove: before.foundAtOrAbove,
        earlyModelNotice: before.earlyModelNotice,
        returnSharePct: before.returnSharePct,
      },
      after: next,
    });
  });
  return next;
}

/** Turns Capture's early-model notice on or off (D-055). */
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
  supplier: "supplier",
  finalDefectType: "final_defect_type",
};
const ENTITY: Record<ReferenceKind, string> = {
  defectType: "DefectType",
  supplier: "Supplier",
  finalDefectType: "FinalDefectType",
};
const WHAT: Record<ReferenceKind, string> = {
  defectType: "This defect type",
  supplier: "This supplier",
  finalDefectType: "This final defect type",
};
/** Fields that must be unique per kind, with the message for a clash. */
const UNIQUE: Record<ReferenceKind, { field: string; message: (v: string) => string }[]> = {
  defectType: [
    { field: "key", message: (v) => `"${v}" is already a defect type. Edit that one instead.` },
  ],
  finalDefectType: [
    {
      field: "key",
      message: (v) => `"${v}" is already a final defect type. Edit that one instead.`,
    },
  ],
  supplier: [
    { field: "name", message: (v) => `"${v}" is already a supplier.` },
    {
      field: "code",
      message: (v) => `${v} is already another supplier’s code. Choose another, like ${v}2.`,
    },
  ],
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
    defectType: ["description"],
    supplier: ["contactPerson", "phone", "notes"],
    finalDefectType: ["description"],
  };
  const out: Record<string, unknown> = { ...values };
  for (const key of nullable[kind]) out[key] = values[key] ?? null;
  return out;
}

export async function createReferenceRow(kind: ReferenceKind, input: unknown, actor: Actor) {
  const values = referenceSchemas[kind].create.parse(input) as Record<string, unknown>;
  await assertUnique(kind, values);
  // A new supplier without a code gets one from its initials (Phase 30A, Dylan 26 Oct 2026).
  if (kind === "supplier" && !values.code)
    values.code = await suggestSupplierCode(String(values.name));
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
  // A supplier's code left blank on edit keeps the one it has (roll codes already use it).
  if (kind === "supplier" && !values.code) delete values.code;
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
 * No deletes: rolls and scans reference these rows. An inactive one disappears
 * from pickers (and an inactive defect type is ignored by the decision engine, D-093).
 */
export async function setReferenceActive(
  kind: ReferenceKind,
  id: string,
  isActive: boolean,
  actor: Actor,
) {
  const before = await findReference(kind, id);
  if (!before) throw Errors.notFound(WHAT[kind]);
  if (kind === "finalDefectType" && before.key === "OTHER" && !isActive)
    throw Errors.conflict(
      "Other can't be switched off. The Quality Inspector needs it for a defect that isn't listed.",
    );
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
