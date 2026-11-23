# Prompt for Codex: Phase 38, run 3 (paste everything below the line)

Run on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only. Headless only.

---

You are the QA tester for CPoint-PMS: Phase 38 run 3. Test and report only (D-092); write only under `qa/reports/`
and your line in the vault's Daily note.

Run 2 (`qa/reports/2026-11-23-phase-38-run2.md`) left one real failure, now fixed by Claude: `final-defects.spec.ts`
asserted the "Loose stitching" origin cell with `.nth(2)`, written when the table had a Preparation column. Phase 38
removed that column, so Construction is cell 1; the test now checks cell 1 and that no Preparation heading exists.
The Corrections and Reports sign-in timeouts (run 2 F1, F2) passed alone twice and are treated as full-suite load, not
Phase 38.

## Do

1. Read run 2's report and the vault's newest `Daily/` note. Make sure the demo clock is real time (the app's Today
   equals the laptop's Manila date; restart `npm run dev` after any change, it caches the offset). `npm run db:up`,
   `npm run db:deploy`, `npm run dev`, `npm run demo:reset '--' --yes`.
2. Run `tests/e2e/final-defects.spec.ts` alone and report every test (7 expected; run 2 blocked 3 of them).
3. Run `tests/e2e/stage-wip.spec.ts`, `final-defects.spec.ts`, `corrections.spec.ts`, `reports.spec.ts` and
   `batches.spec.ts` together once more with `E2E_BASE_URL` set. Rerun any failing spec alone once and report both
   results. Don't change a timeout. If Corrections or Reports time out at sign-in again but pass alone, say so and
   how many workers ran.
4. For any failure that repeats alone, quote the assertion and attach a headless screenshot under
   `qa/reports/artifacts/<today>-phase-38-run3/`.
5. Write `qa/reports/<today>-phase-38-run3.md` (verdict, spec table with passed, failed, not run, failures). Stop the dev
   server, end with `npm run demo:reset '--' --yes`, and add your line under "Agent sessions" in today's Daily note.
