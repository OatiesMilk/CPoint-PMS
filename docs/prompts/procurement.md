# Prompt: Phase 9 — Procurement module + review-queue access fix

> **How to use this file.** Open Claude Code (Opus) at the repo root, switch to **plan mode**, and say:
> _"Read `docs/prompts/procurement.md` and do what it says. Start with Step 1 and stop for my
> approval before writing code."_
> It's one roadmap phase: plan → approve → build → gates → wrap-up → report.

---

<role>
You are the senior full-stack engineer who built Phases 0–8 of this rebuild. You know its
conventions and keep to them. You're adding one new module and fixing one access bug. The bar is
the same as before: an industry panel reviews the result. Where the client hasn't decided
something, you surface it; you don't invent business rules quietly.
</role>

<read_first>
Read all of these **before you plan**. The plan must cite what it reuses.

1. `CLAUDE.md` (auto-loaded), `AGENTS.md`, `docs/STATUS.md`
2. `docs/prompts/system-rebuild.md`: master spec. Its `<architecture>`, `<ui>`, `<quality_gates>`,
   `<documentation_protocol>` and `<final_report_format>` all still apply.
3. `docs/DECISIONS.md`, especially D-008 (no per-person metrics), D-011 (who decides scans),
   D-016 (database-checked guard), D-018 (schema conventions), D-019 (concurrency), D-023
   (inventory ledger), D-024 (account admin and sessions), D-026 (demo week seed).
4. `docs/ROADMAP.md`, `docs/client-survey.md` (Q5, Q12–Q14 and Q16–Q19 matter here), `docs/API.md`
5. `DESIGN.md` and `.claude/skills/ui-craft/SKILL.md`: required for the UI work.
6. Then the code you'll reuse or change:
   - `src/server/policies/{permissions,guard,navigation}.ts`, `src/lib/domain.ts`
   - `prisma/schema.prisma` (`User`, `InventoryItem`, `InventoryMovement`, `BatchSequence`, `AuditLog`)
   - Inventory, the closest existing module, is the pattern to copy end to end:
     `src/server/{models,services,controllers,validators}/inventory.*`,
     `src/app/(app)/inventory/**`, `src/app/api/v1/inventory/**`
   - Review/decision flow: `src/server/services/scan-decision.service.ts`,
     `src/server/controllers/scan.controller.ts`, `src/app/(app)/review/**`,
     `src/app/(app)/scans/**` (`[id]/page.tsx`, `[id]/decision-panel.tsx`, `actions.ts`),
     and the role overviews in `src/app/(app)/{floor-manager,quality-inspector,constructor}/page.tsx`
   - `src/server/services/{bootstrap,demo-seed,user-admin,audit-query}.service.ts`
   - `src/app/(app)/admin/users/**`, plus `tests/unit/**` and `tests/e2e/**` for the existing style
   - Next.js 16 docs in `node_modules/next/dist/docs/` for anything about routing, Server Actions
     or caching that you're not sure of
     </read_first>

<context>
CPoint tracks materials in a paper log book (survey Q12). A late leather roll has stopped
production before (Q13). Today one staff member orders leather, and the production manager orders
equipment for the shoe constructors once they notice stock is low (Q14). There's no formal request
step, so a shortage is noticed late and nobody can see who asked for what.

The Shoe Constructor role exists but only has a "coming soon" home page. This phase gives it its
first real feature.

The client asked for two things.

**A. Procurement module**

- Only **designated** Shoe Constructors can submit a request to buy materials, e.g. when nails or
  leather rolls run low. A System Admin **or** a Floor Manager chooses who's designated.
- The Floor Manager **approves** or **rejects** each request. A rejection needs a reason.
- The module shows each request's status, audit trail and remarks, plus other views that help
  (you propose these; see the design brief).

**B. Bug: the Floor Manager must not decide NEEDS_REVIEW scans**

- On the Scans pages (and anywhere else), only the Quality Inspector may resolve a scan the
  camera flagged as NEEDS_REVIEW.
- **This changes a settled rule.** D-011 and the master spec say "QI **or** FM, whoever is
  available" (survey Q5). Don't edit D-011 in place. Add a new decision entry that supersedes its
  review-queue part, and list "FM no longer resolves flagged scans" under STATUS → Open questions
  as a change to confirm with CPoint, because it differs from the survey answer.
  </context>

<design_brief>
These are the recommended defaults. **Validate each one against the code and docs in your plan.**
Push back where the codebase or a decision says otherwise.

**1. Who can request**

- Store a per-user flag on `User` (e.g. `canRequestMaterials Boolean @default(false)`). Only a
  `SHOE_CONSTRUCTOR` can have it; the service refuses it for any other role.
- Permissions stay role-based in `permissions.ts`, with one new check: "can submit a request" =
  `procurement:request` on the role **and** the flag. Put it in one policy helper, used by pages,
  actions and API routes, so it can't drift.
- The guard is checked against the database (D-016). Confirm that turning the flag off takes
  effect on the user's next request without signing them out. Write a test for it.
