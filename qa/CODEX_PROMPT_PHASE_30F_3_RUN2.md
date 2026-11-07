# Prompt for Codex: Phase 30F-3, run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted Phase 30F-3), Docker Desktop
running for the database only, Dylan's `npm run dev` on http://localhost:3000, **on a weekday
(Monday to Friday) after 01:00 Manila with today planned** (Batches → Plan days as the FM), so the
batches, the bottom bar and the Finish batch sheet exist. Then copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 30F-3, run 2. Run 1
(`qa/reports/2026-11-07-phase-30f-3-run1.md`) passed what it could on a Saturday; S2, S6 and the
plan line of S7 were blocked. Handoff: `qa/handoffs/2026-11-07-phase-30f-3.md`.

What Claude changed since run 1:

- **S1:** run 1 measured the picture's top at y = 638 with the Capture bar at y = 739, so only
  about 100 of the picture's roughly 200 px showed above the bar. **Start another roll** now sits
  at the right of the "Roll" label (same name, same button), not on its own line under the
  dropdown, and the gap between the page's parts is 16 px on a phone (24 px from 640 px up).
- `npm run check` passed (708 unit tests, build OK). Claude ran no browser or e2e test.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Change only the data the scenarios need and say what you changed; undo what
  you can (deactivate a QA account you created, put back an empty roll). Don't change any Windows
  setting.
- Run against Dylan's `npm run dev` URL with `$env:E2E_BASE_URL="http://localhost:3000"`; manual
  checks in your in-app browser; measurements and screenshots with a headless Playwright script of
  your own (fake camera with `tests/e2e/fixtures/marker-card.y4m`, as in run 1).
- If an API route that 30F-3 didn't touch answers 404, stop and ask Dylan to clear the dev cache
  (stop `npm run dev`, `Remove-Item -Recurse -Force .next\dev`, start it again), then rerun.

## Steps

Artifacts in `qa/reports/artifacts/<date>-phase-30f-3-run2/`.

1. Check the Manila time is after 01:00 on a weekday and today has a plan. If not, stop and say so.
2. **R1 (S1):** Capture at 390 × 844, light and dark, Demo mode band on, with a roll chosen: once
   with 0 shots and once after the first shot. Report the picture's top and bottom, the Capture
   bar's top, and how many px of the picture show above the bar. Target: at least 150 px with 0
   shots, and the whole picture after the first shot. Also `scrollWidth` = 390 and the Capture
   button ≥ 44 px. Then Finish the roll (or Put roll back if it has no shots).
3. **R2 (S2, the one-time hint):** a constructor sees no roll chosen when two or more rolls are
   open that **someone else** started and this browser never chose one. Set it up like this: as the
   System Admin, add a Shoe Constructor named "QA 30F3" (Users) and give camera access (More
   actions); make sure two rolls are open that the demo constructor started (start a second one as
   `constructor@` if only one is open). In a fresh browser context, sign in as "QA 30F3" and open
   Capture. Expected: the Roll dropdown's first option reads **Choose a roll** and is selected;
   "Choose the roll this shot belongs to." appears **exactly once** on the page (under the Capture
   button). Afterwards: put back the roll you started (if it has no shots) and deactivate "QA 30F3".
4. **R3 (S6):** as the QI at 390 × 844 and 1440 × 900, light and dark: the notice banner (if a
   batch is due or about to end), the batch cards (badge beside "Batch N"; the batch that can be
   finished now has a ring-coloured border), the fixed bottom bar (card surface, shadow, ≥ 44 px
   button, above the safe area, no sideways scroll), and the Finish batch sheet (open, then
   **Not now**; don't finish a batch).
5. **R4 (S7):** as the FM at 1280 and 1440: the line under "Today, …" reads "Plan: … pairs, 08:00
   to 17:00, every 4 hours. Lunch: …" with the interval **once** (no "every 4 h" before the
   shift).
6. **R5 (screenshots):** Capture (0 shots and after a shot) and Batches (QI and FM) at 390 and
   1440, light and dark; compare with `qa/reports/artifacts/2026-11-06-phase-30f-baseline/`: same
   words and controls, except the three copy changes in handoff §1 and Start another roll's place.
7. **A1:** axe (WCAG 2.1 A/AA, serious or critical) on Capture and Batches at 390 and 1440, light
   and dark: 0 expected.
8. **E2E:** `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts
tests/e2e/batches.spec.ts --workers=1`, then the full suite `npm.cmd run test:e2e`. For each
   failing spec, rerun it alone once with `--workers=1` and report both results (AGENTS.md).

## Write the report

Save `qa/reports/<date>-phase-30f-3-run2.md` from `qa/templates/report.md`. **PASS** if R1 to R5
and A1 pass and every e2e failure passes when rerun alone. Add one line under "Agent sessions" in
today's Daily note (`C:\dev\capstone-obsidian\Daily\`) linking
`[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30F_3_RUN2]]` and the report. Reply with the verdict, the R1
measurements, the e2e counts (passed, failed, skipped) and the report path.
