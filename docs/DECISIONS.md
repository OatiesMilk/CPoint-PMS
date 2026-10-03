# Decision Log

ADR-style, append-only. To change a decision, add a new entry that supersedes the old one;
don't edit history. Format: **ID · date · status**, then Context / Decision / Consequences.

---

### D-001 · 2026-10-02 · Accepted — Rebuild on Next.js + PostgreSQL + Prisma

**Context:** The panel asked for an industry-standard rebuild of the Laravel/MySQL capstone system.
**Decision:** Next.js App Router (TypeScript strict), PostgreSQL, Prisma, Auth.js, Zod, Tailwind +
shadcn/ui, TanStack Query, Recharts, Vitest, Playwright, GitHub Actions CI.
**Consequences:** No PHP code is reused. Ideas carried over are listed in D-009.

### D-002 · 2026-10-02 · Accepted — MVC with a layered server folder

**Decision:** `app/` = views; `app/api/v1/**/route.ts` = routes (one-liners); `server/controllers`,
`server/services`, `server/models` (only layer importing Prisma), `server/validators`, `server/policies`.
**Consequences:** Predictable file locations; layer rules enforced via ESLint import restrictions.

### D-003 · 2026-10-02 · Accepted — Docker: one compose file, two services

**Context:** The team wants minimal, organized containers. Putting Postgres and Next.js in a single
container is an anti-pattern.
**Decision:** `docker-compose.yml` with `app` + `db` only, named volumes `pgdata` and `uploads`.
Dev runs only `db` in Docker; the demo runs everything. The future YOLO service runs outside compose.

### D-004 · 2026-10-02 · Accepted — Legacy Laravel code removed on `system-rebuild`

**Decision:** Delete it in Phase 0 after capturing the design identity. `main` keeps the legacy
system for reference. Start with a fresh database (no MySQL data migration).

### D-005 · 2026-10-02 · Accepted — Batch = one leather roll; scan = one leather section

**Decision:** CV runs only at Preparation, before cutting. Each scan is one section of the roll.
Stages advance manually by the Floor Manager, with logged durations (to measure bottlenecks).

### D-006 · 2026-10-02 · Superseded by D-011 — Decision engine

**Decision:** If every confidence is < 0.50 → PASS. If any is ≥ 0.80 → that defect type's
`defaultAction` (REJECT > REWORK). Otherwise → NEEDS_REVIEW (QI or FM decides; either can override
with a reason). Defect types, default actions and thresholds are admin-editable data.
Seeded: cut/hole → REJECT, abrasion/dirt → REWORK. **Confirm with the client.**

### D-007 · 2026-10-02 · Accepted — Rework and reject handling

**Decision:** REWORK opens a repair-station ticket. When it's DONE, the section counts as usable
(no re-scan). REJECT creates a SalvageItem that can be assigned to a later batch or discarded,
which matches the client's material-reuse practice.

### D-008 · 2026-10-02 · Accepted — Scope limits

**Decision:** Desktop web only. Camera page is a placeholder plus a simulator. Shoe Constructor and
component tracking are placeholders. Basic inventory with low-stock alerts is in scope; batch
scheduling from inventory is deferred. **No per-person workforce metrics** (client reported
jealousy issues). English UI, `Asia/Manila` timezone.

### D-009 · 2026-10-02 · Accepted — Ideas carried over from the legacy system

Token-authenticated CV ingestion endpoint; "current open batch" lookup for the capture client;
confidence-threshold auto-decisions; human review queue with override tracking (AI agreement
rate); audit log; decision-support style defect analytics; light/dark theme with sidebar; CPoint logo.

### D-010 · 2026-10-02 · Accepted — Living project docs for agentic development

**Decision:** `CLAUDE.md` (auto-loads `docs/STATUS.md`), `docs/ROADMAP.md`, `docs/DECISIONS.md`,
`docs/SESSION_LOG.md`, plus `/resume` and `/wrap-up` skills. Every session ends by updating them.

### D-011 · 2026-10-02 · Accepted — Uniform confidence rule for all defect types (supersedes D-006)

**Context:** The team set one default for every defect type instead of per-type actions.
**Decision:** The highest confidence among active defect types decides: **≥ 0.90 → REJECT**,
**0.60 – < 0.90 → REWORK**, **< 0.60 or no detections → PASS** (ASSUMPTION). A detection with an
unknown class key → NEEDS_REVIEW. Thresholds are admin-editable `CvSettings`
(`rejectAtOrAbove`, `reworkAtOrAbove`) and are snapshotted on each scan. The QI or FM can override
any decision with a reason. `DefectType.defaultAction` is dropped.
**Consequences:** Every outcome is automatic; the review queue only holds flagged scans, while human
judgement happens through overrides (tracked as the AI agreement rate). Confirm the values with CPoint.

