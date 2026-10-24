# QA loop: Claude builds, Codex tests

A file-based handoff between the two agents. Nothing here is automated; Dylan carries each step.

```
1. Claude finishes a change   → writes qa/handoffs/YYYY-MM-DD-<feature>.md   (from templates/handoff.md)
2. Dylan opens Codex          → pastes qa/CODEX_PROMPT.md
3. Codex runs + tests the app → writes qa/reports/YYYY-MM-DD-<feature>.md    (from templates/report.md)
4. Next Claude session        → reads the newest report BEFORE planning, fixes what failed
5. Repeat until the report verdict is PASS
```

## Folders

| Path                 | What goes there                                                       | Written by |
| -------------------- | --------------------------------------------------------------------- | ---------- |
| `templates/`         | The two blank templates. Copy them, never edit them in place.         | Team       |
| `handoffs/`          | One file per change that needs testing.                               | Claude     |
| `reports/`           | One file per test run, same name as the handoff it answers.           | Codex      |
| `reports/artifacts/` | Screenshots, traces, logs. One subfolder per report (same base name). | Codex      |
| `CODEX_PROMPT.md`    | The prompt Dylan pastes into Codex.                                   | Team       |

## Naming

`YYYY-MM-DD-<feature>.md`, lowercase, words joined with hyphens. Examples:

- `qa/handoffs/2026-10-10-material-requests.md`
- `qa/reports/2026-10-10-material-requests.md`
- `qa/reports/artifacts/2026-10-10-material-requests/` (screenshots, `trace.zip`, `server.log`)

A second run on the same day adds a suffix: `2026-10-10-material-requests-run2.md`.
"Newest" means the latest date in the file name, then the highest `-runN`.

## Rules for Claude (builder)

- At the end of a session that changed behaviour, write a handoff from `templates/handoff.md`.
  Every scenario needs concrete steps and one observable expected result.
- At the start of a session, list `qa/reports/` and read the newest report for the feature you
  are on before making a plan. Treat its **Suggested fixes** as input, not orders: confirm each
  failure in the code first.
- Reference a report in the session log when you fix something it found.

## Rules for Codex (tester)

- Test and report only; never apply a fix (D-092). Don't change application code, tests,
  migrations, config, `package.json` or `.env`, not even to get a CI check green. Write only under
  `qa/reports/`; Claude fixes what you report.
- Read the vault first (`C:\dev\capstone-obsidian`: `CLAUDE.md`, `Rules.md`, `Inbox/CPoint
commands and where to look.md`) to find files, and add one line to today's Daily note under
  "Agent sessions" when you finish a run.
- Run against the local app as described in the handoff. Never test against a shared or real
  database.
- Record what you actually saw. If a scenario could not be run, mark it **BLOCKED** with the
  reason, never PASS.

## CI fix loop: Claude fixes, Codex re-checks

When a GitHub CI check fails on a PR, **Claude fixes it**. Codex never applies a fix; it only
reruns the jobs Claude doesn't run and reports (D-092, which replaced D-089's Codex fix).

```
1. A CI check fails on the PR      → Dylan tells Claude (or Claude sees it on the PR)
2. Claude reads the failing check  → fixes it, reruns npm run check (and the cv/ checks for station)
3. Was it e2e or docker?           → Claude writes qa/CODEX_PROMPT_CI_RECHECK_<branch>.md (from templates/ci-recheck-prompt.md)
4. Dylan opens Codex on the branch → pastes that prompt; Codex reruns those jobs and writes
                                     qa/reports/YYYY-MM-DD-ci-recheck-<branch>.md and a vault Daily line
5. Claude reads the report         → fixes again if a job still fails; updates SESSION_LOG / STATUS
                                     and the vault, gives Dylan the git commands
6. Dylan commits and pushes        → CI reruns; repeat from 1 until green
```

- A `check` or `station` failure skips steps 3 and 4: Claude reruns those gates itself.
- `<branch>` has its slashes turned into hyphens: `feature/phases-20-23` →
  `CODEX_PROMPT_CI_RECHECK_feature-phases-20-23.md`. A second round adds `_RUN2`.
- The prompt names the PR, the failing job(s) and step, the exact error lines, what Claude changed
  and the jobs to rerun.
- Codex writes only its report and its vault Daily line. If a job still fails, it reports the
  error lines and the file it suspects; it never fixes, skips, disables or loosens a test or a check.

## Where Codex can run the browser

Codex needs to reach the app at `http://localhost:3000`, so it must run on the same machine as
the app: the Codex CLI or the Codex IDE extension, started in this project folder. It drives
Chromium through Playwright, which this repo already has (`@playwright/test`). ChatGPT's web-based
browser (agent mode) and Codex cloud tasks run on OpenAI's servers and cannot open your
`localhost`, so use the local Codex for this loop.

## Git

`qa/handoffs` and `qa/reports` are working notes. Decide as a team whether to commit them; the
`reports/artifacts/` folder (screenshots, traces) should stay out of git.
