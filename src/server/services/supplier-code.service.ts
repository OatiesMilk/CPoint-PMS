import { freeSupplierCode, supplierCodeFromName } from "@/lib/roll-rules";
import { type Db, defaultDb } from "@/server/models/db";
import {
  ensureSupplier,
  findSupplierByName,
  listSupplierCodes,
} from "@/server/models/reference-data.model";
import { seedSupplierTag } from "./roll-tag.service";

/**
 * A supplier's short code for roll codes (Phase 30A, D-104): the one typed, or one made from the
 * name's initials (Dylan, 26 Oct 2026), with a number added when it is taken.
 */
export async function suggestSupplierCode(name: string, db: Db = defaultDb()): Promise<string> {
  return freeSupplierCode(supplierCodeFromName(name), await listSupplierCodes(db));
}

/**
 * Bootstrap and the demo week: add a supplier by name if missing, with a free short code and its
 * first roll tag (the short code, as its default; Phase 42, D-139).
 */
export async function ensureSupplierWithCode(
  data: { name: string; notes: string },
  db: Db = defaultDb(),
) {
  const existing = await findSupplierByName(data.name, db);
  if (existing) return existing;
  const supplier = await ensureSupplier(
    { ...data, code: await suggestSupplierCode(data.name, db) },
    db,
  );
  await seedSupplierTag(supplier, db);
  return supplier;
}
