/**
 * Roll tags (Phase 42, D-139): the list whose codes start every roll code, LR-<tag>-001. The Floor
 * Manager adds, edits, deactivates and removes them under Inventory → Roll tags; Add rolls picks one
 * per roll. A supplier's first tag is its short code (made when the supplier is added, or by the
 * Phase 42 migration), and it is the supplier's default. CPoint hasn't confirmed its real tag
 * codes (A-119).
 */
import {
  planTagCodeChange,
  planTagRemove,
  ROLL_TAG_MESSAGES,
  tagCodeTakenMessage,
  type RollTagOption,
} from "@/lib/roll-tag-rules";
import { Errors } from "@/server/lib/errors";
import { type Db, runInTransaction } from "@/server/models/db";
import { findSupplier } from "@/server/models/reference-data.model";
import {
  clearOtherDefaults,
  countRollsMadeFrom,
  deleteRollTag,
  findRollTag,
  findRollTagByCode,
  insertRollTag,
  listRollTags as listRollTagRows,
  updateRollTag,
  type RollTagRow,
} from "@/server/models/roll-tag.model";
import type { AddRollTagValues, EditRollTagValues } from "@/server/validators/roll-tag.validator";
import { recordAudit } from "./audit.service";

type Actor = { id: string };

export type RollTag = {
  id: string;
  code: string;
  supplierId: string | null;
  supplierName: string | null;
  isDefault: boolean;
  isActive: boolean;
  /** The rolls whose code was made from it. */
  rolls: number;
};

export function toRollTag(row: RollTagRow): RollTag {
  return {
    id: row.id,
    code: row.code,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    isDefault: row.isDefault,
    isActive: row.isActive,
    rolls: row._count.rolls,
  };
}

/** What the audit log keeps: the code and the supplier's name, no people. */
const snapshot = (t: RollTag) => ({
  code: t.code,
  supplier: t.supplierName,
  isDefault: t.isDefault,
  isActive: t.isActive,
});

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";

export async function listRollTags(filters: { activeOnly?: boolean } = {}): Promise<RollTag[]> {
  return (await listRollTagRows(filters)).map(toRollTag);
}

/** Inventory → Roll tags: every tag, and whether its code is locked (A-122). */
export async function listRollTagsForManager(): Promise<(RollTag & { codeLocked: boolean })[]> {
  return (await listRollTags()).map((t) => ({ ...t, codeLocked: t.rolls > 0 }));
}

export async function getRollTag(id: string): Promise<RollTag | null> {
  const row = await findRollTag(id);
  return row ? toRollTag(row) : null;
}

/** The active tags, as the Add rolls dropdown needs them. */
export async function listRollTagOptions(): Promise<RollTagOption[]> {
  return (await listRollTags({ activeOnly: true })).map((t) => ({
    id: t.id,
    code: t.code,
    supplierId: t.supplierId,
    supplierName: t.supplierName,
    isDefault: t.isDefault,
  }));
}

/** A tag that is a supplier's default must belong to an active supplier (A-123). */
async function assertSupplierFor(supplierId: string | null, wantsDefault: boolean) {
  if (wantsDefault && !supplierId)
    throw Errors.validation([
      { path: ["isDefault"], message: ROLL_TAG_MESSAGES.defaultNeedsSupplier },
    ]);
  if (!supplierId) return;
  const supplier = await findSupplier(supplierId);
  if (!supplier)
    throw Errors.validation([{ path: ["supplierId"], message: ROLL_TAG_MESSAGES.chooseSupplier }]);
  if (!supplier.isActive && wantsDefault)
    throw Errors.validation([
      {
        path: ["supplierId"],
        message: `${supplier.name} is no longer an active supplier, so it can’t have a default tag.`,
      },
    ]);
}

export async function addRollTag(values: AddRollTagValues, actor: Actor): Promise<RollTag> {
  if (await findRollTagByCode(values.code))
    throw Errors.validation([{ path: ["code"], message: tagCodeTakenMessage(values.code) }]);
  await assertSupplierFor(values.supplierId, values.isDefault);
  try {
    return await runInTransaction(async (tx) => {
      if (values.isDefault && values.supplierId)
        await clearOtherDefaults(values.supplierId, null, tx);
      const tag = toRollTag(
        await insertRollTag(
          { code: values.code, supplierId: values.supplierId, isDefault: values.isDefault },
          tx,
        ),
      );
      await recordAudit(tx, {
        actor: { type: "USER", userId: actor.id },
        action: "roll_tag.create",
        entity: "RollTag",
        entityId: tag.id,
        after: snapshot(tag),
      });
      return tag;
    });
  } catch (error) {
    // Two people adding the same code at once: the unique index decides.
    if (isUniqueViolation(error))
      throw Errors.validation([{ path: ["code"], message: tagCodeTakenMessage(values.code) }]);
    throw error;
  }
}

/**
 * Edit a tag. Its code changes only while no roll was made from it (A-122); its supplier and
 * default always can. Deactivating takes it out of the Add rolls list (its rolls keep their
 * codes) and it stops being a default; a deactivated tag can't be made one (A-123).
 */