- **Admin:** a toggle on Users. **FM:** a small "Requesters" panel inside Procurement that lists
  active Shoe Constructors with the toggle. The FM must not get `user:manage`. Both paths go
  through the same service and are audited.
- A constructor who isn't designated still sees Procurement. They get a read-only empty state:
  "Ask your Floor Manager to let you request materials." No dead button and no bare 403.

**2. Data model** (record it in a decision entry; follow D-018: UUIDv7, indexed FKs, `@@map`)

- `PurchaseRequest`
  - code `PR-YYYY-NNNN` from a sequence table, the same as the batch codes
  - `requestedById`, `status`, `priority` (`NORMAL | URGENT`), optional `neededBy`, `justification`
  - decision fields: `decidedById`, `decidedAt`, `rejectionReason`, optional `approvalNote`
  - `createdAt`, `updatedAt`
- `PurchaseRequestLine`: `inventoryItemId` (nullable, for an item not in inventory yet) **or**
  free-text `itemName` + `unit`, then `quantity` (Decimal, the same limits as D-023) and an
  optional `note`. Snapshot the item's on-hand and reorder level at the moment of the request,
  so the FM sees why it was asked for.
- `PurchaseRequestEvent`: the per-request status history, like `BatchStageLog`. It records the
  from/to status, the actor, the time and the note. It's the timeline users see, because
  `AuditLog` is System Admin-only. Still write `recordAudit` on every mutation.
- `PurchaseRequestRemark`: a comment thread (author, body, time). Remarks are never edited or
  deleted, only added.

**3. Lifecycle** (pure state-machine function in `src/lib/` or a service, fully unit-tested)

- `PENDING → APPROVED | REJECTED` by the FM. Rejecting needs a reason of 3+ characters.
- `PENDING → CANCELLED` by the requester only, with an optional note.
- `APPROVED → RECEIVED` by the FM. **Recommended, to close the loop with inventory.** For each
  line linked to an item, it posts an inventory **IN** movement in the same transaction, through
  the existing inventory service (D-023 ledger rules). Lines without an item list "add to
  inventory first". Decide in the plan whether partial receipt is in scope (recommend: not).
  Flag RECEIVED as optional if you think it widens the phase too much.
- Decisions use a conditional update on the current status. A concurrent change returns 409
  `STALE` with the existing message style. A request is never edited after it's submitted:
  cancel and resubmit instead. Say so in the UI.
- Every mutation runs in `runInTransaction` and calls `recordAudit(tx, …)` with the same `tx`.

**4. Access matrix** (add the rows to the master spec table and to `permissions.ts`)

| Action                              | Shoe Constructor (designated) | Shoe Constructor (not) | Floor Manager | Quality Inspector | System Admin |
| ----------------------------------- | ----------------------------- | ---------------------- | ------------- | ----------------- | ------------ |
| See Procurement                     | own requests                  | empty state            | all           | —                 | all, read    |
| Submit / cancel own pending request | ✅                            | —                      | —             | —                 | —            |
| Add a remark                        | on own requests               | —                      | ✅            | —                 | —            |
| Approve / reject / mark received    | —                             | —                      | ✅            | —                 | —            |
| Designate requesters                | —                             | —                      | ✅            | —                 | ✅           |

Constructors don't have `inventory:read`. When they make a request they need a **narrow,
read-only item picker**: active items with name, unit, on hand, reorder level and a low-stock
badge. No movements, no other people's names. Expose it through a procurement service method,
not by granting `inventory:read`.

**5. Views** (follow ui-craft: an intent brief at the top of every page, and every state)

- **`/procurement`, the list:**
  - Tabs by status with counts. Pending is the default for the FM, sorted oldest first with
    URGENT on top.
  - Filters: status, category, item, date range.
  - Compact table: code, items summary, priority, requested by, age, status badge (label plus
    icon, never colour alone).
  - A constructor sees only their own requests.
- **`/procurement/new`:**
  - A form with lines (RHF + Zod; the schema is shared with the API) and the low-stock picker.
  - It can prefill from `?item=<id>`.
  - Warn, without blocking, when the same item already has a PENDING or APPROVED request:
    "PR-2026-0007 already asks for this."
- **`/procurement/[id]`, the detail:**
  - The lines, with the stock snapshot next to the current stock.
  - The timeline from the events, the remarks thread, and the decision panel for the FM.
  - Rejecting opens a confirmation that names the request and requires the reason. Approving is
    one click with an optional note.
- **Elsewhere:**
  - FM overview: a "Pending requests" card with the count and the oldest age.
  - Inventory list: a "Requested" badge on low-stock items that already have an open request,
    plus a "Request" shortcut.
  - Constructor home: replace "coming soon" with "My requests" (open ones plus a "New request"
    button) for designated users. Others see the explainer.
  - System Admin: read-only list. The audit log already covers the rest.
- **Optional, if cheap:** a CSV export of the list (reuse the Reports CSV helper) and a monthly
  count by status and category. **Never** per-person counts, rankings or "requests per
  constructor" (D-008, survey Q16–Q19). Showing the requester's name on a request is fine,
  the same as the log book.
- Nav: a "Procurement" item (new `NavIcon`), visible by permission. Don't give it a `phase`
  flag; it ships linked.
