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

### D-007 · 2026-10-02 · Superseded by D-093, D-094 — Rework and reject handling

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

### D-011 · 2026-10-02 · Thresholds superseded by D-093 (the camera decides, kept) — Uniform confidence rule for all defect types (supersedes D-006)

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

### D-019 · 2026-10-02 · Lifecycle superseded by D-082 (concurrency rules kept) — Batch lifecycle and concurrency rules

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

### D-020 · 2026-10-02 · Accepted (an unknown class rejects since D-093) — Camera ingestion contract, batch targeting and device tokens

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

### D-021 · 2026-10-02 · Superseded by D-094 (yield kept as Pass and Reject) — Rework and salvage lifecycle, repair guard and batch yield

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

### D-022 · 2026-10-03 · Superseded by D-094 — Completing a batch with repairs still open (supersedes part of D-021)

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

### D-023 · 2026-10-03 · Accepted (the delivery link removed by D-091) — Inventory is a ledger; optional roll consumption

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

### D-025 · 2026-10-03 · Stage metrics superseded by D-087; the agreement rate and Fixable colour by D-093 — Report metrics, chart colours, and server-side sign-out

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

### D-028 · 2026-10-05 · Superseded by D-093 (nobody decides after the camera) — Only the Quality Inspector decides flagged scans (supersedes part of D-011)

**Context:** D-011 and the master spec said the QI **or** the FM, "whoever is available" (survey
Q5), resolves a scan the camera flagged (an unknown defect class, NEEDS_REVIEW). The client now
asks that only the Quality Inspector does. This changes the review part of D-011. The confidence
rule and overrides of automatic calls are unchanged.
**Decision:**

- New permission **`scan:review`** (QI only). `scan:decide` (FM + QI) now covers only overrides of
  the camera's automatic Pass/Rework/Reject calls.
- A scan whose camera verdict was **NEEDS_REVIEW** stays the QI's for its whole life: both while
  it waits and after it's resolved, so the FM can't overturn the QI's call a click later. The rule
  is one pure helper, `requiredDecisionPermission(scan)`.
- It's enforced in `decideScan` (403 FORBIDDEN), so the Server Action and the API are both covered.
  The UI follows the same helper.
