# QA handoff: Phase 17 camera station window

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Date            | 2026-10-19                                                              |
| Feature         | phase-17-camera-window                                                  |
| Branch          | `main` @ `dac8599`, uncommitted (Dylan branches and commits)            |
| Spec / prompt   | `camera-station-window.md` (Phase 17), plan `phase-17-plan.md`          |
| Written by      | Claude                                                                  |
| Previous report | `qa/reports/2026-10-19-phase-16-camera-page-run2.md` (PASS WITH ISSUES) |

## 1. What changed

- The camera station now has a **desktop window**, "CPoint Camera", for factory staff. It opens
  from a desktop shortcut or `cv/CPoint Camera.cmd`, with no terminal.
- **Check this machine** lists every check (config, model file, Python, packages, **GPU**, camera,
  app, device token, clock) as ✓ pass, ! warning or ✕ fail, each with its fix. A failure keeps
  **Start** off; warnings never do.
- **Camera picker:** cameras that give a picture by number and size, **Find cameras**, a
  **Network camera (address)** entry (DroidCam: `http://<iPhone IP>:4747/video`), and a **Driver**
  choice (Default or DirectShow). The choice is remembered in `cv/station-window.json`; an address
  with a password is never saved.
- **Start** shows the live camera picture with the model's boxes under a banner: "Preview. Nothing
  is sent until you press Capture. The app decides the result." The preview never shows a verdict.
- **Capture** (or Space) sends one scan (the frame on screen) through the station's existing spool
  and `captureId` path. **Last scan** shows the app's verdict in its colour and the section number.
  **Stop** frees the camera.
- No batch at Preparation keeps Capture off with the app's message. A refused token stops the
  station with the fix. Unsent captures show as "N waiting to send". A dropped camera reconnects
  for 30 s, then stops.
- `doctor` now has a GPU line and prints `warn` lines that don't fail it.
- Camera page (FM, QI, Admin): the "Connect the camera station" steps now say to open CPoint Camera
  and use Check this machine, Start and Capture.

## 2. Files touched

| File                                               | Change                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `cv/cpoint_cv/window/` (7 modules)                 | New: presenter, checks, cameras, settings, workers, view (Tk), app |
| `cv/cpoint_cv/events.py`                           | New: station events as data                                        |
| `cv/cpoint_cv/shortcut.py`, `cv/CPoint Camera.cmd` | New: desktop shortcut and launcher                                 |
| `cv/cpoint_cv/station.py`                          | Events, Stop while waiting, a frame's own capture time             |
| `cv/cpoint_cv/doctor.py`                           | Pass/warn/fail, GPU check, clock and version warnings              |
| `cv/cpoint_cv/sources.py`, `triggers.py`           | DirectShow (`[camera] backend`), `ButtonTrigger`                   |
| `cv/cpoint_cv/yolo_detector.py`, `overlay.py`      | Preview at another size with a lock; shared box drawing            |
| `cv/cpoint_cv/config.py`, `cli.py`                 | `[camera] backend`, `[window]`; `window` and `shortcut` commands   |
| `cv/config.example.toml`, `cv/requirements.txt`    | New settings; `pillow==12.3.0` pinned                              |
| `cv/tests/` (5 new files, 2 updated)               | 67 new tests                                                       |
| `src/app/(app)/camera/page.tsx`                    | "Connect the camera station" copy                                  |
| `.gitignore`, `.gitattributes`                     | `/cv/station-window.json`; `*.cmd` with CRLF                       |
| `cv/README.md`, `docs/*`                           | Docs                                                               |

Database migration in this change: **no**

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # apply migrations
npm run dev            # app on http://localhost:3000
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change:

- The station runs on Dylan's laptop (RTX 3060) from `cv/` with `cv/.venv` (Python 3.13), the model
  at `cv/models/yolo-v1.pt` and `CV_DEVICE_TOKEN` in `cv/.env`. If port 3000 is taken, run the app
  with `PORT=3001` and set `CV_BASE_URL=http://localhost:3001` in `cv/.env`.
