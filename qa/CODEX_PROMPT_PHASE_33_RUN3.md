# Prompt for Codex: Phase 33 Inspection queue, run 3 (paste everything below the line)

Before pasting, **Dylan** (PowerShell, laptop, `C:\dev\CPoint-PMS`): keep the Docker app stopped
(`docker compose stop app`), and restart `npm run dev` with `DEMO_LOGIN_TOOLS=true` so it serves
the latest code on `http://localhost:3000`. Run on a weekday after 01:00 Manila.

---

You are the QA tester for CPoint-PMS: Phase 33, the Inspection queue (D-129), **run 3**. Handoff:
`qa/handoffs/2026-11-19-phase-33-inspection-queue.md`. Run 2: `qa/reports/2026-11-19-phase-33-run2.md`
(13 passed, 4 failed, 1 blocked).

## What Claude changed since run 2

- **F1 (Q3):** the filter form now starts fresh whenever the filters change, so Clear empties
  Batch code, Day, Status and Priority (`src/app/(app)/batches/queue-list.tsx`).
- **F2 (Q9):** under Inspected and void, a batch inspected **today** has **Correct** (with the same
  dialog and reason as on Today), whatever day the batch belongs to. The service already allowed it;
  the button was missing (`queue-list.tsx`, `batch-queue.service.ts`, `production.model.ts`).
- **F3 (Q13):** Inspect (and Correct in the list) are 44 px tall on a phone.
- **F4 (Q14):** `batches.spec.ts`'s no-plan test opens the QI's Today tab before reading its
  message; `inspection-queue.spec.ts` also corrects the day-old batch from the list.
- `npm run check` passed (823 unit tests, build OK).

Q12 stays not applicable (no roll has an old code). Every other scenario passed in run 2 and isn't
rerun.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` and your line in the vault's
  Daily note.
- In-app browser at http://localhost:3000 for Q3, Q9 and Q13; headless Playwright for Q14.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"`, `--workers=2`. A first-compile timeout or
  `ECONNRESET`: rerun that spec alone once and report both; never change a timeout.
- Ignore the dev overlay's "Encountered a script tag…" at `src/app/layout.tsx` (since Phase 0).

## Do

1. Pre-flight (stop and report BLOCKED if it fails): port 3000's process is
   `C:\dev\CPoint-PMS\node_modules\next\...`, and `/batches` as the QI shows Queue and Today.
2. Back up the database to `storage\backups\before-phase-33-run3.dump`, then
   `npm run demo:reset '--' --yes`.
3. **Q3:** search a code, then Clear: every filter field is empty and the full list is back; then
   pick a Day and Filter: only that day's batches (the old code isn't sent).
4. **Q9:** inspect an earlier-day batch today (the demo's Urgent one, or yesterday's). Under
   Inspected and void, **Correct** shows on it; correct the pairs with a reason, and the row shows
   the new count. With the demo clock on the next day 09:00, the same row has no Correct, and
   `PATCH /api/v1/production/check-ins/{id}` returns 409 "A batch can only be corrected on the day
   it was inspected. This one was inspected on …". Put the clock back.
5. **Q13:** at 390 × 844, measure Start inspection, Inspect and (in the list) Correct: each at
   least 44 px tall; the Finish sheet sits at the bottom; no sideways scroll.
6. **Q14:** `npx playwright test tests/e2e/inspection-queue.spec.ts tests/e2e/batches.spec.ts --workers=2`,
   then the full suite `npx playwright test --workers=2`. Report the counts.
7. `npm run demo:reset '--' --yes` once more after the e2e; record that it finishes.
8. Write `qa/reports/2026-11-19-phase-33-run3.md` (or today's date) from `qa/templates/report.md`:
   PASS, PASS WITH ISSUES or FAIL; Q3, Q9, Q13, Q14 with evidence; and say which run passed each
   of the other scenarios (run 2 for Q1, Q2, Q4 to Q8, Q10, Q11, A1 to A4).
9. Add one line under "Agent sessions" in today's vault `Daily/` note linking this prompt, the
   handoff and the report as `[[CPoint-PMS/qa/…]]`.
