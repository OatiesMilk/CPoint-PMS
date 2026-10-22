# Phase 20 QA run 2 fixes plan

Status: **approved by Dylan on 2026-10-20 ("go ahead").**

Source: `qa/reports/2026-10-20-phase-20-qa-fixes.md` (Codex, verdict FAIL only because of e2e).
Every browser scenario passed: 14 of 14, including the three that run 1 blocked. E2E: 81 passed,
4 failed, 1 skipped. Work stays on the `main` checkout, uncommitted. Claude runs only lint,
typecheck, unit tests and build; Codex runs e2e.

## Findings

All four failures are in the tests. None points to an app fault.

| #   | Test                                                                                            | Cause                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Fix                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| F1  | `admin.spec.ts` "a new account signs in with its temporary password … a reset ends its session" | It passed in run 1, and the auth code hasn't changed since. Run 2 stopped on Playwright's 30 s **test** timeout while it waited at line 83. This one test signs in four times and hashes three passwords, and the full suite runs in parallel. The "Your password was changed" text on the screenshot comes from the `?reason=password-reset` URL, which was already open before that last sign-in. `checkSession` compares millisecond timestamps (`authAt` against `sessionsValidFrom`), so a fresh sign-in after a reset is always newer. | `test.setTimeout(60_000)`, the same as the long procurement test (D-042 run 5).                       |
| F2  | `cut-around-or-clean.spec.ts:75`                                                                | Settings → Defect types shows 15 rows per page (D-047). Test types from earlier runs push `e2e-clean-only` past page 1.                                                                                                                                                                                                                                                                                                                                                                                                                      | Type each key into **Find defect type** before checking its row, as `admin.spec.ts:187` already does. |
| F3  | `procurement.spec.ts` "order, a short delivery with proof, then close short"                    | It's the same kind of failure as F1. The test is long (two constructors, an order, a delivery, close short), and its last sign-in (`signedIn`, line 111) was still waiting when the 30 s limit hit. When Codex signed in with the same account by hand, it worked.                                                                                                                                                                                                                                                                           | `test.setTimeout(60_000)`.                                                                            |
| F4  | `smoke.spec.ts:105`                                                                             | My run-1 fix sent an item code longer than 20 characters and left out `reorderLevel`, so the API correctly returned 422.                                                                                                                                                                                                                                                                                                                                                                                                                     | Use the code `SMK-<last 8 digits of the time>` (12 characters) and add `reorderLevel: 0`.             |

## After the fixes

- Run lint, typecheck, unit tests and build.
- Update `docs/STATUS.md` and `docs/SESSION_LOG.md`.
- Write `qa/handoffs/2026-10-20-phase-20-qa-run3.md` and `qa/CODEX_PROMPT_PHASE_20_RUN3.md`. Run 3
  is the full e2e suite only, run twice. Doing it twice shows whether F1 and F3 were just slow or
  something else. If either fails again, the handoff asks Codex for the trace, so the app's sign-in
  can be checked properly.
- No branch, commit, push or PR.
