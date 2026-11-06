# Prompt for Codex: the System Admin reaches only the administration modules, run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 12448b5), Docker Desktop
running for the database only, **after 01:00 Manila time**. Copy from the line down.

---

You are the QA tester for CPoint-PMS, D-119, run 2. Run 1
(`qa/reports/2026-11-06-admin-modules-run1.md`) passed 9 of 10 checks. F1: after the Floor
Manager loaded a photo and signed out, the System Admin in the same browser saw the cached copy.
The image route now sends `Cache-Control: private, no-cache` with an `ETag`, so the browser asks
the server on every load and the role check runs each time (an unchanged image answers 304). The
early-model notice in Settings now names Capture. Handoff: `qa/handoffs/2026-11-06-admin-modules.md`.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Put back anything you change.
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md). Restart
  `npm run dev` first so the changed route is loaded.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-06-admin-modules-run2/`;
   `$env:E2E_BASE_URL="http://localhost:3000"`. Check the Manila time is after 01:00.
2. R1 (F1): repeat run 1's A1 steps in the in-app browser (FM opens LR-MLT-003 section #1 so the
   photo loads, signs out, Admin signs in, opens the exact image URL). Expected: `FORBIDDEN`, no
   photo, on the first load. Repeat with your headless `A1-cache-repro.cjs` from run 1: expected
   403 on the cached navigation. Record the FM's response headers (`Cache-Control: private,
no-cache`, `ETag`) and that the FM's second load of the section page still shows the photo.
3. R2: Settings → Thresholds → Early model notice reads "Show “Early model” on Capture", and the
   help text and the toast name Capture, not the Camera page. Put the setting back.
4. `npx playwright test tests/e2e/auth.spec.ts --workers=1`, then the full suite
   `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun that spec alone once
   and report both results.

## Write the report

Save `qa/reports/2026-11-06-admin-modules-run2.md` from `qa/templates/report.md`. **PASS** if R1 and
R2 pass, `auth.spec.ts` passes, and every other e2e failure is a timeout that passed alone. Add one
line under "Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`) linking
`[[CPoint-PMS/qa/CODEX_PROMPT_ADMIN_MODULES_RUN2]]` and the report. Reply with the verdict, the e2e
counts (passed, failed, skipped) and the report path.
