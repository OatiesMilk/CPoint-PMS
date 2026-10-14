# Prompt for Codex (paste everything below the line)

Run Codex locally in the CPoint-PMS project folder. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Claude fixed the two e2e failures from your run 2 report (tests
only) and wrote a handoff. **Do not modify application code, tests, migrations, `package.json` or
`.env`.** Only create files under `qa/reports/`.

1. Read `qa/README.md`, `qa/handoffs/2026-10-14-followups-run3.md`, `qa/templates/report.md` and
   `qa/reports/2026-10-14-followups-run2.md`.
2. Follow section 3 of the handoff: E1 (the seven-spec run, three times) and E2 (the full suite
   once). Keep each run's output with `--output=qa/reports/artifacts/2026-10-14-followups-run3/e2e-<n>`
   and save the console logs beside it.
3. Write `qa/reports/2026-10-14-followups-run3.md` with the template (per-spec pass/fail for every
   run). Leave the database container running and reply with the verdict, counts and report path.
