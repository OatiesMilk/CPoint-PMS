# Master Prompt: CPoint Product Monitoring System Rebuild

> **How to use this file.** Open Claude Code (Opus) at the repo root and say:
> _"Read `docs/prompts/system-rebuild.md` and run the next phase listed in `docs/STATUS.md`."_
> Claude does **one phase per session**, then stops for your review. See `docs/AGENTIC_WORKFLOW.md`.

---

<role>
You are a senior full-stack engineer and technical lead. You are rebuilding a 4th-year BS-IT capstone
project into a Product Monitoring System that would pass review by an industry panel. You write
production-grade, typed, tested code. You explain trade-offs briefly, and you never leave the
project in a state the next session can't pick up from.
</role>

<context>
**Client:** CPoint Shoe Store Corporation, a mass-production maker of leather **school shoes** and
**topsiders**. There are no custom-made shoes; custom orders are out of scope.

**The line:** Preparation → Construction → Sole-ing → Finishing, with one computer-vision
checkpoint at **Preparation, before cutting**: each leather roll is photographed shot by shot on a
Shoe Constructor's phone, and the model's verdict on each shot is final.

**Before the rebuild:** Laravel 12 + MySQL + Blade. The panel asked for a rebuild that meets
industry standards; the rebuild to Next.js, PostgreSQL and Docker (Phases 0 to 9) reused the ideas
that worked (`docs/DECISIONS.md`) and none of the PHP code. Everything after Phase 9 came from
CPoint's follow-ups, above all the factory visit of 23 October 2026 (`docs/CPOINT_VISIT_10232026.md`,
brief `docs/prompts/factory-visit-changes.md`).

**Client research:** `docs/client-survey.md` (Taglish interview answers) and the visit notes. Key
findings that still shape the system:

- Everything was tracked on paper. Stock is still **counted by hand**, so the system takes the
  counts on one sheet with reminders (C-16, C-32), not a per-pair deduction.
- Defects found late waste time and leather, so the client wants a **filter at Preparation**.
- The camera's verdict is final: there is no review, override or repair (C-21, D-093, D-094).
- A roll whose defects cover **more than 10%** of its area goes back to the supplier (C-9, D-116).
- A **batch** is one check-in interval of the working day, lunch left out (C-2, C-3, D-097).
- **Workforce metrics are sensitive.** Do **not** build per-person rankings, leaderboards or
  individual scores. Attendance is a one-day log book (D-077).

**Changed since the rebuild** (each D-entry in `docs/DECISIONS.md` has the reason):

- Material requests and Procurement removed (Phase 24, D-091).
- Pass or Reject only, final; the Review Queue, Repair Station, Salvage and overrides removed
  (Phase 25, D-093, D-094). Component tracking out of scope (D-071).
- Capture on the constructors' own phones; the old `Batch` is a `Roll` (Phase 26, D-095, D-096).
- Batches are the check-in intervals, with lunch and one daily quota; shoe types removed (Phase 27,
  D-097 to D-099). Stage monitoring was replaced earlier by production check-ins (Phase 23, D-082).
- Each role sees only its modules; demo tools on the login page (Phase 28, D-100, D-101).
- Stock updated on one sheet with reminders; Reports → Materials (Phase 29, D-102).
- Rolls added in Inventory with their area; cuts from 3 in Not accepted; a roll over 10% defects
  Returned to supplier; the constructor picks leather then roll (Phases 30A to 30E, D-103 to D-113,
  D-116).
- The Floor Manager plans each weekday on a calendar (Phase 30E-2, D-114, D-115); reports count
  whole rolls (D-117); roll counts against the plan (Phase 30D, D-118).
- Weekdays only, 08:00 to 17:00 (D-105). Unknown model classes are ignored (D-108).
- A printed marker card sets the scale, read on a roll's first shot; a scanning timer per roll
(D-120, D-121). The System Admin keeps only the administration modules (D-119). A polished look
(Phase 30F, D-122).
</context>

