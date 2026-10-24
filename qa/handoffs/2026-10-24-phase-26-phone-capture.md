# QA handoff: Phase 26, capture on the constructors' own phones

| Field           | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Date            | 2026-10-24                                                                                     |
| Feature         | phase-26-phone-capture                                                                         |
| Branch          | `main` checkout in `C:\dev\CPoint-PMS`, **uncommitted** (or Dylan's new branch with it)        |
| Spec / prompt   | `docs/prompts/factory-visit-changes.md` → Phase 26; plan `docs/prompts/plans/phase-26-plan.md` |
| Decisions       | D-095 (rolls at Capture, Batch is Roll), D-096 (phone layout for Capture)                      |
| Written by      | Claude                                                                                         |
| Previous report | `qa/reports/2026-10-24-phase-25-run3.md` (PASS)                                                |

CPoint said on the 23 October visit that allowed constructors capture on their own phones, and that
a roll is scanned before it goes on, with no other stages (C-18, C-23, C-33). Dylan approved the
plan with "go": several rolls can be open at once and Capture has a Roll dropdown; a roll finishes
only at Capture once fully scanned; the Floor Manager cancels any open roll with a reason, anyone
with camera access an empty one; the supplier is required; Capture is the constructor's home.

## 1. What changed

- **Rolls:** a roll is Open, Finished or Cancelled. New codes `R-2026-0001`; older rolls keep their
  `B-` codes. The supplier's own code is the optional **tag**. No stages, quota, notes or shoe type.
- **Capture (`/camera/capture`), Shoe Constructor only:**
  - With no open roll: the Start roll form (Supplier required, Tag optional).
  - With open rolls: the **Roll** line in large text, a **Roll** dropdown listing every open roll
    (anyone's), **Start another roll**, **Finish roll** (needs at least one shot) and **Cancel
    roll** (only while the roll has no shots).
  - The dropdown starts on the roll this browser last captured to, else the newest roll this
    person started, else the only open roll; with several and none of those, nothing is chosen
    and Capture asks for a roll.
  - A shot to a roll someone finished or cancelled meanwhile: "R-… was finished or cancelled, so
    this shot wasn’t saved. Choose another roll, or start one." (`409 ROLL_CLOSED`, before the
    model runs). No roll chosen: `409 NO_ROLL_CHOSEN`.
  - Floor view works as before (Pass green, Reject red), "Shot #N".
- **Who captures:** only a Shoe Constructor the **System Admin** gave camera access (Users → More
  actions → Give camera access / Remove camera access). The QI, the FM and the Admin no longer
  have Capture. The Camera page has no operators panel; `PUT /api/v1/camera/operators/{id}` is the
  Admin's only.
- **Constructor:** home is `/camera/capture`, the only nav item. Without camera access the page
  says to ask the System Admin. `/constructor` is gone.
- **Phone layout (below 640 px):** a top bar with the logo, the page's name, a Pages menu (only
  when the role has more than one page) and the account menu; no sidebar. Capture fits a 390 × 844
  phone: the Capture button full width at the bottom, at least 44 px tall.
- **Reports → Rolls (`/reports/rolls`, FM):** a third tab beside Operations and Quality. Columns
  Roll (with "Tag …"), Supplier, Started, Finished, Shots, Passed, Rejected (for salvage), Status.
  Filters: Find, Supplier, Status, Started (7, 30, 90 days). A roll's page: counts, details, its
  shots with photos, verdicts and defects, the Claim sheet link, and **Cancel roll** with a
  required reason for any open roll. A cancelled roll shows its reason.
- **Removed (404):** `/batches`, `/batches/new`, `/batches/{id}`, `/constructor`,
  `/api/v1/batches/**` (including `…/stages`). The nav has no Rolls or Batches item; the QI home
  has no "Capture sections" button. Inventory's Use stock has no "For roll" field.
- **API:** `/api/v1/rolls` (GET list, POST start), `/rolls/open`, `/rolls/{id}`,
  `/rolls/{id}/finish`, `/rolls/{id}/cancel`, `/rolls/current` (device token). Scans carry
  `rollId`; the scans filter is `?roll=`.
