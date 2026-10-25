# Phase 28 plan: each role sees only its modules, and the demo sign-in tools

Brief: `docs/prompts/factory-visit-changes.md` → Phase 28 (C-17, C-18, C-23; A-23, A-25, A-26).
Status: **approved** by Dylan on 25 Oct 2026 with all four recommendations (section 9); built the
same day. D-100 and D-101.

## 0. Before building

- The laptop repo is on `feature/phase-27-batches` with `AGENTS.md` and `docs/STATUS.md` changed;
  local `origin/main` is stale (no fetch since #25). Dylan: `git fetch origin`, `git switch main`,
  `git pull` (the STATUS edit comes along as uncommitted). Phase 28 builds on that `main`.
- Newest Codex report: `qa/reports/2026-10-24-phase-27-run5.md`, PASS. PR #25 CI green and merged.
  Nothing unresolved to fix first.
- No schema change, no migration.

## 1. The matrix (`src/server/policies/permissions.ts`)

| Permission                                                                                          | Before                       | After                                    |
| --------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------- |
| `camera:view`                                                                                       | FM, QI, Admin                | **Admin**                                |
| `scan:read`                                                                                         | FM, QI, Admin                | **FM** (a section's page, from its roll) |
| `inventory:read`                                                                                    | FM, Admin                    | **FM**                                   |
| `report:quality`                                                                                    | FM, QI                       | **FM**                                   |
| `attendance:read`                                                                                   | FM, Admin                    | **FM**                                   |
| `production:read`                                                                                   | FM, QI, Admin                | **FM, QI**                               |
| `camera:capture`                                                                                    | Constructor (+ `canCapture`) | unchanged                                |
| `production:checkin`                                                                                | QI, FM (D-088)               | unchanged                                |
| `production:plan`, `roll:*`, `inventory:manage`, `report:production`, `attendance:manage`           | FM                           | unchanged                                |
| `camera:operators`, `user:manage`, `settings:manage`, `token:manage`, `audit:read`, `system:health` | Admin                        | unchanged                                |

## 2. Sidebar and homes (`navigation.ts`, `domain.ts` `ROLE_HOME`)

| Role              | Sidebar, in order                                        | Home                                      |
| ----------------- | -------------------------------------------------------- | ----------------------------------------- |
| Shoe Constructor  | Capture                                                  | `/camera/capture`                         |
| Quality Inspector | Batches                                                  | **`/batches`** (was `/quality-inspector`) |
| Floor Manager     | Overview, Batches, Attendance, Reports, Inventory        | `/floor-manager`                          |
| System Admin      | Overview, Users, Settings, Camera, API tokens, Audit log | `/admin`                                  |

`navigationFor` becomes one ordered list per role (no section headings; the longest list has six
items), each item still filtered by its permission so the nav and the guards can't drift. The
"Quality" and "Insights" headings and the `scans` icon go.

## 3. Removed

| What                                                  | Callers found                                                                                                                          | Replacement                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/quality-inspector` page                             | `ROLE_HOME`, `batches/actions.ts` revalidate, `auth.spec.ts`                                                                           | QI home is `/batches`; page → 404                                            |
| `DefectsTodayCard`, `inspectorSummary` (QI home only) | QI home                                                                                                                                | deleted if no other caller                                                   |
| `/scans` list                                         | nav; QI home; `ops-sections.tsx` "Rejected scans"; `quality-view.tsx` defect links; `/scans/[id]` "All scans" and "Scans of this roll" | links become plain text, or point to the roll's page (`/reports/rolls/[id]`) |
| `GET /api/v1/scans` (`scanController.index`)          | only `latest-scans-widget.tsx`                                                                                                         | removed; `POST` (simulator, devices) stays                                   |
| `LatestScansWidget`                                   | FM home, QI home                                                                                                                       | deleted                                                                      |
| Admin's Attendance, Inventory, Batches, Scans         | permissions above                                                                                                                      | 403                                                                          |
| FM's and QI's Camera page                             | `camera:view`                                                                                                                          | 403; the Admin's Camera moves under Administration                           |
| QI's Reports                                          | `report:quality`                                                                                                                       | 403                                                                          |

The Admin's Camera page links "last scan" to `/scans/{id}` and "Rolls being captured" to
`/reports/rolls?status=OPEN`, which the Admin can no longer open: they become plain text.

## 4. Homes

- **FM** (`floor-manager/page.tsx`): Today's batches, Attendance, **Rolls today** (new card:
  sections checked today, of them rejected for salvage, rolls open now; link to Reports → Rolls),
  Low stock, Daily summary. `LatestScansWidget` and `InspectionSplitCard` leave (Rolls today
  covers the split). New `rollsToday(now)` in `roll.service` → `roll.model`.
- **Admin** (`admin/page.tsx`): System health, Users, **Camera status** (the Camera page's state
  text and last capture, link to Camera), Unknown defect classes, **Lunch break** (today's and
  from tomorrow, link to Settings → Lunch break), Audit log. The "Pass or Reject" card folds into
  Unknown classes' link to Defect types.

## 5. Demo tools (A-23)

- `env.ts`: `DEMO_LOGIN_TOOLS` (boolean, default false). `.env.example`: "For the demo only. Never
  turn on for real use." The tools show only when `DEMO_LOGIN_TOOLS=true` **and**
  `SEED_DEMO_USERS=true`.
- **Login page**, under the form: **Demo sign-in**, four buttons ("Floor Manager · Rodel Pascual",
  "Quality Inspector · Maricel Dizon", "System Admin · Jerome Salazar", "Shoe Constructor · Noel
  Manalo"); **Reset demo data**: a dialog that lists what it deletes and keeps, a field to type
  RESET, a progress state ("Resetting… about a minute", elapsed seconds), and "Fresh demo week
  loaded." at the end. A missing demo account gives a named message ("Rodel Pascual's account
  isn't on this database. Start with SEED_DEMO_USERS=true.").
- **Server:** two routes, `POST /api/v1/demo/sign-in` `{ role }` and `POST /api/v1/demo/reset`
  `{ confirm: "RESET" }` → `demo.controller` → `demo-tools.service`. Both answer **404** when the
  flag is off, before reading the body. Sign-in maps the role to the fixed demo email and calls
  the normal credentials `signIn` with `DEMO_USER_PASSWORD` from the server (never sent to the
  browser); the lockout and audit rules apply as usual, and the audit row gets `method: "demo"`
  (only when the flag is on and the email is one of the four, so the normal form can't fake it).
  Reset runs `resetDemoData` + the demo week, the same as `npm run demo:reset -- --yes`, one at a
  time (an in-process lock plus a Postgres advisory lock; a second request gets `409 RESET_RUNNING`
  "A reset is already running. Wait for it to finish."), and audits `system.demo_reset` with
  `origin: "login page"`. It runs in a production build while the flag is on (a new
  `allowInProduction` option, passed only by this service); the CLI still refuses
  `NODE_ENV=production`. It keeps the token in `CV_DEVICE_TOKEN` if the app has it.
- A thin **Demo mode** band at the top of every page (root layout, login included) while the flag
  is on.
- These two routes are the only API routes without `requireApiPermission`; D-101 says why
  (nobody is signed in yet) and how they're fenced (flag + demo users, 404 otherwise, fixed
  accounts only, server-held password, one reset at a time, audited).

## 6. Files by layer

- **Policies:** `permissions.ts`, `navigation.ts`; `src/lib/domain.ts` (`ROLE_HOME`).
- **Pages:** delete `quality-inspector/page.tsx`, `scans/page.tsx`; change `floor-manager`,
  `admin`, `camera`, `scans/[id]`, `reports/page.tsx` (QI branch goes), `reports/_components/
{ops-sections,quality-view}.tsx`, `batches/actions.ts`, `(auth)/login/{page,login-form}.tsx`
  - new `demo-tools.tsx`, `app/layout.tsx` (band).
- **API:** new `api/v1/demo/{sign-in,reset}/route.ts`; `api/v1/scans/route.ts` loses `GET`.
- **Controllers/services/models:** new `demo.controller.ts`, `demo-tools.service.ts`;
  `scan.controller.ts` (index out), `scan-query.service.ts` (list/latest/inspectorSummary out if
  unused), `roll.service`/`roll.model` (`rollsToday`), `demo-reset.service.ts`
  (`allowInProduction`), `auth.service.ts` / `auth.ts` (the `method` on `user.login`).
- **Components:** delete `scans/latest-scans-widget.tsx`, `DefectsTodayCard` if unused; new
  `reports/rolls-today-card.tsx`, `admin` camera-status and lunch cards; `demo-band.tsx`.
- **Env:** `env.ts`, `.env.example`, `docker-compose.yml` (pass `DEMO_LOGIN_TOOLS`, default off).

## 7. Tests

- **Unit:** the matrix per role (every permission, exactly); `navigationFor` per role, exact
  labels and order (with and without `canCapture`); `ROLE_HOME`; demo routes with the flag off →
  404 and no sign-in or reset called; flag on but `SEED_DEMO_USERS` off → 404; a wrong `confirm`
  → 422; the reset lock (a second call while one runs → 409); unknown role → 422; `rollsToday`.
  Old tests for the QI home, the scans list and `GET /api/v1/scans` go.
- **E2E (written, not run; Codex runs them):** `auth.spec.ts`: each role's nav and home; a sample
  of refused pages per role (Admin → `/attendance`, `/inventory`, `/batches`; QI → `/reports`,
  `/camera`; FM → `/camera`, `/admin/users`); `/quality-inspector` and `/scans` → 404; the demo
  buttons only with the flag; axe on the login page with the tools. Other specs that open those
  pages as the Admin or QI are updated (scans, camera, reports specs).

## 8. Docs

DECISIONS **D-100** (each role sees only its modules; amends D-023, D-033, D-066, D-067, D-079)
and **D-101** (the demo tools; amends D-056). STATUS, SESSION_LOG, ROADMAP (Phase 28 criteria),
API.md (demo routes; `GET /scans` gone), README demo script, the master spec's roles table,
QA handoff + `qa/CODEX_PROMPT_PHASE_28.md`, vault Daily note and phase summary.

## 9. Questions (each with a recommendation)

1. **Scans list:** remove it (recommended, A-26) or keep it under Reports?
2. **FM home cards** as listed, with Rolls today replacing Latest scans and the Pass/Reject split
   (recommended)?
3. **Flag name** `DEMO_LOGIN_TOOLS` (recommended)?
4. **Sidebar headings:** one flat list per role (recommended; the brief's table has no headings)
   or keep headings like "Administration"?

## 10. Assumptions to log in STATUS

- ASSUMPTION (A-23): the demo tools need both `DEMO_LOGIN_TOOLS` and `SEED_DEMO_USERS`; a
  production build may reset only while the flag is on.
- ASSUMPTION: "Rolls today" counts sections checked today, those rejected (for salvage), and the
  rolls open now.