<read_first>
At the start of **every** session, before doing anything else:

1. `CLAUDE.md`: project rules (auto-loaded).
2. `docs/STATUS.md`: current phase, what's done, what's next, blockers.
3. `docs/DECISIONS.md`: settled decisions. Don't re-litigate them; add a new entry to change one.
4. `docs/ROADMAP.md`: phase definitions and acceptance criteria.
5. `.claude/skills/ui-craft/SKILL.md`: required for any UI work.
6. `DESIGN.md`: design tokens and rules. It overrides ui-craft defaults.
7. Dylan's Obsidian vault first (`CLAUDE.md` → "Roles, CI fixes and the vault").
   </read_first>

<ground_rules>

- **Branch:** a new branch from the latest `main` for each phase or feature; Dylan commits, pushes
  and opens the PR (D-032). Never push to `main`. `system-rebuild` is history.
- **Commits:** small Conventional Commits (`feat(batches): ...`, `fix(cv): ...`, `docs(status): ...`).
  Commit at every green checkpoint, not one giant commit per phase.
- **Scope:** desktop web first; the layout adapts to narrower windows without sideways scroll
  (D-034). Phone layouts only for Capture and Batches (D-096). Custom shoes are out of scope.
- **One phase per session.** Finish the phase's acceptance criteria, run the quality gates, update
  the docs (see `<documentation_protocol>`), commit, push, then **stop and report**. Don't start
  the next phase unless the user says so.
- **When unsure,** don't guess on business rules. Make the smallest reasonable assumption, mark it
  `ASSUMPTION` in code comments and in `docs/STATUS.md → Open questions`, and keep going.
- **Never** commit secrets. `.env` is gitignored, and `.env.example` documents every variable.
  </ground_rules>

<tech_stack>
Use the current stable versions at the time you scaffold, and record the exact versions in
`docs/DECISIONS.md`.

| Concern               | Choice                                                                              | Why                                                   |
| --------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Framework             | **Next.js (App Router) + TypeScript (strict)**                                      | Full-stack in one deployable unit                     |
| Runtime               | Node.js current LTS                                                                 |                                                       |
| Database              | **PostgreSQL**                                                                      | Requested; relational fit for batches/scans/inventory |
| ORM / migrations      | **Prisma**                                                                          | Typed models, versioned migrations, seed script       |
| Auth                  | **Auth.js (NextAuth v5)**, credentials provider, bcrypt/argon2 hashes, JWT sessions | Standard, no external IdP needed                      |
| Validation            | **Zod**, shared between API and forms                                               | One schema = one truth                                |
| UI                    | **Tailwind CSS + shadcn/ui (Radix)**, restyled via `DESIGN.md` tokens               | Accessible primitives, no default look                |
| Forms                 | React Hook Form + Zod resolver                                                      |                                                       |
| Client data / polling | TanStack Query                                                                      | Batch notices and Capture counts every 60 s           |
| Charts                | Recharts                                                                            | Follow the `dataviz` guidance if available            |
| Tests                 | **Vitest** (unit/service), **Playwright** (e2e smoke)                               |                                                       |
| Quality               | ESLint, Prettier, `tsc --noEmit`, Husky + lint-staged                               |                                                       |
| CI                    | GitHub Actions: lint → typecheck → test → build                                     | Industry baseline                                     |
| Logging               | pino (structured JSON)                                                              |                                                       |
| </tech_stack>         |

<docker>
Keep Docker simple and organized:
- **One `docker-compose.yml` with exactly two services:** `db` (official `postgres` alpine image,
  pinned major version, named volume `pgdata`, healthcheck via `pg_isready`) and `app` (Next.js).
  Don't add containers for Redis, nginx, pgAdmin, etc. If something like that ever seems needed,
  write it up in `docs/STATUS.md → Open questions` instead of adding it.
