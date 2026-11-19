# Prompt for Codex: Phase 32 roll locations, run 3 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only.
**Before pasting:** Dylan stops the dev server (Ctrl+C in its terminal) and starts it again fresh,
`$env:PORT="3001"; npm run dev` in PowerShell, then opens http://localhost:3001/login once.

---

You are the QA tester for CPoint-PMS: Phase 32, run 3, the end-to-end suite only (L12). Handoff:
`qa/handoffs/2026-11-17-roll-locations.md`. Reports so far: `qa/reports/2026-11-19-phase-32-run1.md`
and `qa/reports/2026-11-19-phase-32-run2.md`. Every other scenario has passed (L1 to L11, A1 to
A5, the Set aside name) and carries forward.

## Why run 3

In run 2 the six targeted specs passed 30 of 30 on a fresh dev server, but the full suite (six
workers, 4.5 minutes, one `next dev`) had five failures, and the single-spec reruns started right
after it failed on demo sign-ins that hung on "Signing in…" or a blank `/`. The same specs pass when
the server isn't worn down, so Claude found no code fault and changed nothing. Run 3 checks the
suite on a fresh server with fewer workers at once.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` and your line in the vault's
  Daily note. Don't change `playwright.config.ts`; the worker count goes on the command line only.
- `$env:E2E_BASE_URL="http://localhost:3001"` before Playwright.
- Before each step, check `http://localhost:3001/api/health` answers `ok` within 5 seconds and say
  how long it took.

## Do

1. Full suite with two workers: `npx playwright test --workers=2`. Report passed, failed, skipped
   and the time.
2. If anything failed: ask Dylan to restart the dev server (as above), then rerun each failing spec
   file alone once with `npx playwright test tests/e2e/<spec>.spec.ts --workers=1` and give both
   results. Quote each failure's assertion and say whether it was a sign-in that stayed on `/login`
   or `/`, a time-out, or a wrong value.
3. Only if step 1 passed: the full suite once more with the default workers (`npm run test:e2e`),
   for comparison with run 2; a time-out or stuck sign-in there goes in "Other observations", not
   as a failure, when the same test passed in step 1.
4. Write `qa/reports/2026-11-19-phase-32-run3.md` (or today's date) from `qa/templates/report.md`
   (PASS, PASS WITH ISSUES or FAIL; PASS when step 1, or the step 2 reruns, are green), and add one
   line under "Agent sessions" in the vault's `Daily/` note for today linking this prompt and the
   report.
