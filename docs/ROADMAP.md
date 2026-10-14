# Roadmap: System Rebuild

Do one phase per Claude Code session. Each phase ends with the quality gates in
`docs/prompts/system-rebuild.md` passing, the docs updated, and a commit and push of the working
branch, which the team merges into `main` by pull request (D-032). Phases 0–8 were built on
`system-rebuild`, now merged. Tick the boxes as they're done.

## Phase 0 — Foundation

- [x] `system-rebuild` branch created from the branch containing these docs, and pushed
- [x] ui-craft §9 run: legacy identity (logo, Figtree, sidebar, light/dark) captured in `DESIGN.md` + `src/styles/tokens.css`
- [x] Laravel/PHP code removed (keep `public/images/cpoint-logo.jpg`, `docs/`, `.claude/`, `CLAUDE.md`); `.gitignore` and `.claude/launch.json` updated for Next.js
- [x] Next.js (App Router, TS strict) + Tailwind + shadcn/ui scaffolded with the folder structure from the master spec
- [x] ESLint (with layer import restrictions), Prettier, Husky + lint-staged, Vitest, Playwright configured
- [x] Multi-stage `Dockerfile` (standalone, non-root, healthcheck), `.dockerignore`, `docker-compose.yml` (`app` + `db`)
- [x] `/api/health` checks DB connectivity
- [x] GitHub Actions CI: lint → typecheck → test → build
- [x] `.env.example`, README (dev + demo workflows), `CLAUDE.md` Commands section filled in

## Phase 1 — Data & auth

- [x] Full Prisma schema + first migration + indexes
- [x] Seed: 4 role accounts, shoe types, defect types, CV settings, sample supplier
- [x] Auth.js credentials login, hashed passwords, inactive users blocked
- [x] Policies (`can(user, permission)`) + middleware; 401/403/404 pages
- [x] App shell: sidebar with role-based nav, theme toggle (no flash), logged-in user menu
- [x] AuditLog helper used by every mutation
- [x] e2e: each role logs in and sees only its nav

## Phase 2 — Batches & stages

- [x] Batch list (filter by status/stage/shoe type), create, edit, cancel
- [x] Advance stage (no skipping; going backwards needs a reason) with `BatchStageLog`
- [x] Batch detail: stage timeline with durations
- [x] Unit tests for stage transitions

## Phase 3 — CV skeleton

- [x] Device API tokens (hashed, scoped, revocable)
- [x] `POST /api/v1/scans` + `GET /api/v1/batches/current` documented in `docs/API.md`
- [x] Decision engine (pure, unit-tested): ≥0.90 REJECT, 0.60–0.89 REWORK, <0.60 PASS, unknown class → NEEDS_REVIEW; thresholds configurable
- [x] Unknown class keys stored and flagged
- [x] Image storage via `StorageService` on the `uploads` volume
- [x] `npm run cv:simulate` generates realistic scans
- [x] Override any decision (QI + FM) with a reason; review queue for NEEDS_REVIEW scans
- [x] Scan detail with bounding-box overlay
- [x] "Latest scans" widget on the FM and QI overviews (5s polling)
- [x] Camera placeholder page

## Phase 4 — Rework & salvage

- [x] Rework tickets created automatically from REWORK (**done in Phase 3**); board OPEN → IN_PROGRESS → DONE
- [x] Salvage items created automatically from REJECT (**done in Phase 3**); assign to a later batch or discard
- [x] Batch counts service (usable = passed + rework done) shown on batch detail
- [x] Unit tests for counts

## Phase 5 — Inventory

- [x] Items CRUD with category, unit, reorder level (no delete: deactivate keeps the history)
- [x] Movements (IN/OUT/ADJUST) are the only way quantity changes
- [x] Low-stock alerts on the FM overview
- [x] Optionally consume a leather roll when creating a batch

## Phase 6 — Admin

- [x] Users CRUD, deactivate, reset password (temporary password, forced change, sessions ended)
- [x] Defect types, CV thresholds, shoe types, suppliers management (+ unknown classes panel)
- [x] Audit log viewer with filters
- [x] Component types table + "Coming soon" page; Constructor placeholder home

## Phase 7 — Dashboards & reports

- [x] FM overview and QI overview (as specified in the master spec)
- [x] Daily summary (Manila day), defect analytics, AI agreement rate
- [x] Stage-duration / bottleneck chart
- [x] CSV export
- [x] No per-person metrics anywhere (checked: report payload unit test + UI review, D-025)

