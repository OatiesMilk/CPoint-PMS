# Prompt for Codex: fix a failing CI check (paste everything below the line)

<!-- Claude fills this in and saves it as qa/CODEX_PROMPT_CI_FIX_<branch>.md, with the branch
     name's slashes turned into hyphens (feature/phases-20-23 → feature-phases-20-23).
     Claude does not fix the failure itself. Delete these comments when filling in. -->

Run Codex locally (Codex CLI or the IDE extension) in the CPoint-PMS folder (`C:\dev\CPoint-PMS`),
on the PR's branch. Copy from the line down.

---

You are fixing a failing GitHub CI check on a pull request for CPoint-PMS, a Next.js 16 +
PostgreSQL (Docker) + Prisma 7 web app with a Python camera station in `cv/`. Claude is the main
developer and wrote this prompt; your job is only to make the failing checks pass.

## 1. Read first (vault first, then the repo)

1. The vault: `C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, and
   `Inbox/CPoint commands and where to look.md` (or wherever it is moved). Use them to find files
   instead of exploring the whole repo.
2. The repo: `AGENTS.md` (Codex rules), `CLAUDE.md` (project rules: MVC layering, audit in every
   mutation, no hardcoded defect types), and `qa/README.md` → "CI fix loop".
3. `.github/workflows/ci.yml`, only the failing job(s) below.

## 2. The failure

| Field          | Value                                                             |
| -------------- | ----------------------------------------------------------------- |
| PR             | #<n>: <title> (<link>)                                            |
| Branch         | `<branch>` (head commit `<short sha>`)                            |
| Failing run    | <link to the Actions run>                                         |
| Failing job(s) | `check` / `station` / `e2e` / `docker`, and the failing step name |
| Passing jobs   | <the jobs that passed, so you leave them alone>                   |
| Fails on main? | yes / no / unknown                                                |

### Error lines (copied from the log)

```
<the exact error lines, trimmed to what matters>
```

### What Claude thinks is wrong

<!-- One or two sentences. Say "unsure" if it isn't clear. -->

### Suspected files

- `<path>`: <why>

## 3. Rules

- Fix only what makes these checks fail. No new features, no refactors, no unrelated cleanup.
- Never skip, disable, delete or loosen a test, a lint rule or a type check to get green. If a
  test is wrong, say why in the report and fix the test's expectation, not the app's behaviour
  around it.
- Keep the project rules in `CLAUDE.md` (layering, `runInTransaction` + `recordAudit`, guards on
  every page and route, tokens only in UI).
- Don't touch `.env`, migrations that already ran, or `package.json` dependencies unless the
  failure is in them; say so in the report if you do.
- No commits, pushes or PRs. Dylan commits.

## 4. Fix, then rerun the gates locally

Rerun exactly what failed, then `npm run check` (lint + typecheck + unit tests + build):

| Failing job | Rerun locally                                                                                |
| ----------- | -------------------------------------------------------------------------------------------- |
| `check`     | `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, `npm run build` |
| `station`   | in `cv/`: `ruff check .`, `ruff format --check .`, `mypy`, `pytest`                          |
| `e2e`       | `npm run db:up && npm run db:deploy && npm run build && npm run test:e2e`                    |
| `docker`    | `docker compose up --build -d --wait`, then `curl http://localhost:3000/api/health`          |

<!-- Claude: delete the rows that don't apply. -->

## 5. Report and record

1. Write `qa/reports/YYYY-MM-DD-ci-fix-<branch>.md` (short): the cause, each file you changed and
   why, and every gate you reran with its real result. Never write PASS for a gate you didn't run.
2. Add one line to today's vault note `C:\dev\capstone-obsidian\Daily\YYYY-MM-DD.md` under
   "Agent sessions": `CI fix (<branch>): prompt [[CPoint-PMS/qa/CODEX_PROMPT_CI_FIX_<branch>]] →
report [[CPoint-PMS/qa/reports/YYYY-MM-DD-ci-fix-<branch>]] (<result>)`. Create the note from
   `Templates/Daily.md` if it doesn't exist.
3. Finish by replying with: the cause in one sentence, the files changed, the gates and their
   results, and the report path. Dylan will commit and push; CI then reruns on the PR.
