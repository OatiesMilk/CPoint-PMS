# Prompt for Codex: Phase 30A QA, run 1 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Before pasting, Dylan has
run `npm run db:deploy` and `npm run demo:reset -- --yes` on the dev database. Copy from the line
down.

---

You are the QA tester for CPoint-PMS. The builder (Claude) finished Phase 30A, **leather rolls come
from Inventory** (D-103, D-104), and has not opened it in a browser. Check that the Floor Manager
adds leather rolls with their areas on the item, that leather is read-only on Update stock, that
the constructor picks a roll at Capture instead of starting one, that the Quality Inspector ticks
scanned rolls Fully used at Finish batch (and only then does stock drop), that Correct can untick,
that the FM can remove a roll, and that supplier codes work.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Never run `demo:reset` or `docker compose down -v` on the `cpoint-pms` project. Leave anything
  on port 3000 that isn't CPoint-PMS alone (`PORT=3001`).
- Add rolls only to items you create (codes starting `QA30-`) and tick only your own rolls.
- Browser checks stay headless (no visible Chrome windows). For Capture use Chromium's fake camera
  (`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`).

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and
   `qa/handoffs/2026-10-26-phase-30a-rolls-from-inventory.md`.
2. Set up and save each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-26-phase-30a/`:

   ```bash
   npm run db:up
   npx prisma migrate status
   npm run build
   ```

   `migrate status` must say the database is up to date with
   `20261028090000_rolls_from_inventory` applied. Also save the output of this check as
   `ledger.txt`:

   ```bash
   docker compose exec -T db psql -U cpoint -d cpoint_pms -c "select count(*) as off_ledger from inventory_items i where i.\"quantityOnHand\" <> (select coalesce(sum(m.\"quantityDelta\"),0) from inventory_movements m where m.\"itemId\"=i.id)" -c "select status, count(*) from batches group by status order by status" -c "select name, code from suppliers order by name"
   ```

   `off_ledger` must be 0; the demo rolls include `IN_STOCK`, `OPEN`, `FINISHED`, `USED` and one
   `CANCELLED`; every supplier has a code.

3. **Browser scenarios** (`npm run start`), in the handoff's order, S1 to S17 and A1 to A5. Run
   S7, S8 and S10 at **390 × 844** and screenshot them; also screenshot the Add rolls dialog with
   an error (S3) and the item's Rolls table (S4). Run axe (WCAG 2.1 A/AA) as S16 lists. For S17 run
   the ledger query after each step it names and write the results in the report.
4. Save the HTTP status of every request in A1 to A5 in `access.txt` (role, method, URL, status).
5. Then run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. If a test
   fails, re-run that file alone with `--workers=1` and save it as `e2e-rerun.log`.
6. Run the `ledger.txt` check again after the e2e run and save it as `ledger-after.txt`
   (`off_ledger` still 0).

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you saw.
- **For any FAIL:** the steps, the exact message, a screenshot, whether the app or the test is
  wrong, and the file and line you suspect. Don't fix it; Claude does.
- The e2e passed, failed and skipped counts, and for each failing test its title, the failing line
  and the error. The specs changed in this phase are `capture`, `rolls`, `batches`, `inventory`,
  `admin`, `smoke` and `supplier-quality`; they were written but never run, so say for each
  failure whether the app or the test looks wrong.
- Every axe result, `access.txt`, `ledger.txt` and `ledger-after.txt`.

## Write the report

Save it as `qa/reports/2026-10-26-phase-30a-rolls-from-inventory.md` (or today's date), using
`qa/templates/report.md`. The verdict is **PASS** only if the build passes, the migration is
applied, the ledger check is 0 before and after, the e2e suite has no failure (one that passes in
`e2e-rerun.log` counts as a test-isolation note), axe finds no serious or critical violation, and
every High scenario passed. List BLOCKED scenarios under **"Needs Dylan"**.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-26.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30A]]` and the report.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the report
path.
