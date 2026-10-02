# Master Prompt: CPoint Product Monitoring System Rebuild

> **How to use this file.** Open Claude Code (Opus) at the repo root and say:
> *"Read `docs/prompts/system-rebuild.md` and run the next phase listed in `docs/STATUS.md`."*
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

**Current system:** Laravel 12 + MySQL + Blade (this repo before Phase 0). It has role dashboards, a
YOLO ingestion API (`POST /api/inspections`, Sanctum token), auto pass/reject confidence thresholds,
a human review queue, rework tracking, and a decision-support report. The panel asked for a rebuild
that meets industry standards. Reuse the *ideas* that worked (listed in `docs/DECISIONS.md`), but
none of the PHP code.

**Client research:** read `docs/client-survey.md` (Taglish interview answers). Key findings:
- Everything is tracked today on paper and pen. The materials log book covers leather rolls, nails,
  equipment, sales and deliveries.
- The **bottlenecks are Upper Making and Sole-ing**. Upper Making takes the longest.
- Defects found late waste time and materials in later stages. The client wants a **filter at
  Preparation, before cutting**, to catch raw-material defects early.
- **Either the Quality Inspector or the Floor Manager**, whoever is available, decides on a defect.
- A **daily summary** is enough for production data. Real-time isn't required, except for the
  camera feed.
- Materials are expensive and get reused as much as possible. Leftovers go to the next production.
- Leather rolls have arrived late before and stopped production. Inventory low-stock awareness matters.
- **Workforce metrics are sensitive.** Past awards caused jealousy. Do **not** build per-person
  rankings, leaderboards or individual scores.
- The client wants **per-component tracking in Upper Making** (later), plus inventory management
  and batch quotas.
</context>

<read_first>
At the start of **every** session, before doing anything else:
1. `CLAUDE.md`: project rules (auto-loaded).
2. `docs/STATUS.md`: current phase, what's done, what's next, blockers.
3. `docs/DECISIONS.md`: settled decisions. Don't re-litigate them; add a new entry to change one.
4. `docs/ROADMAP.md`: phase definitions and acceptance criteria.
5. `.claude/skills/ui-craft/SKILL.md`: required for any UI work.
6. `DESIGN.md` (exists after Phase 0): design tokens and rules. It overrides ui-craft defaults.
</read_first>

<ground_rules>
- **Branch:** all rebuild work happens on `system-rebuild`. In Phase 0, if `system-rebuild` doesn't
  exist, create it from the current HEAD (the branch containing this file) and push it with
  `git push -u origin system-rebuild`. Never push to `main`.
- **Commits:** small Conventional Commits (`feat(batches): ...`, `fix(cv): ...`, `docs(status): ...`).
  Commit at every green checkpoint, not one giant commit per phase.
- **Scope:** desktop web only. **No mobile or responsive work yet.** Design for ≥1280px wide and
  don't add mobile nav, breakpoints or touch layouts. The real computer-vision model, live
  phone/webcam capture, and custom shoes are all out of scope.
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

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript (strict)** | Full-stack in one deployable unit |
| Runtime | Node.js current LTS | |
| Database | **PostgreSQL** | Requested; relational fit for batches/scans/inventory |
| ORM / migrations | **Prisma** | Typed models, versioned migrations, seed script |
| Auth | **Auth.js (NextAuth v5)**, credentials provider, bcrypt/argon2 hashes, JWT sessions | Standard, no external IdP needed |
| Validation | **Zod**, shared between API and forms | One schema = one truth |
| UI | **Tailwind CSS + shadcn/ui (Radix)**, restyled via `DESIGN.md` tokens | Accessible primitives, no default look |
| Forms | React Hook Form + Zod resolver | |
| Client data / polling | TanStack Query | Polling for the "Latest scans" widget |
| Charts | Recharts | Follow the `dataviz` guidance if available |
| Tests | **Vitest** (unit/service), **Playwright** (e2e smoke) | |
| Quality | ESLint, Prettier, `tsc --noEmit`, Husky + lint-staged | |
| CI | GitHub Actions: lint → typecheck → test → build | Industry baseline |
| Logging | pino (structured JSON) | |
</tech_stack>

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
- The YOLO service (later) runs **outside** this compose file on the camera machine and talks to
  the app over HTTP with an API token.
