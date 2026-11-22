# Prompt for Codex: Phase 35B, corrections to past records, run 5 (paste everything below the line)

Run on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only. Run 4 ended with a demo
reset, so none is needed at the start; reset at the end only if you create data.

---

You are the QA tester for CPoint-PMS: Phase 35B (D-133), run 5. Run 4: `qa/reports/2026-11-22-phase-35b-run4.md`.
Same rules as before (`qa/CODEX_PROMPT_PHASE_35B.md`): test and report only (D-092); change nothing outside
`qa/reports/` and your line in the vault's Daily note.

## What changed since run 4

- **F2 (the finished toast stayed up):** a cause was found. Sonner pauses a toast's timer while the pointer is over it,
  and in `inspection-queue.spec.ts` the pointer is still where **Finish** was, which on the phone layout is under the
  toast, so the toast never went and also blocked the next tap (it did the same in run 2). The spec now moves the
  pointer away before it waits for the toast to go. No app change, no timeout change.
- **F1 (repeat run):** my run 4 prompt asked for `--repeat-each=2` at two workers. Two repetitions of this spec run at
  the same time on the same fixture days and codes (its own Saturday and Sunday batches), so one saw the stale guard
  correctly refusing the other's edit. That was a fault in the prompt, not the spec or the app. Do **not** repeat it
  concurrently this time (below).
- **F3 (`reports.spec.ts` sign-in redirects in the full run):** the dev-server load stall of Phases 32, 33 and run 3
  (a different spec each run: Admin `ECONNRESET`, reports sign-in), each passing alone. No change.

## Verdict rule for this run

`AGENTS.md` already says a first-compile time-out or `ECONNRESET`, and a sign-in that stalls under load, is rerun alone
once and both results reported. Apply it as the verdict rule: a failure in a broad run that **passes when its spec is
rerun alone, with the cause a sign-in stall, `ECONNRESET` or first compile**, is an observation (PASS WITH ISSUES), not a
FAIL. Anything that fails again alone, or fails an assertion about the app's behaviour, is a FAIL.

## Do

1. Read the vault first. Fresh `npm run dev` (stop the old one); check `/api/health`.
2. `inspection-queue.spec.ts` alone with `--workers=1`, **three times in a row** (separate commands, not
   `--repeat-each`); report all three.
3. `corrections.spec.ts` alone, the six related specs, then the full suite, with `--workers=2` and the quoted `'--'`.
   Report each count. Rerun a broad-run failure alone once and report both results; never force a click or change a
   timeout.
4. Write `qa/reports/<today>-phase-35b-run5.md` from `qa/templates/report.md` (C12 only; "C1 to C11, the print check and
   A1 to A3 passed in runs 1 to 3, unchanged"). Reset the demo at the end if you changed data, and say so. Add one line
   under "Agent sessions" in today's vault `Daily/` note linking this prompt and the report.