### D-012 · 2026-10-02 · Accepted — Pinned versions at Phase 0

Next.js 16.3.8 · React 19.2.8 · TypeScript 5 (strict) · Prisma 7.10.0 + `@prisma/adapter-pg` ·
PostgreSQL 18 (`postgres:18-alpine`) · Node 24 LTS in Docker/CI (22.12+ supported locally) ·
Tailwind CSS 4 · Zod 4 · Vitest 5 · Playwright 1.63 · ESLint 9 · Prettier 3.
**Why not Prisma 8:** at scaffold time npm's `latest` tag pointed at `8.0.0-rc.19`, a release
candidate. 7.10.0 is the newest stable release. Upgrade once 8 is stable.

### D-013 · 2026-10-02 · Accepted — Self-hosted font and hand-written shadcn primitives

**Decision:** Figtree comes from `@fontsource-variable/figtree` (npm) rather than Google Fonts, so
builds and the factory LAN work without internet. shadcn/ui is set up manually
(`components.json`, `cn()`, Radix via the `radix-ui` package). Components are written in shadcn's
structure and styled only with DESIGN.md tokens.

### D-014 · 2026-10-02 · Accepted — Migrations run in the app container at startup

**Decision:** `docker/entrypoint.sh` runs `prisma migrate deploy`, then `node server.js`. The
Prisma CLI is installed in its own Docker stage (pinned to `package.json`) and copied into
`/app/migrate`.
**Trade-off:** the stock Prisma 7 CLI bundles Prisma Studio, so the image is about 650 MB. Removing
Studio's packages breaks the CLI, and hacking it would break on upgrades. If image size matters
later, run migrations from CI or a one-off `docker compose run` instead.

### D-015 · 2026-10-02 · Accepted — Theme via `data-theme` + inline script

**Decision:** `<html data-theme="light|dark">` is set by an inline script before first paint. The
saved choice (`localStorage["cpoint-theme"]`) wins; otherwise the OS preference applies. Tailwind's
`dark:` variant is bound to `[data-theme="dark"]`. This follows the Next.js 16
"preventing flash before hydration" guide, so no theme library is needed.

### D-016 · 2026-10-02 · Accepted — Auth: Auth.js credentials, JWT sessions, database-checked guard

**Decision:** Auth.js v5 (`next-auth@5.0.0-beta.32`, which supports Next 16) with a credentials
provider. The session is a JWT (12 hours, one shift) carrying only `{ userId, role }`. The real
authorization lives in the Data Access Layer (`src/server/policies/guard.ts`), which re-reads the
user on every request, so deactivation and role changes apply on the next click. `proxy.ts` (Next
16's middleware) only checks the cookie. Passwords use `bcryptjs` cost 12 (pure JS, no native
build on Alpine). 5 wrong passwords lock the account for 15 minutes. Unknown emails get the same
answer and timing as wrong passwords. 403 is a stable redirect to `/forbidden` rather than the
still-experimental `forbidden()`.
**Consequences:** No Auth.js adapter tables are needed. Each page costs one indexed user lookup per
request (memoised with React `cache`).

### D-017 · 2026-10-02 · Accepted — Seeding runs inside the app on startup

**Decision:** `bootstrap.service.ts` runs from `instrumentation.ts` on every server start and from
`npm run db:seed`:

- Reference data uses create-if-missing upserts that never overwrite admin edits.
- The first System Admin comes from `BOOTSTRAP_ADMIN_*` and is created only if no admin is active.
- Demo users are opt-in via `SEED_DEMO_USERS`.
- A database outage during bootstrap is logged, not fatal.

**Why:** the Docker runner has no `tsx`. Seeding through the app's own code and Prisma client
means there's no second toolchain in the image, and a fresh factory install is usable with
`docker compose up` alone.

### D-018 · 2026-10-02 · Accepted — Schema conventions

**Decision:**

- UUIDv7 primary keys (time-ordered). Tables are snake_case via `@@map`; columns keep Prisma's
  camelCase.
- Every foreign key is indexed. Money and quantities are `Decimal(12,2)`; confidences and
  thresholds are `Float`.
