/**
 * Storage locations (Phase 32, D-128): racks, bins and areas where leather rolls are kept. The
 * Floor Manager adds them under Inventory, prints their labels and keeps them up to date. A
 * location is never deleted (each roll's history refers to it); an empty one can be deactivated.
 * CPoint hasn't confirmed its rack layout (A-53): the codes are theirs to choose.
 */
import {
  codeTakenMessage,
  planCodeChange,
  planDeactivate,
  type ScannedCode,
} from "@/lib/location-rules";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import {
  countRollsIn,
  findLocation,
  findLocationByCode,
  insertLocation,
  listLocations as listLocationRows,
  listUsedLocationIds,
  locationEverUsed,
  nextLocationSortOrder,
  updateLocation,
  type LocationRow,
} from "@/server/models/location.model";
import type { AddLocationValues, EditLocationValues } from "@/server/validators/location.validator";
import { recordAudit } from "./audit.service";

type Actor = { id: string };

export type Location = {
  id: string;
  code: string;
  name: string | null;
  kind: LocationRow["kind"];
  notes: string | null;
  isActive: boolean;
  /** The rolls kept there now. */
  rolls: number;
};

export function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    notes: row.notes,
    isActive: row.isActive,
    rolls: row._count.rolls,
  };
}

const snapshot = (l: Location) => ({
  code: l.code,
  name: l.name,
  kind: l.kind,
  notes: l.notes,
  isActive: l.isActive,
});

export async function listLocations(filters: { activeOnly?: boolean } = {}): Promise<Location[]> {
  return (await listLocationRows(filters)).map(toLocation);
}

export async function getLocation(id: string): Promise<Location | null> {
  const row = await findLocation(id);
  return row ? toLocation(row) : null;
}

/** A location by its code, for Find roll's scanned `LOC:` labels. */
export async function locationByCode(code: string): Promise<Location | null> {
  const row = await findLocationByCode(code);
  return row ? toLocation(row) : null;
}

/** The location a scanned or typed code names, if any. */
export async function locationForScan(scanned: ScannedCode | null): Promise<Location | null> {
  if (!scanned) return null;
  return locationByCode(scanned.code);
}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";

export async function addLocation(values: AddLocationValues, actor: Actor): Promise<Location> {
  if (await findLocationByCode(values.code))
    throw Errors.validation([{ path: ["code"], message: codeTakenMessage(values.code) }]);
  try {
    return await runInTransaction(async (tx) => {
      const row = await insertLocation(
        {
          code: values.code,
          name: values.name,
          kind: values.kind,
          notes: values.notes,
          sortOrder: await nextLocationSortOrder(tx),
          createdById: actor.id,
        },
        tx,
      );
      const location = toLocation(row);
      await recordAudit(tx, {
        actor: { type: "USER", userId: actor.id },
        action: "location.add",
        entity: "StorageLocation",
        entityId: row.id,
        after: snapshot(location),
      });
      return location;
    });
  } catch (error) {
    // Two people adding the same code at once: the unique index decides.
    if (isUniqueViolation(error))
      throw Errors.validation([{ path: ["code"], message: codeTakenMessage(values.code) }]);
    throw error;
  }
}

/**
 * Edit a location. Its code changes only while no roll was ever placed there (A-79); it is
 * deactivated only when empty, and is then left out of every picker.
 */
export async function editLocation(
  id: string,
  values: Partial<EditLocationValues>,
  actor: Actor,
): Promise<Location> {
  const row = await findLocation(id);
  if (!row) throw Errors.notFound("This location");
  const before = toLocation(row);
  const data: Parameters<typeof updateLocation>[1] = {};

  if (values.code !== undefined && values.code !== before.code) {
    const plan = planCodeChange(before.code, await locationEverUsed(id));
    if (!plan.ok) throw Errors.conflict(plan.reason);
    if (await findLocationByCode(values.code))
      throw Errors.validation([{ path: ["code"], message: codeTakenMessage(values.code) }]);
    data.code = values.code;
  }
  if (values.name !== undefined) data.name = values.name;
  if (values.notes !== undefined) data.notes = values.notes;
  if (values.kind !== undefined) data.kind = values.kind;
  if (values.isActive !== undefined && values.isActive !== before.isActive) {
    if (!values.isActive) {
      const plan = planDeactivate(before.code, await countRollsIn(id));
      if (!plan.ok) throw Errors.conflict(plan.reason);
    }
    data.isActive = values.isActive;
  }

  const action =
    data.isActive === false
      ? "location.deactivate"
      : data.isActive === true
        ? "location.reactivate"
        : "location.edit";

  try {
    return await runInTransaction(async (tx) => {
      // Checked again inside the transaction, so a roll placed meanwhile isn't left in a
      // deactivated location.
      if (data.isActive === false) {
        const plan = planDeactivate(before.code, await countRollsIn(id, tx));
        if (!plan.ok) throw Errors.conflict(plan.reason);
      }
      const after = toLocation(await updateLocation(id, data, tx));
      await recordAudit(tx, {
        actor: { type: "USER", userId: actor.id },
        action,
        entity: "StorageLocation",
        entityId: id,
        before: snapshot(before),
        after: snapshot(after),
      });
      return after;
    });
  } catch (error) {
    if (isUniqueViolation(error) && data.code)
      throw Errors.validation([{ path: ["code"], message: codeTakenMessage(data.code) }]);
    throw error;
  }
}

/** Inventory → Storage locations: every location, and whether its code is locked (A-79). */
export async function listLocationsForManager(): Promise<(Location & { codeLocked: boolean })[]> {
  const [rows, used] = await Promise.all([listLocationRows(), listUsedLocationIds()]);
  return rows.map((row) => ({ ...toLocation(row), codeLocked: used.has(row.id) }));
}

/** A location by its code, added when it doesn't exist yet (the demo seed's placeholder racks). */
export async function ensureLocation(values: AddLocationValues, actor: Actor): Promise<Location> {
  const existing = await findLocationByCode(values.code);
  return existing ? toLocation(existing) : addLocation(values, actor);
}
