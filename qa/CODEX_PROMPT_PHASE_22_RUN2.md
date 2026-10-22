# Prompt for Codex: Phase 22 QA, run 2 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Claude fixed the four findings from your Phase 22 run 1
(`qa/reports/2026-10-21-phase-22-attendance.md`): the summary line now always shows the other
roles' count, the handoff's S2 expects the account's own name, and two stale `auth.spec.ts` tests
no longer depend on the dev accounts' names and switches.

## Rules

- Same as run 1 (`qa/CODEX_PROMPT_PHASE_22.md`): don't modify application code, tests, config,
  migrations, `package.json` or `.env`; only create files under `qa/reports/`. Never print
  passwords. Never run `demo:reset` on the dev database or `docker compose down -v` on
  `cpoint-pms`. Leave port 3000 alone if another app holds it (use `PORT=3001`).
- Before you start, save `SELECT day FROM attendance_days ORDER BY day;`. At the end, delete only
  the attendance days (marks first) that weren't in that list, and say which in the report.

## Steps

1. Read `qa/handoffs/2026-10-21-phase-22-attendance-run2.md`.
2. `npm run db:up`, `npm run db:deploy`, `npm run build`; save the outputs in
   `qa/reports/artifacts/2026-10-21-phase-22-attendance-run2/`.
3. Save the attendance days list.
4. Run R3, then R4 (the full `npm run test:e2e`, saved as `e2e.log`).
5. Start the app (`npm run dev`) and run R1 and R2, with a screenshot of each.
6. Put the dev database's attendance back.

## Write the report

Save it as `qa/reports/2026-10-21-phase-22-attendance-run2.md`, using `qa/templates/report.md`.
**PASS** only if the build passes, R1 to R4 pass and the e2e suite has no failure. For any failure:
the steps, the exact message, a screenshot, whether the app or the test is wrong, and the smallest
fix with file and line.

Finish by replying with the verdict, the e2e counts and the report path.
