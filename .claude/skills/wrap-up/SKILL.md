---
name: wrap-up
description: End-of-session routine for the CPoint rebuild. Runs the quality gates, updates STATUS, SESSION_LOG, DECISIONS and ROADMAP, then commits and pushes. Use when the user says "wrap up", "end session", "save progress", "update the docs", or when a roadmap phase is finished.
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
7. Commit (`docs(status): wrap up <phase/topic>` plus any pending code commits) and run
   `git push -u origin system-rebuild`.
8. Print the final report in the format from `docs/prompts/system-rebuild.md` → `<final_report_format>`.
