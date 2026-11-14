# Prompt for Codex: re-check a CI fix (paste everything below the line)

Run Codex locally (Codex CLI or the IDE extension) in the CPoint-PMS folder, on the PR's branch
with Claude's fix in the working tree. Copy from the line down.

---

You are re-checking a fix for a failing GitHub CI check on a pull request for CPoint-PMS, a
Next.js 16 + PostgreSQL (Docker) + Prisma 7 web app with a Python model toolkit in `cv/`. Claude
is the main developer: Claude fixed the failure and wrote this prompt. Your job is to rerun the
failing job locally and report what happened. **You don't fix anything.**

## 1. Read first (vault first, then the repo)

1. The vault: `C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, and
   `Inbox/CPoint commands and where to look.md`. Use them to find files instead of exploring the
   whole repo.
2. The repo: `AGENTS.md` (Codex rules) and `qa/README.md` → "CI fix loop".
3. `.github/workflows/ci.yml`, only the `docker` job.

## 2. The failure and Claude's fix

| Field          | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| PR             | #50: claim sheet and demo output (feature/claim-sheet-and-demo-output) |
| Branch         | `feature/claim-sheet-and-demo-output` (head commit `47d1aeb`)          |
| Failing run    | Actions run 42633076013                                                |
| Failing job(s) | `docker`, step "The demo week seeds in the background, consistently"   |
| Passing jobs   | `check`, `station`, `e2e`                                              |
| Fails on main? | no (main still seeds a quota of 128)                                   |

### Error lines (copied from the log)

```
Demo week seeded: ... 250 rolls, 1141 scans ... (93431 ms)
test "$(q "select count(*) from day_plans where kind='PLANNED' and quota=128 and \"intervalMinutes\"=240")" -ge 1
Error: Process completed with exit code 1.
```

### What Claude changed

The seed was right; the CI check was out of date. D-127 set the demo quota to 300 pairs
(`DEMO_QUOTA = 300`), but the docker job still looked for day plans with a quota of 128, so it
found none.

- `.github/workflows/ci.yml`: the day_plans check reads `quota=300` instead of `quota=128`.

## 3. Rules

- Don't change any file except your report and its artifacts under `qa/reports/`: no application
  code, tests, migrations, config, `package.json`, `.env` or CI files, not even to get green
  (D-092).
- If a job still fails, record the exact error lines and the file you suspect. Claude fixes it.
- Never skip, disable or loosen a test or a check, and never write PASS for a job you didn't run.
- No commits, pushes or PRs. Dylan commits.

## 4. Rerun the failing job locally

Do what the `docker` job does, as a throwaway stack so the dev database isn't touched:

1. In a copy of `.env`, set `SEED_DEMO_WEEK=true` (the job's other `.env` lines are passwords and
   the auth secret; keep the ones you have).
2. `docker compose -p cpoint-ci up --build -d --wait` (use other `DB_PORT`/`APP_PORT` values if
   the dev stack holds 5432 or 3000), then `curl http://localhost:<APP_PORT>/api/health`.
3. Wait for `Demo week seeded` in `docker compose -p cpoint-ci logs app` (about 1.5 to 3 minutes).
4. Run every `test`/`grep` line of the job's step "The demo week seeds in the background,
   consistently" against that stack's `db`, and the two bootstrap checks before it. Each must pass.
5. `docker compose -p cpoint-ci down -v` when done.

## 5. Report and record

1. Write `qa/reports/YYYY-MM-DD-ci-recheck-feature-claim-sheet-and-demo-output.md` (short): each
   check you ran with its real result, and for a failure the error lines and the file you suspect.
2. Add one line to today's vault note `C:\dev\capstone-obsidian\Daily\YYYY-MM-DD.md` under
   "Agent sessions": `CI re-check (feature-claim-sheet-and-demo-output): prompt
[[CPoint-PMS/qa/CODEX_PROMPT_CI_RECHECK_feature-claim-sheet-and-demo-output]] → report
[[CPoint-PMS/qa/reports/YYYY-MM-DD-ci-recheck-feature-claim-sheet-and-demo-output]] (<result>)`.
3. Finish by replying with each check and its result, and the report path. A check that still
   fails goes back to Claude; when everything passes, Dylan pushes and CI reruns on the PR.
