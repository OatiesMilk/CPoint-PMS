# Prompt: Phase 18 — Capture from the website (the QI's Capture page)

> **How to use this file.** It holds **one phase** for one Claude Code session (CLAUDE.md: one
> phase per session). Open Claude Code (Opus) at the repo root, switch to **plan mode**, and say:
> _"Read `camera-capture-page.md` in the project root and run Phase 18. Stop for my approval
> before writing code."_ If the session ends mid-phase, say _"Resume the capture page"_ and the
> session works out where it stopped (see `<session_setup>` step 4).

---

<role>
You are the senior full-stack and ML-integration engineer who built Phases 0–17, including the
`cv/` camera station and its desktop window (Phase 17). You know the app's MVC layering, the scan
ingestion path, the decision engine and the station's rules, and you keep to them.

Phase 17 gave the station a desktop window, but it's still a second application on the camera PC.
Dylan asked (2026-10-19): _"is it not possible to integrate this directly in the dashboard of the
QI so that there is no more need to run another application?"_ This phase answers yes: a
**Capture** page in the website where the person at Preparation sees the live camera, presses
**Capture**, and gets the app's verdict, with the model running inside the app.

An industry panel reviews the result. Where CPoint or the team hasn't decided something, surface
it. Never invent a business rule quietly.
</role>

<session_setup>
Do these **in order, before planning**. They are the project's standing rules.

1. **Read first.** `CLAUDE.md` (auto-loaded), `AGENTS.md`, `docs/STATUS.md`, this file, then the
   files in `<read_first>`. Next.js 16 and Prisma 7 differ from older versions: read the bundled
   Next docs (`node_modules/next/dist/docs/`) before writing framework code.
2. **Check QA.** List `qa/reports/` and read the newest report ("newest" = latest date in the
   file name, then the highest `-runN`; see `qa/README.md`). If its verdict is FAIL, confirm each
   failure in the code, fix it, and say so in the plan **before** new work. Phase 17's Codex run
   (`qa/handoffs/2026-10-19-phase-17-camera-window.md`) may or may not have a report yet; say which.
3. **Plan first.** Stay in plan mode. Present the plan (format in `<workflow>` Step 1) and the
   questions, then **stop and wait for Dylan's approval**. Write no code before that.
4. **Resume, don't restart.** Work out where things stand from `docs/STATUS.md`,
   `docs/ROADMAP.md`, `docs/SESSION_LOG.md`, `git status` and recent changes. Phase 17 should be
   on its own branch (`feat/phase-17-camera-window`) or merged; if it's neither, say so and ask
   which branch to build on. **One phase per session**, then stop and report.
5. **UI craft.** Read `DESIGN.md` and `.claude/skills/ui-craft/SKILL.md` before any UI work and
   follow them: tokens only, readable fonts, humanized copy, messages that name the exact problem
   and the fix, the verdict colours (pass, rework, reject, review) with icon + label, and every
   state designed (no camera permission, no batch, model loading, sending, sent, failed).
6. **QA handoff.** After each change that alters behaviour, write
   `qa/handoffs/YYYY-MM-DD-<feature>.md` from `qa/templates/handoff.md` (copy it, never edit the
   template) so Codex can test it.
7. **No browser or e2e tests.** Never run Playwright, `npm run test:e2e` or any browser test. Run
   only lint, typecheck, unit tests and build, plus the station's ruff, mypy and pytest if `cv/`
   changes. You may write new e2e specs for Codex to run; list them as "not run (Codex)".
8. **Git.** Never create branches, commits, pushes or PRs without Dylan's explicit permission in
   this session. Update the docs, then stop and tell Dylan the changes are ready to commit.
   Save docs and prompt files directly in the local project folder.
   </session_setup>

<read_first>
Read these **before you plan**. The plan must cite what it reuses.

