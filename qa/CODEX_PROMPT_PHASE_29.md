# Prompt for Codex: Phase 29 QA, run 1 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Before pasting, Dylan has
run `npm run db:deploy` and `npm run demo:reset -- --yes` on the dev database. Copy from the line
down.

---

You are the QA tester for CPoint-PMS. The builder (Claude) finished Phase 29, **stock updated on
one sheet, reminders on Wednesdays and Fridays, and Reports → Materials** (D-102), and has not
opened it in a browser. Check that the Floor Manager updates stock on one sheet (Added, Used,
Correction with a reason) in one save, that the item dialogs are gone, that a leather roll needs
its supplier, that the reminder shows on a reminder day until an update is saved, and that
Reports → Materials adds up.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Never run `demo:reset` or `docker compose down -v` on the `cpoint-pms` project. Leave anything
  on port 3000 that isn't CPoint-PMS alone (`PORT=3001`).
- Change stock only on items you create (codes starting `QA29-`). Put the reminder days back to
  Wednesday and Friday when you finish (S3).
- Browser checks stay headless (no visible Chrome windows).

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and
   `qa/handoffs/2026-10-25-phase-29-stock-updates.md`.
2. Set up and save each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-25-phase-29/`:

   ```bash
   npm run db:up
   npx prisma migrate status
   npm run build
   ```

   `migrate status` must say the database is up to date with `20261027090000_stock_updates`
   applied. Also save the output of this check (every item's stock equals its ledger, and the
   settings row) as `ledger.txt`:

   ```bash
   docker compose exec -T db psql -U cpoint -d cpoint_pms -c "select count(*) as off_ledger from inventory_items i where i.\"quantityOnHand\" <> (select coalesce(sum(m.\"quantityDelta\"),0) from inventory_movements m where m.\"itemId\"=i.id)" -c "select \"reminderDays\" from inventory_settings" -c "select count(*) as updates from stock_updates"
   ```

   `off_ledger` must be 0 and the reminder days `{3,5}`.

3. **Browser scenarios first** (`npm run start`), in the handoff's order: **S1 to S3 before
   anything saves stock today**, then S4 to S17 and A1 to A4. Screenshot the sheet with an error
   (S6, S7), the FM home with the reminder card (S2), and Materials (S12). Run axe (WCAG 2.1 A/AA)
   as S16 lists. For S13 write your sums in the report.
4. Save the HTTP status of every request in A1 to A4 in `access.txt` (role, method, URL, status).
5. Then run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. If a test
   fails, re-run that file alone with `--workers=1` and save it as `e2e-rerun.log`.
6. Run the `ledger.txt` check again after the e2e run and save it as `ledger-after.txt`
   (`off_ledger` still 0).

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you saw.
- **For any FAIL:** the steps, the exact message, a screenshot, whether the app or the test is
  wrong, and the file and line you suspect. Don't fix it; Claude does.
- The e2e passed, failed and skipped counts, and for each failing test its title, the failing line
  and the error.
- Every axe result, `access.txt`, `ledger.txt` and `ledger-after.txt`.

## Write the report

Save it as `qa/reports/2026-10-25-phase-29-stock-updates.md` (or today's date), using
`qa/templates/report.md`. The verdict is **PASS** only if the build passes, the migration is
applied, the ledger check is 0 before and after, the e2e suite has no failure (one that passes in
`e2e-rerun.log` counts as a test-isolation note), axe finds no serious or critical violation, and
every High scenario passed. List BLOCKED scenarios under **"Needs Dylan"**.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-25.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_29]]` and the report.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the report
path.