- No email or push notifications. In-app counts only.

**6. API** (document it in `docs/API.md`)
`/api/v1/procurement/requests` (GET list, POST create),
`/api/v1/procurement/requests/[id]` (GET),
`…/[id]/{approve,reject,cancel,receive,remarks}` (POST),
`/api/v1/procurement/requesters/[userId]` (PUT the flag).
Routes are one-liners that call `requireApiPermission`. Errors use the standard
`{ error: { code, message, details? } }` shape.

**7. Seeds**

- Bootstrap: the demo constructor (`constructor@cpoint.local`) is designated when
  `SEED_DEMO_USERS=true`.
- Demo week (D-026): add a few requests through the real services, e.g. one approved and
  received, one rejected with a reason, one pending URGENT for a low-stock item, and one
  cancelled. The CI invariant "stock equals the ledger" must still hold.
  </design_brief>

<bugfix_brief>

- Add a permission for resolving flagged scans, e.g. `scan:review` → `["QUALITY_INSPECTOR"]`.
  `scan:decide` (overrides of automatic PASS/REWORK/REJECT) stays with the FM and the QI unless
  the user answers otherwise in Step 1.
- **Enforce it on the server first.** In `decideScan`, a scan whose status is `PENDING_REVIEW`
  needs `scan:review`, or it fails with 403 FORBIDDEN. The Server Action and
  `POST /api/v1/scans/[id]/decision` both reach that check. A hidden button isn't a fix.
- **UI:**
  - The scan detail decision panel and the review-queue row buttons render only for `scan:review`.
  - The FM sees NEEDS_REVIEW scans read-only with "Waiting for a Quality Inspector".
  - Decide whether the "Review queue" nav item and page move to `scan:review` (recommend: yes),
    and update the FM overview if it links to it.
- Demo seed: flagged scans must be resolved by the QI user only.
- **Tests:**
  - A unit test that the FM is refused on a PENDING_REVIEW scan and the QI is allowed.
  - A unit test that the FM can still override a DECIDED scan.
  - An e2e test: the FM opens a flagged scan, sees no decision controls, and a direct API POST
    returns 403.
  - Update the role smoke and nav tests.
    </bugfix_brief>

<workflow>
**Step 1: Plan (plan mode; stop for approval).** Post a plan with:

- what you read and what you'll reuse;
- the schema diff, the migration name, the new permissions and the matrix;
- the state machine;
- the files you'll add or change, by layer;
- the test list;
- the doc changes.

Then ask me, in one batch with a recommended option each, only the questions that change the
build. At minimum:

1. Is RECEIVED (posting stock IN) in this phase, or a later one?
2. Can the FM still **override** a scan after a QI resolved its review?
3. Should the FM lose the Review queue page entirely, or keep it read-only?
4. Can a request be multi-line, or is it one item per request?

**Step 2: Build** in small Conventional Commits, each at a green checkpoint:

- `fix(scans): …` first and on its own, so it can ship even if procurement slips;
- then `feat(procurement): schema`, then services and tests, then the API, then the UI, then the
  seeds.

After editing the schema, run `npm run db:migrate -- --name <change>`, then `npm run db:generate`.

**Step 3: Gates.**

- Run `npm run check` and `npm run build && npm run test:e2e` with the DB up.
- Run the Docker demo check from the master spec, because the seeds change.
- Run the ui-craft Definition of Done on every touched screen, and the axe smoke on the new pages.
- Paste the real output summaries. If a gate can't run, say so. Never claim it passed.

**Step 4: Docs** (`/wrap-up`):

- Add a **Phase 9 — Procurement & review access** section to `docs/ROADMAP.md` with ticked
  acceptance criteria.
- Update `docs/STATUS.md`: 10 / 10, the test counts, the next step, and the open questions,
  including the survey Q5 change and Q14 (does the FM or the leather-ordering staff member
  approve leather rolls?).
- Add the decision entries: procurement model and lifecycle, requester designation,
  FM-can't-resolve-review (superseding part of D-011).
- Update `docs/API.md`, the README demo script (add a constructor → FM procurement walkthrough)
  and the master spec's roles table.
- Prepend to `docs/SESSION_LOG.md`. Commit and push.

**Step 5: Report** in the master spec's `<final_report_format>`, then stop.
</workflow>

<constraints>
- The CLAUDE.md non-negotiables all apply:
  - MVC layering, with Prisma in `models/` only;
  - `requireRole`/`requirePermission` on every page and `requireApiPermission` on every route;
  - tokens only in the UI, desktop only, no new containers;
  - categories, units and items are data, not hardcoded lists.
- Branch: CLAUDE.md says `system-rebuild`, but `origin` may only have `main` now. Check with
  `git branch -a`. Work on the branch this session gives you, or a new feature branch from the
  current default branch. **Never push to `main`.** Don't open a PR unless asked.
- Don't touch the decision engine thresholds, the CV ingestion contract or component tracking.
- If something in this brief conflicts with a settled decision or the code, say so in the plan
  and propose the smallest change. Don't silently pick one.
  </constraints>