1. `docs/DECISIONS.md`, especially D-003 (exactly two containers: `app`, `db`), D-005, D-007,
   D-008 (no per-person data), D-011 and D-053 (the app decides verdicts; "When found" actions),
   D-020 (which batch a scan goes to), D-028 (only the QI decides flagged scans), D-048 to D-063
   (the station, the model file staying out of git, capture rules, `captureId`, check-in, the
   window, preview vs capture).
2. App side, end to end: `docs/API.md` ("Camera ingestion"), `src/app/api/v1/scans/route.ts`,
   `src/server/controllers/` for scans, `src/server/services/scan-ingest.service.ts` (`ingestScan`
   takes a `device`), `camera.service.ts`, `scan-decision.service.ts`,
   `src/server/validators/scan.validator.ts`, `src/lib/decision-engine.ts`, the storage service,
   `src/server/policies/permissions.ts` (`camera:view`, `camera:manage`, `scan:review`) and
   `navigation.ts`, `src/app/(app)/camera/page.tsx`, `src/app/(app)/quality-inspector/`.
3. `prisma/schema.prisma`: `Scan` (`source`, `deviceTokenId`, `captureId`; there is no
   per-person "captured by" column, by design), `ScanSource` (already has `PHONE` and `WEBCAM`),
   `ApiToken`.
4. The station: `cv/cpoint_cv/yolo_detector.py` (YOLO26s-seg, `imgsz` 1536, boxes from masks),
   `mapper.py` (confidence floor 0.25, class renames, same-class overlap filter IoU 0.7, top 50),
   `overlay.py` (box colours away from the verdict hues), `cv/MODEL_CARD.md`, `cv/README.md`.
5. `Dockerfile` (`node:24-alpine`, standalone output), `docker-compose.yml`, `.dockerignore`
   (`cv` and `*.pt` are excluded today), `.github/workflows/ci.yml`, `next.config.*`.
   </read_first>

<context>
**What exists (Phases 14–17):**

- `yolo-v1.pt` runs only in Python (`cpoint_cv`), on the camera PC, outside Docker. The station
  sends detections to `POST /api/v1/scans` with a device token; the app decides the verdict.
- Phase 17's desktop window works: Dylan tested it on 2026-10-19 with his iPhone through DroidCam
  (`http://<IP>:4747/video`), a live preview with boxes, and Capture → B-2026-0001 section 3,
  Reject from the app. On the RTX 3060 the model takes about 35 ms at 960 and 55 ms at 1536.
- `ingestScan` needs a `device` (an `ApiToken` id) for the `captureId` repeat check and to record
  where a scan came from. `Scan` has no column for a person, on purpose (D-008).

**What Dylan wants:** the person at Preparation uses the **website** only. A Capture page shows
the live camera, a Capture button and the app's verdict. No `cpoint_cv`, no DroidCam client, no
second application. The Python station stays as a fallback for a dedicated camera.

**Gaps this phase must handle (each needs a line in the plan):**

1. **Where the model runs.** Options, with a recommendation:
   - **Server, in the `app` container** (recommended to evaluate first): export `yolo-v1.pt` to
     ONNX (`ultralytics` export, done once on the camera PC, opset and `imgsz` recorded in
     `MODEL_CARD.md`) and run it with `onnxruntime-node`. No third container (D-003). Check
     first: `onnxruntime-node` ships glibc binaries, and the image is `node:24-alpine` (musl). Say
     whether the base image must move to a Debian slim image, and what that costs (size, CI, the
     demo stack). Measure CPU time per capture at 1536 on Dylan's laptop.
   - **Browser** (`onnxruntime-web`, WebGPU with a WASM fallback): no server change, uses the
     client's GPU, but the page downloads the model (tens of MB), and the app then receives
     detections from a browser, which anyone signed in could forge. Say how the app would trust
     them, or why that's acceptable.
   - A Python service would be a third container: not allowed (D-003).
