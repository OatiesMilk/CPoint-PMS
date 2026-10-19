# Session Log

Append-only, **newest on top**. One entry per Claude Code session.

Template:

```
## YYYY-MM-DD — Phase N: <short title>
**Who:** <teammate driving the session>
**Summary:** 1–3 sentences.
**Changed:** bullets by module/area.
**Gates:** lint ✅ · typecheck ✅ · test ✅ · build ✅ · e2e ✅/n/a · docker ✅/not run (why)
**Decisions:** D-0xx (if any)
**Follow-ups:** bullets
```

## 2026-10-19 — Phase 18: capture from the website

**Who:** Dylan (local `main` checkout at `95d80a8`, not committed)
**Summary:** Built the Capture page from `camera-capture-page.md`: the QI or FM captures from the browser and the app runs the model itself (ONNX Runtime on the CPU), then decides through the same `ingestScan`. Dylan took every recommended option in `phase-18-plan.md`. The first export padded photos to a full square and 16:9 frames disagreed with the station; a dynamic export with the station's "rect" letterbox and OpenCV-style resize made 7 of 7 photos agree.
**Changed:**

- Model: `src/server/lib/cv/` (`mapper.ts` ported from `mapper.py`, `yolo-output.ts` letterbox, resize and decode, `model-info.ts` sidecar, `model-runner.ts` the ONNX port, lazy load, one run at a time); `onnxruntime-node` 1.30.0; `CV_MODEL_PATH`.
- API: `POST /api/v1/scans/capture` (`scanController.capture`, shared image reading), `capture.service.ts` (repeat first, model check, batch check with `BATCH_MOVED`), `ingestScan` takes an origin (device token or website), `captureFieldsSchema`, `camera:capture` (QI, FM).
- Pages: `/camera/capture` (`capture-client.tsx`, `last-scan.tsx`), `src/lib/capture-rules.ts`; nav item Capture (the sidebar marks only the longest match); Camera page ("Capture page active", "Ways to capture", a button); QI home **Capture sections**.
- Station: `python -m cpoint_cv export-onnx` (`onnx_export.py`), `requirements-export.txt`, the mapper parity fixture writer.
- Docker and CI: `node:24-bookworm-slim` with OpenSSL, `ONNXRUNTIME_NODE_INSTALL=skip`, `docker/https.mjs` on 3443, entrypoint starts it when `certs/` has a certificate, `cv/models` and `certs` mounts, Node health check, `.dockerignore`/`.gitignore` (`certs`); `next.config.ts` traces the Linux ONNX runtime and reads `DEV_ORIGINS`; `npm run dev:https`, `npm run cv:parity`.
- Tests: 53 new unit tests (mapper parity, geometry, sidecar, rules, service, route, website origin); 6 station tests; `tests/e2e/capture.spec.ts` (not run). Docs: API, README (Capture from the website, mkcert, iPhone), `cv/README.md`, `MODEL_CARD.md`, DESIGN, the master spec's role table, ROADMAP, DECISIONS, QA handoff.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · unit 590 ✅ · build ✅ · station: ruff ✅ · ruff format ✅ · mypy ✅ · pytest 231 ✅ · `cv:parity` 7 of 7 ✅ · Docker image build ✅ (854 MB; the model loads and runs in it, 0.65 s per frame; the HTTPS listener proxied a request with a throwaway certificate) · e2e and browser tests not run (Codex) · `docker compose up` not run
**Decisions:** D-064, D-065, D-066, D-067
**Follow-ups:** Done the same day: Dylan installed mkcert, trusted its root on the iPhone and captured from Safari over `npm run dev:https` (working, his check). Codex runs `qa/handoffs/2026-10-19-phase-18-capture-page.md`. ONNX Runtime prints a harmless telemetry warning at start in Docker (the `nextjs` user has no home folder).

## 2026-10-19 — Phase 17: the camera station window

**Who:** Dylan (local `main` checkout at `dac8599`, not committed)
**Summary:** Built the station window from `camera-station-window.md`: a Tkinter window with Check this machine (the GPU included), a camera picker with DirectShow and a DroidCam address, a live preview labelled as a preview, Capture and Stop, run by the existing station loop on a worker thread. A `.cmd` launcher and a `shortcut` command open it without a terminal. Dylan took every recommended option in `phase-17-plan.md`.
**Changed:**