## Phase 8 — Hardening & demo

- [x] Playwright smoke test per role covering the main flows (+ axe on every page)
- [x] ui-craft audit across all screens, findings fixed (`docs/UI_AUDIT.md`)
- [x] Demo seed: realistic week of data (D-026)
- [x] Clean `docker compose up --build` on a fresh machine, following the README word for word
      (sandbox: one documented base-image build arg; the CI docker job is the clean-runner check)
- [x] Panel-ready README: architecture diagram, ERD, setup, demo script

## Phase 9 — Procurement & review access

- [x] Review access: only the Quality Inspector decides flagged scans, enforced in the service
      (403), Floor Manager read-only on the scan and in the queue (D-028)
- [x] Purchase requests: schema, lifecycle (approve / reject with reason / cancel / receive into
      inventory), timeline, remarks, conditional updates and audit on every change (D-029)
- [x] Designated requesters, chosen by the Floor Manager or the System Admin, effective on the
      person's next request without signing out (D-030)
- [x] Views: list with status tabs and filters, request form with a stock-aware picker, detail
      with stock then and now, FM home card, Inventory "Requested" badge, constructor home
- [x] API under `/api/v1/procurement/**`, documented in `docs/API.md`
- [x] Seeds: demo constructor designated; the demo week has one request in each state
- [x] Tests: unit (rules, permissions, service, designation, seed), e2e journeys and access,
      axe smoke on the new pages
- [x] Client follow-up (D-031): every Shoe Constructor requests materials; only those the FM or
      Admin allows request leather rolls (also when typed); D-028 confirmed by the team

## Phase 10 — Operations reports

- [x] Floor Manager's Reports lands on **Operations**: key figures vs the previous period, "what
      needs attention", the line by stage with late batches, flow, time in each stage, repair
      station, materials at risk, purchasing, suppliers, and the checkpoint before cutting in brief
- [x] **Quality** tab kept for the FM; it is the Quality Inspector's only report, now with the
      repair station on top and a Pareto on defects
- [x] API: `/reports/operations`, `/reports/repairs`, three new CSVs (D-033)
- [x] Tests: unit (rules, service, no person keys), e2e updated for the new tabs
- [ ] Floor Manager home still shows the inspection split; decide whether it should lead with
      operations too
- [x] Layout adapts to narrower windows (D-034): icon-rail sidebar, auto-fit grids, wrapping
      button groups, tables scroll in their card

## Phase 11 — Material requests: naming, remarks, urgency, specific messages

Brief: `material-requests.md` (project root), Phase 11. Phases 12 and 13 are in the same file.

- [x] Naming (D-035): Shoe Constructors see **Material requests** (nav, titles, buttons, empty
      states, "My material requests" on their home); the Floor Manager and Admin see
      **Procurement**. One role → label map (`requestLabelsFor`); URLs, permissions and tables
      unchanged
- [x] Remarks replace the justification (D-036): optional Remarks box, saved as the first remark
      in the create transaction; migration copies old justifications into remarks, then drops the
      column
- [x] Automatic urgency (D-037): Needed by is required (today to 180 days ahead); High / Medium /
      Low from working days left, computed on read, never stored; badge with icon, label and days
      left; Pending sorted by needed-by date; urgency filter; High count on the FM home card and in
      the Operations report; `PurchasePriority` dropped
- [x] Specific messages system-wide (D-038): every validator message names the field and the fix;
      form-level alerts are built from the field messages; server field errors land on the exact
      input; focus moves to the first invalid field; a summary appears at 3 or more errors
- [x] Tests: unit (urgency bands and ranges, label map, first remark, validator-message sweep,
      field-error paths); e2e specs updated and extended
- [ ] E2E and browser checks are run by Codex through `qa/handoffs/` (not run in the build
      session)
- [ ] Docker demo-week check not run in this session

## Phase 12 — Item-level decisions guided by stock

Brief: `material-requests.md` (project root), Phase 12.

- [x] Per-item decisions (D-039): each line has `decision`, `rejectionReason`, `decidedById` and
      `decidedAt`; the decision panel lists every item with Approve or Reject (reason required),
      "Approve all remaining" and "Save decisions" in one transaction; the request status is
      derived from the items (`deriveRequestStatus`)
