# QA handoff: the scale marker card replaces the tap calibration

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Date            | 2026-11-04                                                              |
| Feature         | scale-marker                                                            |
| Branch          | `main` at 5104e29 plus uncommitted scale marker changes (laptop)        |
| Spec / prompt   | `docs/prompts/plans/scale-marker-plan.md`, D-120 in `docs/DECISIONS.md` |
| Written by      | Claude                                                                  |
| Previous report | `qa/reports/2026-11-04-phase-30d-run2.md` (PASS)                        |

## 1. What changed

- **Shoe Constructor, Capture:** "Set up this phone" and its tap-the-corners dialog are gone.
  Capture now reads a printed **marker card** (ArUco 4x4_50 id 0, a 2.00 in black square) in the
  live picture about four times a second. Under the picture:
  - card seen: "Marker card found. This shot will be measured (19.2 in across)." (a ruler icon);
  - no card: a caution box "Show the marker card to capture." with "Lay the printed marker card
    flat on the leather, fully in the picture. **Print the marker card** at 100% if you don't
    have one." (the link opens `/cpoint-scale-marker-2in.pdf`);
  - a card too small: "The marker card is too small in the picture. Bring the phone closer."; tilted:
    "Hold the phone flat above the leather so the marker card looks square."
- The **Capture** button is disabled while no card is seen, and the hint under it says the same
  message. **Space** (also in Floor view) sends nothing without the card and shows the message.
  At the press the full frame is read again; if the card left the picture, nothing is sent.
- **Floor view:** before the first shot, with no card, the band reads "Capture is off." and "Show
  the marker card to capture."
- **Every shot sends the card's corners**; the server works out the scale from them and saves it
  with the shot (`widthIn`, as before) and the corners in the scan's rule snapshot. A defect box
  whose centre is on the card (the black square, its white border and caption) is ignored: it isn't
  stored and doesn't change the verdict or the roll's defect %. The leather under the card isn't
  checked on that shot.
- **Floor Manager, a scan's page** (`/scans/[id]`, from a roll): the rules line reads "Measured with
  the marker card: 19.2 in across" (or "Scale: 20 in across" for older calibrated shots, "No scale:
  nothing measured").
- **Finish roll** for a roll with shots taken before the card: "… Some of its shots were taken before
  the marker card, so it couldn't be checked for defects." (was "Set up this phone next time …").
- **API:** `POST /api/v1/scans/capture` needs `markerCorners` (JSON) and no longer takes `widthIn`;
  without it `422` "markerCorners is required: show the marker card to capture, …". Cards that
  can't give a scale: `422 MARKER_UNREADABLE`. The device-token `POST /api/v1/scans` (simulator)
  keeps `widthIn` optional and accepts `markerCorners`.
- New dependency `js-aruco2@2.0.0` (MIT): run `npm install` first.

## 2. Files touched

