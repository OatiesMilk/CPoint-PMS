# Prompt for Codex: Phase 30F-3, the phone pages and Floor view (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 3b1db85), Docker Desktop
running for the database only, Dylan's `npm run dev` on http://localhost:3000, **on a weekday
(Monday to Friday) after 01:00 Manila** with today planned, so the batches and Finish batch exist.
Then copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 30F-3. It changes how Capture, Floor view and Batches
look, with three approved copy changes (D-122). Handoff: `qa/handoffs/2026-11-07-phase-30f-3.md`.
Before screenshots: `qa/reports/artifacts/2026-11-06-phase-30f-baseline/` and
`qa/reports/artifacts/2026-11-07-phase-30f-2-run1/` (Capture after 30F-2).

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Change no data except what the e2e suite does and what the scenarios need (a
  roll started and put back, or finished); say what you changed. Don't change any Windows setting.
- Run against Dylan's `npm run dev` URL with `$env:E2E_BASE_URL="http://localhost:3000"`.
  Walk the manual checks in your in-app browser; screenshots and measurements with a headless
  Playwright script of your own saved beside the artifacts (fake camera:
  `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`).
- If an API route that 30F-3 didn't touch answers 404, stop and ask Dylan to clear the dev cache
  (stop `npm run dev`, `Remove-Item -Recurse -Force .next\dev`, start it again), then rerun.

## Steps

Artifacts in `qa/reports/artifacts/2026-11-07-phase-30f-3-run1/` (use the actual date).

1. Check the Manila time is after 01:00 on a weekday and today has a plan (Batches as the FM). If
   not, run steps 2 to 4 and 7, and mark S6 and the Batches screenshots blocked.
2. **S1 to S4 (Capture):** as a constructor with camera access, at 390 × 844 and 1440 × 900,
   light and dark. Measure the live picture's top against `844 − the Capture bar's height`, the
   page's `scrollWidth` against 390, and the Capture button's height. Count the occurrences of
   "Choose the roll this shot belongs to." with no roll chosen. Write the order of the parts at 1440. Take a shot, then Finish roll (or Put roll back on an empty roll).
3. **S5 (Floor view):** at 1440 and 1920, light and dark, before and after a shot.
4. **S7 (Batches, FM):** at 1280 and 1440: the plan line's words; no sideways scroll.
5. **S6 (Batches, QI):** at 390 × 844 and 1440: the banner, the cards, the bottom bar, the Finish
   batch sheet (open it, then Not now; don't finish a batch unless the e2e suite does).
6. **S8:** compare each screenshot with its baseline: list every difference beyond spacing, tone,
   shadow, the order in handoff §1 and the three copy changes.
7. **A1:** axe (WCAG 2.1 A/AA, serious or critical) on Capture and Batches at 390 and 1440, light
   and dark: 0 expected.
8. **E2E:** `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts
tests/e2e/batches.spec.ts tests/e2e/cv.spec.ts --workers=1`, then the full suite
   `npm.cmd run test:e2e`. For each failing spec, rerun it alone once with `--workers=1` and
   report both results (AGENTS.md). Note any time-of-day skip.

## Write the report

Save `qa/reports/2026-11-07-phase-30f-3-run1.md` (the actual date) from `qa/templates/report.md`.
**PASS** if S1 to S8 and A1 pass (blocked weekday checks listed apart) and every e2e failure passes
when rerun alone. Add one line under "Agent sessions" in today's Daily note
(`C:\dev\capstone-obsidian\Daily\`) linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30F_3]]` and the
report. Reply with the verdict, the S1 measurements, the e2e counts (passed, failed, skipped) and
the report path.
