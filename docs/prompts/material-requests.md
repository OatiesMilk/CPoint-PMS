# Prompt: Phases 11–13 — Material requests, item decisions, ordering and delivery

> **How to use this file.** It holds **three phases**, one per Claude Code session (CLAUDE.md:
> one phase per session). Open Claude Code (Opus) at the repo root, switch to **plan mode**, and say:
> _"Read `docs/prompts/material-requests.md` and run Phase 11. Stop for my approval before writing
> code."_
> Next session, say the same with Phase 12, then Phase 13. Each phase plans, builds, passes the
> gates, wraps up and reports.

---

<role>
You are the senior full-stack engineer who built Phases 0–10. You know the conventions and keep to
them. You're reworking the procurement module after the team's review, plus one system-wide
cleanup of form messages. The bar is unchanged: an industry panel reviews the result. Where
CPoint hasn't decided something, surface it. Never invent a business rule quietly.
</role>

<read_first>
Read these **before you plan**. The plan must cite what it reuses.

1. `CLAUDE.md` (auto-loaded), `AGENTS.md`, `docs/STATUS.md`
2. `docs/prompts/system-rebuild.md`: master spec. Its `<architecture>`, `<ui>`, `<quality_gates>`,
   `<documentation_protocol>` and `<final_report_format>` all still apply.
3. `docs/prompts/procurement.md`: the brief Phase 9 was built from.
4. `docs/DECISIONS.md`, especially:
   - D-008 (no per-person metrics), D-018 (schema), D-019 (concurrency);
   - D-020 (uploads and image checks), D-023 (inventory ledger);
   - D-029 to D-031 (procurement and leather-roll requesters);
   - D-032 (`main` is the base branch, changes go by PR), D-034 (layout).
5. `docs/client-survey.md` Q12–Q15, `docs/ROADMAP.md`, `docs/API.md` → Procurement
6. `DESIGN.md` and `.claude/skills/ui-craft/SKILL.md`, especially the form-UX and error-message
   sections.
7. Code:
   - Procurement:
     - `src/lib/procurement-rules.ts`, `prisma/schema.prisma` (`PurchaseRequest*`)
     - `src/server/{models,services,controllers,validators}/procurement.*`
     - `src/app/(app)/procurement/**`, `src/app/api/v1/procurement/**`
   - Inventory, reused when receiving stock: `src/server/services/inventory.service.ts`
   - Uploads, reused for proof of delivery: `src/server/lib/{storage,image-type}.ts`,
     `src/server/services/scan-ingest.service.ts`, `src/app/api/v1/scans/[id]/image`
   - Forms and errors: `src/server/lib/{errors,action-result}.ts`, `src/server/validators/**`, and
     every form component under `src/app/**`
   - Seeds and tests: `src/server/services/demo-seed.service.ts`, `tests/unit/**`, `tests/e2e/**`
   - Next.js 16 docs in `node_modules/next/dist/docs/` for anything about uploads, Server Actions
     or caching you're not sure of
     </read_first>

<context>
Phase 9 shipped procurement:

- **Flow:** `PENDING → APPROVED → RECEIVED`, plus `REJECTED` and `CANCELLED`.
- **Request:** 1–10 lines with a stock snapshot, a required `justification`, and a manual
  `NORMAL | URGENT` priority.
- **Decisions:** the Floor Manager decides the **whole** request.
- **Receiving:** "Mark received" posts the **full** requested quantity as stock IN.

The team reviewed it and asked for the changes below. **Settled by the team, so don't
re-litigate them:**

1. Inline messages across the system must be specific: say which field is wrong and how to fix it.
2. Drop "Why it's needed". Remarks cover it.
3. The Floor Manager can reject a single item in a request.
4. Constructors only ask for materials, so their side is a **material request**, not procurement.
5. Urgency is automatic from the needed-by date, with three classes: **High / Medium / Low**.
6. An item that's still well stocked can be rejected for that reason, while the low items in the
   same request are approved.