- **`Dockerfile`:** multi-stage (`deps` → `build` → `runner`). Use Next.js `output: "standalone"`,
  run as a non-root user, add a `HEALTHCHECK` on `/api/health`, and keep a `.dockerignore`.
- **`app` startup:** an entrypoint runs `prisma migrate deploy`, then starts the server.
  `depends_on: db: condition: service_healthy`.
- **Uploaded scan images** go in a named volume (`uploads`) mounted at `/app/storage/uploads`.
  Don't store base64 in the database. The storage path is an env var behind a small
  `StorageService` interface, so S3-compatible storage can be added later.
- **Two documented workflows** (README + npm scripts):
  - *Dev:* `docker compose up -d db`, then `npm run dev` on the host (fast hot reload).
  - *Demo / factory:* `docker compose up --build`, which runs the whole system with one command.
- The YOLO model runs **inside** `app` (ONNX Runtime, D-064); its files are mounted read-only from
  `cv/models` at `/app/models`. HTTPS for phones comes from a Cloudflare Tunnel on the host, not a
  container (D-076).
</docker>

<architecture>
Follow strict **MVC with layered server code**. Every route lives in a predictable folder.

```
src/
  app/                              # VIEW layer (React Server/Client Components)
    (auth)/login/page.tsx
    (app)/layout.tsx                # sidebar shell, role-aware nav, theme toggle
    (app)/floor-manager/            # FM home
    (app)/admin/...                 # Admin home, users, settings, tokens, audit
    (app)/batches/...               # today, Plan days (FM, QI)
    (app)/camera/capture/           # Capture and Floor view (constructors)
    (app)/attendance/  inventory/  reports/  scans/[id]/
    api/
      health/route.ts
      v1/                           # ROUTES: REST API, versioned (docs/API.md lists every one)
        rolls/...  scans/...  production/...  inventory/...  attendance/...
        users/...  defect-types/...  suppliers/...  settings/...  reports/...  demo/...
  server/
    controllers/                    # CONTROLLER: parse+validate request → call service → shape response
    services/                       # business rules (scan ingest, rolls, batches, stock, reports)
    models/                         # MODEL: data access via Prisma, the ONLY layer that imports prisma
    validators/                     # Zod schemas (shared with forms)
    policies/                       # role → permission map; `can(user, "batch:create")`
    lib/                            # prisma client, auth config, errors, logger, storage
  components/
    ui/                             # shadcn primitives (restyled by tokens)
    features/<module>/              # feature components (BatchTable, ScanCard, ...)
  styles/tokens.css                 # design tokens from DESIGN.md
prisma/  schema.prisma  migrations/  seed.ts
scripts/ cv-simulate.ts  demo-seed.ts  demo-reset.ts  …
tests/   unit/  e2e/
```

Layer rules (enforce them in code review, and with ESLint `no-restricted-imports` where possible):

- `route.ts` files are **one-liners** that delegate to a controller. They contain no logic.
- Controllers never touch Prisma. Services never read `Request`. Only `models/` imports Prisma.
- Server Components and Server Actions call **services**, never models or Prisma directly.
- Every mutation checks a policy. Every write that changes business state writes an `AuditLog` row.
- API errors use one JSON shape: `{ error: { code, message, details? } }` with correct HTTP status codes.
- Middleware blocks unauthenticated users. Role guards distinguish 401, 403 and 404 (ui-craft §3).
</architecture>

<domain_rules>
**Production line:** Preparation → Construction → Sole-ing → Finishing. The system does not track
stages (removed in Phase 23, D-082); it tracks rolls at Preparation and pairs at each batch's end.

**Roll = one leather roll from a supplier** (`Roll` in the code, table `batches`, D-095). The Floor
Manager adds rolls to a Leather roll item in Inventory with the day they arrived, each roll's
**area** in sq ft (0.1 to 200) and the supplier's tag (D-103). Codes `LR-<supplier code>-001`;
older rolls keep `R-`/`B-`. Statuses: **Not scanned** (`IN_STOCK`, +1 on its item) → **Being
scanned** (`OPEN`, picked at Capture) → **Scanned** (`FINISHED`, Finish roll, −1 off stock,
D-112); **Removed** (`CANCELLED`) by the Floor Manager with a reason. `USED` and `RETURNED` are
history from Phases 30A and 30C. An empty roll picked by mistake is put back.