- [x] "Reject whole request" stays as the shortcut: one reason, every item rejected
- [x] Migration `20261013030000_purchase_line_decisions`: decided requests get their status copied
      onto their lines; rejected ones copy the reason to each line
- [x] The requester and the history show the result per item: "1 of 2 items approved", each
      rejected item with its reason, and one timeline event listing the items
- [x] Stock guidance (D-040): stock now and when requested next to each item; "Still in stock"
      badge above 2× the reorder level (`WELL_STOCKED_FACTOR`, one constant); well-stocked items
      pre-selected Reject with the reason filled in, low or out-of-stock items pre-selected
      Approve, items not in inventory "Not in inventory" with nothing selected; never decided
      automatically
- [x] Receiving adds only approved items to stock; a rejected item is no longer "requested" in
      Inventory or the Operations report
- [x] Tests: unit (status derivation for all-approved, mixed, all-rejected and still-pending; a
      concurrent decision; the well-stocked rule at exactly 2× and just above; reorder level 0;
      service and validator-message cases); e2e scenarios written (nails high, adhesive low; an
      undecided item; receive after a mixed decision)
- [ ] E2E and browser checks are run by Codex through `qa/handoffs/` (not run in the build
      session)
- [ ] Docker demo-week check not run in this session (the seed changed: one request is now
      decided item by item)

## Phase 13 — Ordering, delivery with proof, and the remaining gaps

Brief: `material-requests.md` (project root), Phase 13.

- [x] Ordering (D-041): "Mark as ordered" on an approved request with a supplier from Settings, an
      optional reference number, a required expected delivery date (today or later) and an optional
      note; one order per request; the request moves to ORDERED
- [x] "Delivery late" (D-041): ordered or partly received past the expected date; a badge in the
      list and on the request, a Delivery filter, and a line on the Floor Manager's home card
- [x] Deliveries (D-042): "Record delivery" takes a quantity per approved item (prefilled with
      what is outstanding, 0 allowed), the delivery date, proof files and a note; each quantity of
      an inventory item posts stock IN through the ledger in the same transaction; anything
      outstanding leaves the request PARTIALLY_RECEIVED; over-delivery is refused under the item
- [x] Close short (D-042): a partly received request is closed with a reason; it ends as received,
      marked "Closed short", and the history keeps what never arrived
- [x] Proof of delivery (D-042): required; JPEG, PNG, WebP or PDF by their bytes, 10 MB each, 5 per
      upload; stored under server-generated keys; served from a guarded route (FM, Admin, the
      requester on their own request) as private, `nosniff`, with a safe file name; never deleted,
      corrected by adding another file
- [x] Cancel after approval (D-043): the Floor Manager, with a reason, while nothing has arrived;
      after a delivery the page says to use Close short
- [x] Copy to a new request (D-044): on the requester's own rejected or cancelled request; the form
      opens prefilled, rejected items unticked with their reasons; both requests link to each other
- [x] Floor Manager restock (D-045): from Procurement → New or "Request" on a low inventory item;
      decided through the same item-by-item step; marked "Raised by Floor Manager"; no leather-roll
      OK needed
- [x] Views: seven status tabs with counts; the request page shows the order, each delivery with
      proof thumbnails or a PDF link, and what is still to come; the home card shows pending (with
      High), waiting to be ordered and late deliveries; the Operations report counts by the new
      statuses
- [x] Migration `20261013090000_purchase_ordering_deliveries`: two new statuses, order and
      closing fields, `PurchaseDelivery`, `PurchaseDeliveryLine`, `PurchaseAttachment`; each
      request received before the change becomes one delivery without proof; the stock movement
      moves from the request line to the delivery line
- [x] Demo week: nine requests, including one partly received with a photo and a PDF, one late
      delivery, one cancelled after ordering and one raised by the Floor Manager
- [x] Tests: unit (every move and refusal, receipt arithmetic in hundredths, late flag, file
      sniffing for all four types and a renamed program, service, validator-message and seed
      cases); e2e scenarios written (order → short delivery with proof → close short; a refused
      file; cancel an ordered request and copy it; copy with rejected items; FM-raised and late)
- [x] Browser checks by Codex through `qa/handoffs/`: run 1 (47 of 54 manual, one app fault
      fixed), run 2 (13 of 13 manual), runs 3–5 (e2e and axe; the last failures were test and
      test-server issues, fixed)
- [x] Docker demo-week check passed (2026-10-14, throwaway stack)
