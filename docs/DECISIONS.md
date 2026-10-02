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