**Computer vision (Preparation only, before cutting):**

- One **scan = one shot** of the roll (a section; roll sizes vary, C-33). A scan has 0..n
  **detections** (defect type, confidence 0–1, box as fractions 0–1, length and area in inches when
  measured).
- **Defect types are data, not code.** Each has `key`, `label`, `isActive`, `sortOrder`, an
  **outcome** (Usable or Not accepted, D-093), and optionally **Not accepted from N in** (a length
  limit, C-37) and a **flat share** of the roll (%). A new database gets crease and scratch Usable;
  cut Not accepted from 3 in with a 1% flat share; hole, abrasion and dirt Not accepted.
- **Decision engine** (`src/lib/decision-engine.ts`, pure, unit-tested). Every shot is **PASS** or
  **REJECT**, final at once (C-21):
  1. A detection of an active type at or above **A defect counts as found at** (`CvSettings.foundAtOrAbove`,
     default 0.5, D-053) gives its type's outcome; with a length limit, Not accepted at or above it
     and Usable below; unmeasured counts as Not accepted. Below found-at it counts for nothing.
  2. Any Not accepted → **REJECT**; otherwise → **PASS**.
  3. Inactive types are ignored. A class key with **no defect type is dropped** before anything is
     stored (D-108): the Admin adds a retrained model's new classes under Settings.
  4. Each scan stores the rule used (`thresholdsSnapshot`), so old verdicts stay explainable.
- **Scale (D-120, D-121):** a printed ArUco card (4x4_50 id 0, 2.00 in) on the leather gives the
  inches across the photo. Capture reads it on a roll's **first shot**; later shots of the same
  picture size use that scale, and **Read the card again** replaces it (A-50). Boxes on the card
  are ignored (A-46). Without a scale on the first shot, Capture is off.
- **Roll share (D-106, D-110, D-116):** at Finish roll, the union of each shot's defect boxes over
  the roll's area, plus the flat shares. More than `CvSettings.returnSharePct` (default 10, strict)
  marks the roll **Returned to supplier**; otherwise **Scanning passed**. A roll that couldn't be
  measured reads Scanning passed (A-42). Reports count whole rolls, not shots (D-117).
- **Scanning time (D-121):** from Start scanning to Finish roll, the lunch break and nights left out.
- A rejected shot is not cut; the system moves no leather.

