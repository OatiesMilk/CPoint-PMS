# Prompt for Codex: Phase 30F-2, run 3 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main da3d792), Docker Desktop
running for the database only, Dylan's `npm run dev` on http://localhost:3000. Then copy from the
line down.

---

You are the QA tester for CPoint-PMS, Phase 30F-2 (the desktop pages), run 3. Run 2
(`qa/reports/2026-11-07-phase-30f-2-run2.md`) passed R1, R2, R5, A1 and all 32 screenshot pairs,
and failed two checks:

- **F1 (fixed):** Reports → Rolls was 999 px in a 958 px region at 1280, and Returned to supplier
  took three lines. Now: the item and tag lines under the code truncate at 96 px (full text in
  their `title`), Supplier and Scanned no longer force a minimum width, Defect %'s "Not measured"
  may wrap, and the Status badge is 120 to 144 px wide so it takes at most two lines.
- **F2 (not a fault):** the download is named `cpoint-rolls-<date>.csv`, as it has been since
  D-121 (`roll.controller.ts`); the run 2 prompt named it wrongly. It passes when the filtered file
  holds only the filtered rolls.

`npm run check` passed (708 unit tests, build OK). Claude ran no browser or e2e test.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Run against Dylan's `npm run dev` URL with
  `$env:E2E_BASE_URL="http://localhost:3000"`; Playwright's Chromium stays headless.

## Steps

Artifacts in `qa/reports/artifacts/2026-11-07-phase-30f-2-run3/`.

1. **R1 (F1):** with your run 2 measuring script, Reports → Rolls at 1280 × 800 and 1440 × 900,
   light and dark: table `scrollWidth` equals the region's `clientWidth`, the View column fully
   visible, every Status badge on at most two lines. Hover a truncated item line and a tag line:
   each `title` holds the full text. Screenshot 1280 light and dark.
2. **R2:** re-measure Operations (Production by day), Batches (Recent days) and the leather item's
   Rolls table at 1280 to confirm they still fit (nothing there changed).
3. **R3 (F2):** Status Returned to supplier, Download CSV: every row in the file is Returned to
   supplier.
4. **A1:** axe on Reports → Rolls, light and dark: 0 serious or critical.
5. **E2E:** `npx playwright test tests/e2e/rolls.spec.ts tests/e2e/returns.spec.ts tests/e2e/smoke.spec.ts tests/e2e/supplier-quality.spec.ts --workers=1`.

## Write the report

Save `qa/reports/2026-11-07-phase-30f-2-run3.md` (the actual date if it's another day) from
`qa/templates/report.md`. **PASS** if R1 to R3, A1 and the e2e run pass. The six Finish batch
screenshots stay a weekday-only item and don't block a pass. Add one line under "Agent sessions"
in today's Daily note linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30F_2_RUN3]]` and the report.
Reply with the verdict, the R1 widths, the e2e counts and the report path.