- No hard deletes of people or production data: `isActive`, `CANCELLED` or `onDelete: Restrict`.
- Overrides cancel and recreate rework/salvage rows rather than editing them, so history survives.
- The full schema for all phases is in the first migration, and later phases add migrations only
  when requirements change.

### D-019 · 2026-10-02 · Accepted — Batch lifecycle and concurrency rules

**Decision:**

- **Lifecycle:** `PLANNED` (registered) → _Start production_ opens Preparation → _advance_ one
  stage at a time (no skipping) → _Complete_ only from Finishing (confirmed, final).
- **Move back:** one stage, reason required, logged as `isRollback` with the reason; repeat visits
  add to that stage's total time.
- **Cancel:** from Planned or In progress, reason required, final.
- **Edits:** allowed until completed/cancelled, but the shoe type locks at start.
- **Codes:** `B-<Manila year>-<4-digit counter>` from an atomic `INSERT … ON CONFLICT` on `batch_sequences`.
- **Concurrency:** each move sends `expectedStage`, and the update is conditional on the state that
  was read. A mismatch is `409 STALE`, and the UI offers Refresh.
- **One rule set:** `src/lib/stage-machine.ts` is a pure module used by both the services and the UI,
  so buttons and rules can't drift.

**Consequences:** stage durations come from `batch_stage_logs`, which is the data for the Phase 7
bottleneck report. Phase 3 attaches scans to batches `IN_PROGRESS` at `PREPARATION`.

### D-020 · 2026-10-02 · Accepted — Camera ingestion contract, batch targeting and device tokens

**Context:** One camera at Preparation, but several batches can be at Preparation at once. The real
YOLO service must plug in later without code changes.
**Decision:**

- **Which batch:** the camera feeds the batch picked on the Camera page
  (`cv_settings.activeBatchId`, FM/QI via `camera:manage`). Otherwise, or once that batch leaves
  Preparation, it feeds the batch at Preparation the longest. With none at Preparation, ingestion
  returns 409 and stores nothing. An explicit `batchId` is accepted for future multi-camera setups.
- **Contract:** `POST /api/v1/scans` (multipart: `image`, `detections` JSON with fractional boxes,
  optional `source`/`modelVersion`/`capturedAt`/`batchId`) is the stable interface, documented in
  `docs/API.md`.
- **Unknown classes:** any unknown class key forces NEEDS_REVIEW, even beside a high-confidence
  known defect. Known-but-deactivated types are ignored.
- **Outcome rows** (D-007) are created in the ingestion transaction. Overrides cancel and recreate
  them, and are refused once a repair has started or the salvage has been reused or discarded.
- **Device tokens:** `cpt_` + 32 random bytes, stored as SHA-256 with a 12-character display prefix,
  scope `scans:create`, revocable. `lastUsedAt` is updated at most once a minute.
- **Images:** stored on disk under `UPLOADS_DIR` (the Docker `uploads` volume) via `StorageService`,
  using server-generated keys that are never overwritten. The type is checked by magic bytes; ≤ 10 MB.
- **Live widget:** TanStack Query polling every 5 s, paused in background tabs, rather than
  websockets. The survey says daily summaries are enough; only the camera feed needs to be near-live.

**Consequences:** Phase 4 only builds the lifecycle and boards for rows that already exist. Phase 6
adds the Settings page for defect types and thresholds.

### D-021 · 2026-10-02 · Accepted — Rework and salvage lifecycle, repair guard and batch yield

**Context:** Phase 3 creates a rework ticket for every REWORK scan and a salvage item for every
REJECT scan (D-007, D-020). The client said repaired sections "should still be counted in the
batch", and that rejected leather is kept for later production (survey Q15).
**Decision:**

- **Rework ticket:** `OPEN → IN_PROGRESS → DONE` ("Start repair", "Mark repaired"). Each step can
  be undone one step back (6 s undo toast; "Reopen" on DONE) while the batch is open. `CANCELLED`
  comes only from an override or a batch cancel, and is final. The QI and the FM can both work the
  board (`rework:manage`). There's no drag and drop: buttons are clearer and keyboard-accessible.
- **Salvage item:** `AVAILABLE → ASSIGNED` to another batch that is Planned or In progress (never
  its origin), `ASSIGNED → AVAILABLE` ("Unassign") while that batch is open, and
  `AVAILABLE → DISCARDED` with a required reason (final, confirmed). Only the FM decides
  (`salvage:manage`). The QI sees the list read-only.