- The FM keeps the **Review queue**, read-only for flagged scans ("Waiting for a Quality
  Inspector"). Today's automatic Rework/Reject calls stay there for overrides.
- The demo seed resolves flagged scans as the QI only. A unit test asserts it.

**Consequences:** if no QI is on shift, flagged scans wait. **This differs from the survey answer
(Q5), so confirm it with CPoint** (listed under STATUS → Open questions). Reverting means mapping
`scan:review` back to FM + QI in `permissions.ts`.

### D-029 · 2026-10-05 · Superseded by D-091 (module removed) — Purchase requests: model and lifecycle

**Context:** CPoint orders materials from a paper log book (Q12). A late leather roll has stopped
the line (Q13), and nobody formally asks for stock (Q14). The client wants designated Shoe
Constructors to request materials, and the FM to approve or reject each request with a status,
an audit trail and remarks.
**Decision:**

- **Tables:**
  - `purchase_requests`: a code `PR-YYYY-NNNN` from its own sequence table, the requester,
    status, priority (`NORMAL | URGENT`), optional `neededBy`, a justification, and the decision
    fields.
  - `purchase_request_lines` (1–10): an inventory item, or a typed name and unit for something
    not in inventory yet. The name and unit are always stored. Each line keeps a **stock snapshot**
    (on hand and reorder level when asked), and the movement posted on receipt.
  - `purchase_request_events`: the timeline users see, since the audit log is admin-only.
  - `purchase_request_remarks`: append-only.
- **Lifecycle** (`src/lib/procurement-rules.ts`, pure):
  - `PENDING → APPROVED | REJECTED` by the FM (a rejection needs a reason of 3+ characters);
  - `PENDING → CANCELLED` by the requester only;
  - `APPROVED → RECEIVED` by the FM.
  - A request is never edited after it's sent: cancel and send a new one.
- **Receiving** posts an inventory **IN** ("Received for PR-…") for every line linked to an item,
  through `postMovement` in the same transaction (D-023's single ledger write path). Typed items
  are listed as "add to inventory first". The whole request is received at once; there's no
  partial receipt (Step 1 answer).
- **Concurrency:** every status change is a conditional update on the status that was loaded
  (409 STALE). Every mutation writes an event and `recordAudit` in the same transaction.
- **Views:**
  - the list (Pending first for the FM, urgent then oldest), the form, and the detail page with
    stock then and now;
  - an FM home card, a "Requested" badge on Inventory, and "My requests" on the constructor home.
- **Out of scope:** notifications, CSV and stats for requests. Nothing is counted per person
  (D-008); the requester's name on a request is fine, as in the log book.

**Consequences:** the ledger stays the only way stock changes. Lines keep their own name and
unit, so renaming an item later doesn't rewrite history.

### D-030 · 2026-10-05 · Superseded by D-031, then D-091 — Designated requesters

**Context:** only some Shoe Constructors should request materials, and the System Admin **or** the
FM chooses who.
**Decision:**

- **The flag:** a per-user flag, `users.canRequestMaterials`. Permissions stay role-based:
  - `procurement:read` (FM, Admin, Constructor; constructors see only their own requests);
  - `procurement:request` (Constructor);
  - `procurement:decide` (FM);
  - `procurement:remark` (FM; constructors on their own requests);
  - `procurement:designate` (FM, Admin). The FM does **not** get `user:manage`.
- **One check:** `canSubmitPurchaseRequest(user)` = the role permission **and** the flag. Pages,
  Server Actions and the API all use it (403 `NOT_A_REQUESTER`).
- **Fresh on every request:** the flag rides on `SessionUser`, which the guard reads from the
  database on every request (D-016). Turning it off applies on the person's next click, and they
  stay signed in.
- **Who can hold it:** only an active Shoe Constructor. A role change clears it, in the same
  transaction, with an audit entry.
- **Where it's set:** the FM's Requesters tab and the Admin's Users menu use the same service
  (`setRequester`), and both are audited.
- **Constructors' item picker:** a narrow, read-only list of active items with stock. They don't
  get `inventory:read`.
- **Bootstrap:** the demo constructor is designated when it's created, and only then, so an FM
  who stops it isn't overridden on the next start.

**Consequences:** Phase 1's "Constructor is a placeholder role" no longer holds. Q14 is still
open: who approves leather rolls (the FM or the leather-ordering staff member)?

### D-031 · 2026-10-05 · Superseded by D-091 (module removed) — Every constructor requests materials; leather rolls need the OK (supersedes D-030)

**Context:** the team clarified the client's rule (survey Q14).

- Every Shoe Constructor can request any material except leather rolls.
- Only the constructor(s) a System Admin or the Floor Manager designates may also request leather
  rolls. In practice that's the person who orders leather.
- The Floor Manager approves every request, leather rolls included.

D-030 had made the whole procurement module depend on designation.
**Decision:**

- **Submitting:** `procurement:request` (Shoe Constructor) is enough to send a request, cancel
  your own pending one, and add remarks to your own.
- **Leather rolls:** they also need `users.canRequestLeatherRolls`, which is the old
  `canRequestMaterials`, renamed. The rename keeps who was designated. The check is one helper,
  `canRequestLeatherRollsFor(user)`.
- **Recognising leather rolls:** each request line now records its **category**, copied from the
  inventory item or chosen for a typed item. A typed "leather roll" is caught the same way as a
  picked one.
- **Errors and UI:**
  - A leather-roll line without the OK is refused with 403 `LEATHER_ROLLS_NOT_ALLOWED`.
  - The form greys leather rolls out and says to ask the Floor Manager.
  - The FM's "Leather roll requesters" tab and the Admin's Users menu set the flag. Audit actions
    are `procurement.leather_rolls.grant|revoke`.
- **Unchanged from D-030:**
  - the flag is read from the database on every request, so a change applies on the next click
    without signing anyone out;
  - only an active Shoe Constructor can hold it, and a role change clears it;
  - the demo constructor gets it when bootstrap creates the account.

**Consequences:**

- Migration `leather_roll_requesters`: a column rename, plus a backfilled line `category`.
- The constructor home and Procurement are the same for every constructor; only the leather
  options differ.

### D-032 · 2026-10-05 · Accepted — `main` is the base branch; changes arrive by pull request

**Context:** all of `system-rebuild` is now in `main` (PR #1), and the team merges pull requests
by hand. The "work on `system-rebuild`" rule in CLAUDE.md, the skills and the docs no longer
matched how the repo is used.
**Decision:**

- `main` is the integration branch, and nobody pushes to it directly.
- Each session works on a branch from the latest `main`: the branch the session gives you, or
  `feature/<topic>`. It pushes that branch, and the team opens and merges the PR.
- CI runs on pull requests and on pushes to `main`. `system-rebuild` is kept only as history and
  receives no new work.
- `/resume` checks the current branch against `main`, and `/wrap-up` pushes the current branch.

**Consequences:** STATUS names the branch that holds unmerged work. A session that finds its
branch already merged restarts it from `main`.

### D-033 · 2026-10-08 · Accepted (the purchasing parts removed by D-091; the repair parts by D-094) — Operations-first reports for the Floor Manager

**Context:** the team said the Reports tab was centred on quality inspection. As a product
monitoring system it should show what is happening on the production floor in the chosen days
and what is wrong. Minor-defect detection before cutting stays. The Quality Inspector keeps a
quality report and also wants to see what is at the repair station.
**Decision:**

- **Two views on `/reports`.** The Floor Manager (`report:production`) lands on **Operations**
  and has a **Quality** tab. The Quality Inspector only has Quality, with no tab bar.
- **Operations answers, in order:** what needs attention; where the batches are and which wait
  longer than usual; is work flowing (started vs completed, typical lead time, time per stage);
  what is at the repair station and how far each section has got; which materials are out, low
  or about to run out; how purchasing is moving; how each supplier's leather scanned; and the
  checkpoint before cutting in brief.
- **Measures (standard manufacturing KPIs):** throughput (batches completed), WIP (batches in
  production), lead time and per-stage cycle time (median plus 90th percentile), bottleneck
  (highest median stage, as before), first-pass yield (pass ÷ decided), days of cover (stock ÷
  daily use over the range), request decision and receipt times, supplier pass and rework +
  reject share, and a Pareto on defect types. Each key figure shows the change against the
  previous period of the same length, in words and an arrow, never colour.
- **Attention rules** live in `src/lib/ops-rules.ts` (`ATTENTION`): a batch is late past 1.5×
  its stage's median over the last 30 days (needs 3 visits, at least 1 hour); a repair waiting
  over a day; stock under 3 days of cover; a pending request over 2 days or any urgent one; an
  approved request not received after 7 days; a supplier 10 points above the line with 30+
  sections. They are constants for now, not settings.
- **Still no people (D-008).** Every query groups by day, stage, batch, item, supplier or
  request. A unit test checks that the payloads carry no person keys. Suppliers are companies,
  not staff.
- **Repair station** is live (now), not filtered by the range; only "repaired in the last N
  days" and typical time to repair use the range.

**Consequences:**

- New: `ops-report.model.ts`, `ops-report.service.ts`, `ops-rules.ts`; the page's views live in
  `reports/_components`. `stageDurations` also returns the 90th percentile.
- Not done: batch targets (`targetQuotaPairs`) vs output, because output is counted in sections,
  not pairs; supplier lead time, because requests don't record a supplier; component tracking.
- Open: should the Floor Manager home (inspection split, daily summary) lead with operations too?

### D-034 · 2026-10-08 · Accepted — The layout adapts to narrower windows (extends D-008)

**Context:** D-008 made the app desktop-only, but people tile the window to half a screen, and
several screens broke (fixed column counts, clipped numbers, tables pushing the page sideways).
**Decision:**

- The target is still a desktop browser. Nothing is designed for touch or phones.
- **Below 1024px** the sidebar becomes an icon rail (labels move to tooltips and screen readers).
  Page padding shrinks.
- **Grids reflow by the space they have:** card groups use `repeat(auto-fit, minmax(...))`;
  layouts with a wide main column and a side column stack below 1280px (`xl:`); form pairs stack
  below 640px (`sm:`).
- **Tables scroll inside their own container.** The page never scrolls sideways. The table
  wrapper is `relative` so hidden screen-reader text can't escape the scroll area.
- Button groups wrap (`flex-wrap`).
- Checked at 960px and 640px on every page for the Floor Manager, Admin and Quality Inspector.

**Consequences:** new screens use these patterns. Not checked: the Shoe Constructor home and
long tables at 640px, which scroll inside their card.

### D-035 · 2026-10-10 · Superseded by D-091 (module removed) — "Material requests" for constructors, "Procurement" for the FM and Admin

**Context:** the team's review of Phase 9: Shoe Constructors only ask for materials; they don't
procure anything. Calling their screen "Procurement" was wrong for them.
**Decision:**

- Shoe Constructors see **Material requests** everywhere: the sidebar, page titles and browser
  titles, "New material request", empty states, and "My material requests" on their home.
- The Floor Manager and System Admin see **Procurement** / "purchase request". It becomes real
  procurement once Phase 13 adds ordering.
- The names come from one map, `requestLabelsFor(role)` in `src/lib/procurement-rules.ts`. The
  sidebar (`navigation.ts`) and every page header read it, so they can't drift.
- URLs (`/procurement`), permission keys (`procurement:*`), table names and request codes
  (`PR-…`) don't change, so there is no data migration for the rename.

**Consequences:** a new screen in this module takes its title from the map, never a literal.

### D-036 · 2026-10-10 · Superseded by D-091 (module removed) — Remarks replace "Why it's needed" (supersedes part of D-029)

**Context:** the required justification duplicated what remarks already do.
**Decision:**

- The request form has an optional **Remarks** box (up to 500 characters). If filled in, it is
  saved as the request's first `PurchaseRequestRemark`, by the requester, in the create
  transaction, and is in the audit row.
- `purchase_requests.justification` is dropped. Migration
  `20261010153000_material_requests_remarks_urgency` first copies every non-empty justification
  into a remark by the requester at the request's `createdAt`.

**Consequences:** a request can be sent with no reason at all; the needed-by date and the stock
snapshot carry the case. The copied remarks have random (v4) ids, not UUIDv7; they sort by
`createdAt`, so this has no visible effect.

### D-037 · 2026-10-10 · Superseded by D-091 (module removed) — Urgency is automatic, from the needed-by date (supersedes the manual priority in D-029; updates D-033)

**Context:** a manual Normal/Urgent pick was subjective. The team asked for three classes worked
out from the date.
**Decision:**

- **Needed by is required**: today or later in Manila time, at most 180 days ahead. Existing
  requests without one got `createdAt` (Manila date) + 7 days in the migration.
- Urgency is **computed on every read and never stored** (`urgencyFor` in
  `procurement-rules.ts`), by **working days** left, Monday to Friday (Dylan, 2026-10-10):
  **High** 0–3 working days or overdue, **Medium** 4–7, **Low** 8 or more. Holidays aren't
  skipped. The bands and working days are constants (`URGENCY_BANDS`, `WORKING_WEEKDAYS`).
- Closed requests (received, rejected, cancelled) have no urgency and show no badge.
- The Pending tab sorts by needed-by date, then oldest first. That gives High, Medium, Low order
  without storing anything; inside a band the nearer date comes first.
- The urgency filter and the High counts (FM home card, Operations report) are needed-by date
  ranges worked out from today (`urgencyCutoffs`).
- The `PurchasePriority` enum and the `priority` column are dropped. In D-033's attention rules,
  "any urgent one" is now "any High-urgency pending request" (`requests-high`).

**Consequences:** ASSUMPTION to confirm with CPoint: the 3/7 bands, Monday–Friday, and no
holidays. A request's urgency rises by itself as its date approaches. `POST
/api/v1/procurement/requests` no longer takes `priority` or `justification`.

### D-038 · 2026-10-10 · Accepted — Every form message names the field and the fix

**Context:** the team asked for inline messages that say which input is wrong and how to fix it.
An audit found most were specific, with generic leftovers ("Some fields need fixing.", "Something
went wrong.") and several fields falling back to Zod's built-in English text.
**Decision:**

- Messages are written once in the Zod schemas, shared by the forms and the API. Each one names
  its field and the fix ("Enter a quantity greater than 0.", "Needed by can't be in the past.
  Pick today or a later date."). Shared pieces live in `src/server/validators/shared.ts`.
- Values the page sends by itself (expected status, which button) answer "This page is out of
  date. Refresh it and try again."
- The form-level line is built from the field messages (`summarizeIssues`): one issue is shown
  as itself; several are counted and the first is quoted.
- Server field errors are keyed by the full path (`lines.2.quantity`), so the message lands
  under the exact input.
- Each message sits under its field with `aria-describedby`; submitting moves focus to the first
  invalid field (`shouldFocusError` or `focusFirstInvalid`); a summary on top appears only with 3
  or more errors (`FormErrorSummary`, used on the request form).
- `tests/unit/validator-messages.test.ts` feeds every schema bad input and fails on a generic or
  built-in message.

**Consequences:** a new field needs its own messages or that test fails. API clients see the same
sentences in `details[].message`. Not done: the summary component on the batch and inventory item
forms (they have it available but rarely reach 3 errors).

### D-039 · 2026-10-13 · Superseded by D-091 (module removed) — The Floor Manager decides each item of a request (supersedes the whole-request decision in D-029)

**Context:** the team's review of Phase 9: a request often mixes items that are really needed with
items still on the shelf. Deciding the whole request forced the Floor Manager to approve too much
or reject too much.
**Decision:**

- Each `PurchaseRequestLine` has its own `decision` (`PENDING | APPROVED | REJECTED`),
  `rejectionReason`, `decidedById` and `decidedAt`. A rejected item needs a reason of 3 to 300
  characters.
- The request's status is **derived** from its items (`deriveRequestStatus` in
  `procurement-rules.ts`): pending until every item is decided, **approved** when at least one
  item is, **rejected** when every item is.
- **Every item is decided in one save** (Dylan, 2026-10-13). There is no half-decided request:
  `decideRequest` refuses a save that leaves an item out, in one transaction, conditional on the
  request still being pending (409 STALE, D-019), with one timeline event that lists the items and
  one audit row.
- "Reject whole request" stays as a shortcut: one reason, copied to every item. The old
  `POST …/approve` and `POST …/reject` routes still work and mean "every item".
- **Receiving adds only approved items to stock.** A rejected item inside an approved request no
  longer counts as requested (the Inventory "Requested" badge and the Operations stock table).
- Migration `20261013030000_purchase_line_decisions`: approved and received requests get every
  line approved; rejected requests get every line rejected with the request's reason; pending and
  cancelled requests keep their lines pending.

**Consequences:** `purchase_requests.rejectionReason` is only set when every item was rejected for
the same reason; otherwise the reasons are on the items. The requester sees "1 of 2 items
approved" and each rejected item's reason. Phase 13 builds receiving on the approved lines.

### D-040 · 2026-10-13 · Superseded by D-091 (module removed) — Stock guidance on each item: "still well stocked" is more than 2× the reorder level

**Context:** the Floor Manager should see at a glance which items in a request are still on the
shelf, without the system deciding for them.
**Decision:**

- An item is **still well stocked** when its stock on hand is more than `WELL_STOCKED_FACTOR` (2)
  times its reorder level. Exactly 2× is not. The factor is **one constant** in
  `procurement-rules.ts`, not an admin setting (Dylan, 2026-10-13): CPoint hasn't confirmed the
  number, and one constant is easy to turn into a setting later.
- An item with **no reorder level** (0) gets no well-stocked call (Dylan, 2026-10-13): 2 × 0 is
  0, so any stock at all would count.
- The decision panel shows, per item, the stock now and when it was requested ("On hand 40 boxes ·
  reorder at 10 · was 38 when requested"), and pre-selects: **Reject** with the reason "Stock is
  still high (40 boxes on hand, reorder at 10)." for a well-stocked item, **Approve** for a low or
  out-of-stock one, and **nothing** for an item in between, with no reorder level, or not in
  inventory.
- **Nothing is decided automatically.** The pre-selection is a suggestion from the stock as it is
  when the page loads; the Floor Manager can change the choice and the reason, and nothing is
  saved until "Save decisions".

**Consequences:** ASSUMPTION to confirm with CPoint: the 2× factor. The guidance uses current
stock, so it can differ from the snapshot taken when the request was sent; both are shown.

### D-041 · 2026-10-13 · Superseded by D-091 (module removed) — An approved request is ordered before it is received; one order per request

**Context:** Phase 9 went from approved straight to received, so nothing said who the materials
were ordered from, when they were due, or that a delivery was overdue.
**Decision:**

- A new step and status, **ORDERED**, between APPROVED and RECEIVED. "Mark as ordered" records the
  supplier (an active one from Settings → Suppliers), an optional order or reference number, the
  expected delivery date (required, today or later, at most 365 days ahead) and an optional note.
- **One order per request** (Dylan, 2026-10-13): one supplier and one expected date. Items from
  two suppliers go in two requests. The order is stored on the request, not on its lines.
- The system only **records** the order. Nothing is sent to the supplier, and a supplier never
  has an account.
- **"Delivery late"**: a request that is ordered or partly received and whose expected date has
  passed (Manila date; due today is not late). Worked out on every read, never stored. Shown as a
  badge, a list filter and a line on the Floor Manager's home card.
- A delivery can only be recorded on an ordered request: "Mark this request as ordered first, then
  record the delivery."

**Consequences:** the Operations report's "not received after a week" becomes "past the expected
delivery date". Open (survey Q14): who places leather-roll orders at CPoint.

### D-042 · 2026-10-13 · Superseded by D-091 (module removed) — Deliveries can be partial, and each needs proof (supersedes "received as a whole" in D-029)

**Context:** suppliers deliver short, and the team asked for a proof of delivery on every receipt.
**Decision:**

- "Record delivery" replaces "Mark received". The Floor Manager enters what arrived of each
  approved item (0 allowed, never more than what is outstanding), the day it came (not in the
  future, not before the order) and a note. A delivery where nothing arrived is refused.
- Each line keeps a running `receivedQuantity`. What arrived of an inventory item is posted as
  stock IN through the ledger (D-023) in the same transaction, with the movement kept on the
  delivery line. A typed item can be recorded as arrived but is not added to stock.
- The status follows from the lines: anything outstanding → **PARTIALLY_RECEIVED**; nothing
  outstanding → RECEIVED. Arithmetic is in hundredths, as D-023.
- **Close short:** the Floor Manager closes a partly received request with a reason when the rest
  won't come. It ends as RECEIVED, marked "Closed short", and the timeline lists what never
  arrived.
- **Proof of delivery is required** (Dylan, 2026-10-13): at least one file per delivery. JPEG,
  PNG, WebP or PDF, recognised from the file's bytes and never its name; 10 MB each, 5 per upload,
  10 per delivery with corrections. Stored through `StorageService` under server-generated keys
  (`pod/yyyy/mm/<uuid>.<ext>`), as scan images are (D-020).
- Proof is served from `GET /api/v1/procurement/attachments/{id}` to the Floor Manager, the System
  Admin and the requester on their own request, with `Cache-Control: private`, `nosniff`, a
  sandboxing CSP and a cleaned file name.
- **A proof file is never deleted.** A wrong one is corrected by adding the right one and saying so
  in a remark.
- Uploads go to an API route as multipart, not through a server action, because of their size.
  Files are written first and removed again if the transaction fails.
- Requests received before this change each became one delivery with no proof file; the page says
  "Recorded before proof of delivery was added".

**Consequences:** two deliveries recorded at once can't both count: every approved line is updated
only if its received quantity is still what the caller saw (409 STALE).

### D-043 · 2026-10-13 · Superseded by D-091 (module removed) — The Floor Manager can cancel after approval, with a reason, until something arrives

**Context:** a supplier sometimes can't deliver, and an approved request had no way out.
**Decision:**

- A **pending** request is cancelled by whoever sent it, with an optional note (unchanged).
- An **approved or ordered** request is cancelled by the Floor Manager only, and a reason is
  required. It is stored on the request and shown to the requester.
- Once any part has arrived the request can't be cancelled: "Part of this request has already
  arrived, so it can't be cancelled. Use Close short for what won't come." The page shows this
  where the Cancel button would be.

**Consequences:** stock is never reversed by a cancellation, because nothing has been received
when one is allowed.

### D-044 · 2026-10-13 · Superseded by D-091 (module removed) — "Copy to a new request" instead of editing a rejected or cancelled one

**Context:** requests are never edited after they're sent (D-029), so a rejected or cancelled one
had to be typed again.
**Decision:**

- On their **own** rejected or cancelled request, the requester (a constructor, or the Floor
  Manager for one they raised) gets "Copy to a new request".
- The new-request form opens prefilled. Items that were rejected are left out, listed with their
  reasons and a checkbox to ask for them again. The needed-by date is never copied.
- An item that has since been deactivated is copied as a typed item; a leather roll the person
  may no longer request is left for them to choose again.
- The new request stores `copiedFromId`. Each request's page links to the other.

**Consequences:** copying changes nothing on the old request, so it writes no event there.

### D-045 · 2026-10-13 · Superseded by D-091 (module removed) — The Floor Manager can raise a restock request and approve it (extends D-031)

**Context:** survey Q14: the production manager orders equipment and some materials without a
constructor asking.
**Decision:**

- `procurement:request` now includes the Floor Manager. They start a request from Procurement →
  New, or from "Request" on a low or out-of-stock inventory item that has no open request.
- It enters as PENDING and goes through the same item-by-item decision. **The Floor Manager may
  approve their own request** (Dylan, 2026-10-13); the audit log records them as both requester
  and decider.
- Leather rolls need no extra OK for the Floor Manager. The per-constructor flag (D-031) is
  unchanged.
- Such a request is marked "Raised by Floor Manager" in the list and on its page. The mark comes
  from the requester's role; nothing is counted per person (D-008).

**Consequences:** the master spec's roles table gains the Floor Manager under "create requests".

### D-046 · 2026-10-14 · Request numbers superseded by D-091 (full width kept) — Request numbers read MR-…, and pages use the full width (supersedes part of D-035)

**Context:** Dylan, 2026-10-14: the constructors' records are material requests, not
procurement, so "PR-2026-0001" reads wrong; and every page sat in a 1152 px column with empty
space on both sides, which cut off the Procurement table's status column.
**Decision:**

- Request numbers are `MR-YYYY-NNNN` for **every role**. It is one record that the constructor
  and the Floor Manager both refer to, so it has one number; only the screen titles differ by
  role (D-035). The running number per year is kept (`MR-2026-0007` follows `PR-2026-0006`).
- Migration `material_request_codes` renames stored numbers, the "Delivery for …" ledger reasons
  and the "Copied from …" timeline notes; `material_request_codes_legacy` also renames the
  pre-Phase 13 "Received for PR-…" reasons (to "Delivery for MR-…") and any other system text
  with a PR- number. The audit log keeps the old numbers, because it is
  history. Uploaded file names are the user's own and are left alone.
- URLs, permission keys and table names still say procurement/purchase (D-035 unchanged there).
- The app layout no longer caps the content width: tables, dashboards and reports fill the space
  beside the sidebar. Forms keep their own widths, and a page description stops at `max-w-3xl`
  so lines stay readable. The 1280 px rule (DESIGN.md) still holds.

**Consequences:** anything that matches request numbers (tests, docs) uses `MR-`.

### D-047 · 2026-10-14 · Accepted — Every list that can grow pages at 15 rows, with one pager

**Context:** Dylan, 2026-10-14: some tables had no pagination, and the ones that did used 20, 25
or 50 rows, each with its own copy of the controls.
**Decision:**

- One page size, `PAGE_SIZE = 15` in `src/lib/pagination.ts` (Dylan chose 15 over 10: about one
  screen at 1440 × 900 on the full-width pages, D-046). Batches, Scans, Inventory, an item's stock
  ledger, Procurement, Users and the Audit log use it.
- One pager, `TablePager` (`src/components/features/table-pager.tsx`): "Showing 16–30 of 42
  batches · page 2 of 3", Previous / Next (Newer / Older on the ledger and the audit log). A list
  that fits on one page shows only its count.
- Newly paged: Salvage (was cut at 200) and the Review queue (was cut at 50; each of its two lists
  pages on its own, `page` and `autoPage`) page on the server. API tokens, the Settings lists and
  the leather-roll requesters page in the browser; the Settings lists and the requesters also get
  a **Find** box, because new rows sort by name and can land past page 1.
- Not paged, being short by nature: a request's items (at most 10), a batch's stages, a scan's
  detections, report summaries and the Rework board.

**Consequences:** a new list uses `PAGE_SIZE` and `TablePager`. E2E tests find their own rows by
search or filter, never by browsing.

### D-048 · 2026-10-19 · Accepted — The camera station is a Python process outside Docker, built as ports and adapters

**Context:** The first YOLO model (`yolo-v1.pt`, Ultralytics, segment task) is ready. D-003 keeps
compose at two services, and the master spec requires plugging in a model with zero app changes.
**Decision:**

- Inference runs in a **camera station**, the `cpoint_cv` package in `cv/`, on the camera machine
  (for the demo, Dylan's laptop, Python 3.13, GPU through `device = "cuda:0"` in its config). It
  isn't a compose service and isn't in the app image. It talks to the app only through the
  existing contract (D-020) with a device token, as the simulator does.
- The station **reports, the app decides** (D-011). It never sends or applies a verdict. `predict`
  shows a _preview_ through a Python port of `decide()`, labelled as such, whose tests mirror the
  TypeScript ones.
- Small ports: `Detector` (`YoloDetector`, the only module importing ultralytics/torch, and
  `FakeDetector`); `FrameSource` and `ScanClient` follow in Phase 15. Unit tests, lint and types run
  without torch, locally and in CI (`station` job).
- Class keys come from the model's own `names`, with an optional rename map in config. A class
  index the model doesn't name is sent as `class_<n>`, so the app flags it instead of losing it.
- Boxes only, from Ultralytics' box per mask. Mask polygons are used for overlays only; storing them
  is not worth it yet (mask mAP50-95 0.32, and it would need a schema change).
- A **confidence floor** (0.25, config) drops noise before sending; it is not a PASS threshold.
- Everything that can change with a new model (path, name, `imgsz`, device, floor, renames, the
  preview's thresholds and defect types) is configuration, never a constant in code.

**Consequences:** a new model is a file swap plus config and Settings changes. The shared fixture
`tests/fixtures/cv-payload.json` breaks a test on either side if the station's output or the
contract changes.

### D-049 · 2026-10-19 · Accepted — Model files live in `cv/models/`, out of git and Docker; a checksum names them

**Context:** `yolo-v1.pt` is 23.6 MB and would have entered the Docker build context. Dylan chose a
git-ignored folder over Git LFS.
**Decision:** Model files go in `cv/models/` (only `.gitkeep` is committed). `.gitignore` ignores
`*.pt`, `*.onnx`, `cv/models/*`, `cv/config.toml` and `cv/out/`; `.dockerignore` excludes `cv`,
`*.pt` and `*.onnx`. The SHA-256 is recorded in `cv/MODEL_CARD.md` and `[model] sha256`; `predict`
warns on a mismatch. Each scan's `modelVersion` is the config name plus the first 8 hex digits of
the SHA-256 (`yolo-v1-1d729fb0`), at most 60 characters.
**Consequences:** the model file is shared outside git (the team's drive), and anyone can check
they have the right one. Every scan says exactly which weights judged it.

### D-050 · 2026-10-19 · Accepted — The station captures one section per trigger, pins the batch it showed, and saves every capture before sending

**Context:** Phase 15 turns the inference core (D-048) into a station that behaves like the finished
camera: it must know the target batch, capture one section at a time and survive network and
server failures without losing or doubling a scan.
**Decision:**

- `python -m cpoint_cv run webcam | folder <dir> | file <image>`. The webcam captures **one frame
  per Space press** (Dylan, 2026-10-19), never a stream; Q stops. An interval mode for the webcam is
  not built. Folder replay sends every image in name order every `--interval` seconds; it uses the
  same configured `source` as the webcam (`WEBCAM` by default, Dylan: "default"), so no new
  `ScanSource` value or migration.
- Before each capture the station calls `GET /api/v1/batches/current`, prints the batch, and sends
  that `batchId` with the scan (the existing optional field). A section therefore lands in the
  roll it was cut from even if it's sent later; if that batch has left Preparation by then, the
  app's 409 moves the capture to `failed/`. With no batch at Preparation it waits and captures
  nothing. The batch is asked again right after the trigger, and a change is announced.
- Every capture is written to `cv/out/spool/` **before** the model runs and is removed only once
  the app has answered. The spool is sent oldest first at start-up and before each capture, and
  stops at the first capture that must wait, so order is kept.
- Answers: 401/403 stop the station with the fix; 413, 422 and a 409 for the pinned batch move the
  capture to `cv/out/failed/` with the app's message; network errors and 5xx are retried with
  bounded exponential backoff and jitter (4 tries, 1 s doubling to 15 s), then wait in the spool.
- HTTP uses the standard library only (no new dependency). Logs are JSON lines per event; the token
  is read from `CV_DEVICE_TOKEN` (environment or git-ignored `cv/.env`) and never printed or logged.
- `python -m cpoint_cv doctor` checks the model and checksum, Python and pinned package versions,
  the camera, `/api/health`, the token and the clock against the server's `Date` header.
- No overlap filter for duplicate boxes yet; Phase 14's observation stays open.

**Consequences:** the demo can run on a folder of real photos with no camera, and a dropped network
only delays scans. A capture whose batch closed before it could be sent needs a person to look at
`failed/`.

### D-051 · 2026-10-19 · Accepted — An optional `captureId` makes a camera's retry return the first scan

**Context:** `POST /api/v1/scans` had no idempotency key. A retry after a timeout whose request
actually arrived made a second scan, a second repair ticket or salvage item, and a wrong count.
**Decision (Dylan, 2026-10-19):** an additive, optional `captureId` (a UUID the camera makes per
capture) on the ingest form, stored as `Scan.captureId` (nullable, unique; migration
`scan_capture_id`). When the same device sends a known `captureId`, the app answers `200` with the
first scan's result and `duplicate: true`, writes nothing (no image, no outcome, no audit) and
doesn't check the batch again. Another device's `captureId` gets `409`. Two copies racing on the
unique index answer as the first. A new scan's `201` body now carries `duplicate: false`. The
simulator doesn't send it and is unaffected; old scans keep `null`.
**Consequences:** the station retries network errors and 5xx safely. Any future camera client
should send a `captureId`.

### D-052 · 2026-10-19 · Accepted — Defect types follow the model's classes: add `crease` and `scratch` in Settings, turn off `abrasion` and `dirt`

**Context:** yolo-v1 reports `crease`, `cut`, `hole` and `scratch`; the bootstrap created `cut`,
`hole`, `abrasion` and `dirt` (D-011 keeps defect types as data).
**Decision (Dylan, 2026-10-19):** keep the model's own class names. The System Admin adds `crease`
and `scratch` under Admin → Settings → Defect types and turns off `abrasion` and `dirt`, the
classes the model doesn't have (steps in `cv/README.md`). The bootstrap's reference data is not
changed, so a new database starts with the old four until the steps are done. The simulator's
"unknown class" becomes `sim-unknown`, a key no model emits, since `scratch` is now real; the demo
week's flagged scans use it too. The simulator and demo week still draw `cut`, `hole`, `abrasion`
and `dirt`; with the last two off, those detections no longer decide a verdict.
**Consequences:** with the steps done, yolo-v1's detections are judged by D-011 instead of all
going to review. Doing the steps is a per-database task for the demo and for CPoint.

### D-053 · 2026-10-19 · Found-at kept; Rework and "worst outcome" superseded by D-093 — A defect type can say what a found defect means ("When found"), and the worst outcome decides

**Context:** D-011 reads a detection's confidence as how bad a defect is. For a YOLO model it is how
sure the model is that a defect is there. In the five-photo baseline a long, clear cut scored 0.51
and would have passed on its own.
**Decision (Dylan, 2026-10-19, the recommended option):** each defect type gets an optional
**When found** action (Rework or Reject, `DefectType.action`), and Settings → Thresholds gets
**A defect counts as found at** (`CvSettings.foundAtOrAbove`, default 50%). A detection of a type
with an action gives that action from that confidence up, and Pass below it, however sure the
model is above it. A type without an action keeps D-011's two thresholds. Each detection gives an
outcome and the worst one decides the section; an unknown class still sends it to review (D-028).
Migration `defect_actions`; the scan's `thresholdsSnapshot` now also keeps `foundAtOrAbove` and the
`actions` in force, so old and new scans stay explainable. The Python preview follows the same rule.
`PUT /api/v1/settings/cv` takes an optional `foundPercent`; defect types take an optional `action`.
**Consequences:** supersedes D-011's "one rule for every defect type" for types that have an
action. With no actions set, nothing changes. `npm run demo:reset` sets cut and hole to Reject,
crease and scratch to Rework. Which action each defect type gets is still to confirm with CPoint.

### D-054 · 2026-10-19 · Accepted — The camera station checks in while it waits, through the existing batch call

**Context:** the Camera page said "Not connected" a minute after the last scan, even with the
station running and waiting for the operator.
**Decision (Dylan, 2026-10-19):** no new endpoint. While waiting for Space, the station calls
`GET /api/v1/batches/current` every 20 s (`[station] check_in_seconds`), which records the token's
use (at most once a minute). The Camera page shows **Station connected** when a camera token that
isn't the simulator's was used in the last two minutes and no scan came in the last minute. The
check-in also tells the operator straight away when the batch changes or leaves Preparation.
**Consequences:** "Station connected" can last up to two minutes after the station stops. The
contract is unchanged.

### D-055 · 2026-10-19 · Accepted — The early-model notice is a setting

**Decision (Dylan, 2026-10-19):** Settings → Thresholds has **Show “Early model” on the Camera
page** (`CvSettings.earlyModelNotice`, on by default). The notice names the model from the last
scan's `modelVersion` (the checksum suffix dropped), so no model name is in the code. It isn't
shown for simulated scans.

### D-056 · 2026-10-19 · Accepted — `npm run demo:reset` gives a clean demo system and keeps the accounts

**Context:** months of e2e runs left 135 test accounts, 131 device tokens, hundreds of batches and
requests, and test rows in Settings on the dev database.
**Decision (Dylan, 2026-10-19):** a rerunnable script through the service and model layers, in
one transaction. It keeps the bootstrap System Admin and the four demo accounts, the device token
in `CV_DEVICE_TOKEN` (`.env` or `cv/.env`, matched by hash), the bootstrap shoe types and
supplier, and the defect types; it removes every other account and token, batches, scans, repairs,
salvage, stock items and movements, purchase requests with their files, the audit log (then
writes one `system.demo_reset` row), and the scan and proof files under `UPLOADS_DIR`. It sets the
yolo-v1 defect types (D-052, D-053), makes the demo constructor a leather-roll requester again, and
seeds a fresh demo week, which brings the demo inventory back at its opening stock. Without
`--yes` it only shows the counts; it refuses `NODE_ENV=production`.
**Consequences:** the e2e tests post their own `e2e-rule-*` defect types (active, no action) so
they no longer depend on how Settings are set up; the reset removes those too.

### D-057 · 2026-10-19 · Accepted — The station drops duplicate boxes and can use an IP camera

**Decision (Dylan, 2026-10-19):** the mapper keeps only the more confident of two same-class boxes
that overlap by IoU ≥ 0.7 (`[mapper] overlap_iou`, 0 turns it off), so one scratch is no longer
counted twice. `[camera] url` (or `CPOINT_CV_CAMERA_URL` in `cv/.env` when it holds a password)
opens an `rtsp://` or `http(s)://` camera instead of `[camera] index`; logs show it without the
user name and password. No ONNX export: 255 ms per capture on the GPU and 780 ms on the CPU is fine
for one capture per key press.

### D-058 · 2026-10-19 · Accepted — `evaluate` compares preview verdicts with a `labels.csv`, as a small check

**Decision (Dylan, 2026-10-19):** expected results live in `labels.csv` beside the photos
(`file,expected_verdict,classes`). `python -m cpoint_cv evaluate <folder>` writes
`cv/reports/<date>-<model>.md`: per photo, a verdict table, per-class precision and recall by
photo, and how verdicts shift with the found-at value and the thresholds. Up to 30 photos the
report opens with "Small check"; the five sample photos show the integration, not the model's
accuracy. It changes nothing in the app.

### D-059 · 2026-10-19 · Accepted — The camera station gets a Tkinter window that drives the existing station loop

**Decision (Dylan, 2026-10-19):** factory staff run the station from a desktop window
(`python -m cpoint_cv window`), not a terminal and not the website's Camera page (that stays a
possible later phase). Tkinter, from the standard library; camera frames reach it through Pillow,
which ultralytics already installs, now pinned (`pillow==12.3.0`, MIT-CMU licence). No other new
dependency. The window runs the same `Station` loop as `run webcam` on a worker thread, with the
Capture and Stop buttons as its trigger (`ButtonTrigger`), so there is one send path (spool,
retries, `captureId`). `Station` gained an optional `events` callback (what it prints, as data) and
a `should_stop` check; `run webcam` passes neither. The window's state and words live in a
presenter with no Tk import, unit-tested; only `view.py` and `app.py` import Tk, so CI needs no
display. Camera, model and HTTP never run on the UI thread.

### D-060 · 2026-10-19 · Accepted — The live preview is only a preview; Capture sends the frame on screen at full size

**Decision (Dylan, 2026-10-19):** the window runs the model on the live feed at
`[window] preview_imgsz` (960) at most `preview_max_fps` (4) times a second, skipping frames rather
than queueing them. Its boxes use class colours, never the verdict colours, under a fixed banner
("Preview. Nothing is sent until you press Capture. The app decides the result."), and it never
shows a verdict. Capture sends the frame that was on screen at the press, with the press as
`capturedAt`, and that capture runs at `[model] imgsz` (1536). One loaded model serves both behind
a lock, so the GPU holds one model and runs one prediction at a time. Measured on the RTX 3060: about
35 ms at 960 and 55 ms at 1536 for a frame in memory. Only the Last scan panel shows a verdict, and
it is the app's (D-011).

### D-061 · 2026-10-19 · Accepted — "Check this machine": failures block Start, warnings don't

**Decision (Dylan, 2026-10-19):** the window runs `doctor`'s checks plus a new GPU check (torch sees
CUDA, the GPU's name, the CUDA build) against the camera chosen in the window. A check now passes,
warns or fails. Failures block Start: the config, the model file and checksum, Python, a missing
package, the camera, the app, the device token, and a clock more than 5 minutes ahead of the app
(the app refuses those scans). Warnings never block: no GPU (the window runs the model on the CPU
instead), a package version other than the pin, no batch at Preparation yet, a clock 2 to 5
minutes off. `doctor` prints warnings as `warn` and they don't change its exit code; for `run`
and `predict`, a configured GPU that isn't there stays a failure. Choosing another camera means
checking again.

### D-062 · 2026-10-19 · Accepted — The window saves its camera choice in a git-ignored file; DirectShow is a setting

**Decision (Dylan, 2026-10-19):** the window remembers the camera (a number, or an address) and the
driver in `cv/station-window.json`, git-ignored; it never edits `config.toml`. An address holding a
user name or password is used for that run but never saved: the window says to put it in `cv/.env`
as `CPOINT_CV_CAMERA_URL`, and shows and logs it without the password (D-057). `[camera] backend`
(`default` or `dshow`) opens numbered cameras through DirectShow for virtual cameras such as
DroidCam and OBS, and `run webcam` and `doctor` use it too. The camera list shows numbers that give
a picture, with their size; OpenCV can't read device names without another dependency.

### D-063 · 2026-10-19 · Accepted — `CPoint Camera.cmd` launches the window; `shortcut` puts it on the desktop

**Decision (Dylan, 2026-10-19):** `cv/CPoint Camera.cmd` checks `cv/.venv` and the packages, then
starts the window with `pythonw` (no console). When the venv or a package is missing, it shows a
Windows message box naming the setup step. `python -m cpoint_cv shortcut` makes a "CPoint Camera"
desktop shortcut to it, minimized, through Windows' own shortcut maker (PowerShell), with no new
dependency. `.gitattributes` keeps `*.cmd` at CRLF. A failure inside the window at start is written
to `cv/out/logs/window-error.log` and shown in a message box. The Camera page's "Connect the camera
station" steps now point at the shortcut and the window.

### D-064 · 2026-10-19 · Accepted — The app runs the camera model itself, as ONNX, for the Capture page (amends D-048, D-049)

**Context:** Dylan asked for capture from the QI's dashboard with no second application (Phase 18,
`camera-capture-page.md`). The model ran only in Python on the camera PC (D-048), and a Python
service in Docker would be a third container (D-003).
**Decision (Dylan, 2026-10-19, the plan's recommendation):**

- **Server inference** inside the `app` container with `onnxruntime-node` 1.30.0 on the CPU. The
  browser sends only the photo, so no one signed in can post a made-up detection list, and the
  same code serves every PC and phone. Browser inference (`onnxruntime-web`) was rejected: a
  42 MB download per browser and detections the app would have to trust.
- `python -m cpoint_cv export-onnx` writes `yolo-v1.onnx` (dynamic input, FP32, opset 19) and
  `yolo-v1.json` (names, `imgsz`, stride, ONNX SHA-256, the mapper's floor, overlap and renames,
  and the `.pt` weights' `modelVersion`, so station and website scans read as one model). Both stay
  in `cv/models/`, out of git and the image (D-049 holds); Docker mounts the folder read-only at
  `/app/models`; `CV_MODEL_PATH` names the file. A missing model is `503 MODEL_UNAVAILABLE` and a
  plain message on the page.
- The TypeScript path copies the station exactly: "rect" letterbox (pad only to the stride, 32),
  OpenCV's bilinear resize done in code, the end-to-end head's `output0` (boxes only; masks
  ignored), and `mapper.ts`, a line-for-line port of `mapper.py`. A square-padded export and
  sharp's resize both made 16:9 frames differ from the station, so they were dropped. A shared
  fixture (`tests/fixtures/cv-mapper-parity.json`) holds the mappers equal in CI, and
  `npm run cv:parity` compares the real model with `predict --json` (7 of 7 photos agree).
- The runtime image moves from `node:24-alpine` to `node:24-bookworm-slim`, because ONNX Runtime
  ships glibc builds only (+162 MB: 692 → 854 MB). `ONNXRUNTIME_NODE_INSTALL=skip` stops its CUDA
  download in Docker and CI; `next.config.ts` traces only the Linux x64 runtime into the bundle.
- One capture runs at a time on the server. About 0.65 s for a 1920 × 1080 frame and 1.2 s for a
  1536 square photo on Dylan's laptop CPU, the same in Docker.

**Consequences:** the station and the Capture page give the same detections for the same photo.
A new model needs `export-onnx` and an app restart as well as the station's config.

### D-065 · 2026-10-19 · Superseded by D-076 — HTTPS on the LAN: an mkcert certificate served by a small listener inside the `app` container

**Context:** browsers open the camera only on `localhost` or a trusted HTTPS address, and the
iPhone's Safari must use the page.
**Decision (Dylan, 2026-10-19):** `docker/https.mjs` (Node's own `https`, no dependency) listens on
3443 and passes every request to the app on 127.0.0.1:3000 with `X-Forwarded-Proto/Host/Port/For`.
The entrypoint starts it only when `certs/cert.pem` and `certs/key.pem` are mounted; `certs/` is
git-ignored and not in the build context. The certificate comes from mkcert for the server's LAN
IP; each phone or PC trusts mkcert's root once (README, "Capture from the website"). Still two
containers (D-003); Caddy or nginx would be a third. `npm run dev:https` uses
`next dev --experimental-https` with the same files, and `DEV_ORIGINS` allows the phone's address.
The page itself names the HTTPS address when it is opened without one.

### D-066 · 2026-10-19 · Accepted — The QI and the FM may capture from the website; the scan names no person

**Decision (Dylan, 2026-10-19):** a new permission `camera:capture` for the Quality Inspector and
the Floor Manager (the same roles as `camera:manage`): capturing judges nothing, and the FM can
cover Preparation; flagged scans still wait for the QI (D-028). The System Admin and constructors
can't. `ingestScan` takes an origin: a device token, or the website. A website scan has no
`deviceTokenId` and no person column (D-008); its audit row `scan.create` has the user as the
actor and `origin: "website"`. A repeated `captureId` returns the first scan when both came from
the website; a station's id sent from the website is the existing 409. `source` is `PHONE` on a
phone or tablet, otherwise `WEBCAM`. No migration.

### D-067 · 2026-10-19 · Accepted — The Capture page: live video without boxes, the station's batch rule, its own nav item

**Decision (Dylan, 2026-10-19):**

- `/camera/capture`, a **Capture** item under Quality right after Camera; the Camera page and the
  QI home link to it. The sidebar marks only the longest matching item.
- The page shows the plain live camera (up to 1920 × 1080; a phone's back camera by default; a
  camera picker remembered per browser). No live boxes: running the model continuously would be
  slow on the server or a download in the browser, and a preview can't be mistaken for a verdict
  (D-060 holds by design). After Capture, **Last scan** shows the app's verdict, section, defects
  and the frame with its boxes, and links to the scan.
- One press, one scan: the frame on screen at the press, a `captureId` made in the browser,
  `capturedAt` the press time. A dropped connection or a server error is retried 3 times with the
  same `captureId`, then **Send again** keeps it (D-051). Space captures unless a control has focus.
- The batch: the page shows where the next scan goes and refreshes it every 20 s and when the tab
  returns. Capture sends the batch shown, like the station (D-050); if it has left Preparation the
  app refuses before running the model (`409 BATCH_MOVED`) and the page shows the new batch. This
  replaces the brief's "send to the current batch" on purpose. No batch keeps Capture off.
- Every camera state has its own message and fix: not a secure address, permission refused (iPhone
  and desktop steps), no camera, camera busy, model missing.

### D-068 · 2026-10-20 · Accepted — Keep the working copy out of cloud sync; briefs and plans live in `docs/prompts/`

**Decision (Dylan, 2026-10-20, Phase 19):**

- A working copy lives in a folder no cloud service syncs (`C:\dev\CPoint-PMS`), not OneDrive.
  About 99% of a working copy is git-ignored tools and caches (`cv/.venv` 5.2 GB, `.next` up to
  2.2 GB, `node_modules` 1.1 GB, about 87,000 files); syncing them only slows installs and builds.
  OneDrive can't reliably exclude a folder by name, so moving is the fix. The README's "Keeping
  the folder small" says how, and `npm run clean` removes `.next` and `tsconfig.tsbuildinfo`.
- The camera PC keeps the CUDA build of torch (D-048 stands); a PC without a GPU may use the CPU
  build. Only the camera PC needs `cv/.venv` at all (D-064).
- Phase briefs go in `docs/prompts/`, approved plans in `docs/prompts/plans/`, never in the repo
  root. Older history (SESSION_LOG, DECISIONS, dated QA files) keeps the old root paths as written.
- The Docker image drops sharp's musl (Alpine) build after `next build`: the image is Debian
  (D-064) and Next's server trace brought both. 854 → 826 MB. The migrator's Prisma CLI (about
  250 MB, with Studio and `prisma dev`) is left whole: trimming it would break on a Prisma upgrade.

### D-069 · 2026-10-20 · Accepted — The camera station app is retired; capture happens on the website (supersedes D-059 to D-063, amends D-048, D-050, D-054)

**Decision (Dylan, 2026-10-20, Phase 20):**

- The Capture page (D-064 to D-067) does what the station did, with no other app, so the
  **CPoint Camera** window, its `.cmd` launcher and `shortcut` (D-059 to D-063) are removed, and so
  is the station runtime that only it and `run` used: `run`, `doctor`, the spool and the
  transport. `cv/` stays as the **model toolkit**: `predict`, `evaluate` and `export-onnx` (the
  website's model comes from it), plus `npm run cv:parity`.
- The device-token scan API (`POST /api/v1/scans`), API tokens and `captureId` retries stay: the
  simulator and the demo use them. `DEDICATED_CAMERA` stays in the enum so old scans still show.
- The Camera page drops the station check-in (D-054): its states are **Capture page active**
  (or "Scans arriving" when a device token sends), **Simulator active** and **No recent captures**.
- Capture page: **no "check before starting" button**. The window needed one for Python packages,
  the GPU, the token and the PC clock; none of those exist on the website, and the page already
  checks the camera, the model and the batch with a specific message for each.

### D-070 · 2026-10-20 · Superseded by D-093, D-094 — "Rework" reads **Fixable**; the board is **Cut around or clean**; each defect type says how

**Decision (Dylan, 2026-10-20, Phase 20):**

- The camera checks raw leather sections before cutting, so nothing is reworked. Users now read
  the verdict as **Fixable** (badges, filters, charts, Settings, reports and CSV headers), and the
  board at `/rework` is **Cut around or clean** with **To handle**, **Being handled** and **Done,
  usable**. "Repair station", "In repair" and "Repairs done" became "Cut around or clean", "Being
  handled" and "Cleaned or cut around".
- Internal names stay (`REWORK`, `ReworkTicket`, `rework:manage`, `/rework`, audit actions
  `rework.*`, the `rework` field in report JSON): renaming them would touch the database, the API
  and every test for no user-visible gain.
- New data on each defect type: `handling`, **Clean before cutting** or **Cut around the marked
  area** (the default), set under Settings → Defect types → "When Fixable". Migration
  `defect_handling` sets `dirt` to Clean. A section is cleaned only when every defect found on it
  is cleaned; anything else, or a class the app doesn't know, is cut around. Done cards read
  "Cleaned, usable" or "Cut around, usable".

### D-071 · 2026-10-20 · Accepted — Component tracking is out of scope

**Decision (Dylan, 2026-10-20, Phase 20):** per-component tracking in Upper Making is no longer
part of the system. The `/components` "coming soon" page, the Settings → Components tab,
`/api/v1/component-types` and the `component_types` table are removed (migration
`drop_component_types`; the table only held optional names and nothing pointed to it). The open
question about components per shoe type is closed.

### D-072 · 2026-10-20 · Accepted (High on the reject share since D-093) — Supplier quality on the Operations report, with a printable claim sheet per roll

**Decision (Dylan, 2026-10-20, Phase 20):**

- Reports → Operations has **Supplier quality**: per supplier, the rolls (distinct roll codes; one
  batch is cut from one roll), sections, Fixable %, Reject % and the top defect (each Fixable or
  rejected section's strongest detection), worst first. **High** marks a supplier by the same rule
  as the attention item (`supplierIsHigh`: at least 30 sections and 10 points above the line).
- **Rolls with the most rejects** lists the five worst rolls in the range with "Rejected N of M"
  and the main defects. Each has a **Claim sheet**: `/reports/claims/[batchId]`, a page with the
  roll, supplier, counts and every rejected section with its photo and defects, and **Save as
  PDF** through the browser's print dialog (no PDF library). The navigation is left out of print.
- Floor Manager only (`report:production`), like the rest of Operations. Grouped by supplier and
  roll, never by person (D-008): the claim sheet names no one who captured or decided a section.
- `suppliers.csv` gains rolls, Fixable %, Reject %, top defect and High; new `supplier-rolls.csv`.
- The demo week adds two demo suppliers (Marikina Leather, Bulacan Hides) and rotates rolls between
  the three; Marikina's leather shows more defects. `demo:reset` keeps them.

### D-073 · 2026-10-20 · Superseded by D-094 — The Fixable board is named Repair Station

**Decision (Dylan, 2026-10-20, Phase 21):** CPoint's factory already calls the station the
**Repair Station**, so the nav, the page and every place that names the board use that name
(replacing "Cut around or clean" from D-070). The page explains what happens there with no
"nothing is repaired" line, which Dylan found confusing: "Clean the section or cut around the
defect." The cards keep **Clean before cutting** / **Cut around the marked area**, the columns
keep To handle / Being handled / Done, usable, and the verdict stays **Fixable**. `/rework` and
the internal names stay (D-070).

### D-074 · 2026-10-20 · Accepted (two results, not four, since D-093) — Floor view: a full-screen verdict for the operator at the fixed camera

**Decision (Dylan, 2026-10-20, Phase 21):** the station operator has no desk screen, only a
monitor facing them. **Floor view** is a full-screen mode of the Capture page: the same live
preview (no live boxes, D-066), "Next scan goes to …" in large text, and after each capture a
thick coloured frame plus a band with the verdict word, icon, section number and where the piece
goes: Pass (green, on to cutting), Fixable (orange, the Repair Station), Reject (red, salvage),
Needs review (blue, set aside for the QI). The verdict stays **until the next capture**; no
sounds (Dylan). Esc leaves; it's remembered per browser. Space on the station's keyboard captures (Dylan chose no foot pedal, 2026-10-20).
Monitor first rather than an LED tower light (no extra hardware or driver); the bins are taped
by colour and word (`docs/STATION_SETUP.md`).

### D-075 · 2026-10-20 · Accepted — Allowed Shoe Constructors may capture

**Decision (Dylan, 2026-10-20, Phase 21):** the person feeding the camera is a Shoe Constructor.
Sharing a QI login would record every scan under that QI, so each constructor has a **"Can
capture at the camera"** switch (`User.canCapture`, migration `user_can_capture`), set by the
**Floor Manager** (Camera → Camera operators) or the **System Admin** (Users → More actions), like
the leather-roll switch (D-031). `canCaptureFor` (QI and FM always; a constructor only when
allowed; never the Admin) guards the Capture page, the capture API, `batches/current` and the
nav. An allowed constructor gets Capture and its Floor view and sees the verdict and section, not
Scans or Reports. Audited as `camera.capture_access.grant/revoke`; their scans' audit rows name
them (`origin: "website"`).

### D-076 · 2026-10-20 · Accepted — HTTPS through a Cloudflare Tunnel; mkcert removed

**Decision (Dylan, 2026-10-20, Phase 21):** supersedes D-065. Other devices reach the site
through a **Cloudflare Tunnel** (free): a quick tunnel for staging, a named tunnel with a domain
for the real setup. It gives a trusted `https://` address, so the camera works on any device with
no certificate to install. `cloudflared` runs on the server PC, not as a container (still two,
D-003). Removed: `docker/https.mjs`, the entrypoint's HTTPS branch, `HTTPS_PORT` and port 3443,
the `certs` mount, `npm run dev:https` and the README's mkcert and iPhone certificate steps. The
"secure address" message points to the tunnel or localhost. `/certs/` stays git-ignored so an old
key is never committed. Vercel and Cloudflare Pages don't fit as hosts (native ONNX Runtime,
files on disk); a cloud VM running the same compose stays an option for a public demo.

### D-077 · 2026-10-21 · Accepted — Attendance is a one-day log book within D-008

**Decision (Dylan, 2026-10-21, Phase 22; brief `docs/prompts/production-progression.md`):**
Production → **Attendance** (`/attendance`) records who came in each day: one row per saved day
(`AttendanceDay`, the Manila date, unique) and one present-or-absent mark per person on that day's
roster (`AttendanceMark`), migration `attendance`. Present or absent only: no half days, late
arrivals, hours or absence reasons (Dylan: 3A). The page shows **one day at a time**; nothing in
the app shows a person's history, absence count, percentage or streak, and no API returns one. A
mark's user link cascades on a hard delete (only tests and `demo:reset` delete users; the app
deactivates, D-024). Audited as `attendance.take` / `attendance.update` with the counts before and
after and who changed.

### D-078 · 2026-10-21 · Accepted — The roster is every active user on that day

**Decision (Dylan, 2026-10-21, Phase 22: 1A):** a day's roster is every active user created by the
end of that Manila day, plus anyone already marked on it, so a later deactivation never rewrites a
past day. Each person shows their role as the "what they do" badge; Shoe Constructors are listed
first. Factory workers without an account are out of scope: the Admin creates accounts for
constructors who never sign in. **Open question for CPoint:** do all constructors have accounts?

### D-079 · 2026-10-21 · Accepted — The Floor Manager takes attendance for today and 7 days back

**Decision (Dylan, 2026-10-21, Phase 22: 2A):** `attendance:manage` → Floor Manager;
`attendance:read` → Floor Manager and System Admin (read-only). The QI and constructors don't see
the page. Today and the 7 days before can be saved; earlier days are locked and the future is
refused, each with one sentence why. A day starts "Not taken"; **Mark everyone present** then untick
the absent, and **Save attendance (N changes)** saves the whole roster (anyone not sent is saved
absent). A save sends the `updatedAt` it loaded; a mismatch is `409 STALE` ("Someone else saved
this day's attendance. Refresh to see it."). Leaving with unsaved ticks asks first.

### D-080 · 2026-10-21 · Accepted — `workforceFor` is the only worker count

**Decision (Phase 22):** `workforceFor` (`src/lib/attendance-rules.ts`) gives `{ taken,
constructorsPresent, constructorsOnRoster, othersPresent }`. Only Shoe Constructors count as
workers; other roles are ticked but counted apart. A day never saved is "Not taken", never 0.
Phase 23's check-ins read it; any figure divided by people is a line average for a day and never
carries a name (D-008).

### D-081 · 2026-10-21 · Accepted — Twelve demo Shoe Constructors and a week of attendance

**Decision (Phase 22, brief assumption 13):** with `SEED_DEMO_USERS=true`, the bootstrap also
creates 12 demo Shoe Constructors (`DEMO_CONSTRUCTORS`, e.g. `ana.cruz@cpoint.local`) with random
passwords nobody sees, dated 30 days back so they are on every demo-week day. The demo week takes
attendance for its working days before today through the real service (absences 1, 5, 0, 3, 2 on
the five days before a Saturday); today is left "Not taken". `demo:reset` keeps the demo
constructors and removes all attendance with the rest of the test data.

### D-082 · 2026-10-21 · Accepted — A batch is one leather roll: Start roll, then Finish roll

**Decision (Dylan, 2026-10-21, Phase 23: 1A; supersedes D-019's lifecycle):** a batch no longer
travels through Upper Making, Sole-ing and Finishing. **Planned** → **Start roll** (Preparation,
where the camera scans its sections) → **Finish roll** → **Finished**; Cancel stays (reason
required). `POST /api/v1/batches/{id}/stages` takes `start` (`batch:manage`, the Floor Manager)
and `finish` (new `batch:finish`, the Floor Manager and the QI) only; the old moves get a 422 that
says so. Finishing closes the open `BatchStageLog` row, is a conditional update (`409 STALE`,
D-019's concurrency rule stays) and is allowed with sections at the Repair Station (D-022). It is
never automatic: when the scans reach the expected 10 pieces (`EXPECTED_PIECES_PER_ROLL`, an
ASSUMPTION Phase 24 moves onto the roll item) the batch and Capture pages say "All 10 pieces
scanned. Finish this roll?". Statuses read Planned, At Preparation, Finished, Cancelled. No data
migration: old batches keep their stage history (the batch page's **History**); one still past
Preparation reads "Started before rolls were tracked" and can be finished. `Stage`,
`currentStage` and `targetQuotaPairs` stay in the schema; the target quota left the form. The
camera's rule (the oldest roll at Preparation, D-020) is unchanged; `409 BATCH_MOVED` now says
"This roll was finished".

### D-083 · 2026-10-21 · Accepted — The check-in schedule: every 4 hours by default, changes from tomorrow

**Decision (Dylan, 2026-10-21, Phase 23: 2B):** `ProductionSchedule` (shift start and end in
Manila, an interval of 1 to 4 hours, the working days). Check-ins fall at each interval from the
start plus one at the shift end when it is off the grid: the bootstrap default 08:00 to 17:00
every 4 hours, Monday to Saturday, gives **12:00, 16:00 and 17:00** (the survey's morning, lunch
and afternoon walks). A change applies **from tomorrow**, so a day's check-ins never shift; every
version is kept (`effectiveFrom`). The default has no author and `demo:reset` keeps it.

### D-084 · 2026-10-21 · Accepted — The Quality Inspector enters each check-in; Late after 30 minutes

**Decision (Dylan, 2026-10-21, Phase 23: 3B, overriding the brief's "the FM too"):**
`production:checkin` → **Quality Inspector only**; the Floor Manager and the Admin read. A
check-in counts the **pairs that left Finishing since the previous one**, per active shoe type
(whole numbers, at most 2,000 each), with optional notes. It opens at its time and stays open to the
end of the Manila day; more than 30 minutes past its time it reads **Late** (ASSUMPTION constant);
a day over with nothing entered reads **Missed**. A slot takes one entry (`@@unique([day, slotAt])`,
a second is `409 STALE` naming who entered it and when). The QI may **correct** a check-in the same
day with a reason (at least 5 characters); the audit keeps both counts. The constructors present are
read from attendance when it is saved and kept on the row, so a later attendance edit shows as
"Attendance changed after this check-in". Attendance not taken never blocks a check-in. No
notifications: the due check-in shows on the QI home. A day without a QI on shift stays Missed;
tell CPoint.

### D-085 · 2026-10-21 · Accepted — The daily quota is per shoe type for the whole line, with a suggestion

**Decision (Dylan, 2026-10-21, Phase 23: 4A, 5A):** `DailyQuota` per shoe type, in pairs, set by
the Floor Manager (`production:plan`) under Production → **Schedule and quota**. A change applies
from tomorrow; a shoe type's **first** quota applies from today, so a new system isn't a day
without one. The page **suggests** a quota from the last **10 full working days** (every check-in
entered; at least 3 needed): average pairs per check-in × check-ins a day, and beside it the line
average per Shoe Constructor present × the constructors on today's roster. **Use suggestion** fills
the field; the FM can type any other number; the suggestion is stored with the quota. No quota per
person.

### D-086 · 2026-10-21 · Accepted — A short day gets one sentence from the day's numbers, never a name

**Decision (Phase 23, within D-008):** a finished day below quota gets one sentence:
"Below quota by 18 pairs. 5 of 16 Shoe Constructors were absent." / "... with everyone present." /
"... Attendance wasn't taken that day." Production rows are per check-in, day or shoe type; "pairs
per constructor" is the day's total ÷ constructors present, a line average. The only name on a
check-in is who entered or corrected it (an audit fact, never totalled). Day rows start at the
first check-in ever entered, so days before the system was used aren't "missed".

### D-087 · 2026-10-21 · Accepted — Production replaces stage monitoring (supersedes the stage parts of D-025 and D-033)

**Decision (Phase 23):** gone: the Floor Manager home's Batches by stage card; Operations' On the
floor now, Flow and Time in each stage sections; the bottleneck and stuck-batch attention items;
`stages.csv`; the batch list's stage filter and time in stage. In their place: **Today's
production** on the FM home, **Next check-in** on the QI home, Production → **Production**
(`/production`), and on Operations a **Production** section (pairs per day per shoe type against
the quota, constructors present, shortfall sentences, a chart), KPI tiles **Pairs made**, **Of
quota**, **Rolls finished** and **Rolls at Preparation**, the attention item "3 of the last 5
working days were below quota", and `production.csv` (one row per day and shoe type). The daily
summary and `operations.csv` count rolls started and finished.

### D-088 · 2026-10-22 · Accepted — The Floor Manager covers check-ins on a day no Quality Inspector is present

**Decision (Dylan, 2026-10-22, amends D-084's 3B):** the Floor Manager may enter and correct a
day's check-ins **only when that day's attendance is taken and no Quality Inspector is marked
present**. With a QI present, or attendance not taken yet, they can't, and the page, the API
(`403`) and the server action say why in one sentence ("A Quality Inspector is present today, so
they enter the check-ins." / "Take today's attendance first. You can enter check-ins only when it
shows no Quality Inspector present."). The QI can always enter. One function decides
(`mayEnterCheckIns` in `permissions.ts`); attendance answers yes or no for the role
(`qualityInspectorPresent`), never a count or a name (D-008). A covering entry is saved under the
Floor Manager's name and its audit row carries `coveringForQualityInspector: true`.

### D-089 · 2026-10-22 · Codex CI fix superseded by D-092 (vault rules kept) — Codex fixes failing CI checks; the vault is every agent's first lookup and records every change

**Context:** Dylan asked (2026-10-22) that Claude stays the main developer, that Codex applies
the fix when a GitHub CI check fails on a PR, and that every change is also documented in his
Obsidian vault (`C:\dev\capstone-obsidian`), which agents read first to save tokens and avoid
guessing.
**Decision:**

- When CI fails on a PR, Claude doesn't fix it. Claude reads the failing check and writes
  `qa/CODEX_PROMPT_CI_FIX_<branch>.md` from `qa/templates/ci-fix-prompt.md` (failing jobs, error
  lines, suspected files, gates to rerun). Dylan pastes it into Codex; Codex changes only what
  makes the checks pass (never skipping or loosening a test), reruns the gates and writes
  `qa/reports/YYYY-MM-DD-ci-fix-<branch>.md`. Claude may review the fix. This is the one case
  where Codex changes application code.
- Every agent reads the vault first (`CLAUDE.md`, `Rules.md`, `Home.md`, the "where to look"
  note, the phase summary), then only the repo files it points to. The repo wins when they differ.
- Every change, including a Codex CI fix, gets a line in the vault's Daily note, and each phase has
  a short summary note in `Notes/Phases/` that links the repo docs.
- Agents don't create branches, commit or push; Claude gives Dylan the git commands.

**Where:** `CLAUDE.md`, `AGENTS.md`, `qa/README.md`, `qa/templates/ci-fix-prompt.md`,
`docs/AGENTIC_WORKFLOW.md`, `.claude/skills/wrap-up/SKILL.md`; the vault's `CLAUDE.md`,
`Rules.md`, `Home.md`, `Notes/Agent workflow.md`, `Notes/Phases/`.

### D-090 · 2026-10-22 · Accepted — A smaller, realistic demo week that matches the system after Phase 23

**Context:** Dylan asked (2026-10-22) that the demo seed match the current system, with minimal
data named like real data instead of "Demo …" or A-to-L names. The demo week still sent its scans
as "Simulator" through a demo device token with model "demo-seed", although capture is on the
website only since D-069, and it scanned 20 to 30 sections a roll against Finish roll's "about 10
pieces" (D-082).
**Decision:**

- **Scans:** every demo scan is a Capture page capture (`WEBCAM`, no device token, the audit names
  the person) with model `yolo-v1-1d729fb0`; 10 sections a roll (`SECTIONS_PER_ROLL`), so about 120
  scans instead of about 290. The demo week no longer creates a device token.
- **People:** the demo accounts keep their emails and get names: Rodel Pascual (FM), Maricel
  Dizon (QI), Jerome Salazar (Admin), Noel Manalo (the constructor who orders leather, also allowed
  to capture, D-075). The 12 constructors get a mixed list of Filipino names. Demo accounts are
  dated 30 days back like the constructors, so the FM and QI are on the demo week's attendance.
  `demo:reset` puts the demo names back and removes the old A-to-L constructors.
- **Suppliers:** Marikina Leather Trading (the one with more defects), Meycauayan Tannery, JM
  Leather Supply (Divisoria) as the fallback store (survey: two usual suppliers, other stores when
  both run out), and San Roque Shoe Supplies for thread, tacks, cement and soles. Rolls alternate
  between the two tanneries, every sixth from the store; the bootstrap placeholder supplier is no
  longer used by the demo.
- **D-088 in the demo:** on one past day with no constructor absent, the QI is absent; the FM
  captures that day and enters its check-ins; that day's flagged scans wait for the QI the next
  morning (D-028).
- CI's demo-week check expects at least 40 scans (was 150).

**Where:** `src/server/services/demo-seed.service.ts`, `bootstrap.service.ts`,
`demo-reset.service.ts`, `models/demo-reset.model.ts`, `lib/demo-suppliers.ts`,
`.github/workflows/ci.yml`, `tests/unit/demo-seed.test.ts`, `tests/unit/demo-reset.test.ts`.
**Consequences:** demo data only; no migration and no rule changes. The names and suppliers are
invented for the demo; none is a real CPoint person or supplier.

### D-091 · 2026-10-23 · Accepted — Material Requests and Procurement are removed (Phase 24)

**Context:** on the 23 October factory visit CPoint listed Material Requests and Procurement among
the modules to remove (`docs/CPOINT_VISIT_10232026.md`; brief C-1, part of C-18). The notes give
no reason. Dylan approved the Phase 24 plan (`docs/prompts/plans/phase-24-plan.md`) the same day.
**Decision:**

- The module is deleted end to end: the pages, the 16 API routes, the controller, service, model,
  validator, `procurement-rules.ts`, the proof-file helpers (`attachment-type.ts`,
  `receipt-sample.ts`), the feature components, the five `procurement:*` permissions, the nav item
  and the role label map (`requestLabelsFor`). `/procurement` and `/api/v1/procurement/**`
  answer 404. Nothing is hidden behind a flag.
- The leather-roll switch goes with it: `users.canRequestLeatherRolls`, the session field,
  `canRequestLeatherRollsFor`, Users → More actions and the requesters tab.
- Migration `drop_procurement` drops the eight purchase tables, both enums, the column and their
  foreign keys. Stock movements that deliveries posted stay, with their reason text ("Delivery for
  MR-…"), so the ledger still adds up. Proof files already on disk are left alone; `demo:reset`
  clears them with the scan images (`UPLOADS_DIR/pod`).
- FM home: no Pending requests card. Inventory: no Requested badge or Request button. Operations:
  no purchasing section and no request attention items; the low-stock item reads "Restock them
  before they run out."; `stock.csv` loses "Open request".
- Constructor home until Phase 26: the Capture card for a constructor allowed to capture (D-075),
  otherwise "Your work in the system is at the camera. Ask the System Admin for camera access."
  The Shoe Constructor has no permission in the matrix any more; Capture comes from the switch.
- The demo week has no requests; its two deliveries stay as plain stock IN ("Delivery from …"), so
  the shelf ends where D-090 left it.

**Supersedes:** D-029 to D-031, D-035 to D-037, D-039 to D-045 and the request numbers of D-046;
the delivery link of D-023; the purchasing parts of D-033. D-038 (form messages) still holds for
every form. The survey Q14 question (who orders leather) closes with the module.
**Where:** `prisma/schema.prisma`, `prisma/migrations/20261023090000_drop_procurement/`,
`src/server/policies/{permissions,navigation}.ts`, `src/app/(app)/{constructor,floor-manager,
inventory}/page.tsx`, `src/app/(app)/admin/users/**`, `src/app/(app)/reports/_components/**`,
`src/lib/ops-rules.ts`, `src/server/services/{ops-report,bootstrap,demo-seed,demo-reset,auth,
user-admin}.service.ts`, `src/server/models/{demo-reset,inventory,user,ops-report}.model.ts`.
**Consequences:** the dev database loses its requests when the migration runs (backed up first).
The audit log keeps its `procurement.*` rows and their `PurchaseRequest` record type as history,
and the Audit log filters still offer them; audit rows are never rewritten or deleted (confirmed by
the Phase 24 QA, 2026-10-24). Tell CPoint the module is gone; how they order stays outside the
system.

### D-092 · 2026-10-23 · Accepted — Codex only tests and reports; Claude fixes failing CI checks (supersedes D-089's Codex CI fix)

**Context:** Dylan decided (2026-10-23) that Codex applies no fixes at all: its role is to run the
QA (UAT) that Claude writes up for it and to report. D-089 had Codex fix failing GitHub CI checks
from a prompt Claude wrote, the one case where Codex changed application code.
**Decision:**

- **Codex** tests and reports only. It runs the QA from Claude's handoff and paste-in prompt,
  writes its report in `qa/reports/` and adds a line to the vault's Daily note. It never changes
  application code, tests, migrations, config, `package.json` or `.env`, not even to get a CI
  check green.
- **Claude** fixes every failure, failing CI checks included: it reads the failing check, fixes
  it and reruns `npm run check` (and the `cv/` checks for `station`). Claude doesn't run e2e tests
  or Docker, so for an `e2e` or `docker` failure it also writes
  `qa/CODEX_PROMPT_CI_RECHECK_<branch>.md` from `qa/templates/ci-recheck-prompt.md` (renamed from
  `ci-fix-prompt.md`). Codex reruns that job and writes
  `qa/reports/YYYY-MM-DD-ci-recheck-<branch>.md`; a job that still fails goes back to Claude. Then
  Dylan commits and pushes, and CI reruns.
- The rest of D-089 stands: every agent reads the vault first and records every change there, and
  no agent creates branches, commits, pushes or PRs.

**Where:** `AGENTS.md`, `CLAUDE.md`, `qa/README.md`, `qa/CODEX_PROMPT.md`,
`qa/templates/ci-recheck-prompt.md`, `docs/AGENTIC_WORKFLOW.md`, `.claude/skills/wrap-up/SKILL.md`
and the project rules in `docs/prompts/factory-visit-changes.md`; the vault's `CLAUDE.md`,
`Rules.md`, `Home.md`, `Notes/Agent workflow.md` and `Templates/Phase summary.md`; the Claude
project instructions.
**Consequences:** workflow docs only, no code. D-091 belongs to Phase 24, which was planned with
that number before this entry was written.

### D-093 · 2026-10-24 · Accepted — Pass or Reject: the camera's verdict is final (Phase 25)

**Context:** at the 23 October factory visit CPoint said a section is either usable or not:
nobody cleans or cuts around a marked section, and nobody changes the camera's call (C-11 to C-15,
C-19 to C-22). Dylan approved the plan on 2026-10-24 and answered its three questions "yes to
all": an unknown class rejects and is listed in Settings, both verdict columns stay, and a type
with no "When found" action becomes Not accepted.
**Decision:**

- Every section is **Pass** or **Reject**. Each defect type has an **outcome**, Usable or Not
  accepted (Settings → Defect types → When found, required). A detection of an active type at or
  above **A defect counts as found at** (50%, D-053) gives its type's outcome; below it, it counts
  for nothing. Any Not accepted makes the section Reject; otherwise it passes. Inactive types are
  ignored.
- A class the system doesn't know rejects the section (A-12) and is listed under Settings →
  Unknown classes; the Admin home shows a line while any is waiting.
- The verdict is final at once: `finalVerdict` always equals `aiVerdict` (both kept, so old
  reports and queries still read). No status, no override, no decided-by, no decision API.
- A rejected section is reported **for salvage** (A-11): Operations has a For salvage section
  (total and by main defect), the daily and supplier tables and the CSVs say "Reject (for
  salvage)". The report moves no leather (C-20).
- The two confidence thresholds are gone; `PUT /api/v1/settings/cv` takes `foundPercent` (and
  `earlyModelNotice`) and refuses `rejectPercent`/`reworkPercent` by name.
- New scans snapshot `{ foundAtOrAbove, outcomes }`; a scan from before shows "Decided by the
  earlier rule (before 24 Oct 2026)".
- Migration `pass_or_reject` converts first: REWORK → PASS, NEEDS_REVIEW → REJECT on both columns,
  a pending final takes the AI verdict; a type's REWORK action → USABLE, REJECT or none →
  NOT_ACCEPTED. A section a person had decided keeps its final verdict.
- The model's four classes: crease and scratch Usable, cut and hole Not accepted (C-11, C-12, C-19, A-13).
  A new database also gets abrasion and dirt as Not accepted. `demo:reset` sets the four and turns
  abrasion and dirt off.
- Charts have two series. The chart colours were re-stepped so Pass and Reject stay apart for
  red-green colour blindness where they touch (validator: light ΔE 13.0, dark 11.0). The
  `--rework` and `--review` tokens are now `--caution` and `--info`.
- The model toolkit's preview follows: `[preview.outcomes]`, PASS or REJECT; old keys warn by
  name; `labels.csv` takes PASS or REJECT.

**Supersedes:** D-007; D-011's thresholds (the camera still decides); D-028; the Rework and
"worst outcome" parts of D-053; D-070. Amends D-020 (unknown → Reject), D-025 (no agreement rate,
no Fixable colour), D-072 (High on the reject share), D-074 (two results).
**Where:** `src/lib/decision-engine.ts`, `prisma/migrations/20261024090000_pass_or_reject/`,
`src/server/services/{scan-ingest,settings,report,ops-report,bootstrap,demo-seed,demo-reset}.service.ts`,
`src/server/validators/settings.validator.ts`, `src/app/(app)/admin/settings/**`,
`src/app/(app)/scans/**`, `src/app/(app)/camera/capture/**`, `src/app/(app)/reports/**`,
`src/styles/tokens.css`, `cv/cpoint_cv/{preview,config,evaluate,cli}.py`.
**Consequences:** the dev database's Fixable and pending sections become Pass and Reject when the
migration runs (back up first). Tell CPoint: two results, the camera's call stands, and rejected
sections are counted for salvage.

### D-094 · 2026-10-24 · Accepted — The Review Queue, the Repair Station and Salvage are removed (Phase 25)

**Context:** with Pass or Reject final (D-093) there is nothing to review, repair or track in
salvage inside the system (C-1, C-20, C-21).
**Decision:**

- Deleted end to end: `/review`, `/rework`, `/salvage` (they answer 404), `/api/v1/rework/**`,
  `/api/v1/salvage/**`, `/api/v1/reports/repairs`, `POST /api/v1/scans/{id}/decision`, the
  decision panel, the rework and salvage services, the outcome controller, model and validator,
  `outcome-rules.ts`, the In repair badge and the Open repairs card.
- Permissions `scan:decide`, `scan:review`, `rework:manage`, `salvage:read`, `salvage:manage` and
  the nav items Review queue, Repair Station and Salvage go.
- Migration `pass_or_reject` drops `rework_tickets`, `salvage_items`, their enums, the scan
  status and decision columns, and the defect type's `handling`.
- A roll's page shows Passed, Rejected (for salvage) and Total; Finish roll has no open-repairs
  note. The homes lose the flagged count and Open repairs. Operations loses the Repair Station
  section and the repairs attention item. The audit log keeps old `rework.*`, `salvage.*` and
  `scan.decide` rows as history, without a link.

**Supersedes:** D-021 (the batch yield stays as Pass and Reject), D-022, D-073; the repair parts
of D-033.
**Where:** as D-093, plus `src/server/policies/{permissions,navigation}.ts`,
`src/components/features/app-shell/sidebar.tsx`, `src/app/(app)/batches/**`,
`src/app/(app)/{floor-manager,quality-inspector}/page.tsx`, `src/server/services/audit-query.service.ts`.
**Consequences:** the dev database loses its repair tickets and salvage items when the migration
runs. Tell CPoint the three screens are gone.

### D-095 · 2026-10-24 · Accepted — Rolls start, are captured and finish at Capture; Batch becomes Roll in the code (Phase 26)

**Context:** CPoint captures on the constructors' own phones, and only the constructors the System
Admin allows (C-18, C-23, C-33). A leather roll has no production stages; it is scanned before it
goes on (Dylan, 24 Oct). DQ-1 renames the leather-roll `Batch` to `Roll` so Phase 27 can use
"batch" for the check-in interval.
**Decision:**

- `Batch` is `Roll` in the code (model, services, controller, validator, routes `/api/v1/rolls`,
  permissions `roll:read` and `roll:manage`). The table stays `batches` (`@@map`), the scan column
  stays `batchId`. New codes are `R-YYYY-NNNN`; older rolls keep `B-`. A roll's own code from the
  supplier is the optional "tag".
- A roll is OPEN, FINISHED or CANCELLED. Stages, the stage log, the target quota, notes, the shoe
  type and the camera's chosen batch are gone (migration `rolls_at_capture`, converting first:
  PLANNED and IN_PROGRESS → OPEN, COMPLETED → FINISHED, start and finish from the stage log).
- **Start roll** is at Capture; the supplier is required, the tag optional. Several rolls may be
  open at once; Capture's **Roll** dropdown says where each shot goes. It lists every
  open roll, starting on the one this browser last used, else the newest this person started,
  else the only one; with several and none of those, nobody's shot goes to a guess.
- **Finish roll** is at Capture only, and needs at least one shot. The Floor Manager doesn't
  finish rolls.
- **Cancel:** at Capture, anyone with camera access cancels an **empty** roll. The Floor Manager
  cancels **any** open roll from Reports → Rolls, with a required reason. Nothing is deleted; a
  cancelled roll keeps its shots, which are left out of the reports.
- A shot sent to a roll that was finished or cancelled meanwhile is refused before the model runs
  (`409 ROLL_CLOSED`); a website capture with no roll is `409 NO_ROLL_CHOSEN`. The simulator and a
  device token send to the roll open longest (`409 NO_OPEN_ROLL` with none).
- **Capture is the Shoe Constructor's only page and their home**, and only theirs: `camera:capture`
  is the constructor's alone, still behind `canCapture`. The QI, the FM and the Admin no longer
  capture (C-18). **Only the System Admin** gives or removes camera access (Users → More actions);
  the Camera page's operators panel is gone (`camera:operators` is the Admin's).
- **Reports → Rolls** (FM, `roll:read`): every roll with its supplier, start, finish, shots,
  passed, rejected (for salvage) and status, filters by text, supplier, status and start; a roll's
  page lists its shots and links its claim sheet. `/batches`, `/batches/new`, `/constructor` and
  `/api/v1/batches/**` answer 404. Inventory loses the "For roll" link on stock OUT.

**Confirmed:** Dylan kept the dropdown, the cancelled-roll and the `R-` code rules on 2026-10-24.
**Supersedes:** D-082 (Start and Finish roll by the FM; the 10-pieces hint), the batch parts of
D-005, the capture roles of D-064 and D-075 (FM and Admin granting), D-055's active batch.
**Where:** `prisma/schema.prisma`, `prisma/migrations/20261025090000_rolls_at_capture/`,
`src/lib/roll-rules.ts`, `src/server/{models,services,controllers,validators}/roll.*`,
`src/app/api/v1/rolls/**`, `src/app/(app)/camera/capture/**`, `src/app/(app)/reports/rolls/**`,
`src/server/policies/{permissions,navigation}.ts`.
**Consequences:** the dev database's rolls are converted when the migration runs (back up first,
then `demo:reset`). Tell CPoint: constructors start and finish rolls on their phones, and the
System Admin chooses who.

### D-096 · 2026-10-24 · Accepted — Phone layouts for Capture now, and for Batches in Phase 27

**Context:** D-034 says desktop first with no phone design. The constructors capture on their own
phones (C-23), and the QI will finish batches on a phone (C-18).
**Decision:** below 640 px the app shows a top bar (logo, page name, a Pages menu when a role has
more than one page, the account menu and theme) instead of the sidebar. Capture is designed for a
phone held upright: the roll line in large text, a full-width Capture button at the bottom at
least 44 px tall, dialogs that fit 390 × 844. Batches gets the same care in Phase 27. Every other
page stays desktop first (D-034 still holds for them).
**Where:** `src/components/features/app-shell/sidebar.tsx`, `src/app/(app)/layout.tsx`,
`src/app/(app)/camera/capture/**`, `DESIGN.md` → "Phone layout (D-096)", `CLAUDE.md`.

### D-097 · 2026-10-24 · Accepted — A batch is a check-in interval; the System Admin sets the lunch break (Phase 27)

**Context:** CPoint counts finished pairs at set times and calls each stretch between two counts a
batch (C-2, C-4). Lunch pauses the line, and a batch carries on after it (C-3, C-25, C-26, C-40).
**Decision:**

- A **batch** is one check-in interval of the working day. The Floor Manager chooses **How often**:
  every 1, 2, 3 or 4 hours of working time, or **once at the end of the day** (`intervalMinutes`
  null). Changes apply from tomorrow (D-083 still holds).
- The **lunch break** is one per working day, set by the **System Admin** under Settings → Lunch
  break (start and end, or none), applying from tomorrow with a history. Default **11:00 to
  12:00** (A-4, Dylan 2026-10-24). A lunch must sit inside tomorrow's shift.
- Working time leaves lunch out. A batch whose working time runs out at lunch's start ends when
  lunch ends; the last batch ends at the shift end, so it can be shorter (A-2). With the defaults
  the batches are 08:00–13:00 (lunch 11:00–12:00) and 13:00–17:00.
- `/production` becomes **Batches** (`/batches`, `/batches/plan`); a finished batch is still a
  `ProductionCheckIn` row in the code (`slotAt` = the batch's end).
- The bootstrap adds the default lunch from the start on a database with no check-ins, otherwise
  from tomorrow, so past days keep the times they were counted at.

**Supersedes:** the check-in times of D-083 (12:00, 16:00, 17:00 without lunch).
**Where:** `src/lib/production-rules.ts` (`batchesFor`, `lunchProblem`),
`src/server/services/production.service.ts`, `prisma/migrations/20261026090000_batches_are_intervals/`,
`src/app/(app)/batches/**`, `src/app/(app)/admin/settings/lunch-break-form.tsx`,
`src/app/api/v1/settings/lunch-break/route.ts`.
**Consequences:** tell CPoint the batch times and who sets lunch.

### D-098 · 2026-10-24 · Accepted — Worked-out batch statuses, Finish batch with failed pairs, on-screen notices (Phase 27)

**Context:** the QI counts the pairs that left Finishing and how many failed inspection (C-5, C-7,
C-27), may finish a batch shortly before its end (C-28), and should be reminded (C-6, C-31, A-9).
**Decision:**

- A batch's status is **worked out, never stored**: Upcoming, In progress (Paused for lunch during
  lunch), Due at its end, Late 30 minutes after (D-084), Finished (Finished late, Corrected), Missed
  at midnight.
- **Finish batch** opens **10 minutes before the end** and stays open until midnight: the pairs
  finished and, of these, the pairs that failed inspection (0 to start, never more than finished),
  with notes. One finish per batch (`409 STALE` naming who and when); a same-day correction needs a
  reason and the audit keeps both counts. Who may finish is unchanged (the QI; the FM on a day no
  QI is present, D-088).
- **Notices** for whoever may finish: a banner on every page at end − 10 minutes and at the end
  (with Finish batch), a bell beside the logo listing the due batches, and "(n)" in the tab title.
  The browser works them out from `GET /api/v1/production/today` (every 60 s and when the tab
  returns) and the clock. No push, browser notification, sound or server scheduler (C-31).
- Batches has a phone layout (D-096): one column, the batch to finish fixed at the bottom, the
  dialog as a bottom sheet. The QI sees today only; the FM also sees Recent days (Dylan
  2026-10-24).

**Where:** `src/lib/production-rules.ts` (`batchState`, `finishWindow`, `noticesFor`),
`src/components/features/batches/batch-notices.tsx`, `src/app/(app)/batches/**`,
`src/app/(app)/layout.tsx`, `src/components/features/app-shell/sidebar.tsx`.
**Consequences:** tell CPoint the notices only show while the app is open.

### D-099 · 2026-10-24 · Accepted — No shoe types; one daily quota on passed pairs (Phase 27)

**Context:** CPoint doesn't count by shoe type (C-8), and the quota counts only the pairs that
passed inspection (C-41).
**Decision:**

- Shoe types are removed: the table, the Settings tab, `/api/v1/shoe-types/**`, every field,
  filter and column. Old audit rows stay as history.
- **One daily quota** for the whole line. A first quota applies today, a change from tomorrow
  (D-085). Progress, the pace, the shortfall sentence, Operations and `production.csv` use
  **passed pairs** (finished − failed).
- The suggestion is the **average passed pairs per full working day** over the last 10 such days
  (Dylan 2026-10-24), replacing D-085's per-check-in average.
- The migration converts first (A-10): a check-in's pairs are the sum of its per-type counts
  (failed 0); each quota day becomes one quota, the sum of the per-type quotas in force that day.

**Supersedes:** the per-shoe-type parts of D-085 and D-086.
**Where:** `prisma/schema.prisma`, the migration above, `production.service.ts`
(`saveQuota`, `productionCsv`), `src/server/services/ops-report.service.ts`,
`src/server/services/settings.service.ts`, `src/server/validators/{production,settings}.validator.ts`.
**Consequences:** the demo week sets one quota of 128.