- **Data:** migration `rolls_at_capture` converts first (Planned and In progress → Open, Completed
  → Finished, start and finish from the stage log), then drops the stage log, stages, quota,
  notes, the shoe type on a roll and the camera's active batch.
- **Demo week:** four constructors with camera access (`constructor@`, `arnel.bautista@`,
  `jocelyn.reyes@`, `rommel.delacruz@`) capture every roll on phones (source PHONE); 11 rolls
  finished, the newest open, one empty roll cancelled by the FM with a reason.

## 2. Files touched

| File                                                                                       | Change                                                           |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261025090000_rolls_at_capture/`               | Roll status and times; stages, quota, notes, shoe type dropped   |
| `src/lib/roll-rules.ts` (new), `src/lib/stage-machine.ts` (deleted)                        | Finish, cancel, codes, the dropdown's default                    |
| `src/server/{models,services,controllers,validators}/roll.*` (renamed from `batch.*`)      | Start, open list, finish, cancel, capture roll                   |
| `src/server/services/{capture,scan-ingest,camera,demo-seed,demo-reset,ops-report}.service` | Rolls, locks, refusals, demo data                                |
| `src/app/api/v1/rolls/**` (from `batches/**`), `src/app/(app)/batches/**` (deleted)        | The rolls API; the old pages gone                                |
| `src/app/(app)/camera/capture/**` (`roll-bar.tsx`, `start-roll-form.tsx` new)              | Capture with rolls and the phone layout                          |
| `src/app/(app)/reports/rolls/**`, `reports/_components/report-tabs.tsx` (new)              | Reports → Rolls, a roll's page, cancel                           |
| `src/app/(app)/reports/claims/[rollId]/` (renamed)                                         | Claim sheet links back to the roll                               |
| `src/server/policies/{permissions,navigation}.ts`, `sidebar.tsx`, `(app)/layout.tsx`       | New matrix, constructor nav, phone top bar                       |
| `src/app/(app)/{camera,inventory,scans,admin/users,quality-inspector}/**`                  | Operators panel and For roll gone; wording; `?roll=`             |
| `scripts/{cv-simulate,demo-seed,demo-reset}.ts`, `cv/cpoint_cv/payload.py`, fixtures       | `rollId`                                                         |
| `tests/unit/**`                                                                            | Roll tests new or renamed; stage-machine tests deleted           |
| `tests/e2e/**` (`rolls.spec.ts` from `batches.spec.ts`)                                    | Updated for rolls at Capture (written, not run)                  |
| `.github/workflows/ci.yml`                                                                 | Docker job checks capturers, an open and a cancelled roll, PHONE |
| Docs                                                                                       | CLAUDE, DESIGN, API, STATION_SETUP, README, master spec, status  |

Database migration in this change: **yes** (`rolls_at_capture`). It is **not** applied to the dev
database yet: Dylan backs up first, runs `npm run db:deploy` and `npm.cmd run demo:reset -- --yes`.
Claude ran the migration and the reset on its own database: 13 rolls (11 finished with 110 shots, 1
open with 10, 1 cancelled with none and the reason), 120 PHONE scans, the four capturers.

## 3. How to run the app locally

Prerequisites: Docker Desktop running, `npm install` done, `.env` filled in (`AUTH_SECRET`,
`BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`), and **Dylan's backup
taken, `rolls_at_capture` applied and the demo week reset** (prompt step 2 checks this).

```bash
npm run db:up
npm run db:generate
npm run build
npm run start          # http://localhost:3000 (PORT=3001 if 3000 is taken)
```

Simulator (S9): `npm run cv:token` gives a token (or use `CV_DEVICE_TOKEN` from `.env`). Start a
roll at Capture first, then `npm run cv:simulate -- --count 5 --interval 2`.

Phone width: Chrome DevTools device mode at **390 × 844** (iPhone 12/13/14), or Playwright's
`viewport: { width: 390, height: 844 }`. The fake camera (`--use-fake-device-for-media-stream`)
gives frames; the e2e config already uses it.

E2E (all of it): `npm run test:e2e`.

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD` from `.env`.

| Role              | Email                         | Home page            | Camera access   |
| ----------------- | ----------------------------- | -------------------- | --------------- |
| Floor Manager     | `manager@cpoint.local`        | `/floor-manager`     | n/a             |
| Quality Inspector | `inspector@cpoint.local`      | `/quality-inspector` | n/a             |
| System Admin      | `admin@cpoint.local`          | `/admin`             | n/a             |
| Shoe Constructor  | `constructor@cpoint.local`    | `/camera/capture`    | yes (demo week) |
| Shoe Constructor  | `arnel.bautista@cpoint.local` | `/camera/capture`    | yes (demo week) |

A constructor **without** camera access: any other demo constructor (Users lists them), or one
the Admin removes access from in S12 (give it back afterwards).

## 5. Test scenarios

| ID  | Role                 | Steps                                                                                                         | Expected result                                                                                                                                                                    | Priority |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Every role           | Sign in as each. Read the sidebar.                                                                            | FM: Overview, Production, Attendance, Inventory, Camera, Scans, Reports. QI: Overview, Production, Camera, Scans, Reports. Admin: no Rolls or Capture. Constructor: Capture only.  | High     |
| S2  | Constructor (access) | Sign in at 390 × 844. Finish or cancel the demo's open roll if you want an empty state; then Start roll.      | Lands on Capture. Start roll refuses an empty Supplier with a message under the field; with a supplier (tag optional) it starts R-2026-…, shown large on the Roll line.            | High     |
| S3  | Constructor (access) | At 390 × 844, capture three shots with the fake camera.                                                       | The Capture button is full width at the bottom, ≥ 44 px tall; each shot shows Pass or Reject and the shot number; no sideways scroll; dialogs fit the screen.                      | High     |
| S4  | Constructor (access) | With an empty open roll, press Cancel roll and confirm. Then on a roll with shots look for Cancel roll.       | The empty roll is cancelled ("… is cancelled."). A roll with shots has no Cancel roll at Capture.                                                                                  | High     |
| S5  | Constructor (access) | Start a second roll so two are open. Use the Roll dropdown; capture to each; reload the page.                 | The dropdown lists both (and any other open roll, anyone's); each shot goes to the chosen roll (check its page as the FM); after a reload it starts on the last roll used.         | High     |
| S6  | Two constructors     | As constructor A start a roll. As B (another browser) open Capture.                                           | B's dropdown lists A's roll too.                                                                                                                                                   | Medium   |
| S7  | Constructor (access) | Finish an empty roll (if Finish shows); then finish a roll with shots.                                        | An empty roll can't be finished ("A roll needs at least one shot to finish. Cancel it instead."). With shots: confirm, the roll is Finished and leaves the dropdown.               | High     |
| S8  | Constructor + FM     | Constructor has roll X chosen. The FM cancels X in Reports → Rolls. The constructor then captures.            | The shot is refused: "R-… was finished or cancelled, so this shot wasn’t saved. Choose another roll, or start one." No scan is saved.                                              | High     |
| S9  | (simulator)          | With one roll open, run the simulator (5 scans). Then finish every roll and run it again.                     | The 5 scans go to the open roll (the one open longest if several). With none open the simulator gets `409 NO_OPEN_ROLL` and its message.                                           | Medium   |
| S10 | Constructor (access) | Open Floor view, capture with Space, press Esc.                                                               | Green Pass or red Reject band with "Shot #N"; Esc leaves.                                                                                                                          | Medium   |
| S11 | Constructor (none)   | Sign in as a constructor without camera access, at 390 × 844 and at desktop width.                            | Capture says to ask the System Admin for camera access; nothing else in the nav; no Pages menu on the phone bar.                                                                   | High     |
| S12 | Admin                | Users → a constructor → More actions → Remove camera access, then Give camera access.                         | Toasts "… can no longer capture rolls." and "… can now capture rolls on their phone."; the audit log has both rows; the constructor's Capture follows on the next request.         | High     |
| S13 | FM                   | Reports → Rolls. Try each filter and Clear.                                                                   | The three tabs; the columns of §1; the open and cancelled demo rolls show their status; the filters narrow the list and stay in the URL; 15 rows a page.                           | High     |
| S14 | FM                   | Open a finished roll; open its Claim sheet; go back.                                                          | Counts "N shots · X passed · Y rejected (for salvage)", details, shots with photos and defects (Usable, Not accepted, Unknown class); the claim sheet links back; no person named. | High     |
| S15 | FM                   | Open the demo's open roll; Cancel roll with an empty reason, then with a reason.                              | Empty reason refused under the field; with a reason the roll reads Cancelled with the reason; the audit log has a row. The cancelled demo roll shows its reason.                   | High     |
| S16 | FM                   | Reports → Operations and Quality with the cancelled roll in range.                                            | Rolls open KPI counts open rolls; a cancelled roll's shots are not counted; Supplier quality's CSV header starts "Roll,Tag number,Supplier,".                                      | Medium   |
| S17 | FM                   | Inventory → a leather roll item → Use stock.                                                                  | No "For roll" field. The history has a Roll column only when a row on the page names a roll (stock used before Phase 26); a fresh demo week has none.                              | Medium   |
| S18 | QI                   | Open the QI home and Scans; open a scan and follow "Scans of this roll".                                      | No "Capture sections" button; scans show their roll code; the link opens Scans filtered by that roll (`?roll=`).                                                                   | Medium   |
| S19 | FM, QI, Admin        | At 390 × 844 open the home and the Pages menu.                                                                | The top bar shows the page name; the Pages menu lists that role's pages; no sideways scroll on the bar. (Other pages aren't designed for phones; note only broken layouts.)        | Low      |
| S20 | Any                  | Light and dark mode on Capture (phone) and Reports → Rolls.                                                   | Text and badges readable in both.                                                                                                                                                  | Medium   |
| U1  | (throwaway stack)    | Start it with the demo week (prompt step 7). Sign in as the FM and as `constructor@`.                         | 13 rolls: 11 Finished, 1 Open (the newest), 1 Cancelled with a reason and no shots; every scan PHONE; the constructor lands on Capture with the open roll.                         | High     |
| U2  | (throwaway stack)    | From the host, against the throwaway database only: `npm run demo:reset`, then `npm run demo:reset -- --yes`. | The dry run lists rolls and changes nothing; the reset seeds a fresh demo week on rolls with no error.                                                                             | High     |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                             | Expected                                             |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A1  | Everyone (as the FM)           | `/batches`, `/batches/new`, `/constructor`                                                | The app's 404 page                                   |
| A2  | Everyone (as the FM)           | `GET /api/v1/batches`, `GET /api/v1/batches/<id>/stages`                                  | 404                                                  |
| A3  | QI, FM, Admin                  | `/camera/capture`; `POST /api/v1/scans/capture`                                           | `/forbidden`; 403                                    |
| A4  | QI, Admin, Constructor         | `/reports/rolls`, `/reports/rolls/<id>`                                                   | `/forbidden`                                         |
| A5  | FM, QI                         | `PUT /api/v1/camera/operators/<constructor id>` with `{"canCapture": true}`               | 403 "Only the System Admin chooses who can capture." |
| A6  | Constructor (access)           | `/reports`, `/inventory`, `/scans`; `POST /api/v1/rolls/<id>/cancel` on a roll with shots | `/forbidden`; 409 with the "has shots" message       |
| A7  | Signed out                     | `GET /api/v1/rolls`                                                                       | 401                                                  |

## 6. Out of scope / known issues

- Phase 27 turns "batch" into the check-in interval and gives Batches its phone layout; shoe types
  still exist on the Production page until then.
- Only Capture (and the top bar) is designed for phones; other pages at 390 px are desktop first
  (D-034, D-096). Report a page only if it is unusable, as a note.
- Real phones over the Cloudflare Tunnel stay with Dylan at the station (Phase 30A).
- Claude never ran the e2e suite; the updated specs are Codex's first run.
- Old audit rows still read "Batch"; they link to `/reports/rolls/<id>`.
