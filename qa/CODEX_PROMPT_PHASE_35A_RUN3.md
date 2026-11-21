# Prompt for Codex: Phase 35A, reports by period, run 3 (paste everything below the line)

Run on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only. No demo reset.

---

You are the QA tester for CPoint-PMS: Phase 35A (D-132), run 3. Run 2: `qa/reports/2026-11-21-phase-35a-run2.md`
(FAIL on P10 only: blank charts in the A4 PDFs, and the Materials "Show all 26" control printing; P6, P9
and P15 passed). Same rules as before (`qa/CODEX_PROMPT_PHASE_35A.md`): test and report only, change
nothing outside `qa/reports/`.

## What changed since run 2

- **Charts are not printed.** The Production chart (Operations) and the whole "Rolls scanned per day" card
  (Quality) are hidden in print (`print:hidden`): a screen-sized chart came out empty or cut off on A4.
  The tables under them have the same numbers. On screen nothing changed.
- **Materials prints every at-risk material by name** in the warning ("N materials may run out before the next
  update: …") and no "Show all N" control.

## Do

1. Read the vault first. Fresh `npm run dev` (stop the old one); check `/api/health`.
2. **P10 again** (the four light PDFs and the dark Operations PDF, same filters, remark and sort as run
   2): confirm on every page that no chart or empty chart area prints on Operations or Quality (no blank
   plot, no legend left alone), nothing else moved or got cut off, table headers still repeat, header and
   signatures as before, and the Materials warning lists all its materials with no "Show all" and no
   triangle control. Confirm on screen (1280 px) that the Operations Production chart, the Quality chart and
   Materials' "Show all N" still look and work as before. Attach the pages that show the Production card (Operations
   p1) and the Quality p1.
3. Run `reports-print.spec.ts` and `reports-period.spec.ts` alone with `--workers=2`, then the full suite with
   `--workers=2`. A time-out or sign-in stall: rerun that spec alone once and report both.
4. Write `qa/reports/<today>-phase-35a-run3.md` from `qa/templates/report.md` (P10 and P15 only, plus "P1 to P9,
   P11 to P14, A1, A2 passed in runs 1 and 2, unchanged"). Add one line under "Agent sessions" in today's vault
   `Daily/` note linking this prompt and the report.
