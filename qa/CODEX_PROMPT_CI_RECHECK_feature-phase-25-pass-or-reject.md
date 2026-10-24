# Prompt for Codex: re-check a CI fix (paste everything below the line)

Run Codex locally (Codex CLI or the IDE extension) in the CPoint-PMS folder (`C:\dev\CPoint-PMS`),
on the PR's branch with Claude's fix in the working tree. Copy from the line down.

---

You are re-checking a fix for a failing GitHub CI check on a pull request for CPoint-PMS, a
Next.js 16 + PostgreSQL (Docker) + Prisma 7 web app with a Python model toolkit in `cv/`. Claude
is the main developer: Claude fixed the failure and wrote this prompt. Your job is to rerun the
failing jobs locally and report what happened. **You don't fix anything.**

## 1. Read first (vault first, then the repo)

1. The vault: `C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, and
   `Inbox/CPoint commands and where to look.md`. Use them to find files instead of exploring the
   whole repo.
2. The repo: `AGENTS.md` (Codex rules) and `qa/README.md` → "CI fix loop".
3. `.github/workflows/ci.yml`, only the `e2e` and `docker` jobs.

## 2. The failure and Claude's fix

| Field          | Value                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------- |
| PR             | #21: Phase 25, Pass or Reject (https://github.com/OatiesMilk/CPoint-PMS/pull/21)                  |
| Branch         | `feature/phase-25-pass-or-reject` (head commit `90d23af`, plus Claude's fix in the working tree)  |
| Failing run    | https://github.com/OatiesMilk/CPoint-PMS/actions/runs/40072171497                                 |
| Failing job(s) | `e2e` (step "npm run test:e2e"); `docker` (step "Bootstrap created the admin and reference data") |
| Passing jobs   | `check`, `station`                                                                                |
| Fails on main? | no (both come from Phase 25's changes)                                                            |

### Error lines (copied from the log)

```
1) tests/e2e/admin.spec.ts:129 › camera settings › the found-at value is validated, and new scans use the saved one (D-093)
   Locator: getByText('What the camera will decide')  Expected substring: "from 45%"  Received string: "What the camera will decide"
2) tests/e2e/reports.spec.ts:53 › the quality report counts a day exactly, and its CSV matches
   Locator: getByTestId('total-reject')  Expected substring: "2 sections"  Received string: "50%"
flaky: tests/e2e/cv.spec.ts:85 › a section's page draws the boxes … (D-093)
   locator.fill: Test timeout of 30000ms exceeded. waiting for getByLabel('Email')  (passed on retry)
docker: failed in "Bootstrap created the admin and reference data" (the app log ends at "Bootstrap complete", before the demo week; see below)
```

### What Claude changed

The two e2e failures were the tests looking in the wrong element, not app faults. The docker job
still expected Phase 24's data: 4 defect types (a new database now has 6) and a scan with
`status='PENDING_REVIEW'` (that column is gone).

- `tests/e2e/admin.spec.ts`: checks the "Reject when a defect of a Not accepted type is found
  from 45%" line itself, not the heading above it.
- `tests/e2e/reports.spec.ts`: checks the Reject tile's card for "N sections"; the test id sits
  on the percentage.
- `tests/e2e/cv.spec.ts`: each role signs in on its own fresh browser context, so the second
  sign-in can't meet the first one's session (the flaky timeout).
- `.github/workflows/ci.yml` (docker job): 6 defect types; instead of a pending-review scan, every
  scan's final verdict equals the camera's and at least one detection is an unknown class (the
  demo week's rejected section, A-12).

Claude checked the new docker queries on a scratch database after bootstrap and the demo week:
6 types, 0 mismatched verdicts, 7 unknown-class detections, 14 batches, 120 scans. Lint, format
and typecheck pass; Claude did not run e2e or Docker.

## 3. Rules

- Don't change any file except your report and its artifacts under `qa/reports/`: no application
  code, tests, migrations, config, `package.json`, `.env` or CI files, not even to get green
  (D-092).
- If a job still fails, record the exact error lines and the file you suspect. Claude fixes it.
- Never skip, disable or loosen a test or a check, and never write PASS for a job you didn't run.
- No commits, pushes or PRs. Dylan commits.
- Never `docker compose down -v` on the `cpoint-pms` project (the dev database). Use the
  throwaway project below for the docker job.

## 4. Rerun the failing jobs locally

| Failing job | Rerun locally                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e`       | `npm run db:up && npm run db:deploy && npm run build && npm run test:e2e`; then the three files alone: `npx playwright test tests/e2e/admin.spec.ts tests/e2e/reports.spec.ts tests/e2e/cv.spec.ts`                                                                                                                                                                                                        |
| `docker`    | In PowerShell: `$env:DB_PORT="5434"; $env:APP_PORT="3002"; $env:SEED_DEMO_USERS="true"; $env:SEED_DEMO_WEEK="true"; docker compose -p cpoint-ci up --build -d --wait`, then `curl http://localhost:3002/api/health` and the queries of the `docker` job in `ci.yml` (use `docker compose -p cpoint-ci exec -T db psql …`). Afterwards `docker compose -p cpoint-ci down -v` and remove the four variables. |

## 5. Report and record

1. Write `qa/reports/2026-10-24-ci-recheck-feature-phase-25-pass-or-reject.md` (short): each job
   you reran with its real result and counts, and for a failure the error lines and the file you
   suspect.
2. Add one line to today's vault note `C:\dev\capstone-obsidian\Daily\2026-10-24.md` under
   "Agent sessions": `CI re-check (feature/phase-25-pass-or-reject): prompt
[[CPoint-PMS/qa/CODEX_PROMPT_CI_RECHECK_feature-phase-25-pass-or-reject]] → report
[[CPoint-PMS/qa/reports/2026-10-24-ci-recheck-feature-phase-25-pass-or-reject]] (<result>)`.
3. Finish by replying with each job and its result, and the report path. A job that still fails
   goes back to Claude; when everything passes, Dylan commits and pushes and CI reruns on the PR.
