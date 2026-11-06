# QA handoff: the marker card once per roll, and a scanning timer per roll

| Field           | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| Date            | 2026-11-05                                                                               |
| Feature         | card-once-per-roll-timer                                                                 |
| Branch          | `main` at 1793138 plus uncommitted D-121 changes (laptop)                                |
| Spec / prompt   | `docs/prompts/plans/card-once-per-roll-and-timing-plan.md`, D-121 in `docs/DECISIONS.md` |
| Written by      | Claude                                                                                   |
| Previous report | `qa/reports/2026-11-05-scale-marker-run4.md` (PASS)                                      |

## 1. What changed

- **Shoe Constructor, Capture, the card once per roll (D-121):** the cameras at the factory are
  fixed, so the card is needed on a roll's **first shot** only.
  - First shot of a roll: as before. No card: "Show the marker card to capture." and "It's needed
    for the roll's first shot only."; Capture and Space are off.
  - After a shot with the card, the line under the picture reads "Scale set at the first shot: N in
    across. The card can come off the leather." with a **Read the card again** button. Capture and
    Space work without the card; those shots use that scale.
  - A card still in view on a later shot is read and used ("Marker card found. …").
  - **Read the card again:** the next shot needs the card again, and its scale is used from then on.
  - A camera whose picture is a different size (another camera or resolution) needs the card once:
    "This camera's picture is a different size from the roll's first shot. Show the marker card
    once to set its scale."
- **Floor Manager, a scan's page:** a later shot reads "Measured with the roll's marker card from
  Shot #1: N in across"; a shot with the card still reads "Measured with the marker card: N in
  across".
- **Scanning timer:** under the roll on Capture, "Scanning time 08:42" counting up from **Start
  scanning** (h:mm:ss past an hour), with " · Paused for lunch" during the day's lunch break (Settings
  → Lunch break; default 11:00 to 12:00), which isn't counted. A roll left open overnight
  doesn't count the night (A-49); time on the same day counts, even after 17:00. A reload or another phone shows the same time.
- **Finish roll** ends its message with "Scanning time: 12:34."
- **Reports → Rolls (FM):** a **Scanning time** column after Scanned ("—" while being scanned or
  never started); above the table "Average scanning time: 14:05 over 23 rolls (Start scanning to
  Finish roll, lunch left out)" for the rolls the filters show; a **Download CSV** button. The roll's
  page has a "Scanning time" row: "12:34 (lunch left out)".
- **CSV:** `GET /api/v1/reports/rolls.csv` (same filters): Roll, Leather, Supplier, Area (sq ft),
  Started scanning (Manila), Finished (Manila), Scanning time, Scanning time (min), Shots, Passed,
  Rejected, Defect %, Status. FM only.
- **API:** `POST /api/v1/scans/capture` takes `markerCorners` optional; without it and no marked
  shot of the same picture size on the roll: `422 MARKER_REQUIRED`, before the model runs. Finish
  returns `scanningMs`; `/api/v1/rolls/open` adds `scale` and `lunches`; `GET /api/v1/rolls` adds
  `meta.scanning`.
- No migration, no new package.

## 2. Files touched

| File                                                                                    | Change                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `src/lib/roll-timer.ts`                                                                 | New: working time with lunch and nights left out; format |
| `src/lib/scale-marker.ts`, `src/lib/roll-rules.ts`, `decision-engine.ts`                | The roll's scale and messages; Finish wording; snapshot  |
| `src/server/services/scan-ingest.service.ts`, `capture.service.ts`                      | A shot without the card takes the roll's scale; 422      |
| `src/server/services/roll.service.ts`, `models/roll.model.ts`, `scan.model.ts`          | Scale and lunches on open rolls; times, average, CSV     |
| `src/server/validators/scan.validator.ts`                                               | `markerCorners` optional on capture                      |
| `src/server/controllers/roll.controller.ts`, `api/v1/reports/rolls.csv`                 | The CSV; `meta.scanning`                                 |
| `src/app/(app)/camera/capture/capture-client.tsx`, `roll-bar.tsx`                       | Card once per roll, Read the card again, the timer       |
| `src/app/(app)/reports/rolls/page.tsx`, `[id]/page.tsx`, `scans/[id]`                   | Column, average, CSV button, roll's time, scan wording   |
| `tests/unit/*`, `tests/e2e/capture.spec.ts`, `capture-no-card.spec.ts`, `rolls.spec.ts` | New and updated tests                                    |
| `docs/STATION_SETUP.md`, `docs/API.md`                                                  | The card at the first shot; the API                      |

Database migration in this change: **no**

## 3. How to run the app locally

```bash
npm run db:up
npm run db:deploy
npm run dev            # app on http://localhost:3000
```

Use the **USB camera** on Capture with the printed card and leather under it, as in the scale
marker runs. The model files must be on the laptop.

