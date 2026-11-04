# Prompt for Codex: Phase 30E-1, run 3 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at 9bfd10e), Docker
Desktop running for the database only, `npm run dev` running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 2 (`qa/reports/2026-11-04-phase-30e-run2.md`) passed
every manual scenario it could run (S5 and S6 NOT POSSIBLE with reasons) and the five targeted
specs (one Inventory sign-in timeout that passed alone). The full suite had 7 failures, all 30 s
timeouts or aborted navigations under the parallel run against `next dev`; Claude found no app
fault behind them (the roll page heading stayed "Reports" while the roll page was still compiling;
the others are sign-in, axe and page-load waits). S5 was not possible because today's saved
schedule leaves Wednesday out (set on 3 Nov); that is data, not a fault.

This run only reruns the failing specs alone. **Don't run `demo:reset`**, and change no code,
tests, migrations, config or `.env`.

1. Back up the database to `storage/backups/before-30e-qa-run3.dump` as before.
2. In PowerShell set `$env:E2E_BASE_URL="http://localhost:3000"` (the dev port). Run each of these
   alone, one after another, with `--workers=1`, and note each result:
   `tests/e2e/capture.spec.ts`, `tests/e2e/reports.spec.ts`, `tests/e2e/returns.spec.ts`,
   `tests/e2e/rolls.spec.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/inventory.spec.ts`.
   If one fails, rerun that spec alone once more and report both results.
3. Then the full suite once more (`npm run test:e2e`) and report its counts as information.
4. Put back any schedule, lunch or quota rows the tests add, as in run 2. Check the ledger
   (0 mismatches).
5. **PASS** if every spec in step 2 passes alone (on its first or second try) and the ledger is 0.
   Save the report as `qa/reports/2026-11-04-phase-30e-run3.md`, add your line to today's vault
   Daily note linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30E_RUN3]]` and the report, and reply
   with the verdict, the counts and the report path.
