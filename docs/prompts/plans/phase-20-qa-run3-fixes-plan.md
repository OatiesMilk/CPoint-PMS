# Phase 20 QA run 3 fixes plan

Status: **approved by Dylan on 2026-10-20 (asked to clean up all test data once every fix is in).**

Source: `qa/reports/2026-10-20-phase-20-qa-run3.md` (Codex, FAIL). Both full e2e runs: 84 passed,
1 failed, 1 skipped. The reset and close-short tests passed in both runs, so the 60 s limit was
the right fix and sign-in has no fault.

## The one failure

`tests/e2e/cut-around-or-clean.spec.ts:78`, the Settings → Defect types test. It fails the same
way every time, including when run alone.

- **Cause:** a test problem. Each Defect types row is named by its label cell (the row header,
  "E2E stain"), not by its class key. So `getByRole("row", { name: /e2e-clean-only/ })` never
  matches, even though the row is on screen with "Clean before cutting". My run 2 fix (the Find
  box) was needed for paging, but it didn't change how the row is named.
- **Fix:** find each row by its visible text:
  `page.getByRole("row").filter({ hasText: CLEAN_KEY })` and the same for `CUT_KEY` (lines 78 and
  82). The Find box stays.

## After the fix

- Run lint, typecheck, unit tests and build.
- Update `docs/STATUS.md` and `docs/SESSION_LOG.md`.
- Write `qa/handoffs/2026-10-20-phase-20-qa-run4.md` and `qa/CODEX_PROMPT_PHASE_20_RUN4.md`. Run 4
  runs that test alone first, then the full suite once.
- No branch, commit, push or PR.

## Noted, not changed

Codex saw Next warn that `next start` doesn't work with `output: "standalone"`. The e2e server
still came up and every run finished. Changing how Playwright starts the app is a separate change,
so it stays as it is unless Dylan wants it.
