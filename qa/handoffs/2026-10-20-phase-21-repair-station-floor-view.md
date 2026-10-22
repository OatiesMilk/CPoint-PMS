# QA handoff: Phase 21 Repair Station, Floor view, constructor capture, no mkcert

| Field           | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| Date            | 2026-10-20                                                                           |
| Feature         | phase-21-repair-station-floor-view                                                   |
| Branch          | `main` @ `cc612ee`, uncommitted (Phases 20 and 21 are in the working tree)           |
| Spec / prompt   | `docs/prompts/plans/phase-21-plan.md` (approved by Dylan: A, B and C as recommended) |
| Written by      | Claude                                                                               |
| Previous report | `qa/reports/2026-10-20-phase-20-qa-run4.md` (PASS)                                   |

## 1. What changed

- **Repair Station (D-073), every role that sees the board:** the board formerly called "Cut
  around or clean" is now **Repair Station** in the nav, the page title and heading, the
  Operations card, the FM home card, the Override hint, the scan page and the batch-completion
  warning. The page description is "Clean the section or cut around the defect, then mark it
  done. Done sections count as usable in their batch." The cards, columns and the Fixable verdict
  are unchanged.
- **Floor view (D-074), QI / FM / allowed constructors on Capture:** a **Floor view** button next
  to Capture opens a full-screen view for a monitor facing the operator:
  - the live camera and "Next scan goes to …" in large text;
  - after each capture (Space, or a foot pedal set to Space): "Checking…", then a thick coloured
    frame and a band with the verdict word, icon, "Section #N · B-…" and where the piece goes
    (Pass green "Goes on to cutting", Fixable orange "To the Repair Station", Reject red "To
    salvage", Needs review blue "Set aside for the Quality Inspector");
  - the verdict stays until the next capture;
  - problems (no batch, no model, camera denied or busy, send failed) fill the band, with Try
    again or Send again / Discard where they apply;
  - Esc or **Leave Floor view (Esc)** returns to the normal page; the browser remembers Floor view
    and reopens in it. No sounds.
- **Constructor capture (D-075):** a Shoe Constructor can capture only when allowed. The FM allows
  them on **Camera → Camera operators** (find box, Allow capturing / Stop capturing, undo toast);
  the Admin under **Users → More actions → Allow capturing at the camera** (a "Camera" badge shows
  on the row). An allowed constructor gets **Capture** in their nav and a **Capture sections** card
  on their home; Last scan and Floor view show the verdict and section only (no scan photo, no
  Open scan link). They still can't open Scans, Review or Reports.
- **mkcert removed (D-076):** no HTTPS listener, no port 3443, no `certs` mount, no
  `npm run dev:https`. The "secure address" message now says to use the site's https:// tunnel
  link or localhost. The README has "Floor view at the station" and "Reach the site with
  Cloudflare Tunnel"; `docs/STATION_SETUP.md` is new. The Camera page's "Ways to capture" mentions
  Floor view and the tunnel instead of port 3443.

## 2. Files touched

| Area                | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rename              | `navigation.ts`, `rework/page.tsx`, `rework/error.tsx`, `ops-sections.tsx`, `reports/page.tsx`, `open-reworks-card.tsx`, `scans/[id]/page.tsx`, `decision-panel.tsx`, `stage-machine.ts`, `rework.service.ts`                                                                                                                                                                                                                                          |
| Floor view          | `camera/capture/floor-view.tsx` (new), `capture-client.tsx`, `last-scan.tsx`, `capture-rules.ts`                                                                                                                                                                                                                                                                                                                                                       |
| Constructor capture | `prisma/schema.prisma`, migration `20261020110133_user_can_capture`, `permissions.ts`, `guard.ts`, `auth.service.ts`, `layout.tsx`, `scan.controller.ts`, `camera.service.ts`, `user.model.ts`, `scan.validator.ts`, `api/v1/camera/operators/[userId]/route.ts` (new), `camera/actions.ts`, `camera/operators-panel.tsx` (new), `camera/page.tsx`, `capture/page.tsx`, `constructor/page.tsx`, `admin/users/page.tsx`, `admin/users/user-dialogs.tsx` |
| mkcert              | `docker/https.mjs` (deleted), `docker/entrypoint.sh`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `.gitignore`, `certs/.gitkeep` (deleted), `package.json`, `next.config.ts`, `README.md`, `docs/STATION_SETUP.md` (new)                                                                                                                                                                                                                       |
| Tests               | `tests/unit/{capture-rules,capture-route,permissions,stage-machine,camera-operators}.test.ts`, `tests/e2e/{auth,capture,cut-around-or-clean,rework-columns}.spec.ts`                                                                                                                                                                                                                                                                                   |

Database migration in this change: **yes** (`user_can_capture`: `users.canCapture`, default false).
It's already applied to the dev database; `db:deploy` should say nothing is pending there.

## 3. How to run the app locally

```bash
npm run db:up
npm run db:deploy
npm run build
npm run dev            # PORT=3001 if port 3000 is taken by another project
```

Automated tests: `npm run test:e2e` (the full suite). The Capture specs use Chromium's fake camera.

**Docker (M2):** `docker compose up --build -d`. No certificate mount or override is needed any
more. Stop with `docker compose stop`.

**Showing a real verdict colour (F3, optional):** Chromium's fake camera shows a test pattern, so
the model usually says Pass. To see Fixable or Reject, start Chromium with
`--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<file.mjpeg>`, where the
file is made from one of the sample leather photos you used for Phase 20 M3 (an MJPEG file can be
the JPEG frames joined together). If that isn't workable, mark F3 BLOCKED for Dylan's real station
check.

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD` from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data: a batch in progress at Preparation (the demo week has some; or Batches → New → Start
production). The model files in `cv/models/` for real verdicts. For C-scenarios use the demo
constructor and turn the switch off again at the end (C6).

## 5. Test scenarios

### Repair Station

| ID  | Role | Steps                                             | Expected result                                                                                                                                                   | Priority |
| --- | ---- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | FM   | Look at the sidebar, then open it                 | Nav item **Repair Station**; page title and heading **Repair Station**; description starts "Clean the section or cut around the defect"; no "Nothing is repaired" | High     |
| R2  | FM   | Home page, then Reports → Operations              | The home card and the Operations card are titled **Repair Station**                                                                                               | Medium   |
| R3  | QI   | Open a Pass scan → Override decision…             | The Fixable choice says "Goes to the Repair Station to be cleaned or cut around."; the dialog text says "onto or off the Repair Station board"                    | Medium   |
| R4  | FM   | Complete a batch that has an open Fixable section | The warning ends "…once marked done at the Repair Station."                                                                                                       | Low      |
| R5  | Any  | Sweep the pages each role sees                    | No user-visible "Cut around or clean" (the cards' "Clean before cutting" / "Cut around the marked area" and "cleaned or cut around" phrases are expected)         | Medium   |

### Floor view

| ID  | Role | Steps                                                                               | Expected result                                                                                                                                                                                      | Priority |
| --- | ---- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F1  | QI   | Capture → **Floor view**                                                            | The view fills the window (and full screen); live camera; "Next scan goes to B-… · roll … · …" in large text; "Leave Floor view (Esc)" top right; band "Place the next piece, then press the pedal." | High     |
| F2  | QI   | Press Space                                                                         | "Checking…", then a band with the verdict word, its icon, "Section #N · B-…" and the next step, plus a coloured frame round the video in the matching colour                                         | High     |
| F3  | QI   | (Optional, see §3) capture a leather photo that the model calls Fixable or Reject   | Orange "Fixable · To the Repair Station" or red "Reject · To salvage", frame in the same colour                                                                                                      | Medium   |
| F4  | QI   | After F2, wait 30 s without capturing, then capture again                           | The verdict stays until the next capture; the next capture replaces it                                                                                                                               | High     |
| F5  | QI   | Reload the page                                                                     | It opens straight in Floor view. Press Esc: the normal Capture page returns. Reload again: normal page                                                                                               | High     |
| F6  | FM   | Start no batch at Preparation (or use a throwaway stack with none), open Floor view | The band says "Capture is off." with "No batch is at Preparation. Ask the Floor Manager to start one…"; Space does nothing                                                                           | Medium   |
| F7  | QI   | Simulate a send failure (offline, as in P18 S17) in Floor view                      | The red band shows the not-sent message with **Send again** and **Discard this capture**; Send again saves one scan, not two                                                                         | Medium   |
| F8  | QI   | Axe (WCAG 2.1 A/AA) on Floor view before and after a capture                        | No violations                                                                                                                                                                                        | Medium   |
| F9  | QI   | Use Floor view at 1280 × 720 and at 1920 × 1080                                     | No page scroll; the band and the top bar stay readable; the video keeps its aspect                                                                                                                   | Low      |

### Constructor capture

| ID  | Role        | Steps                                                                              | Expected result                                                                                                                                                                                    | Priority |
| --- | ----------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| C1  | Constructor | Sign in (switch off), open `/camera/capture`                                       | No Capture in the nav; the page redirects to `/forbidden`; `POST /api/v1/scans/capture` answers `403`                                                                                              | High     |
| C2  | FM          | Camera page → **Camera operators**, find the demo constructor, **Allow capturing** | Badge "Can capture", toast with Undo; Admin → Audit log has `camera.capture_access.grant` for that person                                                                                          | High     |
| C3  | Constructor | Click anywhere (next request)                                                      | Nav shows **Capture**; home shows **Capture sections** → Open Capture; Capture works; Last scan shows the verdict and "Section #N · B-…" with no photo and no Open scan; Floor view works the same | High     |
| C4  | Constructor | Open `/scans`, `/review`, `/reports`                                               | Each redirects to `/forbidden`                                                                                                                                                                     | High     |
| C5  | Admin       | Users → the constructor's More actions                                             | "Stop capturing at the camera" (because it's on) and a **Camera** badge on the row                                                                                                                 | Medium   |
| C6  | FM          | Camera operators → **Stop capturing** for the demo constructor                     | Badge "Can't capture"; the constructor loses Capture on the next click; audit `camera.capture_access.revoke`                                                                                       | High     |
| C7  | QI          | Camera page                                                                        | No Camera operators panel (only the FM and the Admin set it)                                                                                                                                       | Medium   |

### mkcert removal and Docker

| ID  | Role | Steps                                                                                   | Expected result                                                                                                                                                                                        | Priority |
| --- | ---- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| M1  | n/a  | `npm run db:deploy`                                                                     | Succeeds; `user_can_capture` is applied (or already applied)                                                                                                                                           | High     |
| M2  | n/a  | `docker compose up --build -d` with no certificate setup                                | Health 200; the app log has no HTTPS or certificate line; `docker compose ps` shows only port 3000 for app                                                                                             | High     |
| M3  | QI   | Open the Capture page by the machine's LAN IP over `http://` from the same PC's browser | "The camera only works on a secure address." with the fix "Open this site through its https:// link (the Cloudflare Tunnel address), or use this page on the server PC at localhost." and no port 3443 | Medium   |
| M4  | n/a  | `npm run`                                                                               | No `dev:https` script                                                                                                                                                                                  | Low      |
| M5  | Any  | Camera page → Ways to capture                                                           | Mentions Floor view and the https:// tunnel link; no "3443"                                                                                                                                            | Low      |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                           | Expected                                                           |
| --- | ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A1  | Quality Inspector              | `PUT /api/v1/camera/operators/{constructorId}` `{ "canCapture": true }` | `403`                                                              |
| A2  | Shoe Constructor               | the same call for themselves                                            | `403`                                                              |
| A3  | Floor Manager                  | the same call for the QI's user id                                      | `409` "Only an active Shoe Constructor can be allowed to capture…" |
| A4  | System Admin                   | `/camera/capture`                                                       | `/forbidden` (the switch never applies to the Admin)               |
| A5  | Signed out                     | `GET /api/v1/batches/current`                                           | `401`                                                              |

## 6. Out of scope / known issues

- Don't run `npm run demo:reset` or `docker compose down -v`.
- The Cloudflare Tunnel itself (a public address) is Dylan's to try; don't start one.
- Real hardware (a foot pedal, a second laptop, real leather) is Dylan's station check; list it
  under "Needs Dylan" with P18 S3 and S18. P18 S12 to S15 (plain HTTP and the iPhone certificate)
  are retired with mkcert.
- Next's warning that `next start` doesn't suit `output: "standalone"` is known.
- Internal names (`/rework`, `REWORK`, `rework.*`, the `cut-around-or-clean.spec.ts` file name)
  stay on purpose.
