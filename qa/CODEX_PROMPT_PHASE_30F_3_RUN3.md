# Prompt for Codex: Phase 30F-3, run 3 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted Phase 30F-3), Docker Desktop
running for the database only, Dylan's `npm run dev` on http://localhost:3000. R1 runs any day;
R2 and R3 need **a weekday (Monday to Friday) after 01:00 Manila with today planned** (Batches →
Plan days as the FM). Then copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 30F-3, run 3. Run 2
(`qa/reports/2026-11-07-phase-30f-3-run2.md`) failed only R1 by a few pixels; R2, the Capture
screenshots, axe and e2e passed. The Batches checks were blocked (Saturday). Handoff:
`qa/handoffs/2026-11-07-phase-30f-3.md`.

What Claude changed since run 2:

- **F1 (R1):** below 640 px the gap between the Roll card, the picture and the parts under it is
  12 px (was 16), and the Roll card's inner gaps and the line above Finish roll are 10 px (were
  12). About 8 to 10 px higher on a phone; nothing changes from 640 px up.
- `npm run check` passed (708 unit tests, build OK). Claude ran no browser or e2e test.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Change only the data the steps need, and say what you changed (finish or put
  back the rolls you start). Don't change any Windows setting.
- Run against Dylan's `npm run dev` URL with `$env:E2E_BASE_URL="http://localhost:3000"`; manual
  checks in your in-app browser; measurements with a headless Playwright script of your own (fake
  camera with `tests/e2e/fixtures/marker-card.y4m`, as in run 2). Measure at `scrollY = 0`.
- If an API route that 30F-3 didn't touch answers 404, stop and ask Dylan to clear the dev cache
  (stop `npm run dev`, `Remove-Item -Recurse -Force .next\dev`, start it again), then rerun.

## Steps

Artifacts in `qa/reports/artifacts/<date>-phase-30f-3-run3/`.

1. **R1 (F1):** run 2's R1 again, the same way: Capture at 390 × 844, light and dark, Demo mode
   band on, a roll chosen, with 0 shots and after the first shot. Report the picture's top and
   bottom, the Capture bar's top and the px of picture above it. Expected: at least 150 px with 0
   shots, and the picture's bottom at or above the bar's top after the first shot;
   `scrollWidth` = 390; the Capture button ≥ 44 px. Also a 1440 screenshot: unchanged from run 2.
2. **R2 (S6), weekday only:** as the QI at 390 × 844 and 1440 × 900, light and dark: the notice
   banner (if a batch is due or about to end), the batch cards (badge beside "Batch N"; the batch
   that can be finished now has a ring-coloured border), the fixed bottom bar (card surface,
   shadow, button ≥ 44 px, above the safe area, no sideways scroll) and the Finish batch sheet
   (open, then **Not now**; don't finish a batch). Screenshots, compared with
   `qa/reports/artifacts/2026-11-06-phase-30f-baseline/`.
3. **R3 (S7), weekday only:** as the FM at 1280 and 1440: the line under "Today, …" reads "Plan:
   … pairs, 08:00 to 17:00, every 4 hours. Lunch: …" with the interval **once**.
4. If it isn't a weekday with a plan, mark R2 and R3 blocked and stop after R1 and step 5.
5. **E2E:** `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts
tests/e2e/batches.spec.ts --workers=1`. On a weekday also the full suite `npm.cmd run test:e2e`;
   for each failing spec, rerun it alone once with `--workers=1` and report both results.

## Write the report

Save `qa/reports/<date>-phase-30f-3-run3.md` from `qa/templates/report.md`. **PASS** if R1 to R3
pass and every e2e failure passes when rerun alone; **PASS (R1 only)** if R1 and the targeted e2e
pass and R2 and R3 are blocked by the day. Add one line under "Agent sessions" in today's Daily
note (`C:\dev\capstone-obsidian\Daily\`) linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30F_3_RUN3]]`
and the report. Reply with the verdict, the R1 measurements, the e2e counts and the report path.
