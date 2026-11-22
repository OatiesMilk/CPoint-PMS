# Prompt for Codex: Phase 35B, corrections to past records, run 4 (paste everything below the line)

Run on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only. Run 3 ended with a demo
reset, so none is needed at the start; reset at the end only if you create data.

---

You are the QA tester for CPoint-PMS: Phase 35B (D-133), run 4. Run 3: `qa/reports/2026-11-22-phase-35b-run3.md`
(C11 passed 36 of 36 including Remove roll and New token; C12 failed on `inspection-queue.spec.ts`'s oldest-first
check, which assumed the last Saturday is older than the last Sunday and is wrong on a Sunday; the Admin
`ECONNRESET` and the report sign-in stall passed alone). Same rules as before (`qa/CODEX_PROMPT_PHASE_35B.md`): test
and report only (D-092); change nothing outside `qa/reports/` and your line in the vault's Daily note.

## What changed since run 3

- **F1 (`inspection-queue.spec.ts:133`, a test fault):** the oldest-first check now compares the two fixture dates
  (`saturday < sunday`) instead of assuming the Saturday is older. The app's chronological order was correct. Nothing
  else changed; the three serial cases after it run again.
- F2 (`admin.spec.ts` `ECONNRESET`) and F3 (`reports.spec.ts` sign-in stall) are dev-server load, as in Phases 32
  and 33, each passing alone; no change.

## Do

1. Read the vault first. Fresh `npm run dev` (stop the old one); check `/api/health`.
2. `inspection-queue.spec.ts` alone with `--workers=2` (the quoted `'--'` form, `E2E_BASE_URL` set), then `--repeat-each=2`
   on that spec; report all results. Today is a Sunday: say so in the report, and, if you can, also say what the spec picked
   for `saturday` and `sunday` and which order the queue showed.
3. `corrections.spec.ts` alone, the six related specs, then the full suite, all with `--workers=2`. Report each count.
   A failure in a broad run: rerun that spec alone once and report both; never force a click or change a timeout.
4. Write `qa/reports/<today>-phase-35b-run4.md` from `qa/templates/report.md` (C12 only; "C1 to C11, the print check and
   A1 to A3 passed in runs 1 to 3, unchanged" for the rest). Reset the demo at the end if you changed data, and say so.
   Add one line under "Agent sessions" in today's vault `Daily/` note linking this prompt and the report.
