# Plan: the scale marker replaces the tap calibration (D-120)

Status: **agreed** (Dylan, 2026-11-04: "go", the card lies on the leather); built the same day. Roadmap line: "Scale marker" in `docs/ROADMAP.md`.

## What Dylan chose

- A printed ArUco marker, DICT_4X4_50 id 0, a 2.00 in black square
  (`calibration/cpoint-scale-marker-2in.pdf` in the project files, two cards a page).
- Capture reads it in the browser on every shot. No marker in view: no shot ("Show the marker card
  to capture").
- Tap calibration removed entirely, no fallback. Old shots keep their saved scale (`widthIn`).
- Codex tests with the USB camera.

## Checked before planning

`js-aruco2` 2.0.0 (MIT, pure JS, no WASM) read the PDF rendered at 100 dpi: id 0, sides 199 px
(= 2.00 in), and again with the page turned 17°. Its `ARUCO_4X4_1000` dictionary comes from
OpenCV's and DICT_4X4_50 is its first 50 codes, so id 0 is the same marker.

## Approach

1. **`src/lib/scale-marker.ts`** (new, pure, client-safe): `findMarkers(imageData)` wraps
   js-aruco2 and keeps id 0 only; `pxPerInFromMarker(corners)` uses the 2.00 in side (the
   existing `pxPerInFromCorners` maths, generalised to a square). A marker is refused when too
   small (side under 24 px), not square (sides differ more than 15%, the phone is tilted), or the
   result is outside 4 to 120 in across (the existing bounds). Two markers in view: the average.
2. **Capture (`capture-client.tsx`)**: the preview is read about 4 times a second on a scaled-down
   copy. Under the picture: "Marker card found" (green) or "Show the marker card to capture"
   (caution). Capture and Space (Floor view too) are disabled while no marker is seen. At the
   press the full-size frame is read again and the card's corners are sent with the shot (as
   built: the server works out `widthIn` from them, so the scale has one source). If the marker left the picture in between: no send, "Show the marker card to capture".
3. **Removed:** `calibration.tsx`, "Set up this phone" and its dialog, the saved calibration in
   the browser (the old key is ignored), `SHEET_SIZES`; their unit tests.
4. **Server:** `POST /api/v1/scans/capture` requires `markerCorners` (a named `422`:
   "markerCorners is required: show the marker card to capture, …") and takes no `widthIn`; cards
   that can't give a scale are `422 MARKER_UNREADABLE`. The device-token API (simulator) keeps it optional, so simulator
   shots stay unmeasured. No migration: `scans.widthIn` already holds the scale.
   4b. **The card on the leather:** the corners are in fractions of the photo. Ingest drops detections whose box centre lies inside the card before the verdict and
   the measuring, and keeps the corners in the snapshot.
5. **Wording:** Capture's line says "This shot will be measured (N in across)"; a scan's page
   reads "Measured with the marker card: N in across" (the Last scan card has no picture, so the
   card isn't outlined there).
6. **E2E:** Chromium's fake camera has no marker, so the capture specs that press Capture get a
   fake video with the marker (`tests/e2e/fixtures/marker.y4m`,
   `--use-file-for-fake-video-capture`); one spec keeps the plain pattern to see the disabled
   button and the message. Codex runs them; Claude runs `npm run check` only.
7. **Docs:** `docs/STATION_SETUP.md` (print the card, lay it flat on the leather), `docs/API.md`,
   STATUS, SESSION_LOG, DECISIONS (D-120), ROADMAP; handoff and `qa/CODEX_PROMPT_SCALE_MARKER.md`
   (USB camera, the printed card).

## Assumptions to log

- Decided (Dylan, 2026-11-04): the card lies flat on top of the leather.
- A-46: a defect box whose centre is on the card is ignored (the card isn't leather, and what it
  covers can't be seen); the card's corners are sent with the shot as `markerCorners` and saved
  in the scan's snapshot.
- A-47: the leather under the card isn't checked on that shot; the constructor moves the card
  between shots if a spot matters.
- A-48: A-42 now applies only to old rolls and simulator shots; every new Capture shot is measured.

## Out of scope

- `cv/` toolkit (`calibration.py` keeps its sheet calibration for station photos).
- The System Admin thread (D-119) touches `/camera` (not `/camera/capture`) and permissions; no
  shared code files, only the wrap-up docs.

## New dependency

`js-aruco2@2.0.0` in `package.json` (Dylan runs `npm install` after pulling).
