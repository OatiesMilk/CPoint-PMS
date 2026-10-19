# Prompt: Phase 17 — The camera station window (live preview, check, start and stop)

> **How to use this file.** It holds **one phase** for one Claude Code session (CLAUDE.md: one
> phase per session). Open Claude Code (Opus) at the repo root, switch to **plan mode**, and say:
> _"Read `docs/prompts/camera-station-window.md` and run Phase 17. Stop for my approval
> before writing code."_ If the session ends mid-phase, say _"Resume the camera station window"_
> and the session works out where it stopped (see `<session_setup>` step 4).

---

<role>
You are the senior full-stack and ML-integration engineer who built Phases 0–16, including the
`cv/` camera station (Phases 14–16). You know its ports and adapters, its config, its tests and its
rules, and you keep to them.

The station works but is run from a terminal: `python -m cpoint_cv doctor`, then
`python -m cpoint_cv run webcam`, then Space at the console. CPoint will have **one** camera
station at the Preparation table, run by factory staff, not developers. Dylan wants it to feel like
an app: open it from a desktop shortcut, check the machine with one button, pick the camera, see a
**live preview with the model's boxes**, and press **Capture** / **Stop**. During development the
camera is often an **iPhone through DroidCam**.

An industry panel reviews the result. Where CPoint or the team hasn't decided something, surface
it. Never invent a business rule quietly.
</role>

<session_setup>
Do these **in order, before planning**. They are the project's standing rules.

1. **Read first.** `CLAUDE.md` (auto-loaded), `AGENTS.md`, `docs/STATUS.md`, this file, then the
   files in `<read_first>`.
2. **Check QA.** List `qa/reports/` and read the newest report ("newest" = latest date in the
   file name, then the highest `-runN`; see `qa/README.md`). If its verdict is FAIL, confirm each
   failure in the code, fix it, and say so in the plan **before** new work. Known at the time of
   writing: `2026-10-19-phase-16-camera-page-run2.md` is PASS WITH ISSUES; its issues were
   test-harness notes, not app faults.
3. **Plan first.** Stay in plan mode. Present the plan (format in `<workflow>` Step 1) and the
   questions, then **stop and wait for Dylan's approval**. Write no code before that.
4. **Resume, don't restart.** Work out where things stand from `docs/STATUS.md`,
   `docs/ROADMAP.md`, `docs/SESSION_LOG.md`, `git status` and recent changes. Phase 16 must be
   committed (branch `feat/phase-16-camera-page`); if it isn't merged into `main` yet, say so and
   ask which branch to build on. **One phase per session**, then stop and report.
5. **UI craft.** This phase is a desktop window, not a web page, but the same craft applies:
   readable font sizes, humanized copy, messages that name the exact problem and the fix, and the
   colours and tone of `DESIGN.md` (verdict colours: pass, rework, reject, review). Any web-page
   change follows `DESIGN.md` and `.claude/skills/ui-craft/SKILL.md` with tokens only.
6. **QA handoff.** After each change that alters behaviour, write
   `qa/handoffs/YYYY-MM-DD-<feature>.md` from `qa/templates/handoff.md` (copy it, never edit the
   template) so Codex can test it.
7. **No browser or e2e tests.** Never run Playwright, `npm run test:e2e` or any browser test. Run
   only lint, typecheck, unit tests and build, plus the station's ruff, ruff format, mypy and
   pytest. Don't open the GUI yourself to "check it"; Codex and Dylan do hands-on testing. In the
   report, list e2e and manual GUI tests as "not run (Codex)".
8. **Git.** Never create branches, commits, pushes or PRs without Dylan's explicit permission in
   this session. Update the docs, then stop and tell Dylan the changes are ready to commit.
   Save docs and prompt files directly in the local project folder.
   </session_setup>

<read_first>
Read these **before you plan**. The plan must cite what it reuses.

1. `docs/DECISIONS.md`, especially D-003 (two containers; the station runs outside Docker), D-008
   (no per-person data), D-011 and D-053 (the app decides verdicts; "When found" actions), D-020
   (batch targeting), D-028, and D-048 to D-058 (the station, model storage, capture, captureId,
   class keys, check-in, the early-model notice, demo reset, overlap filter and IP camera,
   evaluate).
2. `cv/README.md` (all of it), `cv/MODEL_CARD.md`, `cv/config.example.toml`, `cv/.env.example`.
3. The station code, end to end:
   - `cv/cpoint_cv/station.py` (the loop: batch, trigger, capture, spool, detect, send, check-in);
   - `sources.py` (`WebcamSource`, `camera_name`, `probe_camera`), `triggers.py`;
   - `yolo_detector.py`, `detector.py`, `mapper.py`, `preview.py`, `overlay.py` (it already draws
     boxes and masks with OpenCV);
   - `client.py`, `transport.py`, `spool.py`, `encode.py`, `payload.py`, `logs.py`;
   - `doctor.py` and `cli.py` (`doctor`, `run`, `predict`, `evaluate`), `config.py`, `env.py`;
   - `cv/tests/` (fakes for HTTP, camera and model; no torch, OpenCV or network in CI).