| File                                                                | Change                                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/lib/scale-marker.ts`                                           | New: the card's maths (scale, tilt, size, card outline, box on card)  |
| `src/lib/marker-detect.ts`, `src/types/js-aruco2.d.ts`              | New: reads id 0 off a picture with js-aruco2                          |
| `src/app/(app)/camera/capture/capture-client.tsx`                   | Live card check, button and Space gated, corners sent                 |
| `src/app/(app)/camera/capture/calibration.tsx`                      | Deleted (the tap calibration)                                         |
| `src/server/validators/scan.validator.ts`                           | `markerCorners`; required on capture; no `widthIn` on capture         |
| `src/server/services/scan-ingest.service.ts`, `capture.service.ts`  | Scale from the card, boxes on the card dropped, 422 MARKER_UNREADABLE |
| `src/server/controllers/scan.controller.ts`                         | Reads `markerCorners`                                                 |
| `src/lib/measure.ts`, `decision-engine.ts`, `roll-rules.ts`         | Sheet calibration removed; snapshot keeps the corners; Finish wording |
| `src/app/(app)/scans/[id]/page.tsx`, `camera/capture/last-scan.tsx` | Wording                                                               |
| `public/cpoint-scale-marker-2in.pdf`                                | The printable card ("Lay it flat on the leather")                     |
| `tests/e2e/capture.spec.ts`, `tests/e2e/cv-helpers.ts`              | Fake camera video with the card; no-card checks; API 422              |
| `tests/e2e/fixtures/marker-card.y4m`                                | New: a 640 × 360 still of leather with the card (16 in across)        |
| `tests/unit/*` (scale-marker, scan-ingest, capture, validators, …)  | Updated and new tests; fixtures in `tests/fixtures/marker/`           |
| `docs/STATION_SETUP.md`, `docs/API.md`                              | The card; the API fields                                              |

Database migration in this change: **no**

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `.env` filled in. **Run `npm install`
first** (new package `js-aruco2`).

```bash
npm install
npm run db:up
npm run db:deploy
npm run dev            # app on http://localhost:3000
```

Extra steps for this change:

- Print `http://localhost:3000/cpoint-scale-marker-2in.pdf` at 100% (or use the copy Dylan printed)
  and check the black square is 2.00 in with a ruler. Keep a piece of leather (or a brown sheet)
  under the USB camera.
- Use the **USB camera** as the Camera on Capture (as in Phase 30D run 2). Close any other app
  holding the camera first.
- The model files (`cv/models/yolo-v1.onnx` and `.json`) must be on the laptop for S3 to S6.

Existing automated tests that cover this area:

```powershell
$env:E2E_BASE_URL="http://localhost:3000"
npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts tests/e2e/returns.spec.ts tests/e2e/cv.spec.ts
```

Run 1 fixes (2026-11-04): **F1** Capture read the card on the full frame at the press, where the
detector missed a card the live check had found; both now read the same 960 px copy. **F2** the
no-card test moved to its own file, `tests/e2e/capture-no-card.spec.ts` (Playwright can't change
launch options inside a file).

Run 2 fix (2026-11-04): **F1** the button still missed the card that the preview showed, because
the detector reads the card on some frames only and the press read one. A press now tries up to 8
frames (about half a second) and sends the first with the card; every frame is read at 960 and then
640 px. Expect Capture to take up to half a second longer when the card is hard to read.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role             | Email                      | Home page         |
| ---------------- | -------------------------- | ----------------- |
| Floor Manager    | `manager@cpoint.local`     | `/floor-manager`  |
| System Admin     | `admin@cpoint.local`       | `/admin`          |
| Shoe Constructor | `constructor@cpoint.local` | `/camera/capture` |

Data this test needs: the demo constructor with camera access (System Admin → Users → More
actions → Give camera access), and a roll in stock on a leather item (Inventory → the item → Add
rolls, area e.g. 24.5 sq ft) to start at Capture.

## 5. Test scenarios

| ID  | Role             | Steps                                                                                                                                  | Expected result                                                                                                                                                                                                            | Priority |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Shoe Constructor | Sign in; on Capture pick the USB camera; start a roll. Keep the card out of the picture                                                | Caution box "Show the marker card to capture." with the **Print the marker card** link; the Capture button is disabled; the hint under it reads the same message                                                           | High     |
| S2  | Shoe Constructor | Click **Print the marker card**                                                                                                        | The PDF opens: two cards, the line "Lay it flat on the leather, fully in the picture for every shot. Defects under the card aren't checked."                                                                               | Medium   |
| S3  | Shoe Constructor | Lay the printed card flat on the leather under the camera, fully in view                                                               | Within about a second: "Marker card found. This shot will be measured (N in across)." and Capture turns on                                                                                                                 | High     |
| S4  | Shoe Constructor | Press **Capture**                                                                                                                      | Last scan shows Shot #1 with a verdict; no "Set up this phone" anywhere on the page                                                                                                                                        | High     |
| S5  | Floor Manager    | Reports → Rolls → that roll → its shot's page                                                                                          | The rules line reads "Measured with the marker card: N in across", N close to S3's number; no defect box drawn on the card                                                                                                 | High     |
| S6  | Shoe Constructor | Measure the real width the camera sees across the leather with a ruler (or a tape at the table) and compare with N from S3             | Within about 5% of the ruler (write both numbers in the report)                                                                                                                                                            | Medium   |
| S7  | Shoe Constructor | Take the card away; press **Space**                                                                                                    | Nothing is sent (the roll's shot count stays); the message "Show the marker card to capture." shows                                                                                                                        | High     |
| S8  | Shoe Constructor | Raise one edge of the card a little (about 20°), then steeply (about 45°)                                                              | A little: still found, or "Hold the phone flat above the leather so the marker card looks square." Steeply: the card isn't read at all, so "Show the marker card to capture." Either way Capture is off once it isn't read | Medium   |
| S9  | Shoe Constructor | Card back in view; **Floor view**; press Space                                                                                         | The band shows the shot's verdict. Then take the card away and press Space: the band shows "Show the marker card to capture."                                                                                              | Medium   |
| S10 | Shoe Constructor | Leave Floor view (Esc); press **Finish roll** and confirm                                                                              | The roll finishes with its defect % (or "0% of it has defects."), not "couldn't be checked"                                                                                                                                | High     |
| S11 | any signed in    | With the browser's dev tools or Playwright's request: `POST /api/v1/scans/capture` as the constructor with an image and captureId only | `422`, message starts "markerCorners is required: show the marker card to capture" (the e2e test covers this too)                                                                                                          | Medium   |
| S12 | Shoe Constructor | At 390 × 844 (phone size) with the card in view                                                                                        | The marker line and the Capture button fit; no sideways scroll; axe 0 violations on Capture                                                                                                                                | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                  | Expected                 |
| --- | ------------------------------ | ------------------------------ | ------------------------ |
| A1  | Signed out                     | `/cpoint-scale-marker-2in.pdf` | Redirect to `/login`     |
| A2  | Floor Manager, QI, Admin       | `/camera/capture`              | `/forbidden` (unchanged) |

## 6. Out of scope / known issues

- The `cv/` toolkit keeps its own sheet calibration (`python -m cpoint_cv calibrate`); not part
  of this change.
- The server trusts the browser's reading of the card (as it trusted the phone's calibration
  before); it doesn't look for the card in the photo itself.
- Shots and rolls from before this change keep the scale they were saved with; rolls with shots
  from an uncalibrated phone still read Not measured (A-42, A-48).
- The simulator (`npm run cv:simulate`) sends no card, so its shots stay unmeasured.
