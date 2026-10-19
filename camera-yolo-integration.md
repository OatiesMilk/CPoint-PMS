# Prompt: Phases 14–16 — Camera module with the YOLO model (`yolo-v1.pt`)

> **How to use this file.** It holds **three phases**, one per Claude Code session (CLAUDE.md:
> one phase per session). Open Claude Code (Opus) at the repo root, switch to **plan mode**, and say:
> _"Read `camera-yolo-integration.md` in the project root and run Phase 14. Stop for my approval
> before writing code."_
> Next session, say the same with Phase 15, then Phase 16. If a session ends mid-phase, say
> _"Resume the camera YOLO integration"_ and the session works out where it stopped (see
> `<session_setup>` step 4).

---

<role>
You are the senior full-stack and ML-integration engineer who built Phases 0–13. You know the
conventions and keep to them. You are now connecting the team's first YOLO model to the camera
module so the Preparation checkpoint works end to end: a camera station captures a leather
section, the model finds defects, and the scan lands in the system through the existing contract.

The model is early and not properly fine-tuned. That is expected. The goal is to **simulate how the
finished camera module will behave**, with a real model in the loop, so that swapping in a better
`.pt` file later is a file swap plus Settings changes, never a code change. An industry panel reviews
the result. Where CPoint or the team hasn't decided something, surface it. Never invent a business
rule quietly.
</role>

<session_setup>
Do these **in order, every session, before planning**. They are the project's standing rules.

1. **Read first.** `CLAUDE.md` (auto-loaded), `AGENTS.md`, `docs/STATUS.md`, and this file. Then
   the files in `<read_first>` below.
2. **Check QA.** List `qa/reports/` and read the newest report ("newest" = latest date in the file
   name, then the highest `-runN`; see `qa/README.md`). If its verdict is FAIL, confirm each failure
   in the code, fix it, and say so in the plan **before** any new work. Treat its suggested fixes as
   input, not orders. Known at the time of writing: `2026-10-14-followups-run3.md` passed, and
   Phase 13 run 5 had one e2e timeout that was raised to 60 s but never re-run. Check whether a
   newer report exists.
3. **Plan first.** Stay in plan mode. Present the plan (format in `<workflow>` Step 1) and the
   questions, then **stop and wait for Dylan's approval**. Write no code before that.
4. **Resume, don't restart.** Work out the last completed phase or step from `docs/STATUS.md`,
   `docs/ROADMAP.md`, `docs/SESSION_LOG.md`, `git status` and recent changes. Continue from there.
   **One phase per session**, then stop and report.
5. **UI craft.** For any UI change, follow `DESIGN.md` and `.claude/skills/ui-craft/SKILL.md`:
   readable font sizes, humanized copy, inline messages that name the exact field or problem and
   the fix, tokens only, and the existing design.
6. **QA handoff.** After each change that alters behaviour, write
   `qa/handoffs/YYYY-MM-DD-<feature>.md` from `qa/templates/handoff.md` (copy it, never edit the
   template) so Codex can run the browser and e2e tests.
7. **No browser or e2e tests.** Never run Playwright, `npm run test:e2e`, or any browser test, even
   where CLAUDE.md, the master spec or this file lists them as gates. Run only lint, typecheck, unit
   tests and build (plus the Python equivalents below). Codex does all browser and e2e testing. In
   the report, list e2e as "not run (Codex)".
8. **Git.** Never create branches, commits, pushes or PRs without Dylan's explicit permission in
   this session. This overrides the `/wrap-up` commit-and-push step and the "commit at green
   checkpoints" advice: update the docs, then stop and tell Dylan the changes are ready to commit.
   Save docs and prompt files directly in the local project folder.
   </session_setup>

<read_first>
Read these **before you plan**. The plan must cite what it reuses.

1. `docs/prompts/system-rebuild.md` (master spec), especially `<docker>`,
   `<cv_integration_contract>`, `<architecture>`, `<ui>`, `<quality_gates>`,
   `<documentation_protocol>` and `<final_report_format>`.
2. `docs/DECISIONS.md`, especially:
   - D-003 (two containers; the YOLO service runs **outside** compose);
   - D-005 (one batch = one roll, one scan = one leather section);
   - D-008 (scope; no per-person metrics), D-009;
   - D-011 (the uniform confidence rule; unknown class → NEEDS_REVIEW);
   - D-020 (ingestion contract, batch targeting, device tokens);
   - D-028 (only the QI decides flagged scans), D-032, D-034.