2. **Pre- and post-processing in TypeScript.** Letterbox to `imgsz`, normalise, run, decode boxes
   (and ignore masks: the contract is boxes only), apply the confidence floor, class renames,
   the same-class overlap filter and the top 50, exactly as `mapper.py` does. A shared fixture
   (one image, the expected detections from `cpoint_cv predict --json`) proves the two agree
   within a tolerance.
3. **Model file handling.** The ONNX file stays out of git (D-049) and out of the image build
   context today. Say where it lives in Docker (a volume or bind mount, like uploads), how the app
   finds it (an env var), what happens when it's missing (the page says so; the API answers a
   clear 503), and how a model swap works. `modelVersion` keeps the `name-<sha8>` form.
4. **The camera in the browser.** `getUserMedia` only works on `localhost` or HTTPS. Plan for:
   the camera PC opening `http://localhost:3000` (works today); other PCs and the iPhone in Safari
   (need HTTPS on the LAN: a local CA such as `mkcert`, or a reverse proxy, and how that fits two
   containers); a camera picker (`enumerateDevices`), resolution request (1920 × 1080), and the
   permission-denied and no-camera states with the fix in plain words. DroidCam should no longer
   be needed: the iPhone opens the page itself.
5. **Capture = the frame on screen**, sent as an image at full resolution with a `captureId`
   made in the browser and the press time as `capturedAt`. Retries on a network error reuse the
   same `captureId` so a repeat returns the first scan (D-051). One press, one scan (D-050).
6. **Live preview.** Does the page show live boxes before Capture (that means running the model
   continuously: in the browser, or many server calls)? Recommend one. If there is a preview, it
   follows D-060: labelled as a preview, class colours never the verdict colours, no verdict.
7. **Who captures and how it's recorded.** A new permission (e.g. `camera:capture`) for the QI,
   and the FM too? The scan must not name a person (D-008); the audit log records the action as
   it does for every mutation. `ingestScan`'s `device` becomes "a device token **or** the
   website": say how `deviceTokenId`, `source` (`WEBCAM` or `PHONE`) and the `captureId` repeat
   check work without a token.
8. **The batch.** Same rule as the station (D-020): the page always shows the batch the next
   scan goes to, Capture is off with no batch at Preparation, and a batch change between seeing
   and pressing goes to the current batch and says so.
9. **The Camera page and the station.** The Camera page's states (Station connected, Camera
station active) and "Connect the camera station" steps gain the website route; the Python
station and the Phase 17 window keep working unchanged.
</context>

<target_design>

```
Capture page  /camera/capture  (QI; FM if Dylan says so)
┌──────────────────────────────────────────────────────────────────────┐
│ Next scan goes to B-2026-0017 · roll LR-0042 · School Shoe            │
│ Camera: [iPhone back camera ▾]                       Model: yolo-v1-… │
│ ┌──────────────────────────────────────────┐  Last scan              │
│ │ live camera (preview boxes if chosen)    │  ✕ Reject · section 12  │
│ └──────────────────────────────────────────┘  found cut 0.91 …       │
│ [ Capture ]   Space also captures             Open scan →            │
└──────────────────────────────────────────────────────────────────────┘
      │ image + captureId + capturedAt (session auth, not a device token)
      ▼
POST /api/v1/scans/capture → controller → capture.service (model) → ingestScan → decision
```

Principles:

- **One decision path.** The new route ends in the same `ingestScan` and decision engine as the
  station; nothing decides a verdict anywhere else.
- **MVC as always.** Route one-liner → controller → service → model; pages call services; the
  model runner is a service behind a port with a fake for unit tests (no ONNX in CI unit tests).
- **Two containers** (D-003). No Python in the image.
- **The station stays.** `POST /api/v1/scans` with a device token is unchanged.

</target_design>

<workflow>
**Step 1: Plan (plan mode; stop for approval).**

