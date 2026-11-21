# Prompt for Codex: re-check a CI fix (paste everything below the line)

Run Codex locally (Codex CLI or the IDE extension) in the CPoint-PMS folder (`C:\dev\CPoint-PMS`),
on `main` with Claude's fix in the working tree. Copy from the line down.

---

You are re-checking a fix for a failing GitHub CI check on `main` for CPoint-PMS, a Next.js 16 +
PostgreSQL (Docker) + Prisma 7 web app with a Python model toolkit in `cv/`. Claude is the main
developer: Claude fixed the failure and wrote this prompt. Your job is to rerun the failing job
locally and report what happened. **You don't fix anything.**

## 1. Read first (vault first, then the repo)

1. The vault: `C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, and
   `Inbox/CPoint commands and where to look.md` (or wherever it is moved). Use them to find files
   instead of exploring the whole repo.
2. The repo: `AGENTS.md` (Codex rules) and `qa/README.md` → "CI fix loop".
3. `.github/workflows/ci.yml`, only the `e2e` job.

## 2. The failure and Claude's fix

| Field          | Value                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------- |
| PR             | #59: Phase 35A: reports by period, sortable tables, filters and print (D-132), merged               |
| Branch         | `feature/reports-by-period`, merged to `main` as `1c196bb`                                          |
| Failing run    | https://github.com/OatiesMilk/CPoint-PMS/actions/runs/44897069011 (`main`)                          |
| Failing job(s) | `e2e` (step: the Playwright tests): 130 passed, 2 failed, 7 skipped                                 |
| Passing jobs   | `check`, `station`, `docker`                                                                        |
| Fails on main? | yes. Both tests passed locally in Codex's Phase 35A runs 1 to 3 (they ran on a demo-reset database) |

### Error lines (copied from the log)

```
1) [chromium] › tests/e2e/reports-print.spec.ts:93:5 › Rolls prints every matching row, past one page, and says when it cut the list
   Expected: > 15   Received: 11        (reports-print.spec.ts:100, both attempts)

2) [chromium] › tests/e2e/reports-period.spec.ts:119:5 › Rolls sorts every matching row and filters by leather item and location
   Test timeout of 30000ms exceeded.
   locator.getAttribute: waiting for getByRole('link', { name: 'Download CSV' })   (reports-period.spec.ts:144)
```

### What Claude changed

The cause is the tests, not the app: CI has no demo week (`SEED_DEMO_USERS` only), so its database holds
only the rolls other specs made. Test 1 assumed more than 15 rolls; test 2 picked the first leather item in
the filter, which in CI can have no rolls, so the page showed "No rolls match" and no Download CSV link.
Both now make their own data.

- `tests/e2e/reports-print.spec.ts`: before opening `?print=1`, count the rolls (`batches` table) and add In
  stock rolls with `addInventoryRoll()` until there are 16.
- `tests/e2e/reports-period.spec.ts`: add one roll with `addInventoryRoll()` and filter by that roll's leather
  item (`selectOption(roll.itemId)`) instead of the first option, with no `if` around the CSV link check.

No application change.

## 3. Rules

- Don't change any file except your report and its artifacts under `qa/reports/`: no application
  code, tests, migrations, config, `package.json`, `.env` or CI files, not even to get green
  (D-092).
- If a job still fails, record the exact error lines and the file you suspect. Claude fixes it.
- Never skip, disable or loosen a test or a check, and never write PASS for a job you didn't run.
- No commits, pushes or PRs. Dylan commits.

## 4. Rerun the failing job locally

Stop the old Docker app first (`docker compose stop app`), then:

| Failing job | Rerun locally                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e`       | `npm run db:up; npm run db:deploy; npm run build; npm run test:e2e` (the same as CI: a production build, the default workers), then the two specs alone below |

1. Run the two specs by name, alone: `npx playwright test tests/e2e/reports-print.spec.ts tests/e2e/reports-period.spec.ts --workers=2`.
   Report each test's result.
2. **Reproduce CI's data** if you can do it without touching the dev database: a throwaway stack
   (`docker compose -p ci35a` with another `DB_PORT` and `APP_PORT`, `npm run db:deploy` and `SEED_DEMO_USERS=true`,
   no `demo:seed`), run the same two specs against it, then take it down. **Never wipe or reset the dev
   database for this.** If you can't, say so; the first run is then on demo data, where these tests passed before.
3. Report the full counts of the `npm run test:e2e` run.

## 5. Report and record

1. Write `qa/reports/YYYY-MM-DD-ci-recheck-feature-reports-by-period.md` (short): each job you reran with its
   real result and counts, which database (demo data or the throwaway stack) each run used, and for a failure
   the error lines and the file you suspect.
2. Add one line to today's vault note `C:\dev\capstone-obsidian\Daily\YYYY-MM-DD.md` under
   "Agent sessions": `CI re-check (feature-reports-by-period): prompt
[[CPoint-PMS/qa/CODEX_PROMPT_CI_RECHECK_feature-reports-by-period]] →
report [[CPoint-PMS/qa/reports/YYYY-MM-DD-ci-recheck-feature-reports-by-period]] (<result>)`.
   Create the note from `Templates/Daily.md` if it doesn't exist.
3. Finish by replying with each job and its result, and the report path. A job that still fails
   goes back to Claude; when everything passes, Dylan commits and pushes and CI reruns.
