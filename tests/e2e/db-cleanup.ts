/**
 * Removes check-ins from a spec's own rows (Phase 34): their repair jobs and findings first, because
 * the schema keeps `RESTRICT` on both (the app never deletes a check-in; a correction removes its
 * findings first). `where` is the condition on `production_check_ins`, with `params`.
 */
export async function removeCheckIns(
  db: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  where: string,
  params: unknown[],
) {
  const own = `SELECT id FROM production_check_ins WHERE ${where}`;
  await db.query(
    `DELETE FROM repair_jobs WHERE "findingId" IN (SELECT id FROM inspection_findings WHERE "checkInId" IN (${own}))`,
    params,
  );
  await db.query(`DELETE FROM inspection_findings WHERE "checkInId" IN (${own})`, params);
  await db.query(`DELETE FROM production_check_ins WHERE ${where}`, params);
}
