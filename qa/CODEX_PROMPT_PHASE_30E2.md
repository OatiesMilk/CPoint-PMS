# Prompt for Codex: Phase 30E-2, the planning calendar (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at a94fbe0), Docker
Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. In Phase 30E-2 the Floor Manager plans each working day on a
month calendar (rolls to be used, quota, check-in interval, shift) or marks it Non-working /
Holiday; a weekday with no plan has no batches and the FM gets a Plan today notice. The handoff is
`qa/handoffs/2026-11-04-phase-30e2-planning-calendar.md`. Read it first: S1 to S13, A1 to A4.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/` (and the backup in step 2).
- Don't run `demo:reset`: this is Dylan's own data. Put back any plan you delete or change for a
  check (note its values first), and undo any Non-working mark you add.
- Do the browser scenarios in **your in-app browser** so Dylan can watch them live, at the
  `npm run dev` URL (http://localhost:3000, or the port it printed). Playwright's own Chromium stays
  headless; don't open visible Chrome windows.

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-04-phase-30e2/`.
2. Keep only the database container up (`npm run db:up`); don't start the Docker app. Before
   migrating, open Batches as the FM and take a screenshot of today's batches (for S1). Back up:
   `docker exec cpoint-pms-db-1 pg_dump -U cpoint -d cpoint_pms -Fc -f /tmp/before-30e2.dump`,
   `docker cp cpoint-pms-db-1:/tmp/before-30e2.dump storage/backups/before-phase30e2-2026-11-04.dump`.
   Then stop `npm run dev` if it runs, `npm run db:deploy` (expect `20261104120000_day_plans`
   applied, or "No pending migrations" if Dylan already ran it), `npm run db:generate`, and start
   `npm run dev` again; note its URL.
3. Walk S1 to S13 and A1 to A4 in your in-app browser (axe with every rule and impact). If a
   scenario can't be done (for example no batch finished today for S10), mark it NOT POSSIBLE and
   say why.
4. In PowerShell set `$env:E2E_BASE_URL="http://localhost:3000"` (the dev port), then run
   `npx playwright test tests/e2e/batches.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts`,
   then the full suite `npm run test:e2e`. Check afterwards that today's plan in `day_plans` is
   what it was before the tests. The dev server compiles each page on first visit and closes idle
   connections after 5 s: if a test fails on a first-compile timeout or `ECONNRESET`, rerun that
   spec alone once and report both results.
5. Check the ledger at the end: every item's on-hand equals the sum of its movements
   (`select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`
   should be 0).

## Write the report

Save it as `qa/reports/2026-11-04-phase-30e2-run1.md` (or the date you run it), using
`qa/templates/report.md`. **PASS** only if every scenario passed (NOT POSSIBLE with a reason is
fine), e2e has 0 failures (skips with a reason are fine) and the ledger is 0. For any FAIL: steps,
what you saw against what was expected, a screenshot, file and line if you can tell. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today
(`C:\dev\capstone-obsidian\Daily\`), linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30E2]]` and the
report.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
