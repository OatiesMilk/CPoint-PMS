# Prompt for Codex: re-check a CI fix (paste everything below the line)

<!-- Claude fills this in after fixing a failing `e2e` or `docker` CI job (Claude reruns `check`
     and `station` itself) and saves it as qa/CODEX_PROMPT_CI_RECHECK_<branch>.md, with the branch
     name's slashes turned into hyphens (feature/phases-20-23 → feature-phases-20-23). Codex
     reruns and reports; it never fixes (D-092). Delete these comments when filling in. -->

Run Codex locally (Codex CLI or the IDE extension) in the CPoint-PMS folder (`C:\dev\CPoint-PMS`),
on the PR's branch with Claude's fix in the working tree. Copy from the line down.

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
3. `.github/workflows/ci.yml`, only the failing job(s) below.

## 2. The failure and Claude's fix

| Field          | Value                                       |
| -------------- | ------------------------------------------- |
| PR             | #<n>: <title> (<link>)                      |
| Branch         | `<branch>` (head commit `<short sha>`)      |
| Failing run    | <link to the Actions run>                   |
| Failing job(s) | `e2e` / `docker`, and the failing step name |
| Passing jobs   | <the jobs that passed>                      |
| Fails on main? | yes / no / unknown                          |

### Error lines (copied from the log)

```
<the exact error lines, trimmed to what matters>
```

### What Claude changed

<!-- The cause in one or two sentences, then each file Claude changed. -->

- `<path>`: <what changed and why>

## 3. Rules

- Don't change any file except your report and its artifacts under `qa/reports/`: no application
  code, tests, migrations, config, `package.json`, `.env` or CI files, not even to get green
  (D-092).
- If a job still fails, record the exact error lines and the file you suspect. Claude fixes it.
- Never skip, disable or loosen a test or a check, and never write PASS for a job you didn't run.
- No commits, pushes or PRs. Dylan commits.

## 4. Rerun the failing jobs locally

| Failing job | Rerun locally                                                                       |
| ----------- | ----------------------------------------------------------------------------------- |
| `e2e`       | `npm run db:up && npm run db:deploy && npm run build && npm run test:e2e`           |
| `docker`    | `docker compose up --build -d --wait`, then `curl http://localhost:3000/api/health` |

<!-- Claude: delete the rows that don't apply. -->

## 5. Report and record

1. Write `qa/reports/YYYY-MM-DD-ci-recheck-<branch>.md` (short): each job you reran with its real
   result and counts, and for a failure the error lines and the file you suspect.
2. Add one line to today's vault note `C:\dev\capstone-obsidian\Daily\YYYY-MM-DD.md` under
   "Agent sessions": `CI re-check (<branch>): prompt [[CPoint-PMS/qa/CODEX_PROMPT_CI_RECHECK_<branch>]]
→ report [[CPoint-PMS/qa/reports/YYYY-MM-DD-ci-recheck-<branch>]] (<result>)`. Create the note
   from `Templates/Daily.md` if it doesn't exist.
3. Finish by replying with each job and its result, and the report path. A job that still fails
   goes back to Claude; when everything passes, Dylan commits and pushes and CI reruns on the PR.
