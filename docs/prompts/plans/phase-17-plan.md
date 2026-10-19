# Phase 17 plan: the camera station window

> Plan only. No code is written until Dylan approves. Source brief: `camera-station-window.md`.

## 1. Setup results

- **Git:** `main` @ `dac8599`, which is Phase 16 merged as PR #11, so Phase 17 builds on a clean
  `main`. Only `camera-station-window.md` and `phase-16-plan.md` are untracked (both docs).
- **Newest QA report:** `qa/reports/2026-10-19-phase-16-camera-page-run2.md`, **PASS WITH
  ISSUES**, 4 of 4. Its two notes are test-harness tips (use `npm.cmd` in PowerShell; fix the
  model path in a temporary config copy). Neither is an app fault, so there's nothing to fix first.
- **Environment:** `cv/.venv` has Tk 8.6 and Pillow 12.3 (it comes with ultralytics), and
  `pythonw.exe` is there, so the window needs no new install.

## 2. What I read and what the window reuses

| Piece            | File                                                               | Reused as                                                                                  |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| The station loop | `cv/cpoint_cv/station.py`                                          | Runs unchanged on a worker thread: batch, recheck, capture, spool, send, check-in          |
| Trigger port     | `triggers.py` (`Trigger.wait(idle)`)                               | New `ButtonTrigger`: Capture / Stop buttons instead of Space / Q                           |
| Source port      | `sources.py` (`FrameSource`, `camera_name`, `probe_camera`)        | New `LiveSource` gives the station the newest frame; `camera_name` hides URL passwords     |
| Model            | `yolo_detector.py`                                                 | One loaded model for both preview and capture; a new per-call `imgsz`                      |
| Mapping          | `mapper.py` (`map_with_sources`)                                   | Boxes on the preview are the same mapped boxes a scan would send                           |
| Drawing          | `overlay.py`                                                       | Its box/label drawing moves into a function used by both the overlay files and the preview |
| Sending          | `client.py`, `transport.py`, `spool.py`, `payload.py`, `encode.py` | Untouched. No second send path; retries, spool and `captureId` all apply                   |
| Checks           | `doctor.py`                                                        | Every existing check, plus a new GPU check and a warning level                             |
| Config           | `config.py`, `config.example.toml`                                 | New `[window]` section and `[camera] backend`                                              |
| Tests            | `tests/fakes.py`                                                   | `FakeTransport`, `FakeSource`, `FakeDetector` drive the presenter tests                    |

The app side (`docs/API.md`, `camera.service.ts`, the Camera page) needs **no contract change**.
The window's check-ins are the station's existing ones, so the Camera page shows **Station
connected** and **Camera station active** exactly as today.

## 3. Design

### Modules (all in `cv/cpoint_cv/`)

```
window/                 new package, only loaded by `python -m cpoint_cv window`
  presenter.py          window state and every message, plain Python, no Tk import (unit-tested)
  workers.py            camera reader, preview loop, station runner (threads, no Tk import)
  checks.py             "Check this machine": runs doctor's checks + GPU, sorts them by level
  cameras.py            finds cameras that give a picture (indexes 0-5, chosen backend)
  settings.py           the window's last choices, saved to cv/station-window.json (git-ignored)
  view.py               the Tk window; the only module that imports tkinter
  app.py                wires it together; the `window` command's entry point
```

### Threads, and how they talk to the window

```
camera reader ──newest frame──▶ FrameBox (lock, 1 slot) ◀── preview loop (≤ N per second)
                                      │                         │ model at preview size
                                      │ (Capture)               ▼
station runner (Station.run) ◀── ButtonTrigger ◀── Capture/Stop buttons
        │ say() + events
        ▼
   queue.Queue ──▶ Tk polls it every 50 ms (root.after) ──▶ presenter ──▶ view redraws
```

- Tk is only touched on the main thread. Workers put events on a queue; the window drains it
  every 50 ms. Camera, model and HTTP never run on the UI thread, so the window can't freeze.
