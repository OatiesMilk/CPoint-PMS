# Prompt for Codex: re-check a CI fix (paste everything below the line)

Run Codex locally (Codex CLI or the IDE extension) in the CPoint-PMS folder (`C:\dev\CPoint-PMS`),
on the branch with Claude's fix in the working tree. Copy from the line down.

---

You are re-checking a fix for a failing GitHub CI check on a pull request for CPoint-PMS, a
Next.js 16 + PostgreSQL (Docker) + Prisma 7 web app with a Python model toolkit in `cv/`. Claude
is the main developer: Claude fixed the failure and wrote this prompt. Your job is to rerun the
failing jobs locally and report what happened. **You don't fix anything.**

## 1. Read first (vault first, then the repo)

1. The vault: `C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, and
   `Inbox/CPoint commands and where to look.md` (or wherever it is moved). Use them to find files
   instead of exploring the whole repo.
2. The repo: `AGENTS.md` (Codex rules) and `qa/README.md` → "CI fix loop".
3. `.github/workflows/ci.yml`, only the `e2e` job.

## 2. The failure and Claude's fix

| Field          | Value                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| PR             | #56: Phase 34: final defects, repairs, stages and work in progress (D-130) (https://github.com/OatiesMilk/CPoint-PMS/pull/56), merged |
| Branch         | `feature/defects-and-repairs` (head commit `9af5d2e`), merged to `main`                                                               |
| Failing run    | https://github.com/OatiesMilk/CPoint-PMS/actions/runs/44774236856 (the PR) and 44774265002 (`main`)                                   |
| Failing job(s) | `e2e` (step: the Playwright tests)                                                                                                    |
| Passing jobs   | `check`, `station`, `docker`                                                                                                          |
| Fails on main? | yes, the same two tests (run 44774265002). `inspection-queue.spec.ts:113` also failed on Phase 33's `main` run (44689397781).         |

### Error lines (copied from the log)

```
106 passed (2.9m), 2 failed, 6 skipped, 6 did not run

1) [chromium] › tests/e2e/batches.spec.ts:344:5 › the Quality Inspector on a phone gets the notice and finishes the batch with failed pairs
   Error: expect(locator).toContainText(expected) failed
   Locator: getByTestId('batch-notice')
   Expected pattern: /B-\d{6}-\d+ is due\. Finish it now\./
   Timeout: 10000ms   Error: element(s) not found      (batches.spec.ts:380)

2) [chromium] › tests/e2e/inspection-queue.spec.ts:114:5 › the queue lists waiting batches across days by code, oldest first, with filters
   Error: expect(locator).toHaveCount(expected) failed
   Locator: getByTestId('queue-B-261115-1')   Expected: 0   Received: 1
   (inspection-queue.spec.ts:147: after Clear, a Day picked and Filter)
```

### What Claude changed

- **Failure 1 (`batches.spec.ts:344`): no change, a time-of-day limit already on record** (STATUS "Known
  test observations", Phase 30A run 5). The test needs a batch due today and fails between 00:00 and 01:00
  Manila (16:00 to 17:00 UTC); the run started at 16:31 UTC (00:31 Manila). Phase 34 doesn't touch the
  notice or the batch times. Rerun it outside that hour.
- **Failure 2 (`inspection-queue.spec.ts`): a race in the test, fixed.** After **Clear** the test picked a
  Day and pressed Filter without waiting for Clear's navigation. On a slow runner that page arrives late,
  rebuilds the filter form (its `key` changes) and empties the Day just picked, so Filter sent no day and
  both batches stayed. It failed the same way on Phase 33's `main` run, so it isn't a Phase 34 fault.
  - `tests/e2e/inspection-queue.spec.ts`: after Clear, `await expect(page).toHaveURL(/\/batches\?tab=queue$/)`
    before selecting the Day. No application change.

## 3. Rules

- Don't change any file except your report and its artifacts under `qa/reports/`: no application
  code, tests, migrations, config, `package.json`, `.env` or CI files, not even to get green
  (D-092).
- If a job still fails, record the exact error lines and the file you suspect. Claude fixes it.
- Never skip, disable or loosen a test or a check, and never write PASS for a job you didn't run.
- No commits, pushes or PRs. Dylan commits.

## 4. Rerun the failing job locally

Run it on a weekday **outside 00:00 to 01:00 Manila**. Stop the old Docker app first
(`docker compose stop app`), and use a fresh `npm run dev` or the production build the CI uses:

| Failing job | Rerun locally                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e`       | `docker compose stop app; npm run db:up; npm run db:deploy; npm run build; npm run test:e2e` (the same as CI: a production build, the default workers), then `npx playwright test --workers=2` |

Report the two failing tests by name (`batches.spec.ts` "the Quality Inspector on a phone gets the
notice and finishes the batch with failed pairs" and `inspection-queue.spec.ts` "the queue lists
waiting batches across days by code, oldest first, with filters"), and the full counts. Run the
`inspection-queue.spec.ts` test three times in a row (`npx playwright test tests/e2e/inspection-queue.spec.ts --repeat-each=3 --workers=1`)
and report all three results, because it is the one that failed on a race.

## 5. Report and record

1. Write `qa/reports/YYYY-MM-DD-ci-recheck-feature-defects-and-repairs.md` (short): each job you
   reran with its real result and counts, and for a failure the error lines and the file you suspect.
2. Add one line to today's vault note `C:\dev\capstone-obsidian\Daily\YYYY-MM-DD.md` under
   "Agent sessions": `CI re-check (feature-defects-and-repairs): prompt
[[CPoint-PMS/qa/CODEX_PROMPT_CI_RECHECK_feature-defects-and-repairs]] →
report [[CPoint-PMS/qa/reports/YYYY-MM-DD-ci-recheck-feature-defects-and-repairs]] (<result>)`.
   Create the note from `Templates/Daily.md` if it doesn't exist.
3. Finish by replying with each job and its result, and the report path. A job that still fails
   goes back to Claude; when everything passes, Dylan commits and pushes and CI reruns.
