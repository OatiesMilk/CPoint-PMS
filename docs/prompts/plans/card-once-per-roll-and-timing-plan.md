# Plan: the marker card once per roll, and a scanning timer per roll (D-121)

Status: **approved** (Dylan, 2026-11-05, "go"); built on main 1793138. Builds on the scale marker (D-120).

## What Dylan decided (2026-11-05)

- Every camera at the factory, phone or webcam, sits at a fixed position. So the card is read
  **once per roll**: at the roll's first shot. Later shots of that roll use the same scale and
  need no card.
- CPoint wants to know how long scanning one roll takes, to compare with the manual check
  (timed by hand, outside the system). Show **minutes per roll** only: no manual entry, no
  minutes per sq ft.

## 1. The card once per roll

- **Capture, first shot of a roll:** as now. Capture and Space stay off until the card is seen
  ("Show the marker card to capture."); the shot sends its corners and saves its scale.
- **Later shots of the same roll:** Capture is on without the card. The line under the picture
  reads "Scale set at the first shot: 16.8 in across. The card can come off the leather." The
  shot sends no corners; the server uses the roll's scale.
- **The roll's scale** is the latest marked shot of that roll of the same picture size (its `widthIn` and frame size). No
  migration: it's read from the roll's scans. A shot whose frame size differs (another camera or
  resolution) needs the card again: "This camera's picture is a different size from the roll's first shot. Show the marker card
  once to set its scale."
- **The card still in view on a later shot:** it is read and used for that shot (and boxes on it
  are ignored), so leaving it there does no harm.
- **Read the card again** (a small button beside the scale line): for when the camera was
  moved; the next shot needs the card and its scale becomes the roll's from then on.
- **API:** `POST /api/v1/scans/capture` takes `markerCorners` optional: without it, the roll
  must already have a marked shot of the same frame size, else `422 MARKER_REQUIRED` ("markerCorners is required
  for this shot: …"), before the model runs. The scan's rule snapshot records `scaleFromShot`
  and the scan page reads "Measured with the marker card" or "Measured with the roll's marker card
  from Shot #1".

## 2. A scanning timer per roll

- **Capture** (Dylan, 2026-11-05): a running timer beside the roll, from the tap on **Start
  scanning** to the tap on **Finish roll**: "Scanning time 08:42" (mm:ss, h:mm:ss past an hour).
  It shows "Paused for lunch" during the day's lunch break and doesn't count it. **Finish roll**
  confirms the total: "Scanning time: 12:34."
- The timer is worked out from the saved start time, so a reload or another phone shows the same
  time. Stored as the roll's start and finish (already saved); nothing new to enter.

- **Reports → Rolls** (FM): a **Scanning time** column (h:mm:ss), working time from Start scanning to
  Finish roll, lunch left out ("12:34"; "—" while being scanned or never started). A line above the table: "Average
  scanning time: 14:05 over 23 rolls" for the rolls the filters show.
- The roll's page shows it beside Started and Finished. `GET /api/v1/reports/rolls.csv` (new, with a Download CSV button) has "Scanning time (min)", in minutes with two decimals for the paper.
- Old rolls show their times too (the start and finish times are already saved).
- Averages only; no constructor named (no rankings).

## Assumptions (to confirm)

- Decided (Dylan, 2026-11-05): lunch doesn't count. The time is the **working time** from Start
  scanning to Finish roll: the day's lunch break (Settings → Lunch break, as in force that day) is
  left out, the same way the batches leave it out.
- A-49: a roll left open overnight doesn't count the night (from 17:00, or its start if later,
  to 08:00 the next day); time on the same day counts, even after 17:00. Cancelled and put-back rolls have no time.
- A-50: a roll's scale comes from its first marked shot; a later card reading replaces it for
  the shots after it.
- A-51: different frame sizes on one roll need their own card reading.

## Tests and QA

- Unit: the roll's scale lookup (same size, other size, re-read), the validator (corners
  optional on capture), the minutes and the average, the CSV column.
- E2E: `capture.spec.ts` (second shot without the card), `rolls.spec.ts` (Scanning time, the
  average, the CSV). Codex runs them with the USB camera: first shot with the card, four without.
