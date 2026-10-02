# Working With Claude Code on This Project

This guide is for the team. It explains how to drive the rebuild with Claude Code so that every
session picks up where the last one stopped, even when a different teammate runs it.

## How the memory works

| File | Role | Who updates it |
|---|---|---|
| `CLAUDE.md` | Project rules. **Auto-loaded every session**, and it auto-imports `docs/STATUS.md` | Rarely; when rules change |
| `docs/STATUS.md` | "Where are we right now?" Overwritten each session | Claude, via `/wrap-up` |
| `docs/ROADMAP.md` | Phases 0–8 with acceptance checkboxes | Claude ticks; team edits scope |
| `docs/DECISIONS.md` | Why things are the way they are (append-only) | Claude + team |
| `docs/SESSION_LOG.md` | History, newest on top | Claude, via `/wrap-up` |
| `docs/prompts/system-rebuild.md` | The master spec | Team (log changes in DECISIONS) |
| `docs/client-survey.md` | Client interview answers | Team, after each client meeting |
| `.claude/skills/` | `ui-craft`, `/resume`, `/wrap-up` | Team |

Claude has **no memory between sessions** except these files. If it's not written down, it didn't happen.

## First run (Phase 0)
1. Merge this branch into `main`, or check it out, so that the docs are present.
2. In the repo root, start Claude Code with Opus and paste:
   ```
   Read docs/prompts/system-rebuild.md and run Phase 0 from docs/ROADMAP.md.
   Start in plan mode: show me the plan before changing files.
   ```
3. Review the plan, approve it, and let it work. It stops at the end of the phase with a report.

## The session loop (every phase after that)
```
/resume                       → Claude reports status and proposes this session's plan
(you) "go" or adjust the plan → Claude builds the phase in small commits
(you) review in the browser   → `docker compose up -d db && npm run dev`, click through it
/wrap-up                      → gates, docs updated, commit, push, paste-ready next prompt
```
Keep **one phase per session**. Long sessions get compacted and lose detail. A fresh session plus
STATUS.md is more reliable.

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
- **Business-rule changes go through DECISIONS.** Example: "The client says dirt should be REJECT.
  Add a decision superseding D-006 and update the seed."
- **Never let it guess silently.** The spec makes it log every `ASSUMPTION` in STATUS → Open
  questions. Go through that list with the client.

## Working as a team of four
- **One driver per phase.** Two people running Claude on the same branch at once will create conflicts.
- To work in parallel, split by phase *after Phase 1* (the schema), each on a feature branch off
  `system-rebuild` (e.g. `system-rebuild/inventory`). Merge back with a PR, and run `/wrap-up` on
  `system-rebuild` after each merge so STATUS stays the single truth.
- Good parallel pairs once Phase 3 is done: **Phase 5 (Inventory)** with **Phase 6 (Admin)**.
- Always `git pull` before starting a session. STATUS.md is only as fresh as your checkout.
- Write your name in the "Who" line of the session log. Your panel may ask who built what.

## When the real camera module is ready
Point the YOLO script at `POST /api/v1/scans` with a device token from Admin → API tokens, and add
the new defect classes in Admin → Defect types. No app code should need to change (D-006). Then ask
Claude to "replace the Camera placeholder with live phone/webcam capture" as a new roadmap phase.

## Troubleshooting Claude sessions
- **It's re-asking settled questions:** tell it to read `docs/DECISIONS.md`.
- **It claims something works that doesn't:** ask it to run the gate and paste the output.
- **STATUS.md drifted from reality:** run `/resume`, which cross-checks the docs against git.
- **The context is getting long or confused:** run `/wrap-up`, then start a fresh session with `/resume`.
