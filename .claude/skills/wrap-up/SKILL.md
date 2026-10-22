---
name: wrap-up
description: End-of-session routine for the CPoint rebuild. Runs the quality gates, updates STATUS, SESSION_LOG, DECISIONS, ROADMAP and the Obsidian vault, then gives Dylan the git commands. Use when the user says "wrap up", "end session", "save progress", "update the docs", or when a roadmap phase is finished.
---

# Wrap-up

1. **Gates:** run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` (and the
   Playwright smoke test / `docker compose up --build` if this session touched those areas).
   Record the real results. If something fails, fix it or record it as a blocker. Never mark it passed.
2. **`docs/STATUS.md`:** overwrite it so it's accurate _now_. Cover the date, current phase,
   phase checklist, "What works right now", **Next step (exact)** with a paste-ready prompt,
   blockers, and open questions/assumptions. Keep it ≤150 lines.
3. **`docs/SESSION_LOG.md`:** prepend one entry using the template at the top of the file.
4. **`docs/DECISIONS.md`:** append an entry for every architectural or business-rule decision
   made this session (supersede, don't edit).
5. **`docs/ROADMAP.md`:** tick the completed acceptance criteria.
6. Update `README.md`, `docs/API.md`, `DESIGN.md` and the `CLAUDE.md` Commands section if they're stale.
7. **Vault** (`C:\dev\capstone-obsidian`): add to today's `Daily/YYYY-MM-DD.md` (Did, Next,
   Questions, one "Agent sessions" line linking the brief, plan, handoff, Codex prompt and report),
   and create or update the phase's summary note in `Notes/Phases/` (from
   `Templates/Phase summary.md`). Link repo docs; don't copy them (D-089).
8. Don't commit or push unless Dylan says so in this session. Give him one copy-paste block: a
   branch from the latest `main` (never `main`, D-032), `git add` with only this work's files
   (never `git add .`), `git commit -m`, `git push -u origin <branch>`, and a reminder to open the
   PR. List the files left out on purpose. If CI then fails on the PR, write
   `qa/CODEX_PROMPT_CI_FIX_<branch>.md` from `qa/templates/ci-fix-prompt.md` for Codex (D-089).
9. Print the final report in the format from `docs/prompts/system-rebuild.md` → `<final_report_format>`.
