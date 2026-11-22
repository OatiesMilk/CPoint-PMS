# Prompt for Codex: Phase 35B, corrections to past records, run 3 (paste everything below the line)

Run on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only. Run 2 ended with a demo
reset, so no reset is needed at the start; reset at the end only if you create data.

---

You are the QA tester for CPoint-PMS: Phase 35B (D-133), run 3. Run 2: `qa/reports/2026-11-21-phase-35b-run2.md`
(FAIL: C10 and the print check passed; the two correction dialogs and four of five sampled dialogs restored focus;
**Remove roll** did not; two e2e timeouts in broad runs, each passing alone). Same rules as before
(`qa/CODEX_PROMPT_PHASE_35B.md`): test and report only (D-092); change nothing outside `qa/reports/` and your line in
the vault's Daily note.

## What changed since run 2

- **F1 (Remove roll focus):** the Reason box of Remove roll has `autoFocus`, so it already held focus when the dialog
  opened and the shared fix remembered the box (removed with the dialog) instead of the button. `ui/dialog.tsx` now
  remembers the last element focused **outside any dialog** (a `focusin` listener) and returns focus to it on close. This
  also covers the other dialog with an autofocused field (Admin → API tokens → New token).
- **F2 (`inspection-queue.spec.ts`, toast over the Correct button on the phone):** the test now waits for the
  "<code> finished." toast to go before tapping Correct. Assertions and timeouts are unchanged. The only app change
  that could move the button is the new Batch date form above the done list.
- **F3 (`corrections.spec.ts`, Correct click not opening the dialog under load):** a click that lands before React has
  hydrated does nothing, so the spec now clicks until the dialog is visible (`openDialog`, with `toPass`), then the same
  assertions follow.

## Do

1. Read the vault first. Fresh `npm run dev` (stop the old one); check `/api/health`.
2. **C11 again, the whole sample** (light and dark, each of Escape, the cancel button and the X; check
   `document.activeElement` is the exact opener): Queue → Correct on a past batch; a roll's Edit details; Inventory → a
   leather item → Add rolls; Batches → Plan days → a day; **Reports → a roll → Remove roll…** (cancel = Keep roll);
   **Admin → API tokens → New token** (cancel = its cancel button). Report each of the 36 checks.
3. **C12:** `corrections.spec.ts` alone, the six related specs, then the full suite, all with `--workers=2` and the quoted
   `'--'`. Report each count. A failure in a broad run: rerun that spec alone once and report both results; never force a
   click or change a timeout.
4. Write `qa/reports/<today>-phase-35b-run3.md` from `qa/templates/report.md` (C11 and C12; "C1 to C10, the print check
   and A1 to A3 passed in runs 1 and 2, unchanged" for the rest). Reset the demo at the end if you changed data, and say
   so. Add one line under "Agent sessions" in today's vault `Daily/` note linking this prompt and the report.
