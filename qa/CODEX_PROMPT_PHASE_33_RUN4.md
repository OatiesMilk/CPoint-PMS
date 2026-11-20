# Prompt for Codex: Phase 33 Inspection queue, run 4 (paste everything below the line)

Before pasting, **Dylan** (PowerShell, laptop, `C:\dev\CPoint-PMS`): keep the Docker app stopped,
and restart `npm run dev` with `DEMO_LOGIN_TOOLS=true` so it serves the latest code on
`http://localhost:3000`. Run on a weekday after 01:00 Manila.

---

You are the QA tester for CPoint-PMS: Phase 33, the Inspection queue (D-129), **run 4**. Handoff:
`qa/handoffs/2026-11-19-phase-33-inspection-queue.md`. Run 3: `qa/reports/2026-11-19-phase-33-run3.md`
(Q3, Q9, Q13 passed; Q14 failed).

## What Claude changed since run 3

- **F1 (Clear, then a Day at once):** Clear now empties every filter field the moment it is
  clicked, before the page reloads, so a Day picked straight after it is sent alone
  (`ClearQueueFilters` in `src/app/(app)/batches/queue-actions.tsx`).
  `inspection-queue.spec.ts` also checks that the Batch code field is empty right after Clear.
- **F2 (the tab title's "(n)"):** the due count was lost when going from Queue to Today, because
  Next.js puts a new `<title>` in on that navigation and the count watched only the first one. It
  now watches the whole page head (`src/components/features/batches/batch-notices.tsx`).
- **F3 (Inventory `ECONNRESET`):** no change; it passed when rerun alone in run 3.
- `npm run check` passed (823 unit tests, build OK).

Every other scenario passed in run 2 or run 3 and isn't rerun.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` and your line in the vault's
  Daily note.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"`, `--workers=2`. A first-compile timeout or
  `ECONNRESET`: rerun that spec alone once and report both; never change a timeout.
- Ignore the dev overlay's "Encountered a script tag…" at `src/app/layout.tsx` (since Phase 0).

## Do

1. Pre-flight (stop and report BLOCKED if it fails): port 3000's process is
   `C:\dev\CPoint-PMS\node_modules\next\...`, and `/batches` as the QI shows Queue and Today.
2. Back up the database to `storage\backups\before-phase-33-run4.dump`, then
   `npm run demo:reset '--' --yes`.
3. **R1 (in-app browser, QI):** in the Queue, search a code and Filter; click Clear and **at once**
   pick a Day and Filter. Expected: the Batch code field is empty straight after Clear, and only
   that day's batches show (no `q=` value in the address).
4. **R2 (in-app browser, QI), when a batch is due:** open Batches (Queue), then click Today. The
   tab title still starts with "(n)" while the due banner shows; back on Queue, still "(n)".
5. **Q14:** `npx playwright test tests/e2e/inspection-queue.spec.ts tests/e2e/batches.spec.ts --workers=2`,
   then the full suite `npx playwright test --workers=2`. Report the counts.
6. `npm run demo:reset '--' --yes` once more after the e2e; record that it finishes.
7. Write `qa/reports/2026-11-20-phase-33-run4.md` from `qa/templates/report.md`: PASS, PASS WITH
   ISSUES or FAIL; R1, R2 and Q14 with evidence; and which run passed each other scenario (run 2:
   Q1, Q2, Q4 to Q8, Q10, Q11, A1 to A4; run 3: Q3, Q9, Q13; Q12 not applicable).
8. Add one line under "Agent sessions" in today's vault `Daily/` note linking this prompt, the
   handoff and the report as `[[CPoint-PMS/qa/…]]`.
