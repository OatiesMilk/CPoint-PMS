# Prompt for Codex: Phase 25 QA, run 2 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running, on the branch with Claude's
run 1 fixes. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 of Phase 25 (Pass or Reject) is
`qa/reports/2026-10-24-phase-25-pass-or-reject.md`: FAIL, 22 of 24. Claude fixed what it found.
Re-check only those items.

| ID  | Run 1 finding                                                            | What Claude changed                                                                                                                        |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | `production.spec.ts:123` matched earlier runs' check-ins by the note     | The test writes a note of its own per run (`E2E check-in <time>`), so old rows never match                                                 |
| F2  | `daily.csv` header "Date (Manila)", the handoff said "Day"               | The handoff was wrong; it now says "Date (Manila), Scanned, Pass, Reject (for salvage)". No app change                                     |
| F3  | Seven unknown-class sections in the demo week, the handoff said one      | The handoff now says "at least one" (the newest roll's last section always; the random mix adds more). No app change                       |
| F4  | Space right after entering Floor view: no picture, "Press Capture again" | Capture waits for a video frame: "The camera is still starting. Wait a moment, then press Space again." (Capture on the page says Capture) |

## Rules

- **Test and report only (D-092).** Create files only under `qa/reports/`, plus your line in the
  vault's Daily note. Don't change code, tests, config, migrations, `package.json` or `.env`.
- Never print passwords or tokens. Never `demo:reset` the dev database. Leave port 3000 alone.
- Put back what you change (found-at stays 50; finish any roll you start).

## Steps

1. Read `qa/README.md`, the run 1 report and `qa/handoffs/2026-10-24-phase-25-pass-or-reject.md`.
2. `npm run db:up`, `npx prisma migrate status` (must be up to date), `npm run db:generate`,
   `npm run build`. Save outputs in `qa/reports/artifacts/2026-10-24-phase-25-run2/`.
3. **R1 (F1):** `npx playwright test tests/e2e/production.spec.ts --workers=1` twice in a row
   against the same dev database. Both runs pass, with no strict-mode error.
4. **R2:** the full suite once, `npm run test:e2e`. No failure (a failure that passes alone with
   `--workers=1` is a test-isolation note).
5. **R3 (F4):** as the QI, open Capture with the fake camera, enter Floor view and press Space at
   once, as in run 1. Expected: either a scan, or the band says "The camera is still starting.
   Wait a moment, then press Space again." and the next Space a second later gives a scan with a
   green Pass band. On the page (not Floor view), the same early press says "… press Capture
   again." Screenshot each.
6. **R4 (F2, F3):** read the two corrected handoff lines; check `daily.csv`'s header and that the
   dev database's newest demo-week roll has an unknown-class section if one is there (no reset).
7. **R5:** open `/review`, `/rework`, `/salvage` as the QI (404) and Reports → Quality and
   Operations as the FM (load, Pass and Reject only), as a quick regression check.

## Write the report

Save `qa/reports/2026-10-24-phase-25-run2.md` from `qa/templates/report.md`: R1 to R5 with PASS,
FAIL or BLOCKED and what you saw; the e2e counts. **PASS** only if the build passes, both R1 runs
and R2 have no failure, and R3 to R5 pass. Add one line under "Agent sessions" in the vault's
`Daily/2026-10-24.md` linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_25_RUN2]]` and the report. Reply
with the verdict, the e2e counts and the report path.
