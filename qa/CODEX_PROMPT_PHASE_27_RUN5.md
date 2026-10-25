# Prompt for Codex: Phase 27 QA, run 5 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running, on the checkout with
Claude's run 4 fix. No database reset is needed. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 4 of Phase 27 (batches) is
`qa/reports/2026-10-24-phase-27-run4.md`: FAIL, e2e 72 passed, 1 failed, 1 skipped, 3 did not
run. The Rolls fix passed. One test still fails: the QI phone test in `batches.spec.ts`, where 2
toasts were still on the page after 15 s, before the axe check.

What Claude changed (tests only, the app is unchanged):

- Run 3's fix (move the pointer off the toasts) **never reached the laptop**: run 4 ran the old
  file. This run has a new fix instead.
- The axe helper in `batches.spec.ts` no longer waits for every toast to leave. It leaves the toast
  area (`[data-sonner-toaster]`) out of the scan, because a fading toast reads as low contrast.
  The tests still check each toast's text where it appears.

## Rules

- **Test and report only (D-092).** Create files only under `qa/reports/`, plus your line in the
  vault's Daily note. Don't change code, tests, config, migrations, `package.json` or `.env`.
- Never print passwords or tokens. Never `demo:reset` the dev database. Leave port 3000 alone.
- Put back what the e2e suite leaves behind, as in run 2 (attendance, future schedules and
  quotas, test suppliers); save the run 4 baseline queries before and after.

## Steps

1. Read `qa/README.md` and the run 4 report.
2. `npm run db:up`, `npx prisma migrate status` (must be up to date), `npm run build`. Save
   outputs in `qa/reports/artifacts/2026-10-24-phase-27-run5/`.
3. **R1:** the spec alone (after 01:00 Manila). No failure.

   ```bash
   npm run test:e2e -- tests/e2e/batches.spec.ts --workers=1
   ```

4. **R2:** the full suite once, `npm run test:e2e`. No failure; a failure that passes alone with
   `--workers=1` is a test-isolation note.
5. **R3 (do the toasts leave in the app?):** as the QI in a 390 × 844 browser with the test
   schedule from the handoff, finish a due batch and then correct it, as in the e2e test. After
   each save, move the pointer to the top-left corner, then time how long the toast stays (it
   should leave in about 4 s). Repeat once with touch emulation (`hasTouch: true`, taps). Report
   the times and whether any toast stays more than 10 s, with a screenshot. If one stays, say
   what was under the pointer and which toasts were showing.
6. Clean up and rerun the baseline queries.

## Write the report

Save `qa/reports/2026-10-24-phase-27-run5.md` from `qa/templates/report.md`: R1 to R3 with
PASS, FAIL or BLOCKED, the e2e counts, and each failure's test title, error and line. **PASS**
only if R1 to R3 pass. Add one line under "Agent sessions" in the vault's `Daily/2026-10-25.md`
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_27_RUN5]]` and the report. Reply with the verdict,
the e2e counts and the report path.