- **Yield:** usable = passed + repaired (DONE). Sections still at the repair station, rejected,
  pending review, and cancelled tickets are not usable. Salvage reused in a batch is counted
  separately ("Salvage reused here"), not added to usable, because it wasn't scanned as part of that roll.
- **Repair guard:** a batch can't be completed while any of its sections are OPEN/IN_PROGRESS at
  the repair station (409 naming the count). Otherwise a closed batch's usable count would be wrong.
- **Cancel cascade:** cancelling a batch cancels its OPEN/IN_PROGRESS tickets in the same
  transaction (audited `rework.cancel`). Its AVAILABLE salvage stays available, because the
  leather still exists.
- **Concurrency:** every move sends `expectedStatus`. The update is conditional, so a mismatch is
  409 STALE (same pattern as D-019).

**Consequences:** Phase 7 reports can read repair turnaround (`openedAt → startedAt →
completedAt`) and salvage reuse from these rows. There are no per-person metrics; `completedById`
and `handledById` are only for the audit trail (D-008).

### D-022 · 2026-10-03 · Accepted — Completing a batch with repairs still open (supersedes part of D-021)

**Context:** D-021 blocked completing a batch while any section was still at the repair station.
The team pointed out that the line doesn't wait for the repair station: the batch moves on, and
the repaired sections join it later.
**Decision:**

- A batch **can be completed** with OPEN/IN_PROGRESS repairs. The confirm dialog says how many are
  still at the repair station.
- Any batch with unfinished repairs, completed or not, shows an **"In repair · N"** tag on the
  batch list and the batch detail. The tag disappears when the last repair is done.
- Repairs on a **completed** batch stay workable on the Rework board (start, repaired, undo,
  reopen), and the batch's usable count rises as they're repaired. Only a **cancelled** batch
  freezes its repairs (they're cancelled with it, D-021).
- Unchanged from D-021: usable = passed + repaired; salvage reused in a batch is shown separately
  and not added to usable (confirmed by the team, 2026-10-03); salvage can only go to a Planned
  or In-progress batch.

**Consequences:** a completed batch's usable count can still change until its repairs finish.
Phase 7 reports should read yield "as of now", or only after the tag clears.

### D-023 · 2026-10-03 · Accepted — Inventory is a ledger; optional roll consumption

**Context:** CPoint tracks materials in a paper log book, and a late leather roll has stopped
production before (survey Q12–Q14). Phase 5 adds items, stock movements and low-stock alerts.
**Decision:**

- **Ledger:** `quantityOnHand` changes only with an `inventory_movements` row, in the same
  transaction, through one conditional `UPDATE`. Movements are never edited or deleted. A mistake
  is undone with an opposite entry (the 6 s Undo toast; allowed once, within 10 minutes) or
  corrected by a stock count.
- **Types:**
  - IN = received (> 0).
  - OUT = used (> 0). It's refused if it would go below zero: no negative stock, ever.
  - ADJUST = stock count. The user enters the counted quantity. It applies only if the stock is
    still what the counter saw (else 409 STALE), and a reason is required.
- **Quantities:** at most 2 decimals, ≤ 1,000,000, and computed in hundredths.
- **Items:**
  - The code is unique, suggested per category (`LR-001`, `NL-`, `AD-`, `TH-`, `EQ-`, `OT-`) and
    editable.
  - Opening stock is recorded as an IN "Opening stock".
  - The quantity is never editable on the item.
  - There's no delete: deactivating hides an item from pickers and refuses movements, but keeps
    its history.
- **Low stock:** active and `quantityOnHand ≤ reorderLevel`, via a Prisma field reference. Out of
  stock at 0. Shown on the FM home card and as a list filter.
- **Rolls and batches:**
  - Creating a batch can optionally take one roll from a leather-roll item. It's an OUT linked to
    the batch, in the batch-create transaction. With no stock left, it's a field error and nothing
    is created.
  - Cancelling a **planned** batch returns the roll. After production starts the roll is cut, so
    nothing is returned.
  - Inventory tracks counts per item, not individual roll codes. The batch keeps its own `rollCode`.
- **Access** follows the master-spec matrix: the FM manages, the System Admin reads, the QI has
  no access. Entries show who recorded them, as the log book does. There are no per-person
  totals (D-008).

**Consequences:** Phase 7 reports can read consumption per batch and per period from the
movements. Supplier deliveries aren't linked to a supplier yet (the note holds it); add a
`supplierId` on IN movements if CPoint wants delivery reports.

### D-024 · 2026-10-03 · Accepted — Account administration, sessions and settings

**Context:** Phase 6 gives the System Admin the tools that were bootstrap or SQL-only: accounts,
thresholds, defect classes and the lists people pick from, plus a way to read the audit log.
There is no email in the factory setup, so password handover is in person.
**Decision:**

- **Temporary passwords:**
  - Creating an account or resetting its password generates a 12-character temporary password
    (no look-alike characters), **shown once** to the admin. Only its bcrypt hash is stored, and
    it never appears in the audit log.
  - The account gets `mustChangePassword`. Until the person chooses their own (`/account/password`,
    ≥ 10 characters, no other rules), every page redirects there and the API answers
    `403 PASSWORD_CHANGE_REQUIRED`.
- **Ending sessions:**
  - A new column `users.sessionsValidFrom`, and the JWT carries `authAt` (the sign-in time).
    `iat` can't be used: Auth.js renews it on every refreshed request.
  - A session that signed in before `sessionsValidFrom` is ended on its next request
    (`/logout?reason=password-reset`).
  - An admin reset ends all of the person's sessions. Changing your own password ends your other
    sessions and signs this one in again.
- **Lock-out protection:**
  - The admin can't deactivate or demote themselves, or reset their own password (they use
    Change password).
  - The **last active System Admin** can't be deactivated or demoted. This is checked in the UI,
    in the service, and again inside the transaction, so two admins can't race past it.