- In PowerShell, use `npm.cmd` for npm commands with `--` flags.
- Make the shortcut once: `cd cv` then `.venv\Scripts\python -m cpoint_cv shortcut`. It prints
  where it put "CPoint Camera.lnk" (the Desktop, or OneDrive's Desktop).
- **iPhone through DroidCam:**
  1. Install DroidCam on the iPhone (App Store) and the DroidCam client for Windows on the laptop
     (dev47apps.com). Put both on the same Wi-Fi.
  2. Open DroidCam on the iPhone and note the Wi-Fi IP and port it shows (for example
     `192.168.1.23`, `4747`).
  3. **By number:** open the DroidCam Windows client, enter the IP, Connect, then **close the
     client's preview window** (only one app can hold the camera). The phone is now a numbered
     camera, usually the highest.
  4. **By address:** disconnect the Windows client; the window opens
     `http://192.168.1.23:4747/video` itself.
- Leave Windows' Camera app, Teams and Zoom closed so they don't hold the webcam.
- Note `cv/station-window.json` and `cv/out/spool/` before you start; restore or delete the json at
  the end if you want the next run to start from `config.toml`.

Existing automated tests that cover this area (run these too):

```bash
cd cv
.venv/Scripts/python -m pytest
cd ..
npm run build && npx playwright test tests/e2e/cv.spec.ts tests/e2e/admin.spec.ts
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs:

- One batch **in progress at Preparation** (FM: Batches → New → Start), for the capture scenarios.
  For W-NB, have none at Preparation first (advance or complete the others), then start one.
- Defect types set up for yolo-v1 (`npm run demo:reset` did it; see `cv/README.md`).
- A leather section or a printed photo of leather to hold under the camera.

## 5. Test scenarios

Run the window from the shortcut unless a step says otherwise. "The window" = CPoint Camera.
Take a screenshot of the window for each High scenario.

### Launch

| ID  | Role       | Steps                                                                                | Expected result                                                                                                                                            | Priority |
| --- | ---------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| L1  | Station PC | Double-click **CPoint Camera** on the desktop.                                       | The window opens; no console window stays open. Title "CPoint Camera". The checks panel says to press Check this machine; Start, Capture and Stop are off. | High     |
| L2  | Station PC | Rename `cv\.venv` to `cv\.venv-off`, double-click the shortcut, then rename it back. | A message box "CPoint Camera" says cv\.venv was not found and names "Set up the station" in cv\README.md. No window opens.                                 | High     |
| L3  | Station PC | In `cv/`, run `.venv\Scripts\python -m cpoint_cv shortcut` a second time.            | It prints "Made the shortcut: …\CPoint Camera.lnk"; the shortcut still works (overwritten, not duplicated).                                                | Low      |
| L4  | Station PC | Windows display scale at 125 % or 150 % (Settings → Display), open the window.       | Text is sharp and readable (not blurry), nothing is cut off at the window's minimum size (980 × 640).                                                      | Medium   |

### Check this machine

| ID  | Role       | Steps                                                                                                                                                             | Expected result                                                                                                                                                                                                                                                                                                                                                                            | Priority |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| C1  | Station PC | App running, a batch at Preparation, laptop webcam chosen. Press **Check this machine**.                                                                          | While checking, the buttons are off and the panel says it's checking. Then every line shows ✓: Config, Model file, Python, each package, **GPU** "NVIDIA GeForce RTX 3060 Laptop GPU, CUDA 12.4 (torch …)", Camera "Camera 0 (default driver) gives a picture", App, Device token naming the batch, Clock. Start turns on; the window stays responsive during the check (it can be moved). | High     |
| C2  | Station PC | Close the window. In `cv/` run `set CUDA_VISIBLE_DEVICES=-1` then `.venv\Scripts\python -m cpoint_cv window` (cmd.exe). Press Check this machine.                 | GPU line is **!** (orange) saying no NVIDIA GPU is usable and the window runs on the CPU instead, about 3 times slower. Start is **on**. After Start, the first message says "Loading the model on the CPU".                                                                                                                                                                               | High     |
| C3  | Station PC | Stop the app (`npm run dev` Ctrl+C). Press Check this machine.                                                                                                    | App line ✕ says it can't reach the address and to start the app (npm run dev, or docker compose up -d). A red bar says how many checks failed and that Start stays off. Start is off.                                                                                                                                                                                                      | High     |
| C4  | Station PC | App running, no batch at Preparation. Check.                                                                                                                      | Device token line is **!** "accepted; no batch is at Preparation yet. Start one on the Batches page before capturing." Start is on.                                                                                                                                                                                                                                                        | Medium   |
| C5  | Station PC | Temporarily blank `CV_DEVICE_TOKEN` in `cv/.env`, Check, then restore it.                                                                                         | Device token ✕ says CV_DEVICE_TOKEN isn't set and how to get one. Start off.                                                                                                                                                                                                                                                                                                               | Medium   |
| C6  | Station PC | Pick a camera number that doesn't exist (if the list allows only real ones, type an address `http://192.168.1.250:4747/video` that has nothing behind it), Check. | Camera ✕ says it couldn't be opened and what to check. Start off.                                                                                                                                                                                                                                                                                                                          | Medium   |
| C7  | Station PC | After C1, pick another camera.                                                                                                                                    | A blue bar says you chose another camera and to press Check this machine; Start turns off until checked again.                                                                                                                                                                                                                                                                             | Medium   |
| C8  | Station PC | Run `.venv\Scripts\python -m cpoint_cv doctor` in `cv/`.                                                                                                          | Same lines as C1 plus the GPU line; any warning prints as `warn`; exit code 0 when nothing fails.                                                                                                                                                                                                                                                                                          | Medium   |

### Camera picker and DroidCam

| ID  | Role       | Steps                                                                                                                                                    | Expected result                                                                                                                                                                                                                | Priority |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| K1  | Station PC | Open the window with the DroidCam Windows client connected (preview closed). Look at the Camera list; press **Find cameras**.                            | The list shows each camera that gives a picture as "Camera N (W x H)", the webcam and the iPhone among them, plus "Network camera (address)". Messages lists the cameras found.                                                | High     |
| K2  | Station PC | Pick the iPhone's number, Driver **Default**, Check, Start. If no picture (camera ✕), switch Driver to **DirectShow**, Check, Start.                     | The iPhone picture shows in one of the two drivers. Note which one worked in the report.                                                                                                                                       | High     |
| K3  | Station PC | Disconnect the DroidCam client. Pick **Network camera (address)**, type `http://<iPhone IP>:4747/video`, press Enter, Check, Start.                      | Camera ✓ "IP camera http://…:4747/video gives a picture"; the live picture shows.                                                                                                                                              | High     |
| K4  | Station PC | Type `192.168.1.23:4747/video` (no http://) and press Enter.                                                                                             | A red bar says the address must start with http://, https:// or rtsp:// and shows the DroidCam form. The choice doesn't change.                                                                                                | Medium   |
| K5  | Station PC | Type `rtsp://admin:secret@192.168.1.50/s1`, press Enter. Open `cv\station-window.json`. Look at Messages and the address box after reopening the window. | An orange bar says the address holds a password, so it isn't saved, and to put it in `cv/.env` as CPOINT_CV_CAMERA_URL. The json has **no** `admin` or `secret`. Nowhere in the window or `cv/out/logs/` does `secret` appear. | High     |
| K6  | Station PC | Pick Camera 1, close and reopen the window.                                                                                                              | The window opens with Camera 1 and the same driver chosen.                                                                                                                                                                     | Low      |

### Run, preview, capture and stop

| ID  | Role            | Steps                                                                                           | Expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Priority |
| --- | --------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | Station PC + FM | Batch at Preparation. Check, then **Start**.                                                    | Messages show the model loading then the camera opening; the top line reads "Next scan goes to B-… · roll … · …". The live picture shows under the grey banner "Preview. Nothing is sent until you press Capture. The app decides the result." Under it, "Preview: N boxes at 960 px, … ms. Captures run at full size." Boxes are labelled "class 0.87", in plain colours. **No verdict** appears over the preview. Capture and Stop on; Start, Check and the picker off. | High     |
| R2  | Station PC      | While running for 1 minute without capturing, look at `cv/out/spool/` and the Camera page (FM). | Nothing is added to the spool and no scan appears in the app: the preview sends nothing. The Camera page reads **Station connected**.                                                                                                                                                                                                                                                                                                                                     | High     |
| R3  | Station PC + FM | Hold a leather section under the camera, press **Capture**.                                     | Capture turns off briefly ("Capturing and sending…"), then **Last scan** shows the app's verdict with its icon and colour (Pass green, Rework orange, Reject red, Needs review blue), "B-… · section N" and "The model found …. Verdict from the app." The Camera page (FM) shows **Camera station active** and this capture; its scan page shows source, `yolo-v1-…` and the same verdict.                                                                               | High     |
| R4  | Station PC      | Press **Space** (focus not in the address box). Then press Space rapidly 3 times.               | Each press while Capture is on makes exactly one scan; presses while it's capturing are ignored (section numbers go up by one per accepted press, no duplicates in the app).                                                                                                                                                                                                                                                                                              | High     |
| R5  | Station PC + FM | Capture, then compare the scan's captured time (scan page) with the clock at the press.         | Captured time is the moment of the press (within a second), not later.                                                                                                                                                                                                                                                                                                                                                                                                    | Medium   |
| R6  | Station PC      | Press **Stop**, then open Windows' Camera app.                                                  | The window says "Stopped. The camera is free."; the preview clears. The Camera app can open the same camera.                                                                                                                                                                                                                                                                                                                                                              | High     |
| R7  | Station PC      | Start, then close the window with the X while running.                                          | The window says Stopping, then closes within a few seconds; the camera is released (Camera app opens it).                                                                                                                                                                                                                                                                                                                                                                 | Medium   |

### Problems while running

| ID  | Role               | Steps                                                                                                                                      | Expected result                                                                                                                                                                                                                                                           | Priority |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| P1  | Station PC + FM    | With no batch at Preparation, Check and Start. Then, as FM, start a batch.                                                                 | The top line says no batch; an orange bar shows the app's message; Capture stays **off** ("Waiting for a batch at Preparation…"). Within about 5 s of starting the batch, the top line names it and Capture turns on.                                                     | High     |
| P2  | Station PC + FM    | Running with a batch; as FM, advance that batch past Preparation (or start a second one) and wait 20 s.                                    | The window says the batch changed / names the new batch, or shows the no-batch message with Capture off.                                                                                                                                                                  | Medium   |
| P3  | Station PC         | Running. Stop the app (`npm run dev` Ctrl+C), press Capture, wait for the retries, then start the app again and press Capture once more.   | First capture: an orange bar says it couldn't send after the tries and it's saved; Last scan area says "1 waiting to send". After the app is back, the next capture sends both in order and the count returns to "Nothing waiting to send". No duplicate scan in the app. | High     |
| P4  | Station PC + Admin | Running. As Admin, revoke the station's token (API tokens), wait up to 20 s or press Capture. Then make a new token and restore `cv/.env`. | The station stops: red bar "The device token was refused. Ask the System Admin for a new one…"; status says to fix it and check again; Start stays off until checked again.                                                                                               | High     |
| P5  | Station PC         | Running on the iPhone by address (K3). Close DroidCam on the iPhone; reopen it within 20 s.                                                | An orange bar says the camera stopped giving a picture and it's reconnecting; Capture is off. When DroidCam is back, the bar clears ("The camera is back.") and Capture turns on.                                                                                         | High     |
| P6  | Station PC         | As P5, but leave DroidCam closed for 40 s.                                                                                                 | After about 30 s the station stops with a red bar saying it didn't come back, what to check, and that saved captures are kept.                                                                                                                                            | Medium   |
| P7  | Station PC         | Unplug a USB webcam while running (or cover P5 with the laptop camera disabled in Device Manager).                                         | Same as P5/P6.                                                                                                                                                                                                                                                            | Low      |

### Regression and app

| ID  | Role          | Steps                                                                                                   | Expected result                                                                                                                                                                                                                                   | Priority |
| --- | ------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| G1  | Station PC    | In `cv/`, run `.venv\Scripts\python -m cpoint_cv run webcam`, press Space once, then Q.                 | Works as before Phase 17: prints the batch, the app's verdict and section; Q stops.                                                                                                                                                               | High     |
| G2  | Station PC    | `.venv\Scripts\python -m cpoint_cv evaluate "<Sample Photos (CAP2)>"` and `predict` on the same folder. | Same results as the Phase 16 run (5 of 5).                                                                                                                                                                                                        | Medium   |
| G3  | FM, QI, Admin | Open `/camera`, scroll to "Connect the camera station".                                                 | Steps: create a token; put it in cv/.env; open CPoint Camera from the desktop (make the shortcut with `python -m cpoint_cv shortcut`); press Check this machine, then Start and Capture; the simulator line. Run axe: 0 WCAG 2.1 A/AA violations. | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                           | Expected                                   |
| --- | ------------------------------ | --------------------------------------- | ------------------------------------------ |
| A1  | Shoe Constructor               | `/camera`                               | Redirect or 403, as before (unchanged).    |
| A2  | Anyone without the token       | The window with `CV_DEVICE_TOKEN` blank | Start stays off (C5); no scan can be sent. |

## 6. Out of scope / known issues

- Claude did not open the window or run any browser or e2e test (project rule). Everything in
  section 5 is first-run.
- Camera names: OpenCV can't read device names without another dependency, so cameras show as
  "Camera N (W x H)". This is by design (D-062).
- The preview runs at most 4 times a second by design (`[window] preview_max_fps`); the camera
  picture itself is smoother than the boxes. Not a fault.
- Controlling the station from the website's Camera page is a possible later phase, not this one.
- DroidCam's own app limits (resolution on the free tier, a watermark) aren't the station's.
