# Prompt for Codex: Phase 30F-1, the foundation of the polished look (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 120205b), Docker Desktop
running for the database only, **after 01:00 Manila time**. Copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 30F-1. It changes how the app looks, not what it does
or says (D-122). Handoff: `qa/handoffs/2026-11-06-phase-30f-1.md`. Before screenshots:
`qa/reports/2026-11-06-phase-30f-baseline.md`.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Change no data except what the e2e suite does itself.
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md). Restart
  `npm run dev` first so the new CSS is built. Screenshots with your headless Playwright script.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-06-phase-30f-1/`;
   `$env:E2E_BASE_URL="http://localhost:3000"`. Check the Manila time is after 01:00.
2. S1, S2: copy `qa/reports/artifacts/2026-11-06-phase-30f-baseline/capture-baseline.cjs` into
   the new artifacts folder and run it there unchanged (it writes beside itself, with the
   baseline's file names). Compare each pair and list every difference that is more than spacing,
   tone, shadow or the line under the title: a missing or changed word, control, number or
   message, something cut off, overlapping or scrolling sideways.
3. S3 to S9 from the handoff in the in-app browser. Put back anything you change.
4. S10 and A1: `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/theme.spec.ts tests/e2e/auth.spec.ts --workers=1`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun
   that spec alone once and report both results.

## Write the report

Save `qa/reports/2026-11-06-phase-30f-1-run1.md` from `qa/templates/report.md`, with a table of
the screenshot pairs (baseline and after links) and the differences found. **PASS** if S1 to S10
and A1 pass, the three targeted specs pass, and every other e2e failure is a timeout that passed
alone. Add one line under "Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`)
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30F_1]]` and the report. Reply with the verdict, the
e2e counts (passed, failed, skipped) and the report path.
