# Prompt for Codex: Phase 30F-2, the desktop pages (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main da3d792), Docker Desktop
running for the database only, **after 01:00 Manila time**. Copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 30F-2. It changes how the desktop pages look, not what
they do or say (D-122). Handoff: `qa/handoffs/2026-11-07-phase-30f-2.md`. Before screenshots:
`qa/reports/2026-11-06-phase-30f-baseline.md`.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Change no data except what the e2e suite does itself. Don't change any Windows
  setting.
- Run against the `npm run dev` server Dylan started (http://localhost:3000, or the port it
  printed); don't restart it. Browser checks in your in-app browser; screenshots with a headless
  Playwright script.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-07-phase-30f-2/`;
   `$env:E2E_BASE_URL="http://localhost:3000"`. Check the Manila time is after 01:00.
2. S1, S2: copy `qa/reports/artifacts/2026-11-06-phase-30f-baseline/capture-baseline.cjs` into
   the new folder and run it there unchanged. Compare each pair and list every difference beyond
   spacing, tone, shadow and the placements in handoff §1: a missing or changed word, control,
   number or message, something cut off, overlapping or scrolling sideways.
3. S3: for the four tables, measure with Playwright at 1280 and 1440 px, light theme: the page's
   `scrollWidth` equals its `clientWidth`, and each table's scroll region's `scrollWidth` equals its
   `clientWidth`. Record the numbers.
4. S4 to S9 from the handoff in the in-app browser. Put back anything you change.
5. S10 and A1: `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts tests/e2e/rolls.spec.ts tests/e2e/returns.spec.ts tests/e2e/inventory.spec.ts --workers=1`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun
   that spec alone once and report both results. If an untouched API route answers 404, say so
   and stop: Dylan clears `.next\dev`.

## Write the report

Save `qa/reports/2026-11-07-phase-30f-2-run1.md` from `qa/templates/report.md`, with a table of the
screenshot pairs and the differences found, and the S3 measurements. **PASS** if S1 to S10 and A1
pass, the targeted specs pass, and every other e2e failure is a timeout that passed alone. Add one
line under "Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`) linking
`[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30F_2]]` and the report. Reply with the verdict, the e2e counts
(passed, failed, skipped) and the report path.