Automated tests that cover this area:

```powershell
$env:E2E_BASE_URL="http://localhost:3000"
npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts tests/e2e/rolls.spec.ts
```

Run 1 fixes (2026-11-05): **F1** the timer counts a roll's time on the same day, after 17:00 too;
only the night of a roll left open overnight is left out (the handoff said "outside 08:00 to 17:00",
which was wrong). An evening run shows the whole time. **F2** the CSV's minutes always have two
decimals (20:53.9 → 20.90). The two no-card e2e tests wait for the sign-in (they got 401); the
capture API role test has 60 s. The timer reads "--:--", not 00:00, until its clock starts.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role             | Email                      | Home page         |
| ---------------- | -------------------------- | ----------------- |
| Floor Manager    | `manager@cpoint.local`     | `/floor-manager`  |
| Shoe Constructor | `constructor@cpoint.local` | `/camera/capture` |

Data: the demo constructor with camera access, and two rolls in stock on a leather item
(Inventory → the item → Add rolls).

## 5. Test scenarios

| ID  | Role             | Steps                                                                      | Expected result                                                                                                                                                                | Priority |
| --- | ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| S1  | Shoe Constructor | Capture, USB camera; start a roll. Note the clock                          | "Scanning time 00:0N" under the roll, counting up each second                                                                                                                  | High     |
| S2  | Shoe Constructor | Card out of the picture                                                    | "Show the marker card to capture." and "It's needed for the roll's first shot only."; Capture off                                                                              | High     |
| S3  | Shoe Constructor | Card on the leather; press Capture                                         | Shot #1 saves; then "Scale set at the first shot: N in across. The card can come off the leather." with Read the card again                                                    | High     |
| S4  | Shoe Constructor | Take the card away; press Capture 3 times, then Space once                 | All 4 save (5 shots); Capture stays on without the card                                                                                                                        | High     |
| S5  | Shoe Constructor | Reload the page                                                            | The same roll, the scale line still shows (no card needed), the timer continues from the same time (not 00:00)                                                                 | High     |
| S6  | Shoe Constructor | Put the card in view, press Capture                                        | "Marker card found. …" while in view; the shot saves (6 shots)                                                                                                                 | Medium   |
| S7  | Shoe Constructor | Card away; press **Read the card again**                                   | "Show the marker card to capture."; Capture off. Card back: Capture on, the shot saves, the scale line returns                                                                 | High     |
| S8  | Shoe Constructor | Floor view: card away, press Space                                         | The shot saves and the band shows its verdict (no "Show the marker card"). Esc                                                                                                 | Medium   |
| S9  | Shoe Constructor | Press **Finish roll**, confirm. Note the clock                             | The message ends "Scanning time: mm:ss." about equal to the clock difference since S1 (write both)                                                                             | High     |
| S10 | Floor Manager    | Reports → Rolls; find the roll                                             | Scanning time column with S9's time; "Average scanning time: … over N rolls (…lunch left out)" above the table                                                                 | High     |
| S11 | Floor Manager    | Open the roll; open Shot #2's page and Shot #1's page                      | Roll: "Scanning time mm:ss (lunch left out)". Shot #2: "Measured with the roll's marker card from Shot #1: N in across". Shot #1: "Measured with the marker card: N in across" | High     |
| S12 | Floor Manager    | Reports → Rolls → **Download CSV**                                         | A CSV with "Scanning time" and "Scanning time (min)"; the roll's minutes match S9 (e.g. 12:34 → 12.57)                                                                         | Medium   |
| S13 | Shoe Constructor | Start the second roll; no card; look at Capture                            | Capture is off and asks for the card (each roll's first shot needs it). Put the roll back (Put roll back) at the end                                                           | Medium   |
| S14 | Shoe Constructor | Only if the run is between 11:00 and 12:00 Manila: an open roll on Capture | " · Paused for lunch" beside the time, which doesn't count up. Otherwise write "not in lunch" and skip                                                                         | Low      |
| S15 | Shoe Constructor | At 390 × 844 (phone size), roll open with the scale set                    | The scale line, the button and the timer fit; no sideways scroll; axe 0 on Capture                                                                                             | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                   | Expected |
| --- | ------------------------------ | ------------------------------- | -------- |
| A1  | Shoe Constructor, QI, Admin    | `GET /api/v1/reports/rolls.csv` | `403`    |
| A2  | Signed out                     | `GET /api/v1/reports/rolls.csv` | `401`    |

## 6. Out of scope / known issues

- The manual check's time is compared by Dylan outside the system; there's nothing to enter.
- A roll left open overnight counts from 08:00 the next day (A-49); its time up to 17:00 the day
  before counts.
- Old rolls show their times too, from the start and finish times already saved; rolls from before
  Phase 30A that had no start time show "—".
- The simulator sends no card and has no scale, as before.
