# Prompt for Codex: Phase 30A QA, run 2 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Before pasting, Dylan has
run `npm run db:generate` and `npm run demo:reset -- --yes` on the dev database (run 1 started
without the reset, so the demo week had no rolls in Inventory and S14 was blocked). Copy from the
line down.

---

You are the QA tester for CPoint-PMS. Run 1 of Phase 30A
(`qa/reports/2026-10-26-phase-30a-rolls-from-inventory.md`) failed on the e2e suite; every manual
scenario but S14 passed. Claude fixed:

- **F1:** Settings → Suppliers showed the new Code column first, so each row was named by its code
  instead of the supplier's name (for screen readers and the test). Name is first again, Code
  second (`src/app/(app)/admin/settings/page.tsx`).
- **F2:** the e2e helper `addInventoryRoll` put every test's rolls on one shared leather item per
  supplier, so parallel tests changed the count between a test's two reads. Each roll now gets an
  item of its own (`tests/e2e/cv-helpers.ts`).
- **F3:** the Materials test read the next page before it had arrived. It now waits for each page
  (`tests/e2e/inventory.spec.ts`).
- **F4:** the smoke test clicked **Update stock** before the item's page had opened, so it hit the
  Inventory list's own Update stock link (the whole sheet, item on another page). It now waits for
  the item's heading and the `?q=` address (`tests/e2e/smoke.spec.ts`).
- **F5:** axe read the stock toast while it was still fading in (low contrast at part opacity). The
  test now waits for the toast to be fully shown, then runs axe on the page with the toast; nothing
  is excluded.
- The item code `LR-004QA30-1` in run 1 came from typing into the field after the suggested code
  had filled it; `fill` replaces it. Not changed.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Never run `demo:reset` or `docker compose down -v` on the `cpoint-pms` project. Leave anything
  on port 3000 that isn't CPoint-PMS alone (`PORT=3001`).
- Add or tick rolls only on items you create (codes starting `QA30R2-`), except R1, which only
  reads the demo item.
- Browser checks stay headless (no visible Chrome windows).

## Steps

1. Read `qa/README.md`, `qa/templates/report.md`, the run 1 report and the handoff
   `qa/handoffs/2026-10-26-phase-30a-rolls-from-inventory.md`.
2. Set up and save each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-26-phase-30a-run2/`. Stop and report if any step fails:

   ```powershell
   npm run db:up
   npx prisma migrate status        # must say "Database schema is up to date!"
   npm run build
   ```

   Then save run 1's ledger query (step 2 of `qa/CODEX_PROMPT_PHASE_30A.md`) as `ledger.txt`.
   After the reset it must show `off_ledger` 0 and rolls in `IN_STOCK`, `OPEN`, `FINISHED`,
   `USED` and one `CANCELLED`. If there is no `IN_STOCK` or `USED`, stop: the reset wasn't run.

3. Start the app with `npm run start` (`PORT=3001`) and run, in this order:
   - **R1 (S14, blocked in run 1):** the handoff's S14 on **Black cowhide (school shoes)**: each
     status chip filters the table, the pager reads "Roll pages" when there are more than 15, and
     no person's name shows.
   - **R2 (F1):** Settings → Suppliers: Name is the first column and Code the second; S13 again on
     a supplier `QA30R2 Leather Works` (code `QLW2` or the one suggested if QLW is taken).
   - **R3:** the handoff's S4, S8, S10 and S11 again on your own item `QA30R2-1` (supplier
     Meycauayan Tannery), at 390 × 844 for S8 and S10, with the ledger check after S10 and S11.
   - **R4:** axe on Settings → Suppliers and the item page with the Add rolls dialog open.
4. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. Then run
   `admin`, `batches`, `inventory` and `smoke` alone with `--workers=1` and save them as
   `e2e-files.log`, even if they passed in the full run.
5. Save the ledger check again as `ledger-after.txt` (`off_ledger` must be 0).

## Write the report

Save it as `qa/reports/2026-10-26-phase-30a-run2.md`, using `qa/templates/report.md`. The verdict
is **PASS** only if the migration is up to date, the build passes, R1 to R4 pass, the full e2e
suite and the four file runs have **no failure**, axe finds no serious or critical violation and
`off_ledger` is 0 before and after. For any FAIL: the steps, the exact message, a screenshot, app
or test, and the file and line you suspect. Don't fix it.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-26.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30A_RUN2]]` and the report.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the report
path.