- **Thresholds** are edited as percentages (one decimal), with 0 < rework < reject ≤ 100. New
  scans use them; past scans keep their `thresholdsSnapshot`.
- **Defect types:**
  - The key is fixed after creation, because the camera sends it and detections keep the raw key.
  - Inactive types are ignored by the engine (D-011).
  - An **Unknown classes** panel lists flagged class keys with counts and offers "Add as defect
    type". This affects new scans only; past NEEDS_REVIEW scans stay in the queue.
- **Reference lists** (shoe types, suppliers, component types): add, edit, and deactivate/reactivate
  with an undo toast. **No deletes**, because records reference them. Inactive entries leave the
  pickers.
- **Component tracking** stays a placeholder: the table is managed in Settings, and `/components`
  says it's coming. The number of components per shoe type is still open with CPoint.
- **Audit log viewer:**
  - read-only;
  - filters for who, action, record type, Manila day range and record id;
  - each entry expands to a field-level before/after diff;
  - user audit rows carry the account's email so entries name the person.

**Consequences:** the `sessionsValidFrom` mechanism can also end sessions on a role change or a
"sign out everywhere" if CPoint wants it later. Phase 7 reports can rely on thresholds and defect
types being data that admins change.

### D-025 · 2026-10-03 · Accepted — Report metrics, chart colours, and server-side sign-out

**Context:** Phase 7 summarizes production and quality. The client wants a daily summary,
cares about the bottleneck stages, and doesn't want anyone singled out (D-008). Separately, the
e2e suite caught sign-out failing: a late prefetch response restored the session cookie, and the
JWT was still valid.
**Decision:**

- **Aggregation:** every report aggregates **per Manila day, defect type, stage or batch**, never
  per person.
  - Days are bucketed in SQL: `(ts AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila'`.
  - A unit test asserts that report payloads contain no person keys. Operational records (who
    recorded a stock entry, the audit log) are not reports.
- **Definitions:**
  - Verdict counts use the **final** verdict.
  - **AI agreement** = scans the AI decided (not NEEDS_REVIEW) whose final verdict equals the AI
    verdict / those scans. Unknown-class scans decided by a person are reported separately.
  - **Defects by type** use each scan's **strongest** detection (the one that drove the decision).
  - **Stage time** = completed visits ending in the range (median + average), moves back
    included, plus batches in each stage now and the longest wait.
  - The **bottleneck** is the stage with the highest median.
  - **Usable** yield is "as of now" (D-022).
- **Range:** a preset (Today / 7 / 14 / 30 days, default 14) or custom from/to. At most 92 days,
  never past today, in the URL.
- **Access:** quality reports for the FM and QI (`report:quality`); production (stage times,
  batches started/completed) for the FM only (`report:production`).
- **CSV:** UTF-8 with a BOM and CRLF (Excel-friendly), RFC 4180 quoting, and text cells starting
  with `= + - @` prefixed with `'` (formula injection).
