---
name: resume
description: Start-of-session briefing for the CPoint rebuild. Reads the living project docs and reports where the project stands and the exact next step. Use when the user says "resume", "where are we", "what's next", "continue", or opens a new session on this project.
---

# Resume

1. Read `docs/STATUS.md`, `docs/ROADMAP.md` (current phase only), the top 3 entries of
   `docs/SESSION_LOG.md`, and skim `docs/DECISIONS.md` headings.
2. Check reality against the docs:
   - `git branch --show-current` (a working branch, never `main`; D-032), `git status --short`,
     `git log --oneline -10`, and `git fetch origin main` then `git log --oneline HEAD..origin/main`.
   - If the working branch is behind `main`, or already merged into it, say so and propose
     updating or restarting it from `origin/main` before any new work.
   - If STATUS claims something is done that the code or git history doesn't show, say so.
3. Reply in **under 15 lines**:
   - Current phase and % of its acceptance criteria ticked
   - Last session's summary (one line)
   - Uncommitted or unpushed work, if any
   - Blockers and open questions that affect the next step
   - **Proposed next step**, plus the plan for this session in 3–6 bullets
4. Wait for the user's go-ahead before writing code. If the user said "resume and go", proceed
   with the plan, following `docs/prompts/system-rebuild.md`.