7. The Floor Manager attaches a **proof of delivery (POD)** when receiving.
8. Close these gaps in the procurement process:
   1. **Ordering step:** supplier, reference number and expected delivery date between approval
      and receipt.
   2. **Partial or short deliveries:** record what actually arrived; the rest stays open.
   3. **Cancel after approval:** e.g. the supplier can't deliver.
   4. **Resend a rejected or cancelled request:** "Copy to a new request".
   5. **Floor Manager–initiated restock:** the FM can raise a request without a constructor
      (survey Q14: the production manager orders equipment).
      </context>

<target_lifecycle>
This is the end state after Phase 13. Each phase builds part of it, but design the schema in
Phase 11 so it isn't redone later.

**Request**

```
PENDING ──decide all items──▶ APPROVED (≥ 1 item approved) ──order──▶ ORDERED
   │                         └▶ REJECTED (every item rejected)      │
   └─cancel (requester or FM)▶ CANCELLED ◀──cancel with reason (FM)──┤ (APPROVED or ORDERED,
                                                                     │  nothing received yet)
ORDERED ──receive (some lines short)──▶ PARTIALLY_RECEIVED ──receive rest──▶ RECEIVED
                                        └──close short (FM, reason)──▶ RECEIVED (marked "closed short")
```

**Line**

- Decision: `PENDING → APPROVED | REJECTED`. A rejection needs a reason.
- Receiving: `receivedQuantity` adds up over deliveries and can't exceed the approved quantity.

**Rules**

- The request status is **derived** from its lines, in one pure function in
  `procurement-rules.ts` with unit tests for every combination.
- Every move is a conditional update on the status the caller saw: a concurrent change returns 409
  STALE (D-019).
- Each move writes a `PurchaseRequestEvent`, plus `recordAudit` in the same transaction.
- If a request **can't** move, say why in one sentence, e.g. "Only approved or ordered requests
  can be cancelled. This one is received."
  </target_lifecycle>

<phase_11>

## Phase 11 — Material requests: rename, remarks, automatic urgency, specific messages

**Scope:** points 1, 2, 4 and 5. There are no lifecycle changes yet.

**1. Naming (point 4)**

