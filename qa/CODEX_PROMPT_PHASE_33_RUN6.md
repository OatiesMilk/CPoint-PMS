# Prompt for Codex: Phase 33 Inspection queue, run 6 (paste everything below the line)

Before pasting, **Dylan** (PowerShell, laptop, `C:\dev\CPoint-PMS`): keep the Docker app stopped,
and restart `npm run dev` with `DEMO_LOGIN_TOOLS=true` (a fresh server). Run on a weekday after
01:00 Manila.

---

You are the QA tester for CPoint-PMS: Phase 33, the Inspection queue (D-129), **run 6**. Handoff:
`qa/handoffs/2026-11-19-phase-33-inspection-queue.md`. Run 5: `qa/reports/2026-11-20-phase-33-run5.md`
(targeted e2e 11 of 11; full suite 102 passed, 2 failed; R2's due branch blocked).

## What Claude found in run 5 (no code changed)

- **F1, F2 (`reports.spec.ts:227`, `returns.spec.ts:121`):** the Floor Manager's sign-in stayed on
  `/` for 10 s instead of reaching `/floor-manager`. `/` is a one-line redirect, and both specs
  passed in run 4 with the same code. It is the dev-server stall seen in Phase 32 runs 2 and 3
  ("hanging on a blank `/`", before any Phase 33 code), late in a two-worker run on one `next dev`.
  So: rerun each failing spec alone, then the full suite once more.
- **R2 blocked:** after the reset no batch was due. Use the demo clock to make one due (step 3).
- `npm run check` passed (823 unit tests, build OK).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` and your line in the vault's
  Daily note.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"`, `--workers=2`. **This run's retry rule:** a
  spec that fails in the full suite on a first-compile timeout, `ECONNRESET`, or a sign-in that
  doesn't reach its home page is rerun alone once; report both results. Never change a timeout.
- Ignore the dev overlay's "Encountered a script tag…" at `src/app/layout.tsx` (since Phase 0).

## Do

1. Pre-flight (stop and report BLOCKED if it fails): port 3000's process is
   `C:\dev\CPoint-PMS\node_modules\next\...`, and `/batches` as the QI shows Queue and Today.
2. Back up the database to `storage\backups\before-phase-33-run6.dump`, then
   `npm run demo:reset '--' --yes`.
3. **R2 (in-app browser, QI):** with the Demo mode band's **Change time**, set today at **17:05**
   (today's last batch ends 17:00, so it is due). Then go Queue → Today → Queue → Today. Each time
   the tab title starts with exactly one "(n)" (never "(1) (1)"); record `document.title`, what the
   tab shows and the text of every `<title>` in the head. Finish that batch (or go **Back to real
   time**): no "(n)". Put the clock back to real time before step 4.
4. **Q14:** `npx playwright test tests/e2e/reports.spec.ts tests/e2e/returns.spec.ts --workers=2`
   (the two run 5 failures, alone), then the full suite `npx playwright test --workers=2`. Report
   the counts, and apply the retry rule above to any failure.
5. `npm run demo:reset '--' --yes` once more after the e2e; record that it finishes.
6. Write `qa/reports/2026-11-20-phase-33-run6.md` from `qa/templates/report.md`: PASS, PASS WITH
   ISSUES or FAIL; R2 and Q14 with evidence; and which run passed each other scenario (run 2: Q1,
   Q2, Q4 to Q8, Q10, Q11, A1 to A4; run 3: Q3, Q9, Q13; run 4: R1; Q12 not applicable). A spec
   that fails in the full suite but passes alone on the retry rule is PASS WITH ISSUES, not FAIL.
7. Add one line under "Agent sessions" in today's vault `Daily/` note linking this prompt, the
   handoff and the report as `[[CPoint-PMS/qa/…]]`.