- **Charts** (dataviz procedure):
  - Recharts only for the stacked daily verdict trend. Ranked lists use plain HTML bars with
    direct labels.
  - The verdict UI colours failed the colour-vision check when stacked (Rework vs Reject ΔE 0.8
    for deuteranopia), so charts use **chart-only steps** (`--chart-*` in `tokens.css`), validated
    with the dataviz validator in light and dark.
  - Light Rework is below 3:1 on the card, so every chart ships a legend (icon + label) and a
    table view.
  - Badges keep the original verdict tokens.
- **Sign-out is server-side:**
  - Each sign-in carries a random `sid` in the JWT.
  - Sign-out stores it in `session_revocations` (migration), kept until the token would have
    expired, and the guard refuses it.
  - Only that session ends; other devices stay signed in (password resets end all sessions,
    D-024).

**Consequences:** the guard does one extra primary-key lookup per request (run in parallel with
the user lookup). Report SQL lives only in `report.model.ts`. Phase 8 can seed a realistic week
using `capturedAt`.

### D-026 · 2026-10-03 · Accepted — Demo week seed through the real services

**Context:** Phase 8 needs a believable week of production for the panel demo, not test
leftovers. Hand-written SQL inserts would bypass the rules that keep stage logs, the stock ledger,
rework, salvage and the audit log consistent with each other.
**Decision:**

- **Replay, don't insert:** `seedDemoWeek` (`services/demo-seed.service.ts`) replays the last six
  Manila working days (Mon–Sat) by calling the real services with a past `now`:
  - `createBatch`, `transitionBatchStage`, `ingestScan`, `decideScan`, `moveReworkTicket`,
    `assignSalvage`/`discardSalvage`, `recordMovement`.
  - Services that create rows now pass their `now` through to `createdAt`/`openedAt`, so seeded
    rows carry the past time.
  - Audit `createdAt` stays the real seeding time. Accepted: the audit log records when a row
    was written.
- **Deterministic:** a mulberry32 PRNG with a fixed seed. Stage times are drawn from the survey's
  ranges: Preparation 2–3 h, **Upper Making 6–9 h** (bottleneck), Sole-ing 4–6 h, Finishing
  1–2 h. Scans use the simulator's mix (`lib/leather-scan.ts`, shared with `cv:simulate`), with
  real sharp-rendered JPEGs.
- **What the week contains:**
  - two batches per day, one moved back, one cancelled, one planned for tomorrow;
  - about 6% overrides with reasons, and repairs timed after each decision;
  - salvage reused in in-progress batches (at most 4 each) or discarded with a reason;
  - deliveries and daily use of supplies.

  The newest batch's last two sections are always unknown-class scans left in the review queue.

- **When it runs:** opt-in only. `SEED_DEMO_WEEK=true` (requires `SEED_DEMO_USERS`) runs it in
  the background on start, so the healthcheck isn't delayed. `npm run demo:seed` runs it by hand.
  Either way it runs **only when no batches exist**, so restarts never add a second week.
- `sharp` becomes a direct, exact-pinned dependency (the version Next already ships).

**Consequences:**

- The demo data passes the same invariants as real data: CI checks that the stock equals the
  ledger and that nothing re-seeds on restart.
- The seed's device token shows "Last used: Never", because the seed bypasses HTTP
  (`docs/UI_AUDIT.md` L4).
- Seeding takes about 30 s, in the background.

### D-027 · 2026-10-03 · Accepted — npm audit highs in the Prisma CLI are not reachable

**Context:** `npm audit` reports 4 highs: `deepmerge-ts` < 8 (stack exhaustion on recursive
objects) and `mysql2` ≤ 3.23.0 (auth downgrade, decompression bomb). Both come in via the
`prisma` CLI. The runtime image includes the CLI (`/app/migrate`) to run `migrate deploy` on
start. The only "fix" npm offers is a downgrade to Prisma 6, which breaks the project (D-001).
**Decision:** keep Prisma 7 and accept the exposure.

- `mysql2` is never loaded: the CLI talks to PostgreSQL only.
- `deepmerge-ts` merges our own static `prisma.config.ts`, with no outside input.
- The CLI runs once per container start and then exits. It never handles requests.

**Consequences:** re-check `npm audit` when upgrading Prisma, and drop this entry once Prisma
ships fixed dependencies. Don't add `overrides` that swap the CLI's dependencies untested.