- In the UI:
  - Constructors see **"Material requests"**: nav item, page titles, buttons ("New material
    request"), empty states, and "My material requests" on the constructor home.
  - The Floor Manager and Admin see **"Procurement"**. It becomes real procurement once Phase 13
    adds ordering.
- Keep the URLs, permission keys and table names as they are, so no data migration is needed.
  The labels change by role. Put the role → label map in one place (navigation and page headers
  read it) so the two can't drift.
- Record the naming in a decision entry.

**2. Remarks replace the justification (point 2)**

- Remove the required "Why it's needed" field.
- The new-request form gets an optional **Remarks** box. If filled in, it's saved as the request's
  first `PurchaseRequestRemark`, in the create transaction.
- **Migration:** copy each existing non-empty `justification` into a first remark by the
  requester, with the request's `createdAt`. Then drop the column.
- Update the demo seed, the API, `docs/API.md` and the tests.

**3. Automatic urgency (point 5)**

- **Needed by** becomes **required**. It must be today or later in Manila time, and at most 180
  days ahead. The error says which rule failed.
- Urgency is **computed at read time, never stored**, in a pure, unit-tested `urgencyFor(neededBy,
today)` in `procurement-rules.ts`. Defaults, to confirm in the plan:

  | Urgency | Needed in            |
  | ------- | -------------------- |
  | High    | 0–3 days, or overdue |
  | Medium  | 4–7 days             |
  | Low     | 8 days or more       |
  - Count **calendar days by Manila date** unless I say working days in Step 1.
  - Put the thresholds in one constant, so they're easy to change after CPoint confirms. Add
    an `ASSUMPTION` comment and an open question in STATUS.
  - The urgency stops counting once a request is closed (received, rejected or cancelled).
    Closed requests show no urgency badge.

- **Migration:** drop the `PurchasePriority` enum and the `priority` column. Existing requests with
  no `neededBy` get `createdAt + 7 days`; note it in the migration and the session log.
- **UI:**
  - an urgency badge with an icon and label (never colour alone), plus the days left ("in 2
    days", "overdue by 1 day");
  - the FM's pending list sorts by urgency, then oldest first;
  - an urgency filter;
  - the FM home card shows how many requests are High.

**4. Specific inline messages, system-wide (point 1)**

- **Audit every form and action:** sign-in, password, batches, stage moves, camera, scan
  decisions, rework, salvage, inventory, material requests, users, settings and tokens.
  - List each generic message you find, such as "Invalid input", "Something went wrong" or a bare
    "Required".
  - Put the list in the plan.
- **The rule:** every message names the field and how to fix it. For example:
  - "Enter a quantity greater than 0."
  - "Quantity can have at most 2 decimal places."
  - "Needed by can't be in the past. Pick today or a later date."
  - "Leather rolls need the Floor Manager's OK. Ask them, or remove this item."
- **Where it lives:**
  - Messages are defined once in the Zod schemas, shared by forms and the API.
  - Server-only refusals (stale, conflict, permission) map to the right field, or to a form-level
    alert that says what to do next, e.g. "Someone else already decided this request. Refresh to
    see the latest."
- **Accessibility:**
  - Each field error sits under its field with `aria-describedby`.
  - On submit, focus moves to the first invalid field.
  - A summary at the top appears only when there are 3 or more errors.
- **Tests:**
  - a unit test over the validators asserting that no message equals a generic string;
  - e2e checks on two or three forms.

**Done when:** constructors see "Material requests" everywhere and the FM/Admin see "Procurement";
remarks have replaced the justification and the data is migrated; urgency is computed, shown,
sorted and filtered; the message audit is fixed and tested; all gates pass.
</phase_11>

<phase_12>

## Phase 12 — Item-level decisions guided by stock

**Scope:** points 3 and 6.

**1. Per-line decisions**

- Add `PurchaseRequestLine.decision` (`PENDING | APPROVED | REJECTED`), `rejectionReason`,
  `decidedById` and `decidedAt`.
- **The decision panel** lists every line, each with **Approve** or **Reject (reason required)**:
  - "Approve all remaining" handles the common case in one click.
  - "Save decisions" applies them in one transaction.
  - The request status is derived from the lines, as in `<target_lifecycle>`.
- **Reject the whole request** stays as a shortcut that rejects every pending line with one reason.
- **Migration:** existing decided requests get their status copied onto their lines. REJECTED
  copies the reason to each line.
- **The requester and the history** show the decision per line: "2 of 3 items approved", with
  each rejected item and its reason. The request timeline gets one event for the decision, listing
  the lines.

**2. Stock guidance (point 6)**

- Next to each line, show the stock **now** and the snapshot from when it was requested, e.g.
  "On hand 40 boxes · reorder at 10 · was 38 when requested".
- **"Still well stocked"** means on hand is more than `WELL_STOCKED_FACTOR × reorderLevel`.
  - The factor defaults to 2, set as one constant marked `ASSUMPTION`.
  - Ask in Step 1 whether it should be an admin setting instead.
- **For a well-stocked line:**
  - show a "Still in stock" badge;
  - pre-select **Reject**, with the reason filled in: "Stock is still high (40 boxes on hand,
    reorder at 10)." The FM can change both.
- **Low or out-of-stock lines** are pre-selected **Approve**.
- **Never auto-decide.** The FM confirms every line. Stock data can be stale, and the constructor
  may know about an upcoming batch.
- Lines with a typed item (not in inventory) have no stock. Show "Not in inventory" and no
  pre-selection.

**3. Tests**

- Unit:
  - the status derivation for all-approved, mixed, all-rejected and a concurrent decision;
  - the well-stocked rule at exactly 2× (not well stocked) and just above it.
- E2E: a constructor requests nails (high stock) and adhesive (low). The FM sees the badge and
  the pre-selection, keeps them, and saves. The constructor sees "1 of 2 items approved", with
  the reason on nails.

**Done when:** the FM decides each line with stock guidance, the status derives correctly, history
and requester views show per-line results, old data is migrated, and all gates pass.
</phase_12>

<phase_13>

## Phase 13 — Ordering, delivery with POD, and the remaining gaps

**Scope:** points 7, 8.1–8.5.

**1. Ordering step (8.1)**

- On an APPROVED request, the FM chooses **Mark as ordered** and enters:
  - the supplier, picked from Settings → Suppliers;
  - an optional order or reference number;
  - the expected delivery date, which is required and today or later;
  - an optional note.
- The request moves to ORDERED.
- **Late deliveries:** ORDERED or PARTIALLY_RECEIVED past the expected date shows **"Delivery
  late"** in the list, on the FM home card and as a filter.
- Supplier and dates go on the request (one order per request). Say in the plan if you think
  per-line orders are needed. Recommend not.

**2. Receiving with partial deliveries and POD (7, 8.2)**

- **Record delivery** opens a form with:
  - for each approved line, the quantity received this time, prefilled with the outstanding
    amount (0 allowed);
  - the delivery date;
  - the POD files: required, at least one;
  - an optional note.
- **Stock:** each received quantity on a line linked to an item posts an inventory IN through the
  existing ledger service, in the same transaction. Typed lines say "Add this item to inventory to
  receive it into stock", and they can still be recorded as received.
- **Status:** outstanding quantity left means PARTIALLY_RECEIVED; none left means RECEIVED. Over
  delivery is refused with "Received quantity can't be more than the 6 rolls still outstanding."
- **Close short:** the FM can close a partly received request with a reason (the rest won't come).
  It's RECEIVED, marked "closed short", and the history shows the shortfall per line.
- **Model:** `PurchaseDelivery` (request, deliveredAt, note, recordedBy) has many
  `PurchaseDeliveryLine` (line, quantity, movementId) and `PurchaseAttachment` (delivery,
  storageKey, mime, size, originalName, uploadedBy).
- **POD files:**
  - Types: JPEG, PNG, WebP or **PDF**, up to 10 MB each and 5 per delivery.
  - Check the type from the file's bytes, never its name. Extend `image-type.ts` (or add a sibling)
    to detect `%PDF-`.
  - Store them through `StorageService` under server-generated keys, as scan images are (D-020).
  - Serve them from an authenticated route with `Cache-Control: private` and
    `Content-Disposition` set safely.
  - Who can see them: the FM, the Admin, and the requester on their own request.
  - A POD is never deleted. A wrong file is fixed by adding the correct one with a remark.
- Ask in Step 1 whether a POD should be **required** (recommended) or optional.

**3. Cancel after approval (8.3)**

- The FM can cancel an APPROVED or ORDERED request **with a reason**, as long as nothing has been
  received yet.
- Once something is received, the only way out is "close short". Explain this when the button is
  disabled.

**4. Copy to a new request (8.4)**

- On a REJECTED or CANCELLED request, the requester (or the FM, for their own) gets **Copy to a
  new request**.
- It opens the new-request form prefilled with the items. Rejected lines are unticked, with their
  reasons shown.
- The new request records `copiedFromId`, and both timelines link to each other.

**5. FM-initiated restock (8.5)**

- The FM can create a request from Procurement → New, or from **Request** on a low-stock inventory
  item.
- It enters as PENDING, and the FM decides it through the same line-decision step. Their own
  approval is allowed and audited as such.
- Mark FM-raised requests "Raised by Floor Manager" in the list. Leather rolls need no extra OK
  for the FM.
- Update `procurement:request` in `permissions.ts` and the master-spec roles table.

**6. Views**

- **Status tabs:** Pending, Approved, Ordered, Partly received, Received, Rejected, Cancelled,
  with counts.
- **The request page timeline** shows each order, delivery (with POD thumbnails or a PDF icon),
  cancellation and copy.
- **FM home card:** pending (with the High count), waiting to be ordered, and late deliveries.

**7. Seeds and tests**

- The demo week covers: one partly received with POD, one late delivery, one cancelled after
  ordering, and one FM-raised.
- Use small generated placeholder images or PDFs for POD, as the scan seed does.
- The CI invariant "stock equals the ledger" must still hold.
- **Unit:**
  - every lifecycle move and refusal;
  - partial-receipt arithmetic, in hundredths, as D-023 does;
  - file sniffing for each allowed type, and refusal of a renamed `.exe`.
- **E2E:** order → partial delivery with POD → close short; and cancel an ordered request.
- Run the axe smoke on every new view.

**Done when:** the full lifecycle in `<target_lifecycle>` works end to end with POD, partial
receipt, late flags, cancel after approval, copy, and FM-raised requests; all gates pass; the docs
are updated.
</phase_13>

<workflow>
For **each** phase:

**Step 1: Plan (plan mode; stop for approval).**

- What you read and what you'll reuse.
- The schema diff and migration names, including how existing rows are migrated.
- The lifecycle and permission changes.
- The files you'll add or change, by layer; the test list; the doc changes.

Then ask, in one batch with a recommended option each, only the questions that change the build.
Ask these in their phase:

- **Phase 11:** calendar or working days for urgency; are the 3/7-day bands right?
- **Phase 12:** is the "well stocked" factor a fixed constant or an admin setting?
- **Phase 13:**
  - Is POD required before receiving?
  - One order per request, or per line?
  - Can the FM approve their own request?

**Step 2: Build** in small Conventional Commits at green checkpoints. Use `fix(forms): …` for the
message sweep, and `feat(procurement): …` / `refactor(procurement): …` for the rest.

- Migrations: `npm run db:migrate -- --name <change>`, then `npm run db:generate`.
- Every mutation runs in `runInTransaction` and calls `recordAudit(tx, …)` with the same `tx`.

**Step 3: Gates.**

- Run `npm run check`, and `npm run build && npm run test:e2e` with the DB up.
- Run the Docker demo-week check, because the seeds change.
- Run the ui-craft Definition of Done on every touched screen.
- Paste the real output summaries. If a gate can't run, say so. Never claim it passed.

**Step 4: Docs** (`/wrap-up`).

- Add a `docs/ROADMAP.md` section for the phase with ticked acceptance criteria.
- Update `docs/STATUS.md`: progress, test counts, next step, and open questions (urgency bands,
  well-stocked factor, who orders leather rolls per survey Q14).
- Add decision entries, starting at **D-035**. Mark each one that supersedes part of D-029 or
  D-031.
- Update `docs/API.md`, the README demo script (procurement walkthrough) and the master spec's
  roles table.
- Prepend to `docs/SESSION_LOG.md`. Commit and push.

**Step 5: Report** in the master spec's `<final_report_format>`. The "Next session" prompt names
the next phase in this file. Then stop.
</workflow>

<constraints>
- The CLAUDE.md non-negotiables all apply:
  - MVC layering, with Prisma in `models/` only;
  - guards on every page and API route;
  - tokens only in the UI, no new containers;
  - categories, units, suppliers and items are data.
- No per-person counts, rankings or "requests per constructor" anywhere (D-008). Showing the
  requester's name on a request is fine.
- **Branch (D-032):** work on a feature branch from the latest `main`. Never push to `main`. The
  team opens and merges the PR.
- Don't touch the decision engine, the CV ingestion contract or component tracking.
- If this brief conflicts with a settled decision or the code, say so in the plan and propose the
  smallest change. Don't silently pick one.
  </constraints>