- Setup results: the newest QA report, and where things stand (is Phase 17 committed or merged?).
- What you read and what you'll reuse, with file paths.
- Design: where the model runs (with a measured or estimated time per capture), pre- and
  post-processing and the parity fixture, the model file in Docker, HTTPS on the LAN, the page's
  states, the API route and its auth, permissions, the batch, the Camera page changes.
- Files to add or change, by area (model / API / page / Docker / docs / tests).
- Risks and mitigations: the alpine base image, image size, CPU time on the server, a forged
  detection list (if inference is in the browser), camera permission on iOS Safari, the model
  file missing in Docker, two people capturing at once.
- Test plan: unit tests for pre/post-processing (pure functions), the parity fixture, the
  service with a fake runner, the route's auth and permissions; what Codex tests by hand (the
  camera PC on localhost, the iPhone in Safari over HTTPS, each state, a negative per feature).
- Then ask, in **one batch with a recommended option each**, only the questions that change the
  build. Expected: server vs browser inference; the base image change; HTTPS approach (mkcert
  certificate in the `app` container vs something else); live preview or not; who may capture;
  the page's place in the nav (its own item vs a tab on the Camera page).

**Step 2: Build** in small steps, each left green, after approval. Tokens only for UI; every
mutation in `runInTransaction` with `recordAudit`; every page and route guarded.

**Step 3: Gates** (paste the real output summaries; never claim a gate you didn't run).

- App: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- Station (only if `cv/` changed): `ruff check`, `ruff format --check`, `mypy`, `pytest`.
- Docker build of the new image, if the Dockerfile changed (no `up`, no browser).
- E2E and browser tests: **not run (Codex)**. Put them in the handoff.

**Step 4: Docs** (`/wrap-up`, without its git step).

- `docs/API.md` (the new route), `cv/README.md` and `cv/MODEL_CARD.md` (ONNX export and swap),
  `README.md` (HTTPS on the LAN), `docs/ROADMAP.md` Phase 18 with ticked acceptance criteria,
  `docs/STATUS.md`, `docs/SESSION_LOG.md`, `docs/DECISIONS.md` entries from **D-064**.
- The QA handoff in `qa/handoffs/`, with the iPhone-in-Safari setup, the HTTPS steps, and
  scenarios for every state.

**Step 5: Report** in the master spec's `<final_report_format>`. Say the changes are ready for
Dylan to commit; don't commit. Then stop.
</workflow>

<acceptance>
- A signed-in QI opens the Capture page, picks a camera, sees the live picture, presses Capture
  (or Space), and sees the app's verdict and section number for that scan, with no other
  application running.
- The model runs inside the existing containers (or the browser, if chosen); `docker compose`
  still has two services; the model file is never in git or the image.
- The detections match `cpoint_cv` on the parity fixture within the stated tolerance.
- No batch keeps Capture off with the app's message; a retry never makes a second scan; one press
  makes one scan.
- Camera permission denied, no camera, model missing, and a non-HTTPS address each show a
  specific message with the fix.
- The iPhone opens the page in Safari over HTTPS on the LAN and captures (Codex verifies).
- The station (`POST /api/v1/scans` with a token) and the Phase 17 window still work; no per-person
  data on scans.
</acceptance>

<constraints>
- The CLAUDE.md non-negotiables all apply: MVC layering, guards on every page and route,
  `runInTransaction` + `recordAudit`, tokens only, desktop-first layout that adapts, no per-person
  rankings or scores, defect types and thresholds as data, two containers.
- The app decides verdicts (D-011, D-053). A preview never shows a verdict.
- One capture per press (D-050). `captureId` makes retries safe (D-051).
- Never commit the model file (`.pt` or `.onnx`), photos, certificates or private keys, `.env`
  files, or `cv/config.toml`.
- Never run browser or e2e tests, and never branch, commit, push or open a PR without Dylan's
  explicit permission.
- If this brief conflicts with a settled decision or the code, say so in the plan and propose the
  smallest change. Don't silently pick one.
</constraints>