- One model, guarded by a lock: preview and capture never run on the GPU at the same time, which
  keeps GPU memory to one model (about 1 GB on the RTX 3060).
- **Station refactor (small):** `Station` gains an optional `events` callback (structured events
  next to the existing `say` text: batch shown, no batch, sent with verdict and section, refused,
  waiting to send, stopped) and a `should_stop` check in its waiting loop so Stop doesn't wait out
  the 5-second batch poll. `run webcam` passes neither and behaves as today.

### Presenter states

`idle → checking → ready` (or `blocked` when a required check fails)
`ready → starting → waiting for batch ⇄ running → capturing → running`
`running → stopping → stopped`; any state → `error` (a refused token, the camera lost for good).

| State             | Start | Capture                           | Stop | Picker |
| ----------------- | ----- | --------------------------------- | ---- | ------ |
| idle / blocked    | off   | off                               | off  | on     |
| ready / stopped   | on    | off                               | off  | on     |
| waiting for batch | off   | **off** (the app's message shows) | on   | off    |
| running           | off   | on                                | on   | off    |
| capturing         | off   | off (one press, one scan, D-050)  | on   | off    |

### Live preview vs. scans (gap 1)

- The preview runs the model on the live feed and draws the boxes with class and confidence.
  Box colours are **neutral** (one per class, never the pass/rework/reject colours), and a fixed
  banner over the picture says: **"Preview. Nothing is sent until you press Capture. The app
  decides the result."**
- The preview never shows a verdict. Only the **Last scan** panel shows one, and only what the
  app answered (section number, verdict in the `DESIGN.md` verdict colours, what was found).

### Speed (gap 2)

- New config `[window] preview_imgsz = 960` and `preview_max_fps = 4`. At 960 the GPU is roughly
  2.5 times faster than at 1536 (about 100 ms), so 4 a second is comfortable; the CPU manages
  about 2 to 3. The loop skips frames rather than queueing them.
- The camera picture itself is drawn at the camera's own rate; the boxes update as fast as the
  preview runs, so the picture never stutters while the model works.
- **The captured scan is always run at the model's full `imgsz` (1536)**, as `run webcam` does.

### Capture = the frame on screen (gap 3)

- The window draws the newest camera frame. Capture takes that same newest frame from the
  FrameBox at the moment of the press, stamps `capturedAt` then, and hands it to
  `Station.capture` through `LiveSource`, so it goes through the spool, `captureId` and retries
  exactly like `run webcam`. (Recommended in question 3.)
- The station's existing recheck still runs first, so a batch change between the screen and the
  press goes to the batch that's current now, and says so.

### Check this machine (gap 4)

Runs on a worker thread; each line shows ✓ pass, ! warning or ✗ fail, with the fix.

| Check                                                | Level when it fails                                                                | What the line tells the operator                                                                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Config file                                          | required                                                                           | which setting is wrong and in which file                                                                                                    |
| Model file + checksum                                | required                                                                           | put the model in `cv/models/`, or fix `[model] path` / `sha256`                                                                             |
| Python 3.13                                          | required                                                                           | install Python 3.13 and recreate `cv/.venv`                                                                                                 |
| Packages missing                                     | required                                                                           | `pip install -r requirements.txt` in `cv/`                                                                                                  |
| Package version differs from the pin                 | warning                                                                            | the same command; it may still work                                                                                                         |
| **GPU** (new): torch sees CUDA, GPU name, CUDA build | warning                                                                            | "No NVIDIA GPU found: the station runs on the CPU, about 3 times slower" or "torch is the CPU build: install the CUDA build (cv/README.md)" |
| Camera gives a picture                               | required                                                                           | the chosen camera, backend and the fix (another app using it, DroidCam not started, wrong address)                                          |
| App reachable and healthy                            | required                                                                           | start the app, or set `CV_BASE_URL`                                                                                                         |
| Device token                                         | required                                                                           | create a token and put it in `cv/.env`                                                                                                      |
| Batch at Preparation                                 | info                                                                               | "Start a batch first"; Start is allowed, Capture waits                                                                                      |
| Clock within 2 minutes                               | warning; **required when more than 5 minutes ahead** (the app refuses those scans) | sync the clock (Settings > Time & language > Sync now)                                                                                      |

- When `[model] device` is `cuda:0` and no GPU is found, the window runs on the CPU and says so
  (warning), instead of failing at Start.
- `doctor` gets the GPU line too, and prints warnings as `warn` (they don't change its exit code).

### Camera choice (gap 5)

- **Camera:** a list of camera numbers that actually gave a frame, with their picture size, e.g.
  "Camera 0 (1280 × 720)", "Camera 1 (1920 × 1080)", found on a worker thread with **Find
  cameras**. OpenCV can't read device names without another dependency, so DroidCam shows as a
  number (usually the highest); the README says so.
- **Network camera:** an address field, e.g. DroidCam's `http://<iPhone IP>:4747/video`.
- **Driver:** Default or DirectShow (`cv2.CAP_DSHOW`, for virtual cameras), saved as the new
  `[camera] backend = "default" | "dshow"` too, so `run webcam` and `doctor` use it.
- **Saved to** `cv/station-window.json` (git-ignored, written by the window only;
  `config.toml` is never edited by the UI). It holds the camera number or address and the driver.
- **Passwords:** an address is always shown and logged through `camera_name`, which strips the
  user name and password (D-057). An address **with** a password is never saved to the JSON file;
  the window says to put it in `cv/.env` as `CPOINT_CV_CAMERA_URL`, which it already reads.

### Camera dropping mid-run

The reader tries to reopen the camera every 2 seconds for 30 seconds ("The camera stopped giving
a picture. Reconnecting..."), with Capture off meanwhile. If it gives up, the station stops with
the fix ("Check DroidCam is open on the iPhone and the PC is on the same Wi-Fi"). Saved captures
are untouched and go out on the next Start.

### Starting without a terminal (gap 6)

- `cv/CPoint Camera.cmd`: checks `cv\.venv\Scripts\pythonw.exe` exists, then starts
  `pythonw -m cpoint_cv window` and exits. If the venv or `cpoint_cv` is missing, it shows a
  Windows message box naming the setup step (e.g. "cv\.venv wasn't found. Follow 'Set up the
  station' in cv/README.md: py -3.13 -m venv .venv, then pip install -r requirements.txt").
- `python -m cpoint_cv shortcut` makes a **CPoint Camera** desktop shortcut to that launcher
  (minimized, so no console flash), using Windows' own shortcut maker through PowerShell. No new
  dependency.
- `pythonw` has no console, so a crash at start is written to `cv/out/logs/window-error.log` and
  shown in a message box instead of disappearing.

### Toolkit and dependencies (gap 7)

- **Tkinter** (standard library, Python Software Foundation licence). Frames go to Tk through
  Pillow's `ImageTk`, already installed with ultralytics (MIT-CMU licence); I'll pin
  `pillow==12.3.0` in `requirements.txt` so it's explicit. No other new dependency.
- The window package is only imported by the `window` command. `run`, `doctor`, `predict`,
  `evaluate`, CI and the existing tests never import Tk.
- High-DPI: the window asks Windows for per-monitor DPI awareness and sizes fonts in points, so
  text stays sharp and readable on the laptop's scaled screen. Body text 11 pt, the verdict 16 pt.

### Errors in the window (gap 8)

Every message `run webcam` prints shows in a **Messages** list (newest on top, the same words):
no batch, the batch changed, can't reach the app (retrying), a scan refused (kept in
`out/failed/`), X waiting to send. Behaviour is the same: a refused token stops the station and
shows the fix in a red bar; no batch keeps Capture off; unsent captures show as "N waiting to
send" under Last scan.

## 4. Files

| Area                            | Files                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Station core                    | `station.py` (events, `should_stop`), `yolo_detector.py` (per-call `imgsz`, detect an in-memory frame), `overlay.py` (shared drawing), `sources.py` (backend, `LiveSource`), `triggers.py` (`ButtonTrigger`), `doctor.py` (GPU check, warning level), `config.py` + `config.example.toml` (`[window]`, `[camera] backend`), `cli.py` (`window`, `shortcut`) |
| Window                          | `window/` package (7 modules above)                                                                                                                                                                                                                                                                                                                         |
| Launcher                        | `cv/CPoint Camera.cmd`, `cv/cpoint_cv/shortcut.py`                                                                                                                                                                                                                                                                                                          |
| Config / ignore                 | `.gitignore` (`/cv/station-window.json`), `requirements.txt` (Pillow pin), `pyproject.toml` (version 0.17.0)                                                                                                                                                                                                                                                |
| Tests                           | `test_presenter.py`, `test_window_checks.py`, `test_cameras.py` (fake OpenCV), `test_window_settings.py`, `test_live_source.py`, `test_button_trigger.py`, `test_launcher.py` (reads the `.cmd` for the missing-venv message), plus updated `test_doctor.py` and `test_station.py`                                                                          |
| Docs                            | `cv/README.md`, `docs/ROADMAP.md`, `docs/STATUS.md`, `docs/SESSION_LOG.md`, `docs/DECISIONS.md` (D-059 to D-063), `qa/handoffs/2026-10-19-phase-17-camera-window.md`                                                                                                                                                                                        |
| App (only if question 6 is yes) | `src/app/(app)/camera/page.tsx`: the "Connect the camera station" steps mention the shortcut                                                                                                                                                                                                                                                                |

## 5. Risks

| Risk                               | Mitigation                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The window freezes                 | Tk on the main thread only; everything else on workers; a 50 ms queue poll                                                                                                                      |
| GPU memory with preview + capture  | One model, one lock; never two predictions at once                                                                                                                                              |
| The phone camera drops mid-run     | Reconnect for 30 s, Capture off meanwhile, then stop with the fix; the spool keeps saved scans                                                                                                  |
| The wrong batch                    | The batch is always on screen; the station's recheck before every capture is unchanged                                                                                                          |
| A token or camera password leaks   | The token stays inside `ScanClient` (its `repr` hides it); addresses go through `camera_name`; an address with a password isn't saved; a test checks the saved file and messages never hold one |
| Blurry or tiny text on high-DPI    | DPI awareness and point-sized fonts                                                                                                                                                             |
| A preview box read as the decision | Neutral colours, a fixed "Preview" banner, no verdict in the preview                                                                                                                            |

## 6. Test plan

- **Unit (pytest, no Tk, torch, OpenCV or network):** every presenter state and which buttons it
  allows; the check levels and which ones block Start; a refused token → error state; no batch →
  Capture off with the app's message; a send that fails → "1 waiting to send"; camera discovery
  and the DirectShow choice with a fake `cv2`; the settings file never saves a password; the
  `ButtonTrigger` with check-ins; `LiveSource` returns the frame on screen; the GPU check with a
  fake torch; the launcher's missing-venv message.
- **Gates I run:** `ruff check`, `ruff format --check`, `mypy`, `pytest` in `cv/`. If the Camera
  page copy changes: `npm run lint`, `typecheck`, `test`, `build`.
- **Not run by me (Codex):** the window by hand and any browser or e2e test. The handoff covers
  the laptop webcam **and** the iPhone through DroidCam (by camera number and by address), every
  state, every check (including no GPU by setting `CUDA_VISIBLE_DEVICES=-1`, and no batch), and a
  negative per feature (a wrong address, the camera unplugged mid-run, the app stopped, a revoked
  token, the launcher with `.venv` renamed).

## 7. Decisions to log (D-059 to D-063)

D-059 Tkinter window; D-060 preview vs capture (preview size and rate, Capture sends the frame on
screen at full size, the preview never shows a verdict); D-061 what blocks Start; D-062 the UI's
choices in `cv/station-window.json` and `[camera] backend`; D-063 the launcher and shortcut.
