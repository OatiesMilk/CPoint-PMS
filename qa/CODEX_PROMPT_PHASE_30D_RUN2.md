# Prompt for Codex: Phase 30D, roll counts, run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main a97d949), Docker Desktop
running for the database only. **The camera source is the USB camera plugged into the laptop**
(not the built-in webcam). Before you start, plug it in and close every other app that uses a
camera (Camera app, Teams, Zoom, OBS, another browser tab on Capture). Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 (`qa/reports/2026-11-04-phase-30d-run1.md`) passed
every check it could reach (e2e targeted 36/0/1, full 94/0/2, ledger 0) but was BLOCKED on two
setup problems, not app faults: the camera was held by another app (S4), and today's plan was
locked because a batch was already finished (S1, S7 with 15 rolls). Run 2 checks only those.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/`. No `demo:reset`.
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md).

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-04-phase-30d-run2/`.
2. **R1 (S4):** as a constructor with camera access, open Capture. **Use the USB camera as the
   source:** in Capture's **Camera** dropdown pick the USB camera (not the built-in or integrated
   webcam) and allow camera access if the browser asks; write its name as listed in the report.
   If the dropdown has no USB camera, stop and report that the USB camera isn't detected. If the camera still says
   "Another app is using this camera.", stop and report which app held it (Task Manager or the
   Windows camera privacy page lists it). Otherwise note "Leather rolls scanned N/M", start a roll,
   take one shot, Finish roll, and check the line reads "N+1/M" right after the finish message,
   without a reload. Screenshot before and after.
3. **R2 (S1 with a plan you can set):** today is locked, so use the next weekday with no plan: as
   the FM plan it with Rolls to be used 15. On Capture, Next planned days lists that day as
   "Leather rolls scanned 0/15". Then return the day to unplanned (note what it was first).
4. **R3 (S7):** Batches → Plan days: today (after R1) reads "N+1 of M rolls scanned" (plus "· K
   returned" if any).
5. Ledger check (should be 0):
   `select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`

No e2e rerun is needed (run 1 passed both suites).

## Write the report

Save `qa/reports/2026-11-04-phase-30d-run2.md` from `qa/templates/report.md`. **PASS** if R1 to
R3 pass and the ledger is 0. Add one line under "Agent sessions" in today's Daily note
(`C:\dev\capstone-obsidian\Daily\`) linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30D_RUN2]]` and the
report. Reply with the verdict and the report path.
