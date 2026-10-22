# Working With Claude Code on This Project

This guide is for the team. It explains how to drive the rebuild with Claude Code so that every
session picks up where the last one stopped, even when a different teammate runs it.

## How the memory works

| File                             | Role                                                                               | Who updates it                  |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------- |
| `CLAUDE.md`                      | Project rules. **Auto-loaded every session**, and it auto-imports `docs/STATUS.md` | Rarely; when rules change       |
| `docs/STATUS.md`                 | "Where are we right now?" Overwritten each session                                 | Claude, via `/wrap-up`          |
| `docs/ROADMAP.md`                | Phases (0–9 so far) with acceptance checkboxes                                     | Claude ticks; team edits scope  |
| `docs/DECISIONS.md`              | Why things are the way they are (append-only)                                      | Claude + team                   |
| `docs/SESSION_LOG.md`            | History, newest on top                                                             | Claude, via `/wrap-up`          |
| `docs/prompts/system-rebuild.md` | The master spec                                                                    | Team (log changes in DECISIONS) |
| `docs/client-survey.md`          | Client interview answers                                                           | Team, after each client meeting |
| `.claude/skills/`                | `ui-craft`, `/resume`, `/wrap-up`                                                  | Team                            |

Claude has **no memory between sessions** except these files. If it's not written down, it didn't happen.

## Starting new work

Phases 0–9 are done (see `docs/ROADMAP.md`). For a new feature or a client change:

1. `git checkout main && git pull`, then create a branch (e.g. `feature/<topic>`).
2. Start Claude Code in the repo root and paste the prompt from `docs/STATUS.md` → Next step, or
   write the request in `docs/prompts/<topic>.md` (see `procurement.md` for the shape) and ask
   Claude to "read it and start with Step 1 in plan mode".
3. Review the plan, approve it, and let it work. It stops with a report; then open the PR.

## The session loop (every phase after that)

```
/resume                       → Claude reports status and proposes this session's plan
(you) "go" or adjust the plan → Claude builds the phase in small commits
(you) review in the browser   → `docker compose up -d db && npm run dev`, click through it
/wrap-up                      → gates, docs updated, commit, push the branch, next prompt
(you) open the PR into main   → CI runs (check, e2e, Docker demo week); review and merge it
```

Keep **one phase per session**. Long sessions get compacted and lose detail. A fresh session plus
STATUS.md is more reliable.

## Claude builds, Codex tests and fixes CI, the vault remembers (D-089)

- **Claude** is the main developer. **Codex** runs the QA handoffs (`qa/README.md`) and applies
  the fix when a GitHub CI check fails on a PR: Claude writes
  `qa/CODEX_PROMPT_CI_FIX_<branch>.md` from `qa/templates/ci-fix-prompt.md`, Dylan pastes it into
  Codex, Codex fixes and reports, Claude reviews. See `qa/README.md` → "CI fix loop".
- **The vault** (`C:\dev\capstone-obsidian`) is every agent's first lookup: its `CLAUDE.md`,
  `Rules.md`, `Home.md`, `Inbox/CPoint commands and where to look.md` and one short summary note
  per phase in `Notes/Phases/` point to the one repo file that answers each question. That saves
  tokens and stops agents guessing.
- **Every change is recorded twice:** in the repo (wrap-up docs, or a `qa/reports/` file for
  Codex) and in the vault's Daily note, including Codex's CI fixes.

## Recommended practices

- **Plan mode first** (Shift+Tab, or say "plan first") for anything touching the schema, auth, or
  more than ~5 files. Reviewing a plan is far cheaper than reviewing a wrong diff.
- **Be specific when you redirect.** "The rework board should group by batch, not by status" works
  better than "make it better".
- **Review before trusting.** Run `/code-review` before you close a phase, and `/security-review`
  after Phase 1 (auth) and Phase 3 (device tokens and uploads).
- **Use subagents for side quests.** For example: "Use a subagent to research how Auth.js v5 handles
  role claims, then come back." It keeps the main context clean.
- **Feed client feedback back in.** After a CPoint meeting, update `docs/client-survey.md`, then ask
  Claude to "reconcile the new survey answers with DECISIONS.md and STATUS open questions".
- **Business-rule changes go through DECISIONS.** Example: "The client wants rework to start at 65%.
  Add a decision superseding D-011 and update the seed."
- **Never let it guess silently.** The spec makes it log every `ASSUMPTION` in STATUS → Open
  questions. Go through that list with the client.

## Working as a team of four

- **One driver per phase.** Two people running Claude on the same branch at once will create conflicts.
- **Branches (D-032):** `main` is the base. Each session works on its own branch from the latest
  `main` (e.g. `feature/procurement-csv`), pushes it, and the team opens and merges the PR. Nobody
  pushes to `main` directly. `system-rebuild` holds Phases 0–8 and is no longer used.
- To work in parallel, give each person a separate feature on a separate branch. Merge one PR
  before starting a session that depends on it, and keep schema changes to one branch at a time.
- Always `git pull` before starting a session. STATUS.md is only as fresh as your checkout.
- Write your name in the "Who" line of the session log. Your panel may ask who built what.

## When the real camera module is ready

Point the YOLO script at `POST /api/v1/scans` with a device token from Admin → API tokens, and add
the new defect classes in Admin → Defect types. No app code should need to change (D-011). Scans
with a class the system doesn't know yet wait in the Quality Inspector's review queue (D-028). Then ask
Claude to "replace the Camera placeholder with live phone/webcam capture" as a new roadmap phase.

## Troubleshooting Claude sessions

- **It's re-asking settled questions:** tell it to read `docs/DECISIONS.md`.
- **It claims something works that doesn't:** ask it to run the gate and paste the output.
- **STATUS.md drifted from reality:** run `/resume`, which cross-checks the docs against git.
- **The context is getting long or confused:** run `/wrap-up`, then start a fresh session with `/resume`.
