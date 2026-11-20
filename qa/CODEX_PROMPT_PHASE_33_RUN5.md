# Prompt for Codex: Phase 33 Inspection queue, run 5 (paste everything below the line)

Before pasting, **Dylan** (PowerShell, laptop, `C:\dev\CPoint-PMS`): keep the Docker app stopped,
and restart `npm run dev` with `DEMO_LOGIN_TOOLS=true` so it serves the latest code on
`http://localhost:3000`. Run on a weekday after 01:00 Manila.

---

You are the QA tester for CPoint-PMS: Phase 33, the Inspection queue (D-129), **run 5**. Handoff:
`qa/handoffs/2026-11-19-phase-33-inspection-queue.md`. Run 4: `qa/reports/2026-11-20-phase-33-run4.md`
(R1, R2 and the targeted e2e passed; the full suite failed 1).

## What Claude changed since run 4

- **F1 (the full suite's Correct dialog stayed open):** the dialog said "This batch was not found":
  `batches.spec.ts`'s clean-up deleted every check-in entered during its run, so with two workers
  it also deleted the check-in `inspection-queue.spec.ts` had just made on last Sunday's batch. Its
  clean-up now removes only today's check-ins. No app change.
- **The duplicate title (run 4 observation):** after Today → Queue the head had two `<title>`
  elements and one read "(1) (1)". The due count now goes on every `<title>` exactly once (any
  number of old prefixes is stripped first), and an empty one stays empty
  (`src/components/features/batches/batch-notices.tsx`).
- `npm run check` passed (823 unit tests, build OK).

Every other scenario passed in runs 2 to 4 and isn't rerun.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` and your line in the vault's
  Daily note.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"`, `--workers=2`. A first-compile timeout or
  `ECONNRESET`: rerun that spec alone once and report both; never change a timeout.
- Ignore the dev overlay's "Encountered a script tag…" at `src/app/layout.tsx` (since Phase 0).

## Do

1. Pre-flight (stop and report BLOCKED if it fails): port 3000's process is
   `C:\dev\CPoint-PMS\node_modules\next\...`, and `/batches` as the QI shows Queue and Today.
2. Back up the database to `storage\backups\before-phase-33-run5.dump`, then
   `npm run demo:reset '--' --yes`.
3. **R2 again (in-app browser, QI), when a batch is due:** Queue → Today → Queue → Today. Each
   time the title starts with exactly one "(n)" (never "(1) (1)"); record `document.title`, what
   the tab shows, and the text of every `<title>` in the head. With no batch due (or after
   finishing it), no "(n)".
4. **Q14:** `npx playwright test tests/e2e/inspection-queue.spec.ts tests/e2e/batches.spec.ts --workers=2`,
   then the full suite `npx playwright test --workers=2`. Report the counts.
5. `npm run demo:reset '--' --yes` once more after the e2e; record that it finishes.
6. Write `qa/reports/2026-11-20-phase-33-run5.md` from `qa/templates/report.md`: PASS, PASS WITH
   ISSUES or FAIL; R2 and Q14 with evidence; and which run passed each other scenario (run 2: Q1,
   Q2, Q4 to Q8, Q10, Q11, A1 to A4; run 3: Q3, Q9, Q13; run 4: R1; Q12 not applicable).
7. Add one line under "Agent sessions" in today's vault `Daily/` note linking this prompt, the
   handoff and the report as `[[CPoint-PMS/qa/…]]`.
