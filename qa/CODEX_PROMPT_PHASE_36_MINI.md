# Short prompt for Codex: Phase 36 (paste everything below the line)

---

QA Phase 36 of CPoint-PMS on the laptop (`C:\dev\CPoint-PMS`, Docker Desktop on, `npm install` done). First run `git apply qa/phase-36-ci-storage-checks.patch` if `.github/workflows/ci.yml` doesn't yet have the "Storage locations" SQL checks (that is Dylan's step; if it isn't applied, say so and skip D8). Then read `qa/CODEX_PROMPT_PHASE_36.md` and follow it exactly: its rules (test and report only, D-092; write only under `qa/reports/` and your line in the vault's Daily note), its setup (stop the Docker app and any old dev server, `db:up`, `db:deploy`, fresh `npm run dev`, `npm run demo:reset '--' --yes`) and its steps. The scenarios are D1 to D10 and A1 in `qa/handoffs/2026-11-22-phase-36-docs.md`: the docs match the app, `docs/DEMO_SCRIPT.md` rehearsed act by act with timings (a weekday before 13:30 Manila if you can), the API spot-check, the new docker SQL checks, the figures and the README diagrams. No e2e run is needed (no app code changed). Back to real time and reset the demo at the end, and write `qa/reports/<today>-phase-36-run1.md` from `qa/templates/report.md` with a verdict (PASS, PASS WITH ISSUES or FAIL) even if everything passes.

The 12 manual screenshots are a separate run: `qa/CODEX_PROMPT_PHASE_36_SCREENSHOTS.md`.
