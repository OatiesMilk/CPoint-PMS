# QA report: the card once per roll and scanning timer (D-121, run 3)

| Field     | Value                                                |
| --------- | ---------------------------------------------------- |
| Date      | 2026-11-05, 22:45–22:56 Manila (test execution)      |
| Handoff   | `qa/handoffs/2026-11-05-card-once-per-roll-timer.md` |
| Prompt    | `qa/CODEX_PROMPT_CARD_ONCE_TIMER_RUN3.md`            |
| Tested by | Codex                                                |
| Verdict   | **PASS**                                             |

## 1. Summary

The corrected no-card spec passed all three tests with one worker and passed again in both the targeted and full runs. The full suite had eight 30-second timeouts across six specs; all eight passed when their specs ran alone once. The admin test that did not run in the full suite also passed on rerun. The inventory ledger check returned **0**, so the run meets the prompt's PASS criteria.

Acceptance checks: 3 passed, 0 failed, 0 blocked. Run 3 called for e2e only; the manual R1–R4 results are in the run 2 report.

## 2. Environment

| Item            | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language                                             |
| Node / npm      | v25.2.1 / 11.7.0                                                            |
| Branch / commit | `main` @ `1793138` (expected uncommitted D-121 changes)                     |
| How the app ran | Existing `npm run dev` server; health endpoint reported app and database up |
| Base URL        | `E2E_BASE_URL=http://localhost:3000`                                        |
| Database        | Docker Postgres `cpoint-pms-db-1`, healthy                                  |
| Browser         | Playwright 1.63.0, Chromium 153.0.8010.12, headless                         |
| Viewport        | 1440 × 900 default; existing phone scenarios use their configured viewport  |
| Time gate       | Run began after 01:00 Manila                                                |

## 3. Scenario results

| Check                  | Result | Notes / evidence                                                                                                                                                                                            |
| ---------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No-card regression     | PASS   | The previously failing “after the roll's first shot with the card, Capture works without it (D-121)” passed in the single-worker spec, targeted run, and full suite. There was no repeat of run 2's 422.    |
| Remaining e2e failures | PASS   | All eight original failures reported a 30-second test timeout and passed in the one-time isolated reruns. The admin camera-settings test that did not run in the full suite also passed in the admin rerun. |
| Inventory ledger       | PASS   | Query comparing each item's on-hand quantity against the sum of its movements returned 0 mismatches after the reruns.                                                                                       |

Existing automated tests run. Counts are passed / failed / skipped.

| Command                                                                                                   | Result                                             | Artifact                    |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------- |
| `npx playwright test tests/e2e/capture-no-card.spec.ts --workers=1`                                       | **3 / 0 / 0**                                      | `no-card-single-worker.log` |
| `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts tests/e2e/rolls.spec.ts` | **22 / 0 / 1**                                     | `targeted-e2e.log`          |
| `npm run test:e2e`                                                                                        | **90 / 8 / 2**, plus **1 did not run** (101 total) | `full-e2e.log`              |
| `npx playwright test tests/e2e/admin.spec.ts`                                                             | **6 / 0 / 0**                                      | `admin-spec-rerun.log`      |
| `npx playwright test tests/e2e/inventory.spec.ts`                                                         | **8 / 0 / 0**                                      | `inventory-spec-rerun.log`  |
| `npx playwright test tests/e2e/reports.spec.ts`                                                           | **3 / 0 / 0**                                      | `reports-spec-rerun.log`    |
| `npx playwright test tests/e2e/returns.spec.ts`                                                           | **4 / 0 / 0**                                      | `returns-spec-rerun.log`    |
| `npx playwright test tests/e2e/rolls.spec.ts`                                                             | **6 / 0 / 0**                                      | `rolls-spec-rerun.log`      |
| `npx playwright test tests/e2e/smoke.spec.ts`                                                             | **10 / 0 / 0**                                     | `smoke-spec-rerun.log`      |

The six isolated reruns total **37 / 0 / 0**. Original full-suite counts are preserved above. All logs, saved error contexts, and `ledger-check.txt` are under `qa/reports/artifacts/2026-11-05-card-once-timer-run3/`.

## 4. Failures

No unresolved failures. The full suite reported the following timeouts:

| Full-suite test                                              | Where it timed out                              | Isolated result |
| ------------------------------------------------------------ | ----------------------------------------------- | --------------- |
| `admin.spec.ts:136`, camera found-at setting                 | Scan API request context disposed after timeout | Passed          |
| `admin.spec.ts:216`, deactivated supplier removed from lists | Rolls report navigation aborted                 | Passed          |
| `inventory.spec.ts:267`, add leather rolls with their areas  | Remove-roll dialog was still visible            | Passed          |
| `inventory.spec.ts:336`, inventory role restrictions         | QI sign-in had not reached Batches              | Passed          |
| `reports.spec.ts:80`, quality report counts and CSV          | Manager sign-in had not reached the home page   | Passed          |
| `returns.spec.ts:121`, over-limit roll at finish             | Roll-detail navigation exceeded the timeout     | Passed          |
| `rolls.spec.ts:28`, finished roll details and tag search     | Roll detail heading had not replaced Reports    | Passed          |
| `smoke.spec.ts:151`, QI Batches and rejected shot            | Roll-detail navigation aborted                  | Passed          |

The full run's `admin.spec.ts:177` camera-settings test did not run. It passed in the isolated admin run. Evidence: `full-e2e.log`, `full-error-contexts/`, and the isolated logs listed above.

## 5. Other observations

- The existing no-model test was skipped with the model present. The demo-mode-disabled test was also skipped in the full run because demo mode was enabled.
- The ledger query was read-only and ran after the isolated reruns. It returned `0`.
- Authorization values printed by Playwright were redacted from the saved full-suite log and error contexts.

## 6. Suggested fixes (priority order)

No D-121 fix is indicated by this run. The full-suite timeouts and their isolated passes are recorded for future comparison.