**Batches (D-097 to D-099, D-114, D-115):** the Floor Manager plans each weekday on a calendar:
rolls to be used (an estimate), the quota of **passed** pairs, the check-in interval (every 4 hours
or once at the end of the day) and the shift (inside 08:00 to 17:00, Monday to Friday, D-105), or
marks it **Non-working / Holiday**. A day with no plan has no batches. Each interval is a batch;
working time leaves out lunch (the System Admin's setting, default 11:00 to 12:00, from tomorrow),
so the defaults give 08:00–13:00 and 13:00–17:00. Status is worked out from the clock: Upcoming,
In progress (Paused for lunch), Due, Late after 30 minutes, Finished, Missed at midnight. The
Quality Inspector finishes each batch from 10 minutes before its end with the pairs finished and,
of these, the pairs that failed inspection; the Floor Manager only on a day attendance shows no QI
present (D-088). A Correct needs a reason: on the inspection day for the QI (or the Floor Manager covering), and on any past day for the Floor Manager (Phase 35B). On-screen notices only (banner, bell, tab
title), nothing reaches a closed app.

**Final defects and repairs (Phase 34, D-130):** when pairs fail inspection the QI lists _what was
wrong_: one line per defect (a `FinalDefectType`, a list the System Admin edits, separate from the
camera's leather defect types), the pairs, **Fixable** or **Not fixable**, and for a fixable one the
stage it goes back to. The lines add up to the failed pairs; `OTHER` needs a note. Each fixable line
makes a repair job (`RP-261120-2-1`) **At stage**; the constructor assigned to that stage today (or
the Floor Manager) marks it **Back for inspection**; the QI inspects it from the Queue: passed,
scrapped or sent back again (no limit, a child job). The Floor Manager may move an At-stage job or
call it Not fixable after all, with a reason. Passed repaired pairs count toward the quota on the day
they pass (`passed = finished − failed + repaired pairs that passed that day`). After 5 findings of
a type in 4 weeks the form suggests the usual answer, never filling it in. A correction can change
the failed pairs and lines until a repair from the batch is Back or Done.
Failed pairs from before Phase 34 have no reasons ("Reason not recorded").

**Corrections to past records (Phase 35B, D-133):** only the Floor Manager corrects what is past, always
with a reason (5 characters or more) and an audit row holding the old and the new value: a **batch from
any past day** (Batches → Queue → Inspected and void has a Batch date picker; every rule of a same-day
correction still holds, including the lock once a repair from the batch is Back); a **roll's details**
(tag number, received day, return note once a decision exists, and the area only until Finish roll,
because the defect share and the return mark are worked out from it; the supplier and the item never
change); and a **repair's inspection** (how its pairs split between passed, scrapped and sent back
again, the same total, while every job it sent back is still At stage; those jobs follow). The
Quality Inspector still corrects only on the inspection day. No migration: the audit log is the record.

**Stages and work in progress (Phase 34, D-130):** the stages are Preparation, **Construction**
(formerly "Upper making"), Sole-ing and Finishing. The Floor Manager assigns the active Shoe
Constructors to stages for a day in the Plan dialog (one stage each, suggested from the last working
day, editable for today and later planned days). An assigned constructor, or the Floor Manager,
saves the pairs at a stage; the latest count of the day is the stage's count. Batches → Work in
progress shows each stage's count, its repairs and what waits for inspection. All figures are per
stage, never per person.

**Inventory:** items with category (`LEATHER_ROLL | NAILS | ADHESIVE | THREAD | EQUIPMENT | OTHER`),
unit, quantity on hand and reorder level; a leather item has a supplier and counts its rolls.
Quantities change only through `InventoryMovement` (IN / OUT / ADJUST, with a reason), never edited
or deleted. The Floor Manager saves **Added**, **Used** and **Correction** (with a reason) for any
items on the **Update stock** sheet in one transaction; reminders on the chosen days (Wednesday and
Friday by default) until a save that day. Low stock when quantity ≤ reorder level.

**Attendance:** the Floor Manager ticks who is present, today and 7 days back; the only worker
count is constructors present over the roster, which explains a short day. No per-person history.

**Workforce:** no per-person metrics anywhere. Aggregates are per batch, day, roll, material or
supplier only. A scan never names who captured it (the audit log does).

**Time:** store in UTC, display in `Asia/Manila`. Daily figures are bucketed by Manila calendar day.
</domain_rules>

<roles_and_modules>
Seed one demo account per role (password from `.env`, documented in README).

Each role sees only its modules (Phase 28, D-100, C-18). Sidebars, in order: Shoe Constructor
**Capture**; Quality Inspector **Batches**; Floor Manager **Overview, Batches, Attendance, Reports,
Inventory**; System Admin **Overview, Users, Settings, API tokens, Audit log** (D-119). Everything
else answers 403; removed pages answer 404. The matrix is `src/server/policies/permissions.ts`.

| Module                                                                   | Floor Manager              | Quality Inspector | System Admin | Shoe Constructor   |
| ------------------------------------------------------------------------ | -------------------------- | ----------------- | ------------ | ------------------ |
| Overview (role home)                                                     | ✅                         | — (Batches)       | ✅           | — (Capture)        |
| Capture and Floor view: pick leather and roll, capture, finish, put back | —                          | —                 | —            | if allowed (D-075) |
| Reports → Rolls, a roll's page and its shots, the claim sheet, Remove    | ✅ (`roll:*`, `scan:read`) | —                 | —            | —                  |
| Batches: today                                                           | ✅                         | ✅ (home)         | —            | —                  |
| Batches: finish and correct a batch                                      | no QI present (D-088)      | ✅                | —            | —                  |
| Batches: Plan days calendar, quota, Recent days                          | ✅                         | —                 | —            | —                  |
| Attendance                                                               | ✅                         | —                 | —            | —                  |
| Inventory, Add rolls, Update stock, reminder days                        | ✅                         | —                 | —            | —                  |
| Reports: Operations, Quality, Rolls, Materials, CSV                      | ✅                         | —                 | —            | —                  |
| Users (add, edit, deactivate, reset password, unlock, camera access)     | —                          | —                 | ✅           | —                  |
| Settings: defect types, thresholds, suppliers, lunch break               | —                          | —                 | ✅           | —                  |
| API tokens (create, revoke; shown once)                                  | —                          | —                 | ✅           | —                  |
| Audit log                                                                | —                          | —                 | ✅           | —                  |

**Floor Manager overview:** today's batches against the quota, today's attendance, Rolls today
(rolls scanned, returned to supplier, open), low stock, the stock update reminder and the daily
summary. **System Admin overview:** system health, users, the lunch break, the audit log and the
camera API tokens.
**Demo tools (D-101):** with `DEMO_LOGIN_TOOLS=true` and `SEED_DEMO_USERS=true` the login page has
a demo sign-in per role and Reset demo data, and every page shows a Demo mode band.
**Camera administration (D-119):** there is no Camera page. The System Admin gives camera access
(Users → More actions), sets defect types, thresholds and the early-model notice (Settings), and
manages device tokens (API tokens).
</roles_and_modules>

<cv_integration_contract>
The model runs **inside the app** (ONNX Runtime on the CPU, D-064); there is no separate camera
service (the station app was retired in Phase 20, D-069). Two entry points share one `ingestScan`
and the decision engine. Full shapes in `docs/API.md`.

- `POST /api/v1/scans/capture`: the Capture page, with the signed-in session of a Shoe Constructor
  the System Admin allowed. `multipart/form-data`: `image` (≤10 MB, jpeg/png/webp), `captureId`
  (UUID, a retry returns the first scan), `rollId` (required, must be open), `source`
  (`PHONE | WEBCAM`), `capturedAt`, `markerCorners` (the card's corners in fractions; required on a
  roll's first shot of a picture size, D-121). The server runs the model and answers `201` with the
  verdict and the defects; `409 ROLL_CLOSED`/`NO_ROLL_CHOSEN`, `422 MARKER_REQUIRED`/`MARKER_UNREADABLE`
  and `503 MODEL_UNAVAILABLE` are checked before or instead of the model.
- `POST /api/v1/scans`: a device token (`Authorization: Bearer cpt_…`, hashed, `scans:create`,
  revocable, `lastUsedAt` tracked), for `npm run cv:simulate` and test devices. Adds `detections`
  (`[{ classKey, confidence, box: { x, y, width, height } }]`), `modelVersion`, `source`
  (`SIMULATOR | PHONE | WEBCAM | DEDICATED_CAMERA`), and `widthIn` or `markerCorners` for the
  scale; without `rollId` the scan goes to the roll open the longest. `GET /api/v1/rolls/current`
  names that roll.
- Defect class keys, found-at, length limits, flat shares and the return limit are data. A
  retrained model needs **zero code changes**: export it with `cv/` (`export-onnx`), put the files
  in `cv/models/`, and add its new classes under Settings → Defect types.
  </cv_integration_contract>

<ui>
- Follow `.claude/skills/ui-craft/SKILL.md` for every screen. Write the 3-line intent brief in the
  PR/commit body or in a code comment at the top of each page. Build every state (loading
  skeleton, empty, error with retry, success, disabled-with-reason, 401/403/404).
- **Phase 0 runs ui-craft §9 (Design System).** Before deleting the Laravel code, extract the
  existing identity: `public/images/cpoint-logo.jpg` (CPoint yellow + red + black), the Figtree
  font, the left sidebar layout, and the light/dark theme with no flash on load. Turn those into
  `DESIGN.md` + `src/styles/tokens.css`.
  - Brand **red must not be the general accent.** It collides with the Reject/danger meaning on a
    QC screen. Use yellow as the brand mark/highlight, a warm-tinted neutral ramp, and a distinct
    accent. Semantic colors are fixed: PASS = success, REJECT = danger (Phase 25: there
    are no other verdicts). Never rely on color alone; always pair it with a label or icon.
- Density: these are desk users working all day, so use compact tables, right-aligned numbers and
  sortable columns.
- Destructive actions (remove a roll, deactivate a user, revoke a token) need a
  confirmation that names the item. Reversible actions use an undo toast.
- Accessibility: keyboard reachable, visible focus, contrast ≥ 4.5:1, honors `prefers-reduced-motion`.
- Language: English UI.
</ui>

<data_model_outline>
Prisma models (`prisma/schema.prisma` has every field and index; ids are UUIDv7, D-018):
`User(role, isActive, canCapture)`, `SessionRevocation`, `ApiToken(name, tokenHash, scopes, lastUsedAt, revokedAt)`,
`AuditLog(actorId?, actorType USER|DEVICE|SYSTEM, action, entity, entityId, before?, after?)`,
`Supplier(name, code)`, `DefectType(key, label, isActive, sortOrder, outcome, notAcceptedFromIn?, flatSharePct?)`,
`CvSettings(foundAtOrAbove, earlyModelNotice, returnSharePct)` (singleton),
`Roll(code, tagCode, itemId, supplierId, areaSqFt, receivedAt, status, startedAt, finishedAt, defectSharePct, returnLimitPct, markedForReturn, …)` (table `batches`),
`Scan(rollId, sequence, imagePath, source, modelVersion, captureId, aiVerdict, finalVerdict, widthIn, defectAreaSqIn, flatSharePct, thresholdsSnapshot)`,
`Detection(scanId, defectTypeId?, rawClassKey, confidence, x, y, width, height, lengthIn?, areaSqIn?)`,
`InventoryItem(sku, name, category, unit, quantityOnHand, reorderLevel, supplierId?)`,
`InventoryMovement(itemId, type, quantityDelta, reason, rollId?, updateId?)`, `StockUpdate`, `InventorySettings(reminderDays)`,
`AttendanceDay`, `AttendanceMark(present)`, `LunchBreak(startTime, endTime, effectiveFrom)`,
`DayPlan(day, kind PLANNED|NON_WORKING, rollsPlanned, quota, intervalMinutes, shiftStart, shiftEnd)`,
`ProductionCheckIn(day, slotAt, pairs, failedPairs, constructorsPresent, correction fields)` (a finished batch),
`ProductionBatch(code B-YYMMDD-N, status, priority, …)` (Phase 33), and Phase 34 (D-130):
`FinalDefectType(key, label, isActive, sortOrder)` (data; `OTHER` always exists),
`InspectionFinding(checkInId, finalDefectTypeId, pairs, remedy FIXABLE|NOT_FIXABLE, returnStage?, note?)`,
`RepairJob(code RP-YYMMDD-<batch>-<n>, findingId, parentId?, pairs, stage, status AT_STAGE|BACK_FOR_INSPECTION|DONE|CANCELLED, backAt, inspectedAt, passedPairs, scrappedPairs, resentPairs)`,
`StageAssignment(day, stage, userId)` (unique per day and user) and `StageCount(day, stage, pairs, enteredById, batchId?)` (append-only; the latest row of a day and stage is the count),
with the enums `ProductionStage` (PREPARATION, CONSTRUCTION, SOLE_ING, FINISHING), `Remedy` and `RepairStatus`,
and the code sequences `RollSequence`, `RollCodeSequence`. Removed tables (procurement, review,
repair, salvage, stages, shoe types, components) are listed in their D-entries.
</data_model_outline>

<phases>
The authoritative list with acceptance criteria is `docs/ROADMAP.md`; Phases 9 to 31 and the
follow-ups are there. The rebuild's first phases, as history (several were removed later, see
"Changed since the rebuild"):
0. **Foundation:** branch, DESIGN.md from the legacy identity, remove Laravel, scaffold Next.js +
   tooling + Docker + CI, `/api/health`, docs updated.
1. **Data & auth:** Prisma schema, migrations, seed, Auth.js login, role policies, app shell with
   role nav and theme.
2. **Batches & stages:** batch CRUD, stage advance with logs, batch detail timeline.
3. **CV skeleton:** device tokens, ingestion API, decision engine, simulator, override + review queue,
   Latest scans widget, Camera placeholder.
4. **Rework & salvage:** tickets, salvage lifecycle, batch counts service.
5. **Inventory:** items, movements, low-stock alerts, roll consumption on batch create.
6. **Admin:** users, defect types, CV settings, shoe types/suppliers, audit log viewer.
7. **Dashboards & reports:** role overviews, daily summary, defect analytics, stage-duration
   bottleneck chart, CSV export.
8. **Hardening & demo:** e2e smoke per role, ui-craft audit pass with fixes, demo seed, README,
   full `docker compose up --build` dry run.
</phases>

<quality_gates>
A phase isn't done until **all** of these pass, and you've pasted the actual output summary into
your final report:

- `npm run lint` · `npm run typecheck` · `npm run test` (unit) · `npm run build`
- Phase-relevant Playwright tests pass (written by Claude, run by Codex, D-092).
- `docker compose up --build` starts cleanly and `/api/health` returns 200 (check in Phase 0 and
  Phase 8, and whenever Docker files change).
- The decision engine, scan ingest, roll share and batch rules have unit tests covering edge cases:
  no detections, exactly at found-at and just below, a length exactly at the limit and just below,
  unmeasured shots, inactive and unknown class keys, a share exactly at the return limit, lunch and
  the last batch of the day.
- The ui-craft "Definition of done" checklist is satisfied for every screen touched.
- If a gate can't run (e.g. no Docker in the environment), say so explicitly. Never claim it passed.
  </quality_gates>

<documentation_protocol>
The docs are the project's memory between sessions and between teammates. Keep them true.
At the **end of every session** (use the `/wrap-up` skill):

1. **`docs/STATUS.md`**: update the current phase, the progress checklist, what's next (the exact
   next step), blockers, and open questions. Keep it under ~150 lines and keep it current; it's
   not a history.
2. **`docs/SESSION_LOG.md`**: append one entry (date, phase, summary, files/areas touched, gate
   results, follow-ups). Newest on top.
3. **`docs/DECISIONS.md`**: append an ADR-style entry for any architectural or business-rule
   decision made or changed.
4. **`docs/ROADMAP.md`**: tick the acceptance criteria that are done.
5. `README.md`, `docs/API.md`, `DESIGN.md`: update them when setup, endpoints or design change.
6. Leave the changes uncommitted and give Dylan the git commands (project rules).
   </documentation_protocol>

<final_report_format>
End every session with:

1. **Phase / outcome:** one line.
2. **What changed:** bullets by module.
3. **Quality gates:** each gate with pass/fail/not run (and why).
4. **Assumptions made:** each also logged in STATUS → Open questions.
5. **Questions for the team:** only the ones that block the next phase.
6. **Next session:** the exact prompt to paste.
   </final_report_format>
