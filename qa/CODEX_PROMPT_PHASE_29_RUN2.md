# Prompt for Codex: Phase 29 QA, run 2 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running (the `db` container only).
Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 of Phase 29
(`qa/reports/2026-10-25-phase-29-stock-updates.md`) failed. Claude fixed:

- **F1 to F3:** a non-leather item (Other, Nails, Thread) couldn't be added: "Choose the supplier
  of this leather roll." The form sends its parsed values, where a non-leather item's supplier is
  `null`, and the server's second check refused `null`. It now accepts `null` for every category
  but Leather roll (`src/server/validators/inventory.validator.ts`).
- **F4:** per 100 pairs showed "—" and days left was far too short, because a demo item's pace
  started at the day the item row was created (today, when the app started) instead of its first
  stock entry. The pace now starts at the item's first ledger entry, or 28 days ago if that is
  later (`src/server/models/materials.model.ts`, `materials.service.ts`). The card's text says so.
- The build and migration failures in run 1 came from before Dylan's setup (no `db:deploy`, no
  `db:generate`, a stale `.next/dev/types`). His `npm run check` passed afterwards.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Never run `demo:reset` or `docker compose down -v` on the `cpoint-pms` project. Leave anything
  on port 3000 that isn't CPoint-PMS alone (`PORT=3001`).
- Change stock only on items you create (codes starting `QA29R2-`). Leave the reminder days on
  Wednesday and Friday.
- Browser checks stay headless (no visible Chrome windows).

## Steps

1. Read `qa/README.md`, `qa/templates/report.md`, the run 1 report and the handoff
   `qa/handoffs/2026-10-25-phase-29-stock-updates.md` (S13 has the corrected calculation).
2. Set up and save each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-25-phase-29-run2/`. Stop and report if any step fails:

   ```powershell
   npm run db:up
   npx prisma migrate status        # must say "Database schema is up to date!"
   npm run db:generate
   npm run build
   ```

3. Start the app with `npm run start` (`PORT=3001`) and run, in this order:
   - **R1 (F1, F2):** Add item with Category Other (`QA29R2-A`, box, reorder 0, opening 10), then
     Nails (`QA29R2-N`, box, reorder 0). Both save and open their item page; neither shows a
     Supplier. Leather roll with no supplier still shows "Choose the supplier of this leather
     roll." under Supplier.
   - **R2 (F3, and the blocked S6 to S8):** Add `QA29R2-B` (Thread, spool, reorder 4, opening 5),
     then the handoff's S5 to S8 on it.
   - **R3 (the blocked S11):** the handoff's S11 on `QA29R2-A`.
   - **R4 (S12):** Reports → Materials shows `QA29R2-B` with 6 spools this week (the correction
     is not use).
   - **R5 (F4, S13):** per 100 pairs is a number for every demo item that has Used entries, and
     matches the handoff's S13 calculation for LR-001 (write your sums in the report). No demo
     item shows "May run out" unless its days left is fewer than the days to Wednesday.
4. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. If a test fails,
   re-run that file alone with `--workers=1` and save it as `e2e-rerun.log`.
5. Save the ledger check from run 1's prompt (step 2 of `qa/CODEX_PROMPT_PHASE_29.md`) as
   `ledger-after.txt` (`off_ledger` must be 0).

## Write the report

Save it as `qa/reports/2026-10-25-phase-29-run2.md`, using `qa/templates/report.md`. The verdict
is **PASS** only if the migration is up to date, the build passes, R1 to R5 pass, the e2e suite has
no failure (one that passes in `e2e-rerun.log` counts as a test-isolation note) and `off_ledger` is 0. For any FAIL: the steps, the exact message, a screenshot, app or test, and the file and line you
suspect. Don't fix it.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-25.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_29_RUN2]]` and the report.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the report
path.
