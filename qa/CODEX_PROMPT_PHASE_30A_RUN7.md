# Prompt for Codex: Phase 30A QA, run 7 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS` on `feature/phase-30a-rolls-from-inventory`, with Docker
Desktop running, **after 01:00 Manila time**. No reset is needed. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 6 of Phase 30A (`qa/reports/2026-10-27-phase-30a-run6.md`)
passed the full suite (88 passed) but `batches.spec.ts` alone failed at line 278: after the
refused 3 finished / 4 failed, `fill("12")` left Pairs finished at 3. Phase 27 run 5 saw the same
("3 pairs" saved).

**Cause (Claude):** after a refused save the form moves focus to the first invalid field one
animation frame later (`src/lib/focus-first-invalid.ts`). When the test typed in that frame, focus
jumped to "Of these, failed inspection" mid-fill, so "12" went there and was then replaced by "2".
**Fix:** the form now moves focus only if it is still where it was when the errors were set (the
button, or nothing), so it never takes focus from a field someone is already typing in; three unit
tests cover it. The e2e test also waits for that focus before typing. `npm run check` passed (607).

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them. Never run `demo:reset` or
  `docker compose down -v`. Browser checks stay headless.

## Steps

1. Check the Manila time; run only after 01:00 Manila.
2. Save each output as UTF-8 text in `qa/reports/artifacts/2026-10-27-phase-30a-run7/`:
   `npm run db:up`, `npx prisma migrate status` (up to date), `npm run build`, and the ledger query
   from `ledger-query.sql` in run 6's artifacts as `ledger.txt` (pipe it through stdin, as in run 6).
3. With no server of your own and `E2E_BASE_URL` unset, run `npm run test:e2e` once
   (`e2e.log`). Then run `batches` alone with `--workers=1` **three times** (`e2e-batches-1.log`
   to `-3.log`).
4. **F1 by hand** (`npm run start`, `PORT=3001`, 390 × 844, the QI, only if a batch can be
   finished now; otherwise NOT NEEDED): open Finish batch, enter 3 and 4, press Finish batch and
   check focus moves to "Of these, failed inspection". Then click Pairs finished at once and type
   12: it stays 12. Close the sheet without saving. Stop the server.
5. Save the ledger check again as `ledger-after.txt`.

## Write the report

Save it as `qa/reports/2026-10-27-phase-30a-run7.md`, using `qa/templates/report.md`, with the
Manila time each run started. The verdict is **PASS** only if the migration is up to date, the
build passes, the full suite and all three `batches` runs have **no failure**, F1 passed or was
not needed, and `off_ledger` is 0 before and after. For any FAIL: the exact message, app or test,
and the file and line. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today, linking
`[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30A_RUN7]]` and the report.

Finish by replying with the verdict, the e2e counts and the report path.