3. `docs/API.md` → "Camera ingestion (device token)".
4. `docs/client-survey.md` (defects and the Preparation checkpoint), `docs/ROADMAP.md`.
5. `DESIGN.md` and `.claude/skills/ui-craft/SKILL.md`.
6. Code, the camera module end to end:
   - Contract and decision: `src/server/validators/scan.validator.ts`,
     `src/server/controllers/scan.controller.ts`, `src/app/api/v1/scans/**`,
     `src/app/api/v1/batches/current`, `src/lib/decision-engine.ts`.
   - Services and models: `src/server/services/{scan-ingest,camera,scan-decision,scan-query}.service.ts`,
     `src/server/models/{scan,cv-settings}.model.ts`, `src/server/lib/{storage,image-type,leather-scan}.ts`.
   - Device tokens: `src/server/policies/guard.ts` (`requireDevice`), the API-token service.
   - Reference data: `src/server/services/bootstrap.service.ts` (`REFERENCE_DATA.defectTypes`),
     `src/app/(app)/admin/settings/**` (defect types and thresholds).
   - UI: `src/app/(app)/camera/**`, `src/app/(app)/scans/**`,
     `src/components/features/scans/{scan-image,scan-thumb,latest-scans-widget,verdict-flow}.tsx`.
   - Simulator: `scripts/cv-simulate.ts`, `scripts/cv-token.ts`.
   - Schema: `prisma/schema.prisma` (`Scan`, `Detection`, `DefectType`, `CvSettings`, `ScanSource`).
   - Tests: `tests/unit/{decision-engine,scan-ingest,scan-decision}.test.ts`.
   - Repo hygiene: `.gitignore`, `.dockerignore`, `Dockerfile`, `.github/workflows/ci.yml`.
   - Next.js 16 docs in `node_modules/next/dist/docs/` for anything you're unsure of.
7. Ultralytics docs for the version the model was trained with (8.4.x): `predict` results for the
   segment task (`Results.boxes.xywhn`, `.conf`, `.cls`, `Results.masks`) and `model.names`.
   </read_first>

<context>
**What exists (Phases 3 and 8):**

- `POST /api/v1/scans` takes one capture per leather section: `image` (JPEG/PNG/WebP, ≤ 10 MB,
  checked by its bytes) and `detections` (≤ 50 of `{ classKey, confidence, box: { x, y, width,
height } }`, boxes as fractions 0–1 from the top-left), plus `source`, `modelVersion`,
  `capturedAt` and an optional `batchId`. A device token with the `scans:create` scope signs it.
- The app decides the verdict itself (D-011): the highest confidence among **active** defect types
  ≥ 0.90 → REJECT, ≥ 0.60 → REWORK, otherwise PASS; any unknown class key → NEEDS_REVIEW, which only
  the Quality Inspector resolves (D-028). Thresholds and defect types are data (Settings).
- REWORK opens a repair ticket and REJECT a salvage item, in the same transaction.
- `GET /api/v1/batches/current` tells the camera which batch its scans go to (D-020).
- The Camera page is still the Phase 3 placeholder. Its state ("Not connected", "Simulator active",
  "Camera active") comes from the newest scan in the last 60 s. It doesn't use `getUserMedia`.
- `npm run cv:simulate` posts fake scans; ~5% use the class key **`scratch`** as its "unknown class".
- The master spec requires that plugging in the real model needs **zero code changes to the app**.

