# Codex prompt: Phase 30B run 3 (2026-11-02)

Paste into Codex on the laptop, opened in `C:\dev\CPoint-PMS`, with Docker Desktop running.

```
Read AGENTS.md, then qa/handoffs/2026-11-02-phase-30b-measuring.md (its "Run 3 changes" section at the end) and the run 2 report qa/reports/2026-11-02-phase-30b-run2.md. Run Phase 30B QA run 3 on main (c8d6410) with the uncommitted run 3 fixes in the working tree; don't switch, pull or commit. Test and report only (D-092): change no code, tests, config, docs, git or database.
- Rerun C1 to C8 as the handoff now says. Use cv\.venv for pytest, ruff and mypy. In PowerShell write npm run cv:roll-photos '--' <code> <folder>.
- For C5 and C6 reuse the photos folder from run 2: qa/reports/artifacts/2026-11-02-phase-30b-run2/photos/ (and its zero-area copy). Compare C5's numbers with cv/reports/2026-11-02-LETTER-TEST-measure.md (lengths within 0.05 in).
- C7 and C8 follow the updated rows (C7 picks a roll with no area by query; C8 names any shot with no photo on this computer).
Write qa/reports/2026-11-02-phase-30b-run3.md with artifacts in qa/reports/artifacts/2026-11-02-phase-30b-run3/. End the report with your Daily note line. Reply with the verdict, each scenario's result, the pytest and unit test counts, and the report path.
```