4. App side, only to see what the station talks to: `docs/API.md` ("Camera ingestion"),
   `src/app/(app)/camera/page.tsx` (its "Connect the camera station" steps),
   `src/server/services/camera.service.ts` (states and check-in).
5. `.github/workflows/ci.yml` (the `station` job), `.gitignore`, `.dockerignore`.
   </read_first>

<context>
**What exists (Phases 14–16):**

- `cpoint_cv` runs `yolo-v1.pt` (YOLO26s-seg, `imgsz` 1536): about 255 ms per image on Dylan's
  RTX 3060 Laptop GPU and 780 ms on the CPU. Python 3.13 in `cv/.venv` (`py -3.13`), torch
  2.6.0+cu124, ultralytics 8.4.103, OpenCV 5.
- `run webcam` asks the app which batch is at Preparation, waits for Space, captures **one** frame,
  runs the model, saves the capture to the spool, sends it with a `captureId` and prints the app's
  verdict. It checks in every 20 s while waiting so the Camera page shows **Station connected**.
- `doctor` checks the model and checksum, Python and package versions, the camera, the app, the
  token and the clock. It does **not** check the GPU.
- `[camera] index` or `[camera] url` (rtsp/http) chooses the camera; OpenCV opens it with its
  default Windows backend (Media Foundation).
- The app decides every verdict; the station never applies thresholds (D-011, D-053).

**What Dylan asked for (2026-10-19):**

1. A window instead of the terminal: **Start** / **Stop** the camera, a **live preview** with the
   model's bounding boxes on it, and a **Capture** button for each leather section.
2. A **pre-requisites check** button before starting: can this machine run the camera module (GPU,
   dependencies installed, model, camera, app, token, and so on).
3. During development the camera is an **iPhone** through **DroidCam** (the iPhone app plus the
   DroidCam client for Windows, so it appears as a camera index; or DroidCam's own stream at
   `http://<iPhone IP>:4747/video` through `[camera] url`). The OBS virtual-camera route was
   dropped, but a DirectShow backend choice is still worth having for virtual cameras.