- Station core: `events.py` (what the loop reports, as data); `station.py` (`events`, `should_stop`, a frame's own capture time); `triggers.py` (`ButtonTrigger`); `sources.py` (`open_capture`, DirectShow); `yolo_detector.py` (`detect_frame` at another size, one lock); `overlay.py` (`draw_boxes` shared with the preview); `doctor.py` (pass/warn/fail, the GPU check, softer clock and version lines); `config.py` and `config.example.toml` (`[camera] backend`, `[window]`); `cli.py` (`window`, `shortcut`, `make_client`).
- Window: `cpoint_cv/window/` (presenter with no Tk, checks, cameras, settings, workers, view, app); `cpoint_cv/shortcut.py`; `cv/CPoint Camera.cmd`.
- Config: `requirements.txt` pins `pillow==12.3.0`; `pyproject.toml` 0.17.0; `.gitignore` (`/cv/station-window.json`); `.gitattributes` (`*.cmd` CRLF).
- App: the Camera page's "Connect the camera station" steps point at the shortcut and the window.
- Tests: 67 new station tests (presenter, checks, cameras and drivers, saved choice, trigger, launcher, threads with fakes, station events). Docs: `cv/README.md` (Use the station window, iPhone through DroidCam, demo script), ROADMAP, STATUS, DECISIONS, QA handoff.

**Gates:** lint ✅ · typecheck ✅ · unit 537 ✅ · build ✅ · station: ruff ✅ · ruff format ✅ · mypy ✅ · pytest 225 ✅ (also in a clean venv without OpenCV, torch or Pillow) · real model through the preview path on the GPU ✅ (35 ms at 960, 55 ms at 1536) · the window by hand, e2e and browser tests not run (Codex) · docker not run (no Docker change)
**Decisions:** D-059, D-060, D-061, D-062, D-063
**Follow-ups:** Codex runs `qa/handoffs/2026-10-19-phase-17-camera-window.md`. The preview rate (4 a second) is conservative for the GPU; raise `[window] preview_max_fps` if the panel wants smoother boxes. Dylans own test (2026-10-19, iPhone through DroidCam by address): live preview with boxes, Capture gave B-2026-0001 section 3, Reject, from the app. After it: the Checks list puts failures first with a scrollbar, the red bar names the failed check, the address message says DroidCam serves one viewer, and box colours avoid the verdict hues with labels on a dark chip. The DroidCam free watermark is detected as a scratch: use a clean view for real scans.

## 2026-10-19 — Phase 16 follow-up: reset run and Codex run 1 fixes

**Who:** Dylan (local `main` checkout, not committed)
**Summary:** Ran `npm run demo:reset -- --yes` on the dev database at Dylan's word (no backup, his call). Codex run 1 (`qa/reports/2026-10-19-phase-16-camera-page.md`) passed 19 of 21; its two failures were a stale local config and a stale e2e assertion, both fixed, and A4 was blocked by test order.
**Changed:**

- `cv/config.toml` (git-ignored): `found_at_or_above` and `[preview.actions]`; `evaluate` now gives 5 of 5 again.
- `cv/cpoint_cv/cli.py`: `predict` and `evaluate` warn when `[preview.actions]` is empty, and the settings line says so; `cv/tests/test_cli.py`.
- `tests/e2e/admin.spec.ts`: the threshold snapshot check uses `toMatchObject`.
- QA handoff `qa/handoffs/2026-10-19-phase-16-camera-page-run2.md` (R3 runs axe on the live camera states before any token is revoked).

**Gates:** lint ✅ · typecheck ✅ · unit 537 ✅ · station: ruff ✅ · mypy ✅ · pytest 158 ✅ · `evaluate` 5 of 5 ✅ · build not re-run (no app code changed) · e2e not run (Codex)
**Decisions:** none
**Follow-ups:** Codex run 2 (`qa/reports/2026-10-19-phase-16-camera-page-run2.md`): 4 of 4 passed, axe clean on every live camera state, e2e 14/14, pytest 158. Its notes: on PowerShell use `npm.cmd run cv:simulate -- …` so the flags reach the script (now in `cv/README.md`).

## 2026-10-19 — Phase 16: the Camera page, "When found" actions, a small model check and the demo reset

**Who:** Dylan (local `main` checkout after PR #10, not committed)
**Summary:** The Camera page now shows the real station honestly: Station connected between captures (the station checks in through `batches/current`), which model judged the last section, and an early-model notice that's a setting. "Confidence isn't severity" is handled as data: each defect type can be Rework or Reject when found. `evaluate` ran on the five sample photos (5 of 5, labelled a small check), and `npm run demo:reset` gives a clean demo system that keeps the accounts. Dylan took every recommended option in `phase-16-plan.md`. The newest QA report (Phase 15 run 2) had no app fault to fix.
**Changed:**

- App: migration `20261019120000_defect_actions` (`DefectAction`, `DefectType.action`, `CvSettings.foundAtOrAbove`, `earlyModelNotice`); decision engine (worst outcome wins) and ingest snapshot; Settings (When found field and column, found-at field, notice switch); Camera page and `cameraStatus` (states, Model card); scan page "Rules used"; `PUT /api/v1/settings/cv` takes an optional `foundPercent`.
- Reset: `scripts/demo-reset.ts`, `demo-reset.service.ts`, `demo-reset.model.ts`, `clearUploadFolders`, `runInTransaction` timeout option. Dry run on the dev database only.
- Simulator and demo week: the model's classes (`MODEL_CLASSES`, active types from the database); crease and scratch drawings.
- Station: check-in while waiting (`check_in_seconds`), overlap filter (`overlap_iou`), `[camera] url` / `CPOINT_CV_CAMERA_URL`, preview actions, `evaluate`; `cv/reports/2026-10-19-yolo-v1.md`; a drafted `labels.csv` beside the sample photos (outside the repo).
- Tests: 29 new Vitest (decision engine, camera status, reset, settings, scenario), 22 new pytest; e2e tests post their own `e2e-rule-*` types (not run).
- Docs: D-053 to D-058, `cv/README.md` (swap runbook, demo script, small check, IP camera), MODEL_CARD, API.md, ROADMAP, STATUS, QA handoff `qa/handoffs/2026-10-19-phase-16-camera-page.md`.

**Gates:** lint ✅ · typecheck ✅ · unit 537 ✅ · build ✅ · station: ruff ✅ · ruff format ✅ · mypy ✅ · pytest 156 ✅ · `evaluate` on the GPU ✅ · `demo:reset` dry run ✅ · e2e and browser not run (Codex) · docker not run (no Docker file changed)
**Decisions:** D-053, D-054, D-055, D-056, D-057, D-058
**Follow-ups:**

- Dylan: back up, then `npm run demo:reset -- --yes`; update `[preview]` in `cv/config.toml`; check `labels.csv`; commit and open the PR.
- Codex: the Phase 16 handoff.
- Confirm with CPoint which defect gets which "When found" action.

## 2026-10-19 — Phase 15 follow-up: Codex run 1 fixes

**Who:** Dylan (local `main` checkout after PR #9, not committed)
**Summary:** Codex passed 18 of 19 scenarios (`qa/reports/2026-10-19-phase-15-camera-station.md`), with the model working end to end on the website. Fixed its two failures and the duplicate-key warning it noticed, which was a real report bug.
**Changed:**

- F2: `tests/e2e/cv.spec.ts` D-028 test sends `sim-unknown`, not `crease` (now a real type).
- F1: `send_refused` station log lines carry `attempts` (`cv/cpoint_cv/client.py`, `station.py`), with a new test.
- `src/server/models/report.model.ts` `defectBreakdown`: a class key that was unknown when scanned and is a defect type now joins that type, so "Defects by type" shows each key once (it listed `crease` twice and broke React's keys). Checked on the dev database with the old and new query side by side.
- QA handoff `qa/handoffs/2026-10-19-phase-15-camera-station-run2.md`.

**Gates:** lint ✅ · typecheck ✅ · unit 508 ✅ · build ✅ (`npm run check`) · station: ruff ✅ · ruff format ✅ · mypy ✅ · pytest 134 ✅ · e2e not run (Codex, R1)
**Decisions:** none
**Follow-ups:** Codex run 2 (`qa/reports/2026-10-19-phase-15-camera-station-run2.md`) passed every fix; its one failure (R3) expected a `scratch` row on the QI home's today-only card when no `scratch` scan was taken today, a handoff mistake, not an app fault. No run 3.

## 2026-10-19 — Phase 15: the camera station (capture, send, recover)

**Who:** Dylan (local `main` checkout, not committed)
**Summary:** The camera station now sends scans: `python -m cpoint_cv run webcam | folder | file` knows the batch, captures one section per Space press (or every image in a folder), runs yolo-v1 and posts the scan, and survives network and server failures through a spool on disk. An optional `captureId` on the scan upload makes retries safe. `doctor` checks the setup. Dylan's answers: keep the model's class names, add them in Settings, turn off `abrasion`/`dirt`, `captureId` yes, folder replay uses the default source, Space to capture.
**Changed:**

- `cv/`: `station.py` (the loop), `client.py`, `transport.py` (stdlib HTTP), `retry.py`, `spool.py`, `sources.py`, `triggers.py`, `encode.py`, `doctor.py`, `env.py`, `logs.py`; `run` and `doctor` commands; `[server]`, `[station]`, `[camera]` settings; `.env.example`; README (run, failures, the Settings steps).
- App: `Scan.captureId` (migration `20261019090000_scan_capture_id`, written with `prisma migrate diff` because `migrate dev` is interactive-only here); validator, model, ingest service (a repeat returns the first scan, 200) and controller.
- Simulator and demo week: unknown class `sim-unknown` (was `scratch`).
- Tests: 6 new Vitest (captureId), fixture with `captureId` and `batchId`, 77 new pytest; `tests/e2e/cv.spec.ts` uses `sim-unknown` (not run).
- Docs: D-050, D-051, D-052, API.md, ROADMAP Phase 15, STATUS, the QA handoff.

**Gates:** lint ✅ · typecheck ✅ · unit 508 ✅ · build ✅ (`npm run check`) · prettier ✅ (touched docs) · station: ruff ✅ · ruff format ✅ · mypy ✅ · pytest 133 ✅ · `doctor` and `run` smoke-checked by hand without a token · e2e not run (Codex) · docker not run (no Docker file changed)
**Decisions:** D-050, D-051, D-052
**Follow-ups:**

- Dylan: do the Settings steps on each database (`cv/README.md`), and update `[preview]` in his own `cv/config.toml`.
- Codex: `qa/handoffs/2026-10-19-phase-15-camera-station.md` (includes the Phase 14 S5/S6 re-run).
- The simulator and demo week still draw `abrasion`/`dirt`; switch them to the model's classes when the demo is prepared (Phase 16).
- Overlap filter for duplicate boxes: still open.

## 2026-10-19 — Phase 14 follow-up: Codex runs 1 and 2

**Who:** Dylan (local `main` checkout, not committed)
**Summary:** Codex passed 9 of 10 scenarios (`qa/reports/2026-10-19-phase-14-cv-core-run2.md`), including the camera e2e spec 8/8 once Docker was running. The one failure, S6, was a wrong step in the handoff: the copied config sat in `cv/out/`, so its relative model path pointed there.
**Changed:**

- Handoff S6: the copied config sets `path = "../models/yolo-v1.pt"`; S5 expects the new message.
- `cv/cpoint_cv/cli.py`: a missing model file now names the config file and says relative paths are read from its folder.

**Gates:** station: ruff ✅ · ruff format ✅ · mypy ✅ · pytest 56 ✅ · S6 corrected steps checked by hand (warning, exit 0) · e2e by Codex (cv.spec 8/8)
**Decisions:** none
**Follow-ups:** optional Codex re-run of S5 and S6.

## 2026-10-19 — Phase 14: camera YOLO model intake and the inference core

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** Added the camera station's inference core, the `cpoint_cv` Python package in `cv/`. It loads `yolo-v1.pt`, runs it on images and prints what the app would receive, with a labelled preview of the verdict. It posts nothing, and no app code changed. A baseline on Dylan's five sample photos is in `cv/MODEL_CARD.md`: 4 of 5 would go to review today only because `crease` and `scratch` are unknown, and a clear cut scored 0.51.
**Changed:**

- `cv/`: detector port (`YoloDetector`, `FakeDetector`), mapper, payload builder, the D-011 preview port, config (TOML plus env), model info, summary and overlays; `predict` CLI; pinned requirements; `pyproject.toml` (ruff, mypy strict, pytest); README and `MODEL_CARD.md`.
- Model moved to `cv/models/yolo-v1.pt` (Dylan's OK); its SHA-256 is in the model card and `config.example.toml`. Dylan's `cv/config.toml` uses `cuda:0`.
- Contract on both sides: `tests/fixtures/cv-payload.json` (written by `cv/tests/test_contract_fixture.py`) and `tests/unit/cv-contract.test.ts`.
- `.gitignore`, `.dockerignore`, `eslint.config.mjs` (ignore `cv/**`, whose venv holds third-party JavaScript), and a `station` CI job.
- Docs: ROADMAP Phase 14, STATUS, D-048, D-049, the README camera section.

**Gates:** lint ✅ · typecheck ✅ · unit 502 ✅ · build ✅ · prettier ✅ · station: ruff ✅ · ruff format ✅ · mypy ✅ · pytest 56 ✅ (also in a fresh venv without torch) · e2e not run (Codex) · docker not run (no Docker file changed; `.dockerignore` only excludes more)
**Decisions:** D-048, D-049
**Follow-ups:**

- A larger held-out photo set with expected verdicts, for Phase 16's evaluation (five photos is a smoke test).
- Consider an overlap filter for duplicate boxes (Phase 15).
- Codex: `qa/handoffs/2026-10-19-phase-14-cv-core.md`.
- Phase 15: the station (capture, send, retries, spool), the class-key data step, the simulator's unknown key.

## 2026-10-14 — Follow-up: two e2e fixes after Codex's run 2

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** Run 2 passed all eight browser scenarios; the 16 sign-in failures did not recur. Two e2e tests failed: one is a real test/pagination mismatch, the other an intermittent hydration race. Both fixed in the tests; no app change.
**Changed:**

- `tests/e2e/cv.spec.ts`: after revoking, the token test checks the "revoked" toast and the 401, not the row. Revoked tokens sort after active ones, so with more than 15 tokens the row moves past page 1 (failed in both runs).
- `tests/e2e/inventory.spec.ts`: choosing Thread is retried until the unit follows. Once in two runs, the choice was made before the form hydrated and the unit stayed "roll".

**Gates:** lint ✅ · typecheck ✅ · unit 500 ✅ · build ✅ · e2e by Codex run 3 ✅ (seven specs three times 57/57, full suite 75/75; `qa/reports/2026-10-14-followups-run3.md`).
**Decisions:** none
**Follow-ups:** Codex: `qa/handoffs/2026-10-14-followups-run3.md`.

## 2026-10-14 — Follow-up: fixes from Codex's full-width/MR and pagination runs

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** Fixed both app faults and the four observations from the two QA reports, and gave e2e assertions more time on a cold server.
**Changed:**

- Procurement list: Items, Requested by, Sent, Expected and Status may wrap (Items to two lines), and "1 of 2 items approved" sits on its own line, so the table fits beside the sidebar at 1440 px (Codex: 1212 px wide in 1120 px).
- Migration `20261014120000_material_request_codes_legacy`: "Received for PR-…" (Phase 9 wording) becomes "Delivery for MR-…", and any other PR- number in ledger reasons or timeline notes becomes MR-. Tested on a scratch Postgres.
- Pager: "1 supplier that matches" / "3 suppliers that match" (`MATCHING` in `table-pager.tsx`).
- Copy to a new request: ticking a rejected item fills the untouched starter row instead of adding a second row under it.
- `playwright.config.ts`: `expect` timeout 10 s. 16 tests in the first wave failed at the home-page URL check with the page still on `/login`, then `/`; later tests passed. Not proven to be the cause; Codex's rerun checks it.

**Gates:** lint ✅ · typecheck ✅ · unit 500 ✅ · build ✅ · e2e: Codex rerun (`qa/handoffs/2026-10-14-followups-run2.md`).
**Decisions:** D-046 amended (legacy reasons)
**Follow-ups:** Codex: run the rerun handoff.

## 2026-10-14 — Follow-up: one pagination for every list (15 per page)

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** Every list that can grow now pages at 15 rows with one shared pager. Salvage, the Review queue, API tokens, the Settings lists and the leather-roll requesters gained pagination; the Settings lists and requesters also gained a Find box.
**Changed:**

- `src/lib/pagination.ts` (`PAGE_SIZE = 15` and helpers), `src/lib/use-paged-rows.ts` (find + pages for in-browser lists), `src/components/features/table-pager.tsx`.
- Services use `PAGE_SIZE`: batch, scan-query, inventory, procurement, user-admin, audit-query. `getItemDetail` also returns `total`.
- Salvage: `listSalvageItems` takes a page and returns `{ rows, total }`; `?page=` on the page and the API. Review queue: `page` and `autoPage`, the old "Showing the 50 oldest" note is replaced by the pager.
- Pages: the seven existing pagers replaced by `TablePager`; tokens, Settings (`reference-manager.tsx`) and `requesters-panel.tsx` paged.
- E2E: the Settings and requesters tests type into the Find box before looking for their row. New unit test `tests/unit/pagination.test.ts`.

**Gates:** see `qa/handoffs/2026-10-14-pagination.md` (lint, typecheck, unit tests, build run by Claude; e2e left to Codex).
**Decisions:** D-047
**Follow-ups:**

- Codex: run the handoff. Dylan: branch, commit and open the PR with the full-width/MR change (D-032).

## 2026-10-14 — Follow-up: full-width pages and MR request numbers

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** Pages now use the whole width beside the sidebar, and request numbers read MR-… (material request) instead of PR-… for every role, with a data migration for existing ones.
**Changed:**

- `src/app/(app)/layout.tsx`: removed the `max-w-6xl` cap on the page wrapper. `page-header.tsx`: the description stops at `max-w-3xl`. Constructor home: "My material requests" card is full width. Forms keep their own widths.
- `formatRequestCode` returns `MR-YYYY-NNNN`. Migration `20261014090000_material_request_codes` renames stored codes, "Delivery for …" ledger reasons and "Copied from …" notes; the audit log is untouched.
- Unit tests, the e2e row pattern, README, DESIGN.md, API.md and the schema comment use `MR-`.

**Gates:** see the QA handoff `qa/handoffs/2026-10-14-full-width-mr-codes.md` (lint, typecheck, unit tests, build run by Claude; e2e left to Codex).
**Decisions:** D-046
**Follow-ups:**

- Codex: run the handoff. Dylan: branch, commit and open the PR when happy (D-032).

## 2026-10-14 — Phase 13: QA closed and the Docker demo-week check

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** Codex's fifth run showed the connection reset gone. One long test ran out of time once under load and now has 60 seconds. The Docker demo-week check passed on a throwaway stack. Phase 13 is ready for Dylan to branch and commit.
**Changed:**

- Read `qa/reports/2026-10-14-phase-13-material-requests-run5.md`: build passed; `--keepAliveTimeout 70000` confirmed on the live e2e server; three parallel runs of 45: 44/1, 45/0, 45/0; no `ECONNRESET` in any. Run 1's failure was the full request-to-delivery journey test hitting its 30 s limit while a page loaded (21–23 s in the other runs).
- `tests/e2e/procurement.spec.ts`: that one test has `test.setTimeout(60_000)`. Not re-run by Codex (Dylan, 2026-10-14: no sixth run; CI runs the e2e specs on the PR and retries a failure once).
- **Docker demo-week check, passed** (Claude, throwaway stack `-p cpoint-demo13` on ports 3300/55432 with its own image tag, removed afterwards with its volumes; the dev database was not touched): the image built; health OK; "Demo week seeded" with 14 batches, 290 scans, 9 requests; requests by status: 1 pending, 1 approved, 2 ordered (1 late), 1 partly received, 1 received, 1 rejected, 2 cancelled; 1 raised by the Floor Manager; 2 deliveries with 2 JPEGs and 1 PDF, all three files present on the uploads volume; every delivery has proof; no line received above its quantity; every item's stock equals its ledger; 2 scans left for review; a restart did not seed again.
- Not changed: the `next start` with `output: standalone` warning in the e2e server log (since Phase 9; the server starts fine).

**Gates:** lint ✅ · typecheck ✅ (the last change is test-only; unit tests and build were green before it and no source changed since) · e2e by Codex: run 5 two of three parallel runs green, the remaining failure addressed but not re-run · docker demo-week ✅.
**Decisions:** none
**Follow-ups:**

- Dylan: branch, commit, push, open the PR (D-032). Watch the e2e and Docker jobs in CI.
- The untracked `phase-13-plan.md` in the root can be deleted once Phase 13 is merged.

## 2026-10-14 — Phase 13: contrast finding closed, one flaky e2e call after Codex's fourth QA run

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** Run 4 closed the contrast question: the short-delivery test passed three times out of three once it waited for the dialog to open, so run 3's finding was a measuring fault in the test and the app's colours are unchanged. One new intermittent failure appeared in an older test; the e2e server's keep-alive timeout was raised as the likely fix.
**Changed:**

- Read `qa/reports/2026-10-14-phase-13-material-requests-run4.md`: build passed; single test 3 of 3; parallel 44 passed, 1 failed of 45; serial procurement 15 of 15.
- F1 (run 4): `apiRequestContext.post: read ECONNRESET` on `POST /api/v1/procurement/requests` in the D-031 leather-roll test, parallel run only; the test passed in runs 2 and 3 and in the serial run. Codex judged it an app or server fault. Claude's reading: the e2e server logged no error for the request (an exception in the app returns a logged 500, not a dropped connection), and the failing call follows a pause of several seconds, longer than Node's 5 s keep-alive, so Playwright's API client reused a connection the server had just closed. **Inferred from the log and the test's timing; not reproduced.**
- `playwright.config.ts`: the e2e server starts with `--keepAliveTimeout 70000`. No application code or test changed.
- `qa/handoffs/2026-10-14-phase-13-material-requests-run5.md` and `qa/CODEX_PROMPT_PHASE_13_RUN5.md`: the parallel set three times.

**Gates:** lint ✅ · typecheck ✅ · unit tests and build not re-run (no source change since the last green run) · e2e not run by Claude · docker demo-week not run (Dylan: after the phase is complete).
**Decisions:** none
**Follow-ups:**

- Run Codex on the run 5 handoff. If ECONNRESET recurs, the keep-alive reading is wrong: look at the request path under parallel load.
- The Docker stack runs the standalone server, which this option does not reach; CI retries a failed e2e test once.
- Docker demo-week check, as the last step before the PR.

## 2026-10-14 — Phase 13: one open axe finding after Codex's third QA run

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** Codex's third run (e2e only) passed 44 of 45; E1 to E3 are fixed. The one failure is a serious axe `color-contrast` finding on three grey texts in the Record delivery dialog. Its cause is not established, so no application code was changed; the test helper now gathers the evidence.
**Changed:**

- Read `qa/reports/2026-10-14-phase-13-material-requests-run3.md`: build passed; 44 passed, 1 failed of 45 (parallel); 14 passed, 1 failed of 15 (serial); the failure reproduced when run alone.
- The flagged text uses `text-muted-foreground` on the dialog's white surface, about 6.8:1 by calculation against 4.5:1 required, and the same classes pass axe on every page and elsewhere in the same dialog. The test ran axe the moment the dialog opened, during its 0.2 s fade-in. Claude's judgement is that the finding is a measuring artefact; against that, the same three elements failed in all three runs. **Unproven either way.**
- `tests/e2e/procurement.spec.ts`: `expectAccessible` now waits for finite animations to end before running axe, and prints, per element, the text colour, background colour, ratio, required ratio and font size axe measured. The short-delivery test also waits for the dialog's first field before the check.
- `qa/handoffs/2026-10-14-phase-13-material-requests-run4.md` and `qa/CODEX_PROMPT_PHASE_13_RUN4.md`: run the one test three times, then the full specs.
- Not done: Codex suggested raising the contrast of the muted token in `tokens.css`. It is used across the whole system and passes elsewhere, so it waits for the measurement.

**Gates:** lint ✅ · typecheck ✅ · test ✅ (494) · build ✅ · e2e not run by Claude · docker demo-week not run.
**Decisions:** none
**Follow-ups:**

- Run Codex on the run 4 handoff. If the finding recurs with the same low ratio on white, fix the colours in the dialog or the token and re-measure both themes (DESIGN.md).
- Docker demo-week check before the PR.
- The e2e server's "destination stream closed early" lines rose to 25 in the parallel run (15 in run 2); wording unchanged, no failing test.

## 2026-10-14 — Phase 13: e2e test fixes after Codex's second QA run

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** Codex's second run passed all 13 manual scenarios, so the proof-file fix and the six scenarios blocked in run 1 are verified in a browser. Three more faults in the e2e tests were corrected. No application code changed.
**Changed:**

- Read `qa/reports/2026-10-14-phase-13-material-requests-run2.md`: manual 13 of 13 passed; F1, F3, F4 and F5 from run 1 confirmed fixed; e2e 43 passed, 2 failed of 45 in parallel, 12 passed, 3 failed of 15 in a serial procurement run.
- E1, E2, E3 (tests only), fixed in `tests/e2e/procurement.spec.ts`: an ambiguous "Note" label, a helper page axe couldn't scan (now opened from an explicit context), and a controlled checkbox driven with `check()`/`uncheck()` (now clicked, with the result asserted).
- `qa/handoffs/2026-10-14-phase-13-material-requests-run3.md` and `qa/CODEX_PROMPT_PHASE_13_RUN3.md`: an e2e-only third run.

**Gates:** lint ✅ · typecheck ✅ · test ✅ (494) · build ✅ · e2e not run by Claude; two procurement tests have still never run to their end · docker demo-week not run.
**Decisions:** none
**Follow-ups:**

- Run Codex on the run 3 handoff (e2e only), then read its report.
- Docker demo-week check before the PR.
- Codex ran the dev server on port 3001 because another project's Vite server holds port 3000 on this PC.

## 2026-10-14 — Phase 13: fixes after Codex's first QA run

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** Codex's first Phase 13 run found one app fault and three faults in the e2e tests Claude had written without running. All four are fixed, and a second, shorter handoff covers the six scenarios Codex's runner blocked.
**Changed:**

- Read `qa/reports/2026-10-13-phase-13-material-requests.md`: 47 of 54 manual checks passed, 1 failed, 6 blocked; e2e 36 passed, 9 failed of 45.
- F1 (app, Medium), fixed: in `delivery-dialog.tsx` the file picker was cleared before the chosen files were copied out of its live `FileList`, so a proof file picked after an error or after removing another was sometimes lost. The files are now copied first.
- F3, F4, F5 (tests only), fixed in `tests/e2e/procurement.spec.ts`: a renamed error id, a note matched twice, and five tests that navigated before sign-in had finished. Added a step that picks a file, removes it and picks two more, so F1 stays covered.
- S19 to S24 were blocked by the QA runner (it typed into a disabled box, then closed the request early), so a second delivery, adding proof later and close short after two deliveries have **not** been checked by hand. `qa/handoffs/2026-10-14-phase-13-material-requests-run2.md` covers them with a fresh request (13 scenarios), with `qa/CODEX_PROMPT_PHASE_13_RUN2.md` as the prompt.
- Not changed: a React hydration warning about `caret-color` that Codex saw on two pages. Nothing in the project sets that style; run 2 asks Codex whether it recurs.

**Gates:** lint ✅ · typecheck ✅ · test ✅ (494) · build ✅ · e2e not run by Claude; the corrected procurement tests have still never passed · docker demo-week not run.
**Decisions:** none
**Follow-ups:**

- Run Codex on the run 2 handoff, then read its report.
- Docker demo-week check before the PR.

## 2026-10-13 — Phase 13: Ordering, delivery with proof, and the remaining gaps

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** A request now runs approved → ordered → partly received → received. The Floor Manager records the order (supplier, reference, expected date) and each delivery with proof files; short deliveries stay open or are closed short. The Floor Manager can also cancel after approval with a reason and raise restock requests, and a rejected or cancelled request can be copied to a new one.
**Changed:**

- Start of session: local `main` level with GitHub at `c044511` (Phase 12, PR #5). `docs/STATUS.md` corrected (it still said Phase 12 was uncommitted). Deleted the untracked `phase-12-plan.md`; added `qa/reports/artifacts/` to `.gitignore`. Plan in `phase-13-plan.md` (project root), approved by Dylan with all four recommended answers.
- Schema: migration `20261013090000_purchase_ordering_deliveries`, written by hand from `prisma migrate diff` and applied to the dev DB with `db:deploy` (no drift afterwards). Statuses `ORDERED` and `PARTIALLY_RECEIVED`; order, cancel-reason, closed-short and `copiedFromId` fields on the request; `receivedQuantity` on the line; new `PurchaseDelivery`, `PurchaseDeliveryLine`, `PurchaseAttachment`; `deliveryId` on events. Requests already received each became one delivery without proof, and the line's `movementId` moved to the delivery line.
- Rules: `procurement-rules.ts` gains the new moves and their one-sentence refusals, `STATUS_ORDER`, `outstandingQuantity`, `deriveReceiptStatus`, `shortfallNote`, `isDeliveryLate` and the proof-file limits.
- Server: `orderRequest`, `recordDelivery`, `addDeliveryProof`, `closeShort`, `getProofFile`, `getCopySource` in the service; cancel now takes a reason after approval; new `attachment-type.ts` (JPEG, PNG, WebP, PDF from the bytes; safe file names) and `receipt-sample.ts` (generated sample proof). Routes: `order`, `deliveries`, `close-short`, `deliveries/{id}/attachments`, `attachments/{id}`, `suppliers`; the `receive` route is gone. `procurement:request` includes the Floor Manager.
- UI: request page (Order card, Deliveries card with proof, "Arrived" column, timeline with proof and copy links); new `delivery-dialog.tsx` and `proof-files.tsx`; `request-actions.tsx` rewritten (order, cancel with a reason, close short); list with seven tabs, Expected column, late and "Raised by Floor Manager" badges and a Delivery filter; new-request form takes a copy and the Floor Manager; "Request" on low inventory rows; home card shows to-order and late counts.
- Operations report: "requested" and "approved, not all received" use the new statuses; "late" is now past the expected delivery date.
- Seed: nine requests replayed in time order through the services, with generated proof files.
- Tests: rules, service, permissions, validator-message, seed and a new `attachment-type.test.ts`; `procurement.spec.ts` updated for the new flow and six scenarios added.

**Gates:** lint ✅ · typecheck ✅ · test ✅ (494) · build ✅ · e2e not run by Claude (Codex runs it from `qa/handoffs/2026-10-13-phase-13-material-requests.md`) · docker demo-week not run · screens not checked in a browser by Claude.
**QA:** read `qa/reports/2026-10-13-phase-12-material-requests.md` first. Nothing to fix in the app: its one failure (S17) was a wrong handoff expectation, already corrected, and two checks were blocked by missing test data. The Phase 13 handoff has a migration check on a request received before the change (S40), and lists the demo-week check on a throwaway stack as an optional step before the PR.
**Decisions:** D-041, D-042, D-043, D-044, D-045
**Follow-ups:**

- One unit test caught a real fault during the build: a lost backslash meant Windows paths weren't stripped from proof file names. Fixed, and the test stays.
- The migration's backfill ran on the dev DB (which had received requests) but its result was not inspected row by row; the handoff has a check for it.
- Confirm with CPoint: who orders leather rolls (survey Q14), whether proof is always available at delivery, and the 365-day limit on expected dates.
- Run the Docker demo-week check before the PR (the seed changed and now writes files to the uploads volume).
- Not built, by scope: per-item orders, editing an order after it is marked, deleting proof files, CSV export of requests.

## 2026-10-13 — Phase 12: Item-level decisions guided by stock

**Who:** Dylan (local `main` checkout, not committed; no branch, by his instruction)
**Summary:** The Floor Manager now approves or rejects each item of a request, with the stock now and when requested beside it; well-stocked items start on Reject and low ones on Approve, as suggestions only. The request's status follows from its items, the requester sees the result per item, and receiving adds only approved items to stock.
**Changed:**

- Start of session: local `main` was 2 commits behind GitHub; fast-forwarded to `8adab3a` (Phase 11, PR #4). `docs/STATUS.md` corrected (it still said Phase 11 was uncommitted).
- Schema: migration `20261013030000_purchase_line_decisions`, written by hand and applied to the dev DB with `db:deploy` (`prisma migrate diff` shows no drift). New enum `PurchaseLineDecision`; lines gain `decision`, `rejectionReason`, `decidedById`, `decidedAt`. Decided requests had their outcome copied onto their lines. The dev DB also had Phase 11's migration pending; it was applied in the same run.
- Rules: `procurement-rules.ts` gains `deriveRequestStatus`, `decisionSummary`, `decisionEventNote`, `WELL_STOCKED_FACTOR`, `isWellStocked`, `suggestedDecision`, `wellStockedReason`, `stockGuidanceLine`.
- Server: `decideRequest` in the service (approve and reject now go through it); `setLineDecision` in the model; `decideSchema`; `POST /api/v1/procurement/requests/{id}/decide`; receive posts approved lines only; open-request queries and the Operations stock table skip rejected lines.
- UI: new `line-decisions.tsx` (the decision panel in the Items card); the request page shows each item's decision and reason and "N of M items approved"; "Reject whole request…" in the Decision card; the list and the constructor home show "1 of 2 items approved" on mixed requests.
- Seed: the approved demo request has two items, one rejected.
- Tests: rules, service, validator-message and seed tests; `procurement.spec.ts` updated (Approve and Reject buttons changed) and two scenarios added.

**Gates:** lint ✅ · typecheck ✅ · test ✅ (454) · build ✅ · e2e not run by Claude (Codex runs it from `qa/handoffs/2026-10-13-phase-12-material-requests.md`) · docker demo-week not run · screens not checked in a browser by Claude.
**QA:** read `qa/reports/2026-10-11-phase-11-material-requests.md` first. Its one failure (F1) was already closed in Phase 11 as a wrong handoff expectation, so nothing to fix. Codex's Phase 12 report `qa/reports/2026-10-13-phase-12-material-requests.md`: 28 of 31 checks passed and all 39 e2e tests in five specs passed on a production build. The one failure (S17) was a wrong expectation in the handoff, not an app fault: receiving REQ-A had raised the item to 6 boxes, between its reorder level and 2×, so nothing is pre-selected (D-040); the handoff was corrected. Two migration checks (S20, S21) were blocked because the dev DB had no request approved or rejected before the change, so the migration's backfill of approved and rejected requests has only been checked on a received one (S22).
**Decisions:** D-039, D-040
**Follow-ups:**

- Confirm the 2× well-stocked factor with CPoint.
- An item between its reorder level and 2× gets no pre-selection; say so to CPoint when confirming the factor.
- Run the Docker demo-week check before the PR (the seed changed).
- Phase 13 next (ordering, delivery with proof, the remaining gaps). It needs received quantities per line; Phase 12 added none.

---

## 2026-10-10 — Phase 11: Material requests (naming, remarks, urgency, specific messages)

**Who:** Dylan (local copy, not committed; no branch, by his instruction)
**Summary:** Constructors now see "Material requests" and the FM/Admin "Procurement"; an optional first remark replaces the required justification; urgency (High/Medium/Low) is worked out from a required needed-by date by working days; every form message in the system names the field and the fix.
**Changed:**

- Schema: migration `20261010153000_material_requests_remarks_urgency`, applied to the dev DB. It copied each justification into a first remark, gave requests without a needed-by date `createdAt + 7 days`, then dropped `justification`, `priority` and the `PurchasePriority` enum. The three existing dev requests kept their text as remarks.
- Rules: `procurement-rules.ts` gains `requestLabelsFor`, `urgencyFor`, `urgencyOf`, `daysLeftLabel`, `urgencyCutoffs`, `urgencyDateRange` and the constants.
- Server: procurement validator, model and service; Operations report counts High urgency; navigation label by role; demo seed uses needed-by dates and remarks.
- UI: request form (Needed by required with a live urgency preview, Remarks, no Priority), `UrgencyBadge`, urgency filter, list and detail pages, FM home card, constructor home.
- Messages: all validators, `errors.ts` (`summarizeIssues`), `action-result.ts` (full-path keys), shared `FieldError`, `FormErrorSummary`, `focusFirstInvalid`; salvage, stock, user, token and settings dialogs focus the first invalid field.
- Tests: `validator-messages.test.ts` (new), urgency and label tests, service tests; e2e specs updated and three scenarios added.
- `vitest.config.mts`: the `server-only` stub path now uses `fileURLToPath`. With `.pathname`, a project folder with spaces in its name broke `format.test.ts` on this machine.

**Gates:** lint ✅ · typecheck ✅ · test ✅ (435) · build ✅ · e2e not run by Claude (Codex runs it from `qa/handoffs/`; one partial run on this machine was unreliable because Playwright's browser isn't installed) · docker demo-week not run · screens not checked in a browser by Claude.
**QA:** Codex's report `qa/reports/2026-10-11-phase-11-material-requests.md`: 34 of 35 scenarios passed and all 50 e2e tests in six specs passed on a production build. The one failure (F1, fields not stacking at 960px) was a wrong expectation in the handoff, not an app fault (D-034 stacks below 640px); the handoff was corrected. From its observations: `next.config.ts` now sets `logging.serverFunctions: false`, because `next dev` printed sign-in passwords in the terminal.
**Decisions:** D-035, D-036, D-037, D-038
**Follow-ups:**

- The e2e server logs "The destination stream closed early." while tests pass; cause not confirmed.
- Confirm with CPoint: the 3/7 working-day bands, Monday–Friday, no holidays.
- Run the Docker demo-week check before the PR.
- Phase 12 next (item-level decisions guided by stock).

---

## 2026-10-08 — Rework board: collapsible columns

**Who:** team (local copy, not committed)
**Summary:** The three Rework columns fold to their header; the choice is saved in the browser. Layout is three columns or one stack, so a folded column never leaves a gap.
**Changed:** `rework/rework-column.tsx` (client, open/closed only), `rework/page.tsx` (container query layout), `tests/e2e/rework-columns.spec.ts`, DESIGN.md.
**Gates:** lint ✅ · typecheck ✅ · e2e written, not run (needs a build) · checked by hand at 640, 960 and 1440 px.

---

## 2026-10-08 — Phase 10: Operations reports

**Who:** team (local copy, not committed)
**Summary:** Rebuilt the Floor Manager's Reports around operations (D-033); the Quality report stays as a tab and is the Quality Inspector's report, now with the repair station.
**Changed:**

- `/reports`: Operations and Quality views, attention list, line by stage, flow chart, repair station, materials at risk, purchasing, suppliers, checkpoint summary, Pareto on defects.
- API and CSVs: operations, repairs, operations.csv, stock.csv, suppliers.csv. `stageDurations` adds the 90th percentile.
- Tests: new unit tests for the rules and service; e2e reports spec updated.
  - Responsive pass (D-034): sidebar rail below 1024px, auto-fit and stacking grids on every page, wrapping action rows, Table wrapper fix.
    **Gates:** lint ✅ · typecheck ✅ · unit tests ✅ (388) · build not run (a dev server was using `.next`) · e2e not run (needs a build) · docker not run. Checked by hand in the browser against the demo week: Floor Manager Operations and Quality tabs. The Quality Inspector's view was not opened in a browser.

---

## 2026-10-05 — Phase 9 follow-up: leather-roll requesters, branch workflow

**Who:** Team + Claude Code
**Summary:** Applied the team's answers.

- **D-028 confirmed:** the FM doesn't decide flagged scans.
- **Procurement rule (D-031, supersedes D-030):** every Shoe Constructor requests materials, and
  only the ones the FM or Admin allows can request leather rolls.
- **Branch workflow (D-032):** the docs and tooling now say `main` plus pull requests that the
  team merges.

**Changed:**

- **Schema:** migration `leather_roll_requesters`.
  - `canRequestMaterials` is renamed to `canRequestLeatherRolls` (who was designated is kept).
  - Request lines record their `category`, backfilled from the item, so typed leather rolls are
    caught too.
- **Server:**
  - `canRequestLeatherRollsFor`; submit, cancel and remarks need only the constructor role;
  - a leather-roll line without the OK is refused with 403 `LEATHER_ROLLS_NOT_ALLOWED`;
  - the picker marks leather rolls `allowed: false`, and the audit actions are
    `procurement.leather_rolls.*`.
- **UI:**
  - the form greys out leather rolls with a note, and typed items choose a kind;
  - the constructor home and Procurement are the same for every constructor;
  - "Leather roll requesters" tab, plus the Admin menu wording.
- **Tests:**
  - unit: picked and typed leather rolls, the picker, permissions;
  - e2e: supplies are always allowed; leather rolls work after the FM allows them and are
    refused again once stopped, on the next request.
- **Docs and tooling:**
  - CLAUDE.md, the `/resume` and `/wrap-up` skills, AGENTIC_WORKFLOW, the ROADMAP header, and CI
    triggers (`main` plus pull requests);
  - API, README (overview, accounts, demo script, ERD), DESIGN, the master spec roles table,
    STATUS.

- **Security fix found by the Docker e2e run:** the sign-in form could submit natively before
  hydration, as GET, putting the email and password in the URL. It's now `method="post"`, with
  the button disabled until hydration. There's an e2e regression test (it fails before the fix).
- **Test stability:**
  - the e2e helpers left a browser page open per API login, and full runs crashed Chromium;
    they're closed now;
  - a procurement check filters to its own item, since data piles up across runs.

**Gates:**

- lint ✅ · typecheck ✅ · test ✅ (364) · build ✅ · format ✅
- e2e ✅ 64/64 three times on `next start`, and twice on a fresh Docker stack. The stack applied
  all 6 migrations and seeded one request per state, with stock equal to the ledger.
- Before the page-leak fix, the same browser crash showed with both the old and new login forms
  (an A/B check).
- The sandbox ran out of disk once; I pruned the Docker build cache (26 GB).
  **Decisions:** D-031, D-032 (D-028 confirmed)
  **Follow-ups:** open the PR into `main`; tell CPoint about the Q5 change (D-028).

---

## 2026-10-05 — Phase 9: Procurement & review access

**Who:** Team + Claude Code
**Summary:** Added the procurement module, and fixed an access bug in the review queue.

- **Procurement:** designated Shoe Constructors request materials; the Floor Manager approves or
  rejects them and marks them received, which posts the stock IN through the inventory ledger.
- **Bug fix:** only the Quality Inspector now decides scans the camera flagged. This changes the
  review part of D-011 and needs CPoint's confirmation.

The Step 1 answers:

- receipt is in this phase, for the whole request;
- a flagged scan is QI-only for life;
- the FM keeps the review queue, read-only;
- requests can have up to 10 items.

**Changed:**

- **Scans (D-028):**
  - `scan:review` (QI) and `requiredDecisionPermission`, enforced in `decideScan` (403);
  - the FM sees "Waiting for a Quality Inspector" on the scan and in the queue.
- **Schema:** `procurement` migration: requests, lines with a stock snapshot, events, remarks, a
  sequence table, and `users.canRequestMaterials`.
- **Server:**
  - `lib/procurement-rules.ts`, `procurement.{model,service,validator,controller}`;
  - permissions `procurement:{read,request,decide,remark,designate}`;
  - the requester guards; the flag on `SessionUser`;
  - a role change clears the flag.
- **API:** `/api/v1/procurement/**` (requests, actions, remarks, items, requesters).
- **UI:**
  - the list, form and detail pages;
  - the Requesters tab, FM home card, Inventory "Requested" badge, constructor home, and the
    Admin Users toggle.
- **Seeds:** bootstrap designates the demo constructor; the demo week adds five requests, one per
  state.
- **Fixes found by the gates:**
  - the detail table overflowed at 1280 px;
  - an invalid `<dl>` in the FM card (axe, seen only on the Docker demo);
  - the Latest scans skeleton `<ul role=status>` (axe; a Phase 8 regression);
  - three e2e tests that broke as test data grew.

**Gates:** lint ✅ · typecheck ✅ · test ✅ (362) · build ✅ · format ✅ · e2e ✅ 63/63 twice on
`next start` and twice on a fresh Docker stack with the demo week · docker ✅ demo week checked in
psql (one request per state, stock equals the ledger, flagged scans decided only by the QI, no
re-seed on restart). Sandbox deviations: a base-image build arg, and another project name and
ports so the dev DB kept running.
**Decisions:** D-028 (QI-only flagged scans, supersedes part of D-011), D-029 (purchase requests),
D-030 (designated requesters)
**Follow-ups:**

- Confirm with CPoint: the Q5 change (D-028), and who approves leather rolls (Q14).
- Open a PR into `main` when the team is ready.
- Optional: CSV export and monthly counts for procurement.

---

## 2026-10-03 — Phase 8: Hardening & demo

**Who:** Team + Claude Code
**Summary:** The system is panel-ready:

- a realistic demo week seeded through the real services;
- a smoke test per role with axe on every page;
- a ui-craft audit with every finding fixed or listed;
- a fresh-machine Docker run from the README;
- a rewritten README with an architecture diagram, ERD and a 10-minute demo script.

**Changed:**

- **Demo seed (D-026):**
  - `services/demo-seed.service.ts`, `lib/leather-scan.ts` (shared with the simulator),
    `npm run demo:seed`, and `SEED_DEMO_WEEK` (passed through compose, documented in
    `.env.example`).
  - It runs in the background on start, and only on an empty database.
  - Services pass `now` through to `createdAt`/`openedAt`. `sharp` is a direct dependency.
- **Tests:**
  - `tests/e2e/smoke.spec.ts`: every sidebar page per role renders and passes axe (WCAG 2.1
    A/AA, light, and dark for the FM). Short journeys for FM, QI, Admin and Constructor.
  - Unit tests for the seed (determinism, stage times, guards, time order, two scans left for
    review).
  - Two older e2e tests now search instead of browsing page 1.
- **UI fixes (`docs/UI_AUDIT.md`):**
  - The superseded verdict is struck through, not faded. The admin health list is a valid `dl`.
    Skeletons have `role=status`.
  - The review queue has a `?batch=` filter and a truncation note. The rework "Repaired" column
    is capped at 12.
  - The batches table fits at 1280 px. The admin nav shows a single active link. Latest scans
    wraps. The "All 0 scans" link is hidden. Salvage Discard has more space.
- **CI:** the docker job starts with the demo week and checks the counts, a pending review, that
  stock equals the ledger, and that a restart doesn't re-seed.
- **Docs:**
  - README rewrite: Mermaid architecture and ERD (both render), demo quick start, demo script,
    screenshots in `docs/screenshots/`.
  - DESIGN.md rules from the audit.
  - `ComingSoonCard` removed.

**Gates:** lint ✅ · typecheck ✅ · test ✅ (299) · build ✅ · format ✅ · e2e ✅ 57/57 twice on
`next start` and twice on a fresh Docker stack loaded with the demo week · docker ✅ fresh clone,
fresh volumes, README steps. Sandbox deviations: a base-image build arg, and a separate compose
project name so the dev volumes weren't reused.
**Decisions:** D-026 (demo week seed), D-027 (Prisma CLI npm audit highs accepted)
**Follow-ups:**

- CPoint confirmations (thresholds, shift length, salvage/yield rules, Constructor scope).
- Real YOLO model and new defect classes (added as data in Settings).
- Component tracking once CPoint gives the component counts per shoe type.

---

## 2026-10-03 — Phase 7: Dashboards & reports

**Who:** Team + Claude Code
**Summary:** Added Reports:

- daily summary by final verdict, defects by type, camera call vs final verdict with AI agreement,
  and time per stage with the bottleneck;
- three CSV exports;
- live cards replacing every "Phase 7" placeholder on the FM and QI homes.

Also fixed a real sign-out bug: sessions are now revoked server-side.
**Changed:**

- Domain: `src/lib/report-rules.ts` (range presets, day filling, agreement, bottleneck, safe CSV),
  `formatDayLabel`.
- Server:
  - `models/report.model.ts` (all report SQL, Manila-day buckets);
  - `services/report.service.ts` (no person fields);
  - `validators/report.validator.ts`, `controllers/report.controller.ts`;
  - `/scans?defect=` filter.
- API: `/api/v1/reports/quality`, `/production`, `/daily.csv`, `/defects.csv`, `/stages.csv`.
- UI:
  - **Recharts** (installed): `VerdictTrendChart`, `BarList`, `SplitBar`, `VerdictLegend`;
  - **tokens:** chart-only `--chart-*` tokens validated with the dataviz palette validator (light
    and dark);
  - **pages and cards:** `/reports`; the FM home split + daily summary cards; the QI home
    defects + agreement cards;
  - **nav:** Reports is live.
- **Fix (auth):** a late prefetch response could restore the session cookie after sign-out (the
  e2e sign-out test failed once, then 3 of 4 under stress before the fix). JWTs now carry a `sid`;
  sign-out writes it to `session_revocations` (migration), and the guard refuses it. 8/8 under
  stress after the fix.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (292) · build ✅ · e2e ✅ (47 against
`next start`, twice; reports + auth specs 4× repeated, 56/56) · docker ⚠️ **not run locally**
(see below; the CI docker job builds the image and runs the migrations on a fresh volume) ·
psql ✅:

- a day's report matches hand counts (454 / 145 / 371);
- revocation rows exist and are pruned;
- the migration is applied.

**Decisions:** D-025
**Follow-ups:**

- **Sandbox:** the Docker daemon hit the sandbox's background time limit and was stopped (it was
  already at the longest limit). Postgres kept running, and the rest of the session reached it on
  its container IP. One full e2e run failed as the port forward died (a reports test's sign-in);
  it passed in every run since.
- **Audit:** `npm audit` reports 4 high issues in the Prisma CLI's dependencies (deepmerge-ts,
  mysql2). They were there before this phase and aren't in the app's runtime. Revisit in Phase 8.
- **Dead code:** `ComingSoonCard` is now unused; remove or keep for Phase 8 placeholders.
- Phase 8: hardening and demo.

## 2026-10-03 — Phase 6: Admin

**Who:** Team + Claude Code
**Summary:** Gave the System Admin real tools:

- accounts with temporary passwords, a forced change and resets that end every session;
- Settings for thresholds, defect types (with an Unknown classes panel), shoe types, suppliers and
  components;
- a read-only audit log viewer with field diffs;
- live admin home cards.

**Changed:**

- DB: migration `users_sessions_valid_from`.
- Auth: the JWT `authAt` claim; `checkSession` ends sessions older than `sessionsValidFrom`; the
  guard forces `/account/password` on `mustChangePassword`; API `403 PASSWORD_CHANGE_REQUIRED`;
  `/logout?reason=password-reset`.
- Domain: `src/lib/admin-rules.ts` (temp password, account guards, threshold validation and
  description, audit diff).
- Server:
  - models: user admin queries; generic reference-data CRUD; unknown class keys; thresholds;
    the audit viewer;
  - services: `user-admin`, `settings`, `audit-query`, `changeOwnPassword`;
  - validators: user, settings, audit;
  - controllers: user, settings (a reference controller factory), audit.
- API: `/api/v1/users` (+ reset-password, unlock), `/settings/cv`, `/defect-types` (+ `/unknown`),
  `/shoe-types`, `/suppliers`, `/component-types`, `/audit-logs` (`docs/API.md`).
- UI:
  - pages: `/admin/users`, `/account/password`, `/admin/settings` (5 tabs), `/admin/audit`,
    `/components`;
  - the admin home cards; "Change password" in the user menu;
  - Users, Settings and Audit log are live in the nav.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (276) · build ✅ · e2e ✅ (44 against
`next start`, twice; 44 against Docker, twice) · docker ✅ (rebuilt image, health 200; the
migration had already been applied to the shared dev DB, and CI's docker job runs it on a fresh
volume) · psql ✅ (thresholds restored to 90/60, audit rows per admin action, demo accounts
untouched)
**Decisions:** D-024
**Follow-ups:**

- Account edit, unlock and reactivate are unit-tested, not e2e-tested.
- The last-admin rule is unit-tested (the e2e covers the self-protection path).
- Phase 7: dashboards and reports.

## 2026-10-03 — Phase 5: Inventory

**Who:** Team + Claude Code
**Summary:** Built inventory as a ledger:

- items with codes, units and reorder levels;
- stock entries (receive, use, stock count) with Undo and a log-book history showing the balance
  after each entry;
- low-stock alerts on the FM home;
- an optional "Take a roll from inventory" when creating a batch, returned if a planned batch is
  cancelled.

**Changed:**

- Domain: `src/lib/inventory-rules.ts` (movement planning, stock level, quantity format, item codes).
- Server:
  - `models/inventory.model.ts` (conditional `applyStockDelta`, field-reference low-stock query,
    history with newer-sum balances);
  - `services/inventory.service.ts` (`postMovement` is the single write path);
  - `validators/inventory.validator.ts`, `controllers/inventory.controller.ts`;
  - batch service: roll consumption in create, roll return on a planned cancel, roll info on
    detail;
  - bootstrap: demo inventory.
- API: `/api/v1/inventory`, `/{id}`, `/{id}/movements`, `/movements/{id}/undo` (`docs/API.md`).
- UI:
  - pages: `/inventory` (filters), `/inventory/new`, `/inventory/[id]` (stock dialogs, history),
    `/inventory/[id]/edit`;
  - components: `StockBadge`, `LowStockCard`;
  - the batch form's roll picker and "Roll from inventory" on batch detail;
  - Inventory is live in the nav.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (248) · build ✅ · e2e ✅ (38 against
`next start`, twice; 38 against Docker, twice) · docker ✅ (rebuilt image, health 200, demo
inventory seeded) · psql ✅ (ledger sum = on hand for all 40 items, no negative stock, audit rows
per movement type, a failed roll-create left no batch)
**Decisions:** D-023
**Follow-ups:**

- Item edit and deactivate are covered by unit tests and manual checks, not e2e.
- Optional: link IN movements to a supplier for delivery reports (D-023 consequences).
- Phase 6: Admin.

## 2026-10-03 — Phase 4 follow-up: complete batches with repairs open

**Who:** Team + Claude Code
**Summary:** The team confirmed that salvage reused in a batch stays out of its usable count. They
changed the closing rule: a batch can be completed while sections are still at the repair
station. Such a batch is tagged "In repair · N" until its repairs are done.
**Changed:**

- Rules: `planReworkMove` refuses only cancelled batches; `availableActions` no longer blocks
  Complete; `openRepairsNote` replaces `openRepairsReason`.
- Server: the completion guard is removed from `batch.service`; list rows and batch detail carry
  `openRepairs` (`countLiveReworkByBatch`).
- UI: `InRepairBadge` on the batch list and detail, and a note in the Complete dialog.
- Tests: updated unit tests (220) and the outcomes e2e (complete with an open repair, then repair it
  on the board).
- Docs: D-022, API.md, STATUS, DESIGN.md.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (220) · build ✅ · e2e ✅ (33 against
`next start`, twice) · docker: not re-run locally (no Docker-specific change; CI runs the docker job)
**Decisions:** D-022
**Follow-ups:** Phase 5 (Inventory).

## 2026-10-02 — Phase 4: Rework & salvage

**Who:** Team + Claude Code
**Summary:** Closed the loop on camera outcomes:

- a rework board where sections move Waiting → Being repaired → Repaired, with undo;
- a salvage list where the Floor Manager reuses rejected leather in another batch or discards it;
- a batch Yield card (usable = passed + repaired).

Completing a batch is blocked while repairs are open, and cancelling a batch cancels its open repairs.
**Changed:**

- Domain: `src/lib/outcome-rules.ts` (ticket/salvage moves, `computeBatchYield`), the open-repairs
  reason in `stage-machine.ts`.
- Server:
  - models: the outcome model's list/transition/count helpers, `listOpenBatches`;
  - services: `rework.service`, `salvage.service`, `batchYield` in `scan-query.service`, the
    completion guard and cancel cascade in `batch.service`;
  - validators: `outcome.validator`; controller: `outcome.controller`.
- API: `GET /api/v1/rework`, `POST /api/v1/rework/{id}/status`, `GET /api/v1/salvage`,
  `POST /api/v1/salvage/{id}/assign|unassign|discard` (`docs/API.md`).
- UI:
  - pages: `/rework`, `/salvage` (tabs);
  - the Yield card and a detail skeleton on batch detail;
  - the Open reworks card on the FM home;
  - `ScanThumb` and an image fallback on `ScanImage`;
  - scan detail links to the board/list;
  - nav: Rework and Salvage are live.
- **Fix (auth):** the proxy now redirects signed-in users away from `/login` on GET only. A late
  prefetch response could restore the session cookie right after `/logout` cleared it. The sign-in
  POST was then redirected and the form showed "This page couldn't load". Phase 4's two extra nav
  links made the deactivation e2e test fail consistently. This is very likely the "unreproduced"
  Phase 3 failure; it hasn't recurred since the fix (stress-run 6×, full suite 6×).

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (218) · build ✅ · e2e ✅ (33 against
`next start`, twice; 33 against Docker, twice, starting cold) · docker ✅ (fresh image, health 200)
· audit rows checked in psql ✅ (`rework.start/done/unstart/cancel`, `salvage.assign/unassign/discard`)
**Decisions:** D-021
**Follow-ups:**

- `rework.reopen` is covered by unit tests only (no e2e).
- Phase 5: inventory.

## 2026-10-02 — Phase 3: CV skeleton

**Who:** Team + Claude Code
**Summary:** Built the camera pipeline end to end: device tokens, the ingestion API, the decision
engine, image storage, automatic rework/salvage rows, and a simulator. Added overrides and the
review queue, the scan pages with bounding-box overlays, the Camera page, token admin, and the
live feed on the FM/QI homes.
**Changed:**

- DB: migration `camera_active_batch` (`cv_settings.activeBatchId`).
- Domain: `src/lib/decision-engine.ts`.
- Server:
  - lib: `device-token`, `storage`, `image-type`, `action-result`;
  - models: `api-token`, `scan`, `outcome`, `cv-settings`, plus preparation-batch helpers;
  - services: `api-token`, `camera`, `scan-ingest`, `scan-decision`, `scan-query`;
  - validators: `scan`, `token`; `controllers/scan.controller`; `requireDevice`; `camera:manage`.
- API: `POST/GET /api/v1/scans`, `/{id}`, `/{id}/image`, `/{id}/decision`, `GET /api/v1/batches/current`.
- Scripts: `npm run cv:token`, `npm run cv:simulate` (sharp-rendered leather images).
- UI:
  - pages: `/scans`, `/scans/[id]`, `/review`, `/camera`, `/admin/tokens`;
  - components: ScanImage overlay, VerdictFlow, LatestScansWidget (TanStack Query);
  - the QI home, batch scan counts, and nav (Camera, Scans, Review queue, API tokens are live).

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (193) · build ✅ · e2e ✅ (28 against
`next start`, twice; 28 against Docker, 5 of 6 runs; see below) · docker ✅ (fresh volume, 2 migrations,
simulator → images in the `uploads` volume, survive `restart app`) · audit rows checked in psql ✅
**Decisions:** D-020
**Follow-ups:**

- **Unreproduced e2e failure:** on the first run against a freshly started Docker stack, the
  deactivation test failed one `toBeVisible` assertion. It then passed 3× alone and in 5 more full
  runs. Likely cause: cold-start latency (the first server action and bcrypt on a cold container)
  exceeding Playwright's 5 s assertion timeout. Watch for it in CI; if it recurs, warm the app up in
  the CI e2e job rather than raising timeouts.
- Phase 4: rework and salvage boards and lifecycle; "usable" batch count.

## 2026-10-02 — Phase 2: Batches & stages

**Who:** Team + Claude Code
**Summary:** Built the batch module end to end:

- the stage machine, models and service, with an atomic code counter and STALE concurrency;
- the REST API;
- list, create/edit and detail pages with dialogs and toasts;
- the live "Batches by stage" card on the FM home.

Verified with 140 unit and 21 e2e tests, locally and against Docker.
**Changed:**

- Domain: `src/lib/stage-machine.ts`, `src/lib/format.ts`, batch status labels in `src/lib/domain.ts`.
- Server: `models/{batch,stage-log}`, reference-data list helpers, `services/batch.service`,
  `validators/batch.validator`, `controllers/batch.controller`, `Errors.stale`, `readJsonBody`.
- API: `/api/v1/batches`, `/[id]`, `/[id]/stages`, `/[id]/cancel` (`docs/API.md`).
- UI: Table, Badge, Select, Textarea, Dialog, Toaster (sonner); BatchStatusBadge, StageProgress,
  BatchesByStageCard; `/batches` (+ loading/error), `/batches/new`, `/batches/[id]`, `/batches/[id]/edit`.
- Nav: Batches is live.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (140) · build ✅ · e2e ✅ (21, `next start`
and Docker) · docker ✅ (fresh volume, health 200) · audit rows checked in psql ✅
**Decisions:** D-019
**Follow-ups:**

- Phase 3: decide how the camera picks "the current batch" when several are at Preparation.
- The cloud sandbox's Docker daemon stopped once mid-session. The app degraded and recovered on its
  own (health 503 → 200, no restart), which confirms the bootstrap/health design.

## 2026-10-02 — Phase 1: Data & auth

**Who:** Team + Claude Code
**Summary:** Migrated the full schema, added startup bootstrap/seeding, Auth.js sign-in with
lockout and audit, the permission matrix + guards, the role-based app shell, and role home pages.
Verified with 94 unit and 13 e2e tests, locally and against the Docker stack.
**Changed:**

- DB: `prisma/schema.prisma` + `migrations/…_init` (17 tables, 46 indexes).
- Server: `models/{db,user,audit-log,reference-data}`, `services/{audit,auth,bootstrap}`,
  `policies/{permissions,navigation,guard}`, `lib/{auth,auth.config,password,env}`,
  `controllers/auth.controller`, `instrumentation.ts`, `proxy.ts`.
- UI: login page (RHF + Zod), sidebar shell, role homes, `/forbidden`, `not-found`, primitives
  (Input, Label, Card, Alert, DropdownMenu), `src/lib/domain.ts` (enums + labels).
- Tooling: ESLint Prisma rule switched to a regex (allows the runtime-free enums file); route.ts
  files anywhere may import controllers. CI/compose pass the auth env; CI checks the bootstrap.
- Docs: README (Environment, demo accounts, sign-in rules), API.md (auth), CLAUDE.md rules,
  DESIGN.md components, D-016 to D-018.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (94) · build ✅ · e2e ✅ (13, `next start`
and Docker) · docker ✅ (fresh volume: migration applied, bootstrap seeded, health 200).
**Decisions:** D-016, D-017, D-018
**Follow-ups:**

- Confirm the shift length (session) and lockout policy with CPoint.
- Phase 2: batches & stages.

## 2026-10-02 — Phase 0: Foundation

**Who:** Team + Claude Code
**Summary:** Created `system-rebuild`, removed the Laravel app, and scaffolded Next.js 16 +
Prisma 7 + PostgreSQL 18 with the MVC layout, design tokens, Docker, tests and CI. The health
endpoint and status page work end to end, in dev and in Docker.
**Changed:**

- Removed: all Laravel/PHP code, Blade views, Composer/Vite config (the logo is kept).
- Design: `DESIGN.md`, `src/styles/tokens.css`, `globals.css`. Contrast was measured for every
  text/surface pair (lowest text pair is 4.72:1, rework on rework-soft in light mode). Input
  outlines were raised to ≥ 3:1.
- Server: `src/server/{lib,models,services,controllers}` (env, Prisma client, logger, error shape,
  health). `src/app/api/health/route.ts`.
- UI: `Button` (shadcn structure), `VerdictBadge`, `ThemeToggle`, the root layout with a
  no-flash theme script, and the temporary status home page.
- Tooling: ESLint layer rules, Prettier, husky + lint-staged, Vitest, Playwright, GitHub
  Actions (`check`, `e2e`, `docker` jobs).
- Docker: multi-stage `Dockerfile` (standalone, non-root, healthcheck, migrate-on-start),
  `docker-compose.yml` (`app` + `db`, volumes `pgdata`, `uploads`), `.dockerignore`.
- Docs: README rewritten, `docs/API.md`, CLAUDE.md commands + Next 16 agent notes, D-012 to D-015.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (6) · build ✅ · e2e ✅ (3, local Chromium) ·
docker ✅ (`compose up --wait` → both healthy, `/api/health` 200, migrations ran, uid 1001).
GitHub Actions hasn't run yet; it runs on the first push.
**Decisions:** D-012, D-013, D-014, D-015
**Follow-ups:**

- Check the first CI run on GitHub, especially the `docker` job on a clean runner.
- Phase 1: Prisma schema, seed, Auth.js, policies, app shell.

## 2026-10-02 — Planning: confidence rule update

**Who:** Team + Claude Code
**Summary:** Replaced per-defect-type actions with one rule for all types: ≥90% REJECT,
60–89% REWORK, below 60% PASS (assumption).
**Changed:** `docs/prompts/system-rebuild.md` (decision engine, overrides, data model, tests),
`docs/DECISIONS.md` (D-011 supersedes D-006), `docs/STATUS.md`, `docs/ROADMAP.md`, `docs/AGENTIC_WORKFLOW.md`.
**Gates:** n/a (docs only)
**Decisions:** D-011
**Follow-ups:** Confirm the 90% / 60% thresholds and the below-60% PASS assumption with CPoint.

## 2026-10-02 — Planning: rebuild prompt and project docs

**Who:** Team + Claude Code
**Summary:** Agreed the rebuild scope and defaults. Wrote the master prompt, living docs, and
agentic workflow setup. No application code changed.
**Changed:** `docs/prompts/system-rebuild.md`, `CLAUDE.md`, `docs/STATUS.md`, `docs/ROADMAP.md`,
`docs/DECISIONS.md`, `docs/SESSION_LOG.md`, `docs/AGENTIC_WORKFLOW.md`, `docs/client-survey.md`,
`.claude/skills/{ui-craft,resume,wrap-up}`.
**Gates:** n/a (docs only)
**Decisions:** D-001 – D-010
**Follow-ups:** Run Phase 0. Confirm D-006 defect default actions with CPoint (superseded by D-011).
