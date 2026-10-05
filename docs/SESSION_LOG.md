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