4. He chose this desktop-window option over controlling the station from the website's Camera
   page (that remains a possible later phase; don't build it).

**Gaps this phase must handle (each needs a line in the plan):**

1. **Live preview vs. scans.** The preview runs the model continuously on the live feed, but it is
   **only a preview**: nothing is sent until **Capture**, and the app still decides the verdict.
   Say how the preview's boxes are labelled so nobody reads them as the decision.
2. **Speed.** At `imgsz` 1536 the GPU gives about 4 previews a second; the CPU under 2. Propose a
   preview size and frame cap (config), keep the **captured** scan at the model's full `imgsz`,
   and keep the window responsive (camera, inference and HTTP off the UI thread).
3. **Capture = the frame on screen.** Capture must send the frame the operator saw (or the next
   fresh one; decide and say which), with `capturedAt` from that moment, through the existing
   spool → send path, so retries, the spool and `captureId` all still apply.
4. **The check.** Which checks are **required** (block Start) and which are **warnings** (no GPU →
   CPU, slower; clock drift). Add a GPU check (torch sees CUDA, the GPU's name, the CUDA build),
   reuse `doctor.py` for the rest, and say what each red line tells the operator to do.
5. **Camera choice.** A picker for camera numbers that actually give a picture, an IP-camera
   address (DroidCam's URL), and a backend choice (default / DirectShow). Where the choice is
   saved (a git-ignored local file, not `config.toml` edits by the UI, unless you argue otherwise).
   Passwords in URLs are never shown or logged (as in D-057).
6. **Starting without a terminal.** A desktop shortcut or a `.cmd` launcher that runs the window
   with `pythonw` from `cv/.venv`. If Python or the venv is missing, the window can't start: the
   launcher must say which setup step is missing instead of failing silently.
7. **Toolkit and dependencies.** Prefer the standard library (Tkinter) plus what's already
   installed (Pillow comes with ultralytics; OpenCV). Any new dependency is pinned, justified and
   its licence named. The GUI module must be optional: the CLI, CI and the existing tests must
   keep working without a display.
8. **Errors in the window.** Everything the CLI prints today (no batch, token refused, network
retries, spool waiting, the app refusing a scan) shows in the window in plain words, with the
same behaviour (a refused token stops it; no batch blocks Capture).
</context>

<target_design>

```
CPoint Camera window (cpoint_cv.gui, Tkinter)
┌──────────────────────────────────────────────────────────────────────┐
│ Camera: [iPhone (DroidCam) ▾]  Driver: [Default ▾]   [Check this machine] │
│ Next scan goes to B-2026-0017 · roll LR-0042 · School Shoe                │
│ ┌──────────────────────────────────────────────┐  Checks                  │
│ │   live preview with boxes (preview only)     │  ✓ Model, ✓ GPU, ✓ App … │
│ │                                              │  Last scan               │
│ └──────────────────────────────────────────────┘  section 12 · REWORK     │
│ [ Start ]  [ Capture (Space) ]  [ Stop ]            2 waiting to send     │
└──────────────────────────────────────────────────────────────────────┘
        │ worker threads: camera reader · preview inference · station (check-in, send)
        ▼
  existing core: WebcamSource · YoloDetector · mapper · Spool · ScanClient · doctor checks
```

Principles:

- **Reuse the core.** The window drives the same `Station` pieces (or a small refactor of them)
  that `run webcam` uses; no second send path. `run webcam` keeps working.
- **A presenter you can test.** Window state (idle → checking → ready → running → capturing →
  stopped / error) lives in a plain-Python class with no Tk import, unit-tested with the existing
  fakes. The Tk view only renders it.
- **Configuration, not constants.** Preview size, frame cap, default camera and backend come from
  config; the UI's last choices go to a git-ignored local file.
- **The app is unchanged** unless the plan argues for a copy change on the Camera page
  ("Connect the camera station" mentioning the window). No contract change.
  </target_design>

<workflow>
**Step 1: Plan (plan mode; stop for approval).**

- Setup results: the newest QA report, and where things stand (is Phase 16 merged?).
- What you read and what you'll reuse, with file paths.
- Design: modules, threads and how they talk to the UI, the presenter's states, the camera picker
  and backends, the check list (required vs warning), preview vs capture, the launcher, config.
- Files to add or change, by area (station core / GUI / launcher / config / tests / docs; app only
  if a copy change is proposed).
- Risks and mitigations: UI freezes, GPU memory with preview + capture, a phone camera dropping
  mid-run, the wrong batch, a token or camera password leaking, Tkinter on Windows high-DPI.
- Test plan: presenter and check logic with fakes; camera enumeration and backend choice with a
  fake OpenCV; the launcher's missing-venv message; what Codex tests by hand (handoff scenarios
  with the laptop webcam **and** the iPhone through DroidCam, a negative per feature).
- Then ask, in **one batch with a recommended option each**, only the questions that change the
  build. Expected: the toolkit (Tkinter recommended); the preview size / frame cap; whether
  Capture sends the frame on screen or the next fresh one; what blocks Start; a desktop shortcut
  created by a command vs a `.cmd` file in `cv/`; whether to update the Camera page copy.

**Step 2: Build** in small steps, each left green, after approval. PEP 8 with type hints; ruff and
mypy clean; new tests in `cv/tests/` that run without torch, OpenCV, Tk or a network (skip any test
that truly needs a display, and say so).

**Step 3: Gates** (paste the real output summaries; never claim a gate you didn't run).

- Station: `ruff check`, `ruff format --check`, `mypy`, `pytest`.
- App (only if app files changed): `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`.
- GUI by hand, e2e and browser tests: **not run (Codex)**. Put them in the handoff.

**Step 4: Docs** (`/wrap-up`, without its git step).

- `cv/README.md`: "Use the station window" (shortcut, check, camera picker, iPhone with DroidCam,
  Capture / Stop), and update the demo script to use the window.
- `docs/ROADMAP.md`: add Phase 17 with ticked acceptance criteria. `docs/STATUS.md`,
  `docs/SESSION_LOG.md`, and `docs/DECISIONS.md` entries from **D-059** (toolkit, preview vs
  capture, required checks, where UI choices are saved, the launcher).
- The QA handoff in `qa/handoffs/`, with setup steps for DroidCam on the iPhone, the exact
  commands, and scenarios for every window state and every check (including no GPU and no batch).

**Step 5: Report** in the master spec's `<final_report_format>`. Say the changes are ready for
Dylan to commit; don't commit. Then stop.
</workflow>

<acceptance>
- A desktop shortcut or launcher opens the window without a terminal; with no `cv/.venv` it says
  which setup step is missing.
- **Check this machine** lists every check with a pass, warning or fail and the fix for each; it
  includes the GPU. Start stays disabled while a required check fails.
- The camera picker lists the cameras that give a picture, takes an IP-camera address and offers
  a DirectShow backend; the iPhone through DroidCam works by index and by URL (Codex verifies).
- **Start** shows a live preview with boxes labelled as a preview; **Capture** sends one scan
  through the existing spool and `captureId` path and shows the app's verdict and section number;
  **Stop** releases the camera. The window stays responsive throughout.
- No batch at Preparation blocks Capture with the app's message; a refused token stops the
  station with the fix; unsent captures show as "waiting to send".
- `run webcam`, `doctor`, `predict` and `evaluate` still work; CI's station job passes without a
  display; no app contract change.
</acceptance>

<constraints>
- The CLAUDE.md non-negotiables all apply. Two containers only (D-003): the window is part of the
  station, outside Docker, never a service in `docker-compose.yml`.
- The app decides verdicts (D-011, D-053). The preview never sends anything and never shows a
  verdict as if it were the app's.
- One capture per press, never a stream of scans (D-050).
- Never show, log or commit the device token or a camera password. Never commit the model file,
  photos, `cv/config.toml`, `cv/.env` or the UI's local settings file.
- No per-person data (D-008). Desktop only.
- Never run browser or e2e tests, and don't drive the GUI yourself. Never branch, commit, push or
  open a PR without Dylan's explicit permission.
- If this brief conflicts with a settled decision or the code, say so in the plan and propose the
  smallest change. Don't silently pick one.
</constraints>
