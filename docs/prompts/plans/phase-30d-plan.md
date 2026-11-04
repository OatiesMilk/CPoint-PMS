# Phase 30D plan: roll counts on Capture, the planning calendar and Materials

**Asked by:** Dylan, 4 Nov 2026 (this thread): show the constructor how many rolls are scanned
against the Floor Manager's plan on Capture; count leather by the camera's result; finish what is
left of the team's QA notes (`groupmates-feedback-plan.md`). Agreed point by point in the thread
before building ("proceed with the ones that can go ahead"). Built on `main` at a97d949 (30E-2
#36 and the reports by roll #37 merged). Decision D-118.

## Dylan's rules (4 Nov)

1. Rolls used = rolls the camera passed.
2. Rolls checked by the camera = every roll scanned, passed or not.
3. Returned to supplier = the rolls that failed the scan (over the defect limit, D-116).
4. Pairs finished stays the same.
5. Add these to planning too.

## Checked against the system: contradictions and their fixes

| #   | Found                                                                                                                                                                         | Fix                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Rolls checked counted only FINISHED and USED; a Phase 30C roll sent back has status RETURNED and counted as returned only, so checked − returned came out too low or negative | Checked counts RETURNED too (and needs `finishedAt`)                                          |
| 2   | Remove writes the same OUT as Finish roll, so a water-damaged roll counted as used                                                                                            | **Removed (other)** per week: cancelled rolls from Inventory, by their removal day            |
| 3   | The leather item rows' Used counts every roll that left stock; the new Rolls used counts passed only                                                                          | The leather rows say "Rolls that left stock: used, returned or removed"; Days left keeps them |
| 4   | A month's last week can be 1 to 3 days, so week-against-week reads as a drop                                                                                                  | Each week on Leather rolls shows its **working days** (Mon–Fri less Non-working days)         |

Unmeasured rolls count as passed (A-42), so they are used; no separate line.

## Dropped (Dylan)

- **Pairs per roll:** nothing links pairs to rolls, a roll is cut over several days, and rolls
  differ in area. The Leather rolls table already shows rolls and pairs side by side.
- **On hand at week end:** Rolls used beside Returned to supplier already answers "restocks
  follow production or defects".
- **Change in pairs:** the weeks are listed one under another; the working days explain a short
  week.

## Build

- **Capture** (`/camera/capture`): a card above the roll: "Today, Wed, 4 Nov", then **Leather
  rolls scanned 3/15** in large text with a bar (and "Plan reached" when met); "The Floor Manager
  hasn't planned today yet." or "Today is marked Non-working / Holiday." otherwise; then **Next
  planned days** (up to 4, planned days only, "Leather rolls scanned 0/12"). Refreshed after this
  phone finishes or puts back a roll, every 60 s and when the tab comes back.
  `GET /api/v1/rolls/plan` (camera access, like `/rolls/open`).
- **Batches → Plan days:** today's and past days read "3 of 5 rolls scanned · 1 returned"; the
  day's dialog says "…so far: 2 used, 1 returned to the supplier (over the defect limit)."
- **Reports → Materials, Leather rolls:** Rolls used = checked − returned, Rolls checked by the
  camera (with 30C returns), Returned to supplier, **Removed (other)**, Pairs finished; each week
  with its working days.
- Code: `rollOutcomesByDay` (roll.service, from `listRollFinishes`), `capturePlan`
  (production.service), `capturePlanDays`/`leatherRollsLine` (production-rules), `workingDaysIn`
  (month-weeks), `rollsRemovedByDay` (materials.model). No migration.
- Tests: unit (rules, services, materials); e2e `capture.spec.ts` (counter, API, 403s, axe) and
  `inventory.spec.ts` (Leather rolls columns, used = checked − returned, working days). E2E by
  Codex.

## Assumptions

- **A-44:** Capture counts every roll finished today, passed or returned ("scanned"), against the
  plan; the days ahead are planned days only, so Non-working days and days not planned yet are
  skipped.
- **A-45:** a removed roll counts on the day it was removed; rolls from before Phase 30A (no item)
  were never in stock and are left out.