export async function editRollTag(
  id: string,
  values: EditRollTagValues,
  actor: Actor,
): Promise<RollTag> {
  const row = await findRollTag(id);
  if (!row) throw Errors.notFound("This tag");
  const before = toRollTag(row);
  const data: Parameters<typeof updateRollTag>[1] = {};

  if (values.code !== undefined && values.code !== before.code) {
    const plan = planTagCodeChange(before.code, await countRollsMadeFrom(id));
    if (!plan.ok) throw Errors.conflict(plan.reason);
    if (await findRollTagByCode(values.code))
      throw Errors.validation([{ path: ["code"], message: tagCodeTakenMessage(values.code) }]);
    data.code = values.code;
  }
  if (values.supplierId !== undefined && values.supplierId !== before.supplierId)
    data.supplierId = values.supplierId;
  if (values.isDefault !== undefined && values.isDefault !== before.isDefault)
    data.isDefault = values.isDefault;
  if (values.isActive !== undefined && values.isActive !== before.isActive) {
    data.isActive = values.isActive;
    if (!values.isActive) data.isDefault = false;
  }

  const finalSupplierId = data.supplierId !== undefined ? data.supplierId : before.supplierId;
  const finalDefault = data.isDefault !== undefined ? data.isDefault : before.isDefault;
  const finalActive = data.isActive !== undefined ? data.isActive : before.isActive;
  if (finalDefault && !finalActive)
    throw Errors.validation([{ path: ["isDefault"], message: ROLL_TAG_MESSAGES.inactiveDefault }]);
  // Only a supplier or default that changed is checked: an old tag of a since-deactivated supplier
  // may still be edited for its code.
  if (data.supplierId !== undefined || data.isDefault !== undefined)
    await assertSupplierFor(finalSupplierId, finalDefault);

  const action =
    data.isActive === false
      ? "roll_tag.deactivate"
      : data.isActive === true
        ? "roll_tag.reactivate"
        : "roll_tag.update";

  try {
    return await runInTransaction(async (tx) => {
      if (data.code !== undefined) {
        // Checked again inside the transaction, so a roll made meanwhile keeps its tag's code.
        const plan = planTagCodeChange(before.code, await countRollsMadeFrom(id, tx));
        if (!plan.ok) throw Errors.conflict(plan.reason);
      }
      if (finalDefault && finalSupplierId && (data.isDefault || data.supplierId !== undefined))
        await clearOtherDefaults(finalSupplierId, id, tx);
      const after = toRollTag(await updateRollTag(id, data, tx));
      await recordAudit(tx, {
        actor: { type: "USER", userId: actor.id },
        action,
        entity: "RollTag",
        entityId: id,
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  } catch (error) {
    if (isUniqueViolation(error) && data.code)
      throw Errors.validation([{ path: ["code"], message: tagCodeTakenMessage(data.code) }]);
    throw error;
  }
}

/**
 * Remove a tag no roll was ever made from (A-122). A tag in use is deactivated instead, so its
 * rolls keep their codes.
 */
export async function removeRollTag(id: string, actor: Actor): Promise<void> {
  const row = await findRollTag(id);
  if (!row) throw Errors.notFound("This tag");
  const before = toRollTag(row);
  const plan = planTagRemove(before.code, await countRollsMadeFrom(id));
  if (!plan.ok) throw Errors.conflict(plan.reason);
  await runInTransaction(async (tx) => {
    // Checked again inside the transaction: a roll made meanwhile keeps its tag.
    const again = planTagRemove(before.code, await countRollsMadeFrom(id, tx));
    if (!again.ok) throw Errors.conflict(again.reason);
    await deleteRollTag(id, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "roll_tag.delete",
      entity: "RollTag",
      entityId: id,
      before: snapshot(before),
    });
  });
}

/**
 * A new supplier's first tag: its short code, as the supplier's default (A-119). Skipped when a
 * tag with that code exists already, so the supplier simply starts with no default. Runs in the
 * supplier's own transaction.
 */
export async function seedSupplierTag(
  supplier: { id: string; name: string; code: string },
  db: Db,
  actor?: Actor,
): Promise<RollTag | null> {
  if (await findRollTagByCode(supplier.code, db)) return null;
  const tag = toRollTag(
    await insertRollTag({ code: supplier.code, supplierId: supplier.id, isDefault: true }, db),
  );
  if (actor)
    await recordAudit(db, {
      actor: { type: "USER", userId: actor.id },
      action: "roll_tag.create",
      entity: "RollTag",
      entityId: tag.id,
      after: snapshot(tag),
    });
  return tag;
}

/** A tag by its code, added when it doesn't exist yet (the demo seed's extra tag). */
export async function ensureRollTag(values: AddRollTagValues, actor: Actor): Promise<RollTag> {
  const existing = await findRollTagByCode(values.code);
  return existing ? toRollTag(existing) : addRollTag(values, actor);
}