</docker>

<architecture>
Follow strict **MVC with layered server code**. Every route lives in a predictable folder.

```
src/
  app/                              # VIEW layer (React Server/Client Components)
    (auth)/login/page.tsx
    (app)/layout.tsx                # sidebar shell, role-aware nav, theme toggle
    (app)/floor-manager/...         # one folder per role, see <modules>
    (app)/quality-inspector/...
    (app)/admin/...
    (app)/constructor/...
    (app)/camera/page.tsx           # placeholder CV page (shared)
    api/
      health/route.ts
      v1/                           # ROUTES: REST API, versioned
        batches/route.ts            # GET list, POST create
        batches/[id]/route.ts
        batches/[id]/stages/route.ts
        scans/route.ts              # POST = CV ingestion (token auth), GET list
        scans/[id]/decision/route.ts
        rework/...  salvage/...  inventory/...  users/...  defect-types/...  settings/cv/...  reports/...
  server/
    controllers/                    # CONTROLLER: parse+validate request → call service → shape response
    services/                       # business rules (decision engine, batch counts, stage flow)
    models/                         # MODEL: data access via Prisma, the ONLY layer that imports prisma
    validators/                     # Zod schemas (shared with forms)
    policies/                       # role → permission map; `can(user, "batch:create")`
    lib/                            # prisma client, auth config, errors, logger, storage
  components/
    ui/                             # shadcn primitives (restyled by tokens)
    features/<module>/              # feature components (BatchTable, ScanCard, ...)
  styles/tokens.css                 # design tokens from DESIGN.md
prisma/  schema.prisma  migrations/  seed.ts
scripts/ cv-simulator.ts            # posts fake scans to the API
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
**Production stages** (fixed order): `PREPARATION → UPPER_MAKING → SOLEING → FINISHING`.

**Batch = one leather roll.** Fields: batch code (auto, e.g. `B-2026-0001`), roll code, supplier,
shoe type (`School Shoe` | `Topsider`, as a table so more can be added), date received, target
quota in pairs (optional; the client's quota isn't strict), status (`PLANNED | IN_PROGRESS |
COMPLETED | CANCELLED`), current stage, created by.

**Stage tracking:** the **Floor Manager advances a batch manually** to the next stage. Each stage
transition writes a `BatchStageLog` (stage, startedAt, endedAt, by whom, optional notes). Stage
durations feed the bottleneck report. Stages can't be skipped. Going backwards needs a reason and
is audited.

**Computer vision (Preparation only, before cutting):**
- One **scan = one leather section** of the batch's roll, captured before the cutting guides are applied.
- A scan has 0..n **detections** (defect type, confidence 0–1, bounding box as fractions 0–1).
- **Defect types are configurable data, not code.** Seed `cut`, `hole`, `abrasion`, `dirt`. Each
  has `key`, `label`, `isActive`, `sortOrder`. The same confidence rule applies to **every** defect
  type; there are no per-type actions. The YOLO class list will change after the new training
  photos, so unknown class keys from the CV service must be stored and flagged, not rejected.
- **Decision engine** (`server/services/decision-engine.ts`, pure function, fully unit-tested).
  It uses the **highest confidence among detections of active defect types**. The two thresholds
  are admin-editable `CvSettings`, seeded at `rejectAtOrAbove = 0.90` and `reworkAtOrAbove = 0.60`
  (team decision D-011):
  1. max confidence ≥ 0.90 → **REJECT** (automatic)
  2. 0.60 ≤ max confidence < 0.90 → **REWORK** (automatic)
  3. max confidence < 0.60, or no detections → **PASS** (automatic; `ASSUMPTION` until confirmed)
  4. Any detection with an **unknown class key** → **NEEDS_REVIEW** instead, because the system
     can't trust a class it doesn't know.
  Compare boundaries on the raw float (0.8999 = REWORK, 0.90 = REJECT). Validate that
  `reworkAtOrAbove < rejectAtOrAbove` when an admin saves settings. Store the thresholds used on
  each scan (`thresholdsSnapshot`) so old decisions stay explainable after the settings change.
- **Human-in-the-loop:** the **Quality Inspector or the Floor Manager**, whoever is available, can
  **override** any automatic decision (PASS / REWORK / REJECT) from scan detail or the "Recent
  decisions" list, and resolves NEEDS_REVIEW scans in the review queue. Overrides require a reason
  and are tracked (`isOverride`, `aiVerdict` vs `finalVerdict`). An override also updates the linked
  ReworkTicket/SalvageItem: it cancels the old one and opens the new one. Overrides feed an
  "AI agreement rate" metric.
- **Outcomes:**
  - **PASS** → the section continues to cutting.
  - **REWORK** → a `ReworkTicket` is opened (`OPEN → IN_PROGRESS → DONE`) for the separate repair
    station. When the Floor Manager or Quality Inspector marks it DONE, the section **counts as
    usable in the batch**. It doesn't get re-scanned.
  - **REJECT** → removed from the line but **kept as a `SalvageItem`** linked to its origin batch
    (`AVAILABLE → ASSIGNED (to a later batch) | DISCARDED`). This reflects the client's practice of
    reusing leftover material.
- **Batch counts** (derived in a service, never stored redundantly): total scanned, passed,
  rework open, rework done, rejected, **usable = passed + rework done**, pending review.

**Inventory (basic):** items with category (`LEATHER_ROLL | NAILS | ADHESIVE | THREAD | EQUIPMENT |
OTHER`), unit, quantity on hand, reorder level. Changes happen only through `InventoryMovement`
(IN / OUT / ADJUST, with reason, optional batch, user). Show a low-stock alert when quantity ≤
reorder level. Creating a batch can optionally consume one leather roll from inventory.

**Component tracking (Upper Making):** placeholder only. Add a `ComponentType` table and a
"Coming soon" page. Don't build the workflow.

**Workforce:** no per-person metrics anywhere in the UI. Aggregates are per stage, per batch or per day only.

**Time:** store in UTC, display in `Asia/Manila`. Daily summaries are bucketed by Manila calendar day.
</domain_rules>

<roles_and_modules>
Seed one demo account per role (password from `.env`, documented in README).

| Module | Floor Manager | Quality Inspector | System Admin | Shoe Constructor |
|---|---|---|---|---|
| Overview dashboard (role-specific) | ✅ | ✅ | ✅ (system health) | placeholder |
| Batches: list / create / edit / advance stage | ✅ full | view | view | — |
| Camera (CV placeholder page) | ✅ | ✅ | ✅ | — |
| "Latest scans" widget (polls every 5s) | ✅ on overview | ✅ on overview | — | — |
| Recent decisions + override; review queue (unknown classes) | ✅ | ✅ | — | — |
| Scan history + detail (image + boxes) | ✅ | ✅ | view | — |
| Rework board | ✅ | ✅ | — | — |
| Salvage | ✅ | view | — | — |
| Inventory + movements | ✅ | — | view | — |
| Reports: daily summary, defects, stage durations, CSV export | ✅ | ✅ (quality only) | — | — |
| Users (CRUD, deactivate, reset password) | — | — | ✅ | — |
| Defect types, CV thresholds, shoe types, suppliers | — | — | ✅ | — |
| CV device API tokens (create / revoke, shown once) | — | — | ✅ | — |
| Audit log (filterable) | — | — | ✅ | — |
| Constructor home: "Your tasks are coming soon" | — | — | — | ✅ |

**Floor Manager overview:** today's scans and pass/rework/reject split, open reworks, batches
per stage (shows the bottleneck), low-stock alerts, and Latest scans.
**Quality Inspector overview:** today's REWORK/REJECT decisions to verify, with override (the primary
action), the flagged-scan count, today's defect breakdown by type, AI agreement rate, and Latest scans.

**Camera page (placeholder):** shows the connected source as "Not connected" with a
"Simulator active" state when demo scans are arriving. It has a batch selector (the open batch at
Preparation), an image-frame area with an empty state, and a note: "Phone/webcam capture will be
connected here." It doesn't use `getUserMedia` yet.
</roles_and_modules>

<cv_integration_contract>
This contract is what the real YOLO service will call later, so keep it stable and document it in
`docs/API.md`.
- `POST /api/v1/scans`: `Authorization: Bearer <device token>` (hashed in DB, `scans:create` scope,
  revocable, `lastUsedAt` tracked). Request is `multipart/form-data`: `batchId` (optional; defaults
  to the open batch at Preparation), `image` (≤10 MB, jpeg/png/webp), and `detections` (JSON array of
  `{ classKey, confidence, box: { x, y, width, height } }`), plus `modelVersion` and `source`
  (`SIMULATOR | PHONE | WEBCAM | DEDICATED_CAMERA`).
  Response is `201` with `{ scanId, verdict, status }`.
- `GET /api/v1/batches/current?stage=PREPARATION`: lets the capture client find the open batch.
- `scripts/cv-simulator.ts` (`npm run cv:simulate -- --count 20 --interval 3`): posts realistic
  fake scans with generated placeholder images and a mix of outcomes, so the dashboards can be
  demoed with no camera.
- Defect class keys, thresholds and source type are all data/config. Plugging in the real model
  must need **zero code changes** to the app.
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
    accent. Semantic colors are fixed: PASS = success, REWORK = warning, REJECT = danger,
    NEEDS_REVIEW = info. Never rely on color alone; always pair it with a label or icon.
- Density: these are desk users working all day, so use compact tables, right-aligned numbers and
  sortable columns.
- Destructive actions (reject override, deactivate user, revoke token, discard salvage) need a
  confirmation that names the item. Reversible actions use an undo toast.
- Accessibility: keyboard reachable, visible focus, contrast ≥ 4.5:1, honors `prefers-reduced-motion`.
- Language: English UI.
</ui>

<data_model_outline>
Prisma models (refine as needed and record changes in DECISIONS):
`User(role enum, isActive)`, `ShoeType`, `Supplier`, `Batch`, `BatchStageLog`,
`Scan(batchId, sequence, imagePath, source, modelVersion, aiVerdict, finalVerdict, status,
maxConfidence, thresholdsSnapshot Json, isOverride, overrideReason, decidedById, decidedAt)`,
`Detection(scanId, defectTypeId?, rawClassKey, confidence, x, y, width, height)`,
`DefectType(key unique, label, isActive, sortOrder)`, `CvSettings(rejectAtOrAbove, reworkAtOrAbove)` (singleton),
`ReworkTicket(scanId unique, status, notes, completedById, completedAt)`,
`SalvageItem(scanId unique, originBatchId, status, assignedBatchId?)`,
`InventoryItem`, `InventoryMovement`, `ComponentType` (placeholder),
`ApiToken(name, tokenHash, scopes, lastUsedAt, revokedAt)`,
`AuditLog(actorId?, actorType USER|DEVICE|SYSTEM, action, entity, entityId, before Json?, after Json?, createdAt)`.
Add indexes for every foreign key and for `Scan(createdAt)`, `Scan(status)`, `AuditLog(createdAt)`.
</data_model_outline>

<phases>
The authoritative list with acceptance criteria is `docs/ROADMAP.md`. Summary:
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
- Phase-relevant Playwright smoke test passes (from Phase 1 on).
- `docker compose up --build` starts cleanly and `/api/health` returns 200 (check in Phase 0 and
  Phase 8, and whenever Docker files change).
- The decision engine, batch counts and stage transitions have unit tests covering edge cases:
  no detections, exactly 0.60, 0.5999, exactly 0.90, 0.8999, several detections (highest wins), inactive
  defect type ignored, unknown class key, invalid thresholds, skipped stage.
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
6. Commit the docs with the code (`docs(status): ...`) and push.
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
