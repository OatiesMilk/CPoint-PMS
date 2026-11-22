# Short prompt for Codex: Phase 35B (paste everything below the line)

---

QA Phase 35B of CPoint-PMS on the laptop (`C:\dev\CPoint-PMS`, Docker Desktop on, `npm install` done). Read
`qa/CODEX_PROMPT_PHASE_35B.md` and follow it exactly: its rules (test and report only, D-092; write only
under `qa/reports/` and your line in the vault's Daily note), its setup (stop the Docker app and any old dev
server, `db:up`, `db:deploy`, fresh `npm run dev`, `npm run demo:reset '--' --yes`) and its steps. The
scenarios are C1 to C12 and A1 to A3 in `qa/handoffs/2026-11-21-phase-35b-corrections.md`. Run the e2e
(`corrections.spec.ts`, the related specs, then the full suite with `--workers=2`), reset the demo at the
end, and write `qa/reports/<today>-phase-35b-run1.md` from `qa/templates/report.md` with a verdict
(PASS, PASS WITH ISSUES or FAIL) even if everything passes.
