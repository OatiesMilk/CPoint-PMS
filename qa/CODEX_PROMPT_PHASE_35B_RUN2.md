# Prompt for Codex: Phase 35B, corrections to past records, run 2 (paste everything below the line)

Run on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only. No demo reset is
needed at the start (run 1 ended with one); reset at the end only if you create data.

---

You are the QA tester for CPoint-PMS: Phase 35B (D-133), run 2. Run 1: `qa/reports/2026-11-21-phase-35b-run1.md`
(FAIL: C1 to C9, A1 to A3 passed; C10 wording, C11 focus and C12 the e2e failed). Same rules as run 1
(`qa/CODEX_PROMPT_PHASE_35B.md`): test and report only (D-092); change nothing outside `qa/reports/` and your
line in the vault's Daily note. Nothing else of the working tree is yours to touch: the two CI-fix specs
(`reports-period.spec.ts`, `reports-print.spec.ts`) and `qa/CODEX_PROMPT_CI_RECHECK_feature-reports-by-period.md`
were changed by Claude before run 1 (the main CI fix, a separate prompt), not by anyone else.

## What changed since run 1

- **F2 (e2e):** `corrections.spec.ts` read two `timestamp` columns through `pg`, which parses them as the
  laptop's local time (8 hours off in Asia/Shanghai), so the stale guard answered STALE. It now reads them as
  UTC text (`to_char`). No app change for this.
- **F1 (focus):** Radix returns focus to its own Trigger, and these dialogs are opened by plain buttons, so focus fell to the page.
  `src/components/ui/dialog.tsx` now remembers what had focus when a dialog opens and gives it back on close (every
  dialog in the app, not only these two).
- **F3 (wording):** the handoff's C10 now names both messages (the plain stale one, and "This batch was already
  corrected by <name> at <time>. Refresh to see it." when the first save was itself a correction). No code change.
- **Your clipped-header observation:** Operations' Production by day table printed with its right header clipped.
  The new **Corrected** badge sat beside the date and widened the first column; it is now under the date. No other
  print change.
- F4 (the `reports.spec.ts` sign-in stall in the full run, passing alone) is dev-server load, as in Phases 32 and
  33; no change.

## Do

1. Read the vault first. Fresh `npm run dev` (stop the old one); check `/api/health`.
2. **C11 again** (light and dark): on the past-day Queue page open **Correct** on a batch, press Escape; on a roll
   page open **Edit details**, press Escape; also open and close each with **Not now** and with the X. Focus must
   return to the button that opened it each time (`document.activeElement` is that button). Then spot-check three other
   dialogs for the same: Inventory → Add rolls, Batches → Plan → a day, Reports → a roll → Remove roll….
3. **Print check:** save the Operations A4 PDF again for a range that contains a corrected day (correct one batch
   first, then use Custom for that day plus the days around it). The Production by day table must fit the page
   width with the **Corrected** badge in the first column and no header clipped; **See batches** must not print.
   Say if any other table's header is clipped (and which).
4. **C10 again** only to confirm the wording quoted in the handoff matches what you saw.
5. **C12:** `corrections.spec.ts` alone, then the related specs and the full suite with `--workers=2` (the first
   command with `'--'` quoted as in run 1). Report each count. A sign-in time-out in the full run: rerun that spec alone
   once and report both.
6. Write `qa/reports/<today>-phase-35b-run2.md` from `qa/templates/report.md` (C10, C11, C12 and the print check;
   say "C1 to C9 and A1 to A3 passed in run 1, unchanged" for the rest). Reset the demo at the end if you corrected
   anything by hand, and say so. Add one line under "Agent sessions" in today's vault `Daily/` note linking this prompt
   and the report.