**The model (inspected from the file's metadata without loading it; re-verify in Phase 14):**

| Field        | Value                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------ |
| File         | `yolo-v1.pt` in the project root, about 23 MB, untracked in git                            |
| Framework    | Ultralytics 8.4.103 (AGPL-3.0), checkpoint saved 2026-07-21                                |
| Architecture | YOLO26s-seg, task **segment** (masks and boxes), end-to-end head (no separate NMS)         |
| Classes      | `0 crease`, `1 cut`, `2 hole`, `3 scratch`                                                 |
| Input size   | trained at `imgsz=1536`                                                                    |
| Weights      | FP16                                                                                       |
| Validation   | box precision 0.62, recall 0.69, mAP50 0.66, mAP50-95 0.44; mask mAP50 0.61, mAP50-95 0.32 |

**Gaps this integration must handle (each needs a line in the plan):**

1. **Class keys don't match.** The system's defect types are `cut`, `hole`, `abrasion`, `dirt`.
   The model emits `crease`, `cut`, `hole`, `scratch`. Today every `crease` or `scratch` detection
   would send the scan to NEEDS_REVIEW. Fix it as **data** (Settings → Defect types, or a
   documented data step), not code. Decide what happens to `abrasion` and `dirt` (deactivate, keep).
   Once `scratch` is a real type, the simulator's "unknown class" stops being unknown: give it a key
   the model can never emit.
2. **Confidence is not severity.** D-011 reads a detection's confidence as how bad the defect is.
   A YOLO confidence is how sure the model is that the defect exists. With an under-trained model,
   most true defects may score below 0.60 and pass. Don't change D-011 quietly. Show the effect with
   numbers from real sample images, propose options (thresholds tuned in Settings, a per-class rule
   later, or keeping the rule and documenting it), and ask.
3. **Masks vs boxes.** The contract carries boxes only. The runner must turn each mask's detection
   into a normalized box so the app needs no change. Storing polygons (for a mask overlay) is a
   backwards-compatible extension for later. Recommend whether it's worth it, but don't build it
   in these phases unless Dylan approves.
4. **Where inference runs.** Not in the `app` container and not as a third container (D-003). It
   runs in a separate Python **camera station** process on the camera machine (for the demo, Dylan's
   PC), which talks to the app over HTTP with a device token, exactly as the simulator does.
5. **Repo hygiene.** A 23 MB binary is in the project root, and `.dockerignore` doesn't exclude it,
   so it would land in the Docker build context. Propose where model files live (for example
   `cv/models/`), keep them out of git and the Docker image, and record a checksum instead. Ask
   whether Dylan wants Git LFS instead.
6. **Retries and duplicates.** The ingest endpoint has no idempotency key. A retry after a timeout
   whose request actually succeeded creates a second scan. Design the station so this can't happen
   silently, and say whether a small, backwards-compatible contract addition is worth it.
   </context>

<target_architecture>

```
Camera station (Python, outside Docker)                     CPoint PMS (Next.js, unchanged contract)
┌──────────────────────────────────────────────┐            ┌──────────────────────────────────────┐
│ FrameSource ── webcam │ folder replay │ file  │            │ GET  /api/v1/batches/current         │
│      │                                       │  HTTPS +   │ POST /api/v1/scans (multipart)       │
│      ▼                                       │  device    │   → decision engine (D-011)          │
│ Detector ── YoloDetector(yolo-v1.pt)         │  token     │   → scan, detections, rework/salvage │
│      │      FakeDetector (tests, no torch)   │ ─────────► │   → audit, Camera page, review queue │
│      ▼                                       │            └──────────────────────────────────────┘
│ Mapper ── class keys, normalized boxes,      │
│           confidence floor, top 50           │
│      ▼                                       │
│ Client ── payload, retries, spool folder     │
└──────────────────────────────────────────────┘
```

Principles:

- **The app stays the single source of truth for verdicts.** The station only reports what the
  model saw. It never decides PASS, REWORK or REJECT, and never filters by the app's thresholds.
- **Ports and adapters.** `FrameSource`, `Detector` and `ScanClient` are small interfaces. The
  YOLO adapter is the only module that imports `ultralytics`/`torch`, so unit tests run without
  them (a `FakeDetector` returns fixed detections).
- **Configuration, not constants.** Model path, `imgsz`, device (`cpu`/`cuda`), confidence floor,
  base URL, token, source and capture mode come from a config file and env vars. A `.env.example`
  documents each. The token is read from the environment and never logged.
- **Traceable model version.** `modelVersion` = a readable name plus the first 8 hex digits of the
  file's SHA-256 (for example `yolo-v1-3fa2b19c`, ≤ 60 characters), so every scan says exactly
  which weights judged it.
- **Pinned dependencies.** `ultralytics==8.4.103` and the rest pinned in `requirements.txt` (or a
  `pyproject.toml` with a lock). State the Python version.
  </target_architecture>

<phase_14>

## Phase 14 — Model intake and the inference core (no app changes)

**Goal:** a tested Python package that loads `yolo-v1.pt`, runs it on an image and produces a
payload the app's validator accepts, without posting anything.

1. **Model card.** Load the model once (read-only) and record in `cv/MODEL_CARD.md`: file name,
   SHA-256, Ultralytics and torch versions, task, class map, `imgsz`, validation metrics above,
   intended use (Preparation leather sections), known limits (early, not fine-tuned), and the
   AGPL-3.0 licence note. If anything differs from `<context>`, the file wins; say so.
2. **Layout.** Propose and create `cv/` (or a better name) with: the package, `requirements.txt`,
   `config.example.toml` (or `.env.example`), `README.md`, `tests/`, and `models/` (git-ignored,
   with a `.gitkeep`). Move nothing yourself. Tell Dylan to move `yolo-v1.pt` into `models/` once the
   plan is approved, or ask whether you may. Add `*.pt`, `*.onnx` and `cv/models/*` to `.gitignore`
   and `.dockerignore`, and exclude `cv/` from the Docker build context.
3. **Detector port.** `Detector.detect(image) -> list[Detection]` with a `YoloDetector` adapter
   (loads once, warms up once, `imgsz` from config, `cpu` by default) and a `FakeDetector`.
4. **Mapper (pure, fully unit-tested).**
   - `class index → classKey` from the model's own `names`, never a hardcoded list; an optional
     rename map in config (for example `crease → wrinkle`) if the team wants different keys;
   - boxes as `xywhn` converted to top-left `x, y, width, height`, clipped to 0–1 so
     `x + width ≤ 1` and `y + height ≤ 1` (the validator's rule);
   - a configurable **confidence floor** (default from the plan, e.g. 0.25) below which detections
     are dropped as noise; this is not the app's PASS threshold;
   - sorted by confidence, at most 50 (`MAX_DETECTIONS`);
   - confidence rounded to 4 decimals; empty list when nothing is found.
5. **CLI `predict`.** `python -m cpoint_cv predict <image-or-folder> [--save-overlay out/]` prints
   per image: detections, `modelVersion`, inference time, and the verdict the app **would** give with
   the default thresholds (computed with a Python port of D-011 used only for this preview, and
   labelled as a preview). Optional overlay images with boxes and masks for the team's review.
6. **Contract test, both sides.** Add one shared fixture, `tests/fixtures/cv-payload.json`, with a
   payload the mapper produces. A Vitest test parses it with `ingestFieldsSchema` and must pass; a
   pytest test checks the mapper output matches the same shape. If either side changes, a test
   breaks.
7. **Baseline numbers.** Run `predict` on the sample images the team has (ask Dylan where the
   Preparation photos are; don't use the training set if a held-out set exists). Report per class:
   how many detections, the confidence spread, and how many images would be PASS / REWORK / REJECT /
   NEEDS_REVIEW under today's settings. This is the evidence for gap 2. Keep the images out of git.

**Acceptance:** the package runs `predict` on a folder; mapper, config and fixture tests pass
without torch installed; the Vitest contract test passes; the model card is written; no app code
changed except the test and ignore files.
</phase_14>

<phase_15>

## Phase 15 — The camera station: capture, send, recover

**Goal:** a station process that behaves like the finished camera: it knows the target batch,
captures one leather section at a time, runs the model and sends the scan through the existing
contract, and survives network and server errors.

1. **Frame sources** behind `FrameSource`:
   - `webcam` (OpenCV, device index and resolution from config), **one capture per trigger**
     (Space/Enter in the console, as the operator would press a pedal or button), never a stream;
   - `folder` replay: sends every image in a folder in order, with `--interval`, so the demo runs
     on real leather photos without a camera;
   - `file`: one image, for debugging.
2. **Batch awareness.** Before each capture, call `GET /api/v1/batches/current` and print
   "Next scan goes to B-2026-0007 (roll R-…, School Shoe)". On `404 NO_BATCH_AT_PREPARATION`, show
   the app's message and wait; don't capture.
3. **Sending.** Encode JPEG (quality from config, always under 10 MB), post multipart with
   `source` (`WEBCAM` or `DEDICATED_CAMERA` from config; ask whether folder replay should send a
   distinct source), `modelVersion` and `capturedAt` (ISO 8601 with offset, taken at capture, not
   at send). Print the app's verdict and section number from the `201` response.
4. **Errors.**
   - `401`: stop and say "The device token was refused. Ask the System Admin for a new one under
     API tokens and set CV_DEVICE_TOKEN."
   - `409` no batch: wait as in step 2. `413`/`422`: log the app's message (it names the field),
     keep the image in a `failed/` folder, and continue.
   - Network errors and `5xx`: retry with exponential backoff and jitter, bounded; then keep the
     capture in a local **spool** folder and resend it later in order.
   - Prevent silent duplicates (gap 6): propose the smallest safe approach (for example, a
     client capture id the app stores and treats as idempotent, which would be an additive, optional
     field with its own decision entry). If Dylan declines a contract change, retry only when the
     request certainly never reached the server, and document the trade-off.
5. **Data step for classes (gap 1).** Write the exact Settings steps (or a small idempotent
   script that uses the existing service layer and audit) to add `crease` and `scratch` and decide
   `abrasion`/`dirt`. Change the simulator's unknown key to one the model can't emit. Don't edit
   the bootstrap's existing rows (it never overwrites).
6. **Logging.** Structured logs (JSON lines or plain with levels) per capture: time, batch,
   detections, inference ms, HTTP status, retries. Never the token.
7. **Health of the station.** `python -m cpoint_cv doctor` checks: model file and checksum, Python
   and package versions, camera opens, base URL reachable (`/api/health`), token accepted
   (`/api/v1/batches/current`). Each failure says what to fix.

**Acceptance:** with the app running, folder replay posts scans that appear on the Camera page,
in Latest scans and in the review queue when flagged (Codex verifies in the browser); unit tests
cover the client's status handling, retries, spool and the payload builder with mocked HTTP; the
data step is documented and rerunnable.
</phase_15>

<phase_16>

## Phase 16 — Camera page, evaluation and the demo

**Goal:** the app shows the real station clearly and honestly, and the team can show and measure
the early model.

1. **Camera page** (replace the placeholder copy, keep the layout and tokens):
   - the state badge distinguishes the station from the simulator (already from `source`);
   - show the model version of the last scan, and a calm notice when it's an early model, e.g.
     "Early model (yolo-v1). Results are for testing; the Quality Inspector checks every flagged
     section." Decide whether "early model" is data (a setting) or derived; don't hardcode the name;
   - rewrite "Connect a camera" for the station: the token, `python -m cpoint_cv doctor`, then start;
     keep the simulator line;
   - every state built (no captures, no batch, not connected, simulator, station), with specific,
     humanized copy.
   - Optional, ask first: a station heartbeat so the page shows "Connected, waiting for the next
     section" between scans instead of "Not connected" after 60 s. This is an additive endpoint with
     a device token and its own decision entry.
2. **Scan detail:** show `modelVersion` where the team can see which weights judged a section.
   No per-person data anywhere (D-008).
3. **Evaluation report.** `python -m cpoint_cv evaluate <labelled-folder>` compares the model's
   preview verdict with the expected one per image and writes `cv/reports/<date>-<model>.md`:
   confusion table of verdicts, per-class precision and recall at the chosen floor, and a threshold
   sweep showing how PASS/REWORK/REJECT shift at 0.5–0.9. It informs the thresholds Dylan sets in
   Settings; it changes nothing by itself. Ask how expected labels are stored (folder names, a CSV,
   or YOLO label files).
4. **Model swap runbook** in `cv/README.md`: drop in `yolo-v2.pt`, update config, run `doctor`
   and `evaluate`, add any new classes under Settings → Defect types, compare reports, then switch.
   No app code changes.
5. **Demo script** in the README: start the app, create a token, start a batch, run the station in
   folder replay, watch the Camera page, resolve a flagged scan as the QI, see the rework ticket and
   salvage item.
6. Optional export to ONNX for CPU speed, only if Phase 14's timings show the station is too slow
   at `imgsz=1536`; measure, don't assume.

**Acceptance:** the Camera page reflects a real station run; the evaluation report exists for
`yolo-v1`; the swap runbook and demo script are written; the handoff covers every page state.
</phase_16>

<workflow>
For **each** phase:

**Step 1: Plan (plan mode; stop for approval).**

- The setup results: newest QA report and what you'll fix first, and where the last session
  stopped.
- What you read and what you'll reuse, with file paths.
- Design: modules and interfaces, data flow, configuration, error handling, and the contract
  (unchanged, or the exact additive change with its decision entry).
- Files to add or change, by layer (station / app view / controller / service / model / tests /
  docs). Schema changes and migration names, if any.
- Risks and how each is mitigated (model accuracy, latency, duplicates, wrong batch, token leak).
- The test plan: unit tests per module, edge cases, the shared contract fixture, and the scenarios
  Codex will run from the handoff.
- Then ask, in **one batch with a recommended option each**, only the questions that change the
  build. Expected ones:
  - **Phase 14:** where the model file lives (git-ignored folder vs Git LFS); the confidence floor;
    where the held-out sample photos are; Python version on the camera machine; CPU or GPU.
  - **Phase 15:** what to do with `abrasion`/`dirt`; the class key names; the `source` for folder
    replay; a client capture id for idempotency (yes/no); trigger key vs interval for webcam.
  - **Phase 16:** the threshold approach for an early model (gap 2); the heartbeat (yes/no); how
    evaluation labels are stored.

**Step 2: Build** in small steps, each left green, after approval.

- Station code follows PEP 8 with type hints; add `ruff` (lint and format) and `mypy` or `pyright`
  (types) and `pytest`, all pinned in a dev requirements file.
- App code keeps every CLAUDE.md rule: MVC layering with Prisma only in `models/`, guards on every
  page and API route, `runInTransaction` + `recordAudit(tx, …)` for every mutation, tokens only in
  the UI, defect types and thresholds as data.
- If `prisma/schema.prisma` changes: `npm run db:migrate -- --name <change>`, then
  `npm run db:generate`.

**Step 3: Gates** (paste the real output summaries; never claim a gate you didn't run).

- App: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` (or `npm run check`).
- Station: `ruff check`, `ruff format --check`, the type checker, `pytest` (without torch for the
  unit tests).
- Docker: only if Docker files change, `docker compose up --build -d` and `/api/health` returns 200.
- E2E and browser tests: **not run (Codex)**. Put them in the handoff instead.
- The ui-craft Definition of Done on every touched screen.

**Step 4: Docs** (`/wrap-up`, without its git step).

- `docs/ROADMAP.md`: add the phase with ticked acceptance criteria.
- `docs/STATUS.md`: progress, test counts, next step, open questions (thresholds for an early model,
  class keys, model storage).
- `docs/DECISIONS.md`: new entries from **D-048** for the station architecture, model storage, the
  class keys, any contract addition, and anything that supersedes part of D-011 or D-020.
- `docs/API.md` and the README when the contract, setup or demo changes. `docs/SESSION_LOG.md`:
  prepend an entry.
- Write the QA handoff in `qa/handoffs/` from `qa/templates/handoff.md`, with the station's setup
  steps in "Extra steps", the exact commands Codex runs, and at least one negative scenario per
  feature (revoked token, no batch at Preparation, an unknown class, a wrong role on the Camera page).

**Step 5: Report** in the master spec's `<final_report_format>`. Say the changes are ready for
Dylan to commit; don't commit. The "Next session" prompt names the next phase in this file. Then
stop.
</workflow>

<constraints>
- The CLAUDE.md non-negotiables all apply. Two containers only (D-003): the station is not a
  service in `docker-compose.yml` and not part of the app image.
- **Zero app-code changes to plug in a model.** Phases 14–15 change no app behaviour except tests,
  ignore files, the simulator's unknown key and documented data steps. Any contract change is
  additive, optional, backwards compatible with the simulator, and has its own decision entry.
- The app decides verdicts (D-011). The station never applies PASS/REWORK/REJECT thresholds.
- Defect classes, thresholds, confidence floor, model path and source are data or config, never
  constants in code.
- Flagged scans are still decided only by the Quality Inspector (D-028).
- No per-person counts, rankings or scores anywhere (D-008). No phone or touch design.
- Never commit the model file, sample photos, the token or `.env`.
- Never run browser or e2e tests. Never branch, commit, push or open a PR without Dylan's explicit
  permission.
- If this brief conflicts with a settled decision or the code, say so in the plan and propose the
  smallest change. Don't silently pick one.
  </constraints>
