# Prompt for Codex: Phase 30A QA, run 5 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS` on the branch `feature/phase-30a-rolls-from-inventory`,
with Docker Desktop running. No reset is needed. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 4 of Phase 30A passed (`qa/reports/2026-10-26-phase-30a-run4.md`).
Dylan then asked for two UI changes, which Claude made (`npm run check` passed, 604 unit tests):

- **U1, Attendance:** the "Day" label stood alone above the date box, between Previous day and
  Next day, and looked misplaced. It now sits above the whole day picker, and Previous day, the
  date, Next day (and Back to today) form one row (`src/app/(app)/attendance/attendance-roster.tsx`).
- **U2, View on rows:** a table whose rows open a page of their own now ends with a **View** link
  (eye icon + "View"; screen readers hear "View roll LR-MLT-008"). The first cell's link stays.
  Tables: Reports → Rolls; Inventory; an item's Rolls table (View beside Remove); Reports →
  Materials (Used per material); a roll's Shots table (View opens the shot); Reports → Operations
  → Rolls with the most rejects (View beside Claim sheet). Shared parts in
  `src/components/ui/table.tsx` (`TableActionsHead`, `TableViewLink`); rule in `DESIGN.md`.
  Tests changed: `rolls.spec.ts` (the code link is matched exactly, View checked) and
  `inventory.spec.ts` (a low-stock row has two links: its name and View).

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Never run `demo:reset` or `docker compose down -v` on the `cpoint-pms` project. Leave anything
  on port 3000 that isn't CPoint-PMS alone.
- Don't change data you didn't create, except opening pages. Browser checks stay headless.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and the run 4 report.
2. Save each output as UTF-8 text in `qa/reports/artifacts/2026-10-26-phase-30a-run5/`:
   `npm run db:up`, `npx prisma migrate status` (up to date), `npm run build`, and run 1's ledger
   query (step 2 of `qa/CODEX_PROMPT_PHASE_30A.md`) as `ledger.txt`.
3. Start the app with `npm run start` on `PORT=3001` for the browser checks, as the Floor Manager:
   - **U1:** Attendance at 1440 × 900 and 1280 × 800: "Day" is above the row, the three controls
     share one baseline, nothing overlaps. Go to a past day: Back to today joins the same row.
     Narrow the window to 900 px: the row wraps without overlap. Screenshot each.
   - **U2:** each table above at 1440 × 900 and 1280 × 800: the last column shows View with an eye
     on every row, right-aligned; View opens the same page as the first cell's link; Tab reaches
     it with a visible focus ring; no sideways page scroll (a table may scroll inside its card at
     1280; say which do). On the item's Rolls table, View and Remove sit side by side. Screenshot
     each table at 1280.
   - **A1:** axe (WCAG 2.1 A/AA) on Attendance, Reports → Rolls, Inventory, an item page with
     rolls, Reports → Materials, a roll page with shots and Reports → Operations.
   - Stop that server before step 4.
4. Run the full e2e suite with Playwright's own server (`Remove-Item Env:E2E_BASE_URL
-ErrorAction SilentlyContinue`, then `npm run test:e2e`) and save it as `e2e.log`. Then run
   `rolls` and `inventory` alone with `--workers=1` and save them as `e2e-files.log`.
5. Save the ledger check again as `ledger-after.txt` (`off_ledger` must be 0).

## Write the report

Save it as `qa/reports/2026-10-26-phase-30a-run5.md`, using `qa/templates/report.md`. The verdict
is **PASS** only if the migration is up to date, the build passes, U1, U2 and A1 pass (axe: no
serious or critical violation), the full e2e suite and both file runs have **no failure**, and
`off_ledger` is 0 before and after. For any FAIL: the steps, the exact message, a screenshot, app
or test, and the file and line you suspect. Don't fix it.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-26.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30A_RUN5]]` and the report.

Finish by replying with the verdict, the e2e counts and the report path.
