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

### D-028 · 2026-10-05 · Accepted — Only the Quality Inspector decides flagged scans (supersedes part of D-011)

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

### D-029 · 2026-10-05 · Accepted — Purchase requests: model and lifecycle

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

### D-030 · 2026-10-05 · Accepted — Designated requesters

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

### D-031 · 2026-10-05 · Accepted — Every constructor requests materials; leather rolls need the OK (supersedes D-030)

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

### D-033 · 2026-10-08 · Accepted — Operations-first reports for the Floor Manager

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

### D-035 · 2026-10-10 · Accepted — "Material requests" for constructors, "Procurement" for the FM and Admin

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

### D-036 · 2026-10-10 · Accepted — Remarks replace "Why it's needed" (supersedes part of D-029)

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

### D-037 · 2026-10-10 · Accepted — Urgency is automatic, from the needed-by date (supersedes the manual priority in D-029; updates D-033)

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

### D-039 · 2026-10-13 · Accepted — The Floor Manager decides each item of a request (supersedes the whole-request decision in D-029)

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

### D-040 · 2026-10-13 · Accepted — Stock guidance on each item: "still well stocked" is more than 2× the reorder level

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
