# Prompt: Phases 24–31 — What CPoint asked for on the 23 October 2026 factory visit

> **How to use this file.** It holds **eight phases** (Phase 30 in two parts), one per Claude Code
> session (CLAUDE.md: one phase per session). Open Claude Code (Opus) at `C:\dev\CPoint-PMS` with
> the vault added (`claude --add-dir C:\dev\capstone-obsidian`), switch to **plan mode**, and say:
> _"Read `docs/prompts/factory-visit-changes.md` and run Phase 24. Stop for my approval before
> writing code."_
> Next session, say the same with the next phase. Dylan answered the build questions and the
> questions for CPoint on 23 Oct 2026, and the three follow-ups the same evening; the answers are
> rules now (`<confirmed>`, C-19 to C-41). No question for CPoint is open.
>
> This file **replaces Phase 24 of `docs/prompts/production-progression.md`** (materials used,
> worked out from the check-ins). It was never built, and CPoint now counts stock by hand (C-16).

| Phase | What it does                                                                                        | Who sees it             | Needs first                              |
| ----- | --------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------- |
| 24    | Remove Material Requests and Procurement                                                            | FM, Admin, constructors | —                                        |
| 25    | Pass or Reject, and the camera's verdict is final; remove the Review Queue, Repair Station, Salvage | the camera, FM reports  | —                                        |
| 26    | Capture on the constructors' own phones; rolls start and finish there; rolls in Reports             | constructors, FM        | —                                        |
| 27    | Batches are the check-in intervals: lunch break, on-screen notices, failed pairs, no shoe types     | QI, FM, Admin           | —                                        |
| 28    | Each role sees only its modules; demo quick sign-in and reset on the login page                     | everyone                | —                                        |
| 29    | Inventory by stock count, reminders on Wednesdays and Fridays, weekly consumption                   | FM                      | —                                        |
| 30A   | Leather rolls come from Inventory with their areas; picked at Capture; ticked Fully used (D-104)    | FM, constructors, QI    | —                                        |
| 30B   | Can the camera measure a cut in inches? An A4 piece of leather with cuts (`cv/` toolkit only)       | Dylan at the station    | an A4 piece of leather, a ruler, 1 phone |
| 30C   | Large cuts from 3 inches; a roll over 10% defects is marked Return to supplier, the FM decides      | constructors, FM        | 30B's report                             |
| 31    | The documentation and the paper's figures match the system                                          | anyone reading the docs | all of the above                         |

Order (DQ-3): removals first (less code to keep green), then the two new flows (Capture, Batches),
then access, inventory and measuring. **Reordered by Dylan on 2026-10-26:** 30A is now the rolls
in Inventory (each with its own area, D-103: the area is entered, never added up from the shots,
which changes C-33), 30B the measuring check (Part A below, now with one A4 piece of leather
instead of whole rolls) and 30C the app part (Part B below). Plans:
`docs/prompts/plans/phase-30a-plan.md` and `phase-30b-plan.md`.

---

<role>
You are the senior full-stack engineer who built Phases 0–23 and keeps to their conventions. On
23 October 2026 the team visited CPoint's factory, and CPoint narrowed the system: five modules
go, the camera gives two outcomes, a batch becomes the Quality Inspector's check-in interval, a
lunch break pauses it, stock is counted by hand, and a roll with too many defects goes back to the
supplier. Dylan answered the open questions the same day. You turn all of it into working software
one phase at a time. An industry panel reviews the result and CPoint will use it, so you build what
is confirmed (`<confirmed>`), mark everything else as an ASSUMPTION, and never invent a business
rule quietly. You prefer deleting code to hiding it: a removed module leaves no page, route,
permission, table, seed row, test or live doc behind.
</role>

<read_first>
Read these **before you plan**. The plan must cite what it reuses.

1. **The vault first (D-089):** `C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, `Home.md`,
   `Inbox/CPoint commands and where to look.md`, the latest `Daily/` note,
   `Inbox/2026-10-23 CPoint - factory visit.md` (the visit, the questions and Dylan's answers), and
   the phase summary in `Notes/Phases/` once it exists. Read repo files through `C:\dev\CPoint-PMS`,
   never through the vault's junctions.
2. `CLAUDE.md` (auto-loaded with `docs/STATUS.md`) and `AGENTS.md`.
3. **The visit notes: `docs/CPOINT_VISIT_10232026.md`.** C-1 to C-18 come from them, C-19 onward
   from Dylan's answers. When this brief and the notes differ, the notes win and you say so in the
   plan.
4. The newest report in `qa/reports/` (latest date, then highest run). If it lists failures, fix
   them first and say so. (On 2026-10-23 the newest, `2026-10-22-demo-seed-refresh.md` and
   `2026-10-22-phase-23-qa-run2.md`, both PASS.)
5. `docs/prompts/system-rebuild.md`, the master spec. Its `<architecture>`, `<ui>`,
   `<quality_gates>`, `<documentation_protocol>` and `<final_report_format>` still apply except
   where `<project_rules>` below overrides them. Its `<domain_rules>` and `<roles_and_modules>` are
   what these phases change.
6. `docs/prompts/production-progression.md`, Phases 22 and 23 (attendance and check-ins): the
   shape this brief copies and the code Phase 27 reworks.
7. `docs/DECISIONS.md`: the entries in your phase's **Supersedes** line, plus D-008 (no per-person
   metrics), D-017 (bootstrap), D-018 (schema), D-023 (ledger), D-032 (branches), D-034 (layout),
   D-038 (form messages), D-047 (pagination), D-089 (agents). The last entry is **D-090**; new ones
   start at **D-091**.
8. `docs/ROADMAP.md`, `docs/API.md`, `DESIGN.md`, `.claude/skills/ui-craft/SKILL.md` (any UI
   work), `docs/client-survey.md` (Q5, Q10 to Q20).
9. The code under your phase's **Read for this phase**. The Next.js 16 docs in
   `node_modules/next/dist/docs/` for anything about Server Actions, forms, caching or route
   handlers you aren't sure of.

</read_first>

<context>
**Source.** Dylan's notes from the visit, `docs/CPOINT_VISIT_10232026.md`, and his answers of
23 Oct 2026 (C-19 onward).

**In one paragraph.** CPoint drops Material Requests, Procurement, the Review Queue, the Repair
Station and Salvage. The camera at Preparation gives two outcomes, Pass or Reject, and its verdict
is final: nobody corrects it. CPoint can use small cuts, creases and minimal scratches, never cuts of
3 inches or more, holes or stretch marks. Constructors the System Admin allows capture on their own
phones, on a stand at a fixed position, shot after shot until the whole roll is in. A **batch** is
now a stretch of the working day between two check-ins: the Floor Manager sets how often, the System
Admin sets a lunch break that pauses the clock, and the Quality Inspector finishes each batch with
the pairs finished and the pairs that failed inspection, after an on-screen notice 10 minutes before
and at its end. Shoe types go. When defects cover more than 10% of a roll's area, the system marks
the roll **Return to supplier** and the Floor Manager decides. The Floor Manager enters stock counts
by hand any day, with a reminder on Wednesdays and Fridays. Each role sees only its own modules, and
constructors and the QI get phone layouts. For the demo only, the login page gets a quick sign-in
and a reset button.

**Words.** Use them in the UI, code comments and docs.

| Word                 | Means                                                                                                       | In the code today                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Batch                | One check-in interval of a working day, e.g. Batch 2 · 10:00–13:00, lunch 11:00–12:00. The QI finishes it.  | A slot from `slotsFor` plus its `ProductionCheckIn` row (Phase 23). Not `Batch`. |
| Roll                 | One leather roll from a supplier, captured shot by shot until all of it is in.                              | The `Batch` model, codes `B-2026-0001` (D-005, D-082). Phase 26 renames it.      |
| Section              | One shot of part of a roll; one scan. A shot, not a cut piece.                                              | `Scan`                                                                           |
| Pass, Reject         | The camera's two outcomes for a section. Final: nobody changes them (C-21).                                 | `Verdict` (REWORK and NEEDS_REVIEW go in Phase 25)                               |
| Usable, Not accepted | What a found defect of a type means: Usable lets the section pass; Not accepted rejects it.                 | `DefectType.action` (Rework or Reject, D-053)                                    |
| For salvage          | What reports call a rejected section (C-15). It sends no leather anywhere: the roll is judged whole (C-20). | `SalvageItem` (removed in Phase 25)                                              |
| Return to supplier   | The system's finding on a roll whose defects cover more than 10% of its area. The FM decides (C-36).        | Nothing yet (Phase 30B)                                                          |
| Stock count          | The Floor Manager's count of every material, entered any day, reminded on Wednesdays and Fridays.           | ADJUST movements (D-023)                                                         |

Roles: QA or QI = `QUALITY_INSPECTOR`; FM = `FLOOR_MANAGER`; System Admin = `SYSTEM_ADMIN`;
Shoe Constructor = `SHOE_CONSTRUCTOR`.

**The line not to cross (D-008).** Nothing ranks or totals people: no rolls, sections or rejects
per constructor, no batches finished or failed pairs per QI, no late finishes per person, no counts
per FM. Failed pairs are counted per batch and per day, never per person. Who started a roll is
kept only to find "my open roll" and in the audit log; roll pages, claim sheets and reports never
name the constructor (as D-072 does for claim sheets). Who finished a batch or counted stock is
shown on that one row as a log-book fact, never totalled (D-086).
</context>

<confirmed>
Build these as stated. Items marked _(how: ours)_ ask the team to recommend the method; the method
is then an assumption.

**From the visit notes** (`docs/CPOINT_VISIT_10232026.md`)

- **C-1** Remove Material Requests, Procurement, the Review Queue, the Repair Station and Salvage,
  after checking that what depends on them can go too.
- **C-2** "Interval check-in = batch." With work from 8:00 to 5:00 and lunch from 11:00 to 12:00:
  every 4 hours gives Batch 1 8:00–1:00 and Batch 2 1:00–5:00; every 2 hours gives Batch 1
  8:00–10:00, Batch 2 10:00–11:00 plus 12:00–1:00, Batch 3 1:00–3:00, Batch 4 3:00–5:00; end of
  day gives Batch 1 8:00–5:00.
- **C-3** The System Admin sets the lunch break (start and end, e.g. 11:00–12:00). The check-in
  pauses when it falls inside the lunch break.
- **C-4** Batches are determined by the intervals.
- **C-5** The QI finishes the batches (the interval check-in).
- **C-6** The FM sets the check-in time. QIs are notified in the system 10 minutes before and at
  the check-in time exactly (e.g. at 4:50 and 5:00 for an end-of-day check-in).
- **C-7** The QI's submission to finish a batch changes the batch's status _(how: ours)_.
- **C-8** No shoe types in the system: a leather roll isn't used for one shoe type only.
- **C-9** A roll whose defects are **more than 10%** of the roll goes back to the supplier
  _(how: ours, e.g. from the roll's total size and a formula)_.
- **C-10** Check whether the camera can cover a whole roll in several captures, adding up its size
  _(how: ours)_.
- **C-11** CPoint can make use of **small cuts** and **creases**.
- **C-12** CPoint can't use or doesn't accept **large cuts**, **holes** and **stretch marks**.
- **C-13** No "for repair" status for leather: CPoint's repair station only handles finished shoes.
  The camera has two outcomes, **Pass** or **Reject**.
- **C-14** No Review Queue: the QI inspects finished shoes, not raw leather.
- **C-15** No Salvage module: each scan's "for salvage" is reported, for reports and analytics only.
- **C-16** Inventory: the FM edits and enters the quantities of all materials by hand. CPoint counts
  inventory at the end of every week or twice a week _(how: ours; reports tied to it, e.g. weekly
  consumption)_.
- **C-17** For the demo only: a quick sign-in and a reset seed data button on the login page.
- **C-18** What each role sees, strictly: Shoe Constructor: **Capture**, with a phone layout.
  Quality Inspector: **Batches** only (notified every interval to check in and finish batches),
  with a phone layout. Floor Manager: **Batch, Attendance, Reports, Inventory**. System Admin:
  **administration modules** only.

**From Dylan's answers to the questions for CPoint** (23 Oct 2026, the vault's visit note)

- **C-19 (Q-1)** Scratches are Usable, minimal ones only; a scratch has no length limit (C-39).
- **C-20 (Q-2)** A rejected section doesn't by itself send leather to salvage. The roll is judged
  as a whole: when defects cover more than 10% of the whole roll, the whole roll is marked
  **Return to supplier**.
- **C-21 (Q-3)** Nobody corrects the camera: its verdict is taken as correct and final.
- **C-22 (Q-4)** The model will be fine-tuned later (stretch marks among the new classes). Until
  then stretch marks aren't detected.
- **C-23 (Q-5)** Shoe Constructors capture on their own phones, only those the System Admin grants
  access.
- **C-24 (Q-6)** The phone sits at a fixed position (a stand).
- **C-25 (Q-7)** The lunch break is the same on every working day, Saturday too.
- **C-26 (Q-8)** A batch whose time runs into the lunch break carries on after it. A batch whose
  working time runs out exactly when lunch starts doesn't end there: it ends when lunch ends.
- **C-27 (Q-9)** Finishing a batch records the pairs finished and the pairs that failed inspection,
  and the reports show both.
- **C-28 (Q-10)** The QI may finish a batch early, once the 10-minute notice has come.
- **C-29 (Q-11)** On a day no QI is in, the FM finishes the batches (D-088 stays).
- **C-30 (Q-12)** A daily quota stays, as one number of pairs for the whole line.
- **C-31 (Q-13)** A notice on the screen is enough for now: no alert to a closed app, no sound.
- **C-32 (Q-14)** The FM enters inventory changes any time of the week; the system reminds the FM
  every Wednesday and Friday.
- **C-33 (Q-15)** Roll sizes vary, so the camera takes several shots until the whole roll is
  captured, and the roll's total size comes from those shots, if the model can measure it (30A).
- **C-34 (Q-16)** The whole roll is checked before any of it is cut.
- **C-35 (Q-17)** "More than 10%" is the share of the roll's area covered by defects, and every
  defect counts, small cuts and creases included.
- **C-36 (Q-18)** The FM decides whether a roll goes back; the system shows its findings on the
  roll to guide the decision.
- **C-37 (Q-19)** A cut **3 inches or longer** is large (Not accepted); a shorter one is small
  (Usable).
- **C-38 (Q-20)** Every Shoe Constructor gets an account, set up by the System Admin.
- **C-39 (F-1)** A scratch has no length limit: a found scratch is Usable whatever its length.
- **C-40 (F-2)** Lunch is the only break that pauses a batch.
- **C-41 (F-3)** The daily quota counts only the pairs that passed inspection.

**Dylan's build decisions** (23 Oct 2026)

- **DQ-1** Rename the leather-roll `Batch` to `Roll` in code: **yes** (Phase 26).
- **DQ-2** Convert old demo and test data and drop what no longer exists: **yes** (back up, then
  `demo:reset`).
- **DQ-3** The order as proposed, removals first.
- **DQ-4** Notices in the open app only (C-31 agrees).
- **DQ-5** Settled by C-21: no corrections at all, so the Floor Manager's "Correct the verdict" goes
  too.
- **DQ-6** Redraw the paper's figures in Phase 31: **yes**.
- **DQ-7** New databases start with the model's four classes and CPoint's outcomes: **yes**. The
  model may be fine-tuned later; its new classes come in through Settings → Unknown classes.

</confirmed>

<review>
The visit against the system as it stands after Phase 23 and D-090.

| Visit      | The system today                                                                                                           | Change                                                                                                      | Phase  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| C-1        | Material requests and procurement (D-029 to D-046): requests, item decisions, orders, deliveries with proof, FM restock    | Removed end to end. Suppliers and inventory stay                                                            | 24     |
| C-14       | Unknown classes go to NEEDS_REVIEW and wait for the QI (D-020, D-028); `/review`; the QI home counts them                  | Removed. An unknown class rejects the section and shows in Settings (A-12)                                  | 25     |
| C-21       | The FM and the QI can override a verdict (`scan:decide`); Quality shows AI agreement                                       | Removed. The camera's verdict is final                                                                      | 25     |
| C-13       | REWORK reads **Fixable**; the Repair Station board (D-070, D-073); "In repair" tags; Operations repair section             | Removed. Pass or Reject only                                                                                | 25     |
| C-15, C-20 | A `SalvageItem` per Reject, assigned to a later batch or discarded (D-021)                                                 | Removed. Rejected sections are counted "for salvage" in reports (A-11)                                      | 25     |
| C-11, C-12 | Per type "When found" Rework or Reject (D-053), otherwise two confidence thresholds (D-011)                                | Each type Usable or Not accepted; cuts from 3 in Not accepted (30B); stretch marks after fine-tuning        | 25, 30 |
| C-2, C-4   | "Batch" means a roll (D-005, D-082); check-ins are slots on the Production page (D-083)                                    | "Batch" means the interval; the roll is a "Roll", in the UI and the code                                    | 26, 27 |
| C-3, C-26  | No lunch; slots every interval from the shift start: 12:00, 16:00, 17:00 (D-083)                                           | Lunch doesn't count as working time: 13:00 and 17:00 for every 4 hours                                      | 27     |
| C-2        | Every 1 to 4 hours                                                                                                         | Adds once at the end of the day                                                                             | 27     |
| C-5, C-27  | The QI enters pairs per shoe type; Due, Late after 30 minutes, Entered, Missed (D-084); the FM covers with no QI (D-088)   | "Finish batch" records pairs finished and failed; statuses worked out from the clock (A-5)                  | 27     |
| C-6, C-31  | "No notifications" (D-084); the due check-in shows on the QI home                                                          | On-screen notices 10 minutes before and at the end                                                          | 27     |
| C-8        | Shoe types on rolls, counts and quotas (D-085)                                                                             | Removed: one count per batch, one daily quota                                                               | 26, 27 |
| C-9, C-10  | Supplier quality by sections and claim sheets (D-072); no areas, no calibration                                            | Roll area and defect area from the shots; over 10% marked Return to supplier; the FM decides                | 30     |
| C-16, C-32 | A ledger with IN, OUT and ADJUST per item (D-023); receipts from procurement; the Phase 24 brief would deduct use per pair | A count sheet (ADJUST), receipts (IN), Wednesday and Friday reminders, weekly use; Phase 24's brief dropped | 29     |
| C-17       | `npm run demo:reset` on the command line only (D-056)                                                                      | Flag-gated buttons on the login page                                                                        | 28     |
| C-18, C-23 | Constructors: Material requests, Capture if the FM or Admin allows (D-075). Desktop first, no phone design (D-034)         | Capture only, for those the System Admin allows, on their own phones, phone layout                          | 26     |
| C-18       | QI: Production, Batches, Camera, Capture, Scans, Review queue, Repair Station, Salvage, Reports (Quality)                  | Batches only, phone layout                                                                                  | 27, 28 |
| C-18       | FM: also Camera, Capture, Scans, Review (view), Repair Station, Salvage, Procurement, Production                           | Batches, Attendance, Reports, Inventory (and the Overview home)                                             | 28     |
| C-18       | Admin: also reads Attendance, Inventory, Production, Batches, Scans, Camera, Procurement                                   | Users, Settings, API tokens, Audit log, camera status                                                       | 28     |

**What the answers leave to the build (and this brief handles):**

1. **Stretch marks aren't a class of the model.** `yolo-v1` knows `crease`, `cut`, `hole` and
   `scratch` (`cv/MODEL_CARD.md`). Until it is fine-tuned (C-22), a stretch mark isn't caught. A
   new class from a fine-tuned model arrives as an unknown key: the section is rejected and the key
   is listed for the Admin to set up (A-12). `cv/MODEL_CARD.md` says so.
2. **"Small" and "large" cuts are one class.** Telling them apart needs a length, so each phone's
   view must be calibrated (30A, 30B). Until then a cut is Not accepted (A-13); then 3 inches is the
   line (C-37).
3. **The model is early** (precision 0.62, recall 0.69, outline mAP50-95 0.32) and its verdict is
   final (C-21). The 10% figure is therefore the system's finding, and the FM decides (C-36).
4. **Own phones differ** (C-23): each one sees a different width at the same height, so each phone
   is calibrated once on its stand (A-18).
5. **"Batch" changes meaning**, hence the rename (DQ-1).
6. **A section is now a shot of the roll, not a cut piece** (C-33), so D-082's "All 10 pieces
   scanned. Finish this roll?" hint goes; the constructor finishes when the whole roll is in.
7. **Failed pairs and the quota** (C-27): the quota counts the pairs that passed (C-41), so the
   pace and the shortfall sentence do too.
8. **The master spec, the README, `docs/STATION_SETUP.md` and the paper's figures still describe the
   removed modules** (Phase 31, DQ-6).
9. **A reset button on a sign-in page is destructive**, so it lives behind a flag that is off by
   default, with a banner while it's on (A-23).
10. **Nothing reaches a closed app** (C-31): the QI keeps Batches open on the phone. The notices
    are worked out in the browser, with no scheduler or push service.

</review>

<removal_impact>
What each removal touches, so the plan can prove it is safe (C-1). File counts are from a search of
`src`, `tests` and `scripts` on 2026-10-23; the plan lists every file again.

**Material Requests and Procurement (Phase 24, about 72 files)**

- Tables: `purchase_request_sequences`, `purchase_requests`, `purchase_request_lines`,
  `purchase_request_events`, `purchase_deliveries`, `purchase_delivery_lines`,
  `purchase_attachments`, `purchase_request_remarks`; enums `PurchaseRequestStatus`,
  `PurchaseLineDecision`; column `users.canRequestLeatherRolls`.
- Code: `src/app/(app)/procurement/**`, 16 routes under `src/app/api/v1/procurement/**`,
  `procurement.{controller,service,model,validator}.ts`, `src/lib/procurement-rules.ts` (urgency
  bands, `requestLabelsFor`), `src/server/lib/attachment-type.ts` (proof files only),
  `src/components/features/procurement/*`.
- Linked from: the FM home (`PendingRequestsCard`), the constructor home (my requests), Inventory
  ("Requested" badge and "Request", `openRequestCodes`, `listRequestableItems`), Users (the
  leather-roll switch), the session (`canRequestLeatherRolls` in `auth.service.ts`), the sidebar
  label map, the Operations report (the purchasing section; the attention items `requests-high`,
  `requests-old` and `requests-late`; "Raise a purchase request" on the low-stock item; the "Open
  request" column of `stock.csv`), bootstrap (the demo constructor's flag), the demo week (nine
  requests and proof files), `demo-reset` (requests, proof files under `UPLOADS_DIR`), five
  `procurement:*` permissions, tests (unit and `procurement.spec.ts`).
- Stays: suppliers (rolls and supplier quality use them; `/api/v1/suppliers` stays,
  `/api/v1/procurement/suppliers` goes), inventory items and movements (old "Received for MR-…" IN
  movements keep their reason text), low-stock alerts.

**Review Queue (Phase 25, about 38 files)**

- `NEEDS_REVIEW` (an unknown class key, D-020), `PENDING_REVIEW`, `scan:review` (D-028), `/review`,
  the QI home's flagged count, the Floor view's blue "Needs review", the blue bin in
  `docs/STATION_SETUP.md`, "pending review" in reports, the demo week's two flagged scans.
- Stays: Settings → Unknown classes (the Admin still adds new model classes); detections keep
  `rawClassKey` and `isUnknownClass`.

**Verdict corrections (Phase 25, C-21)**

- `scan:decide`, `POST /api/v1/scans/{id}/decision`, `scan-decision.service.ts` and
  `scan-decision.test.ts` (it also decides flagged scans, so nothing is left for it), the override
  form on a section's page and its audit action, the AI agreement figure on Reports → Quality, the
  override fields on `scans` (the plan lists them). `aiVerdict` and `finalVerdict` stay as columns,
  equal from now on, unless the plan shows that merging them is simpler.

**Repair Station (Phase 25, about 103 files mention rework or Fixable)**

- `REWORK` ("Fixable"), `rework_tickets`, `/rework`, `rework:manage`, `DefectHandling` (Clean or
  Cut around, D-070), the FM home's Open repairs card, "In repair" badges, "passed + repaired" on
  roll pages, the Operations repair section and `/api/v1/reports/repairs`, Fixable % columns and
  chart series, the Floor view's orange, the Python preview's REWORK, the colour and chart tokens
  for Fixable.

**Salvage (Phase 25, about 42 files)**

- `salvage_items`, `/salvage`, `salvage:read`, `salvage:manage`, assign or discard (D-021),
  "Salvage reused here" on roll pages, the demo week's salvage moves.
- Becomes: "for salvage" = a rejected section, counted in reports (A-11).

**Shoe types (Phases 26 and 27, about 63 files)**

- `shoe_types`, Settings → Shoe types, `/api/v1/shoe-types`, `batches.shoeTypeId`,
  `daily_quotas.shoeTypeId`, `production_counts`, the per-type fields of the check-in form, the
  per-type columns of the Production page, reports and `production.csv`.
- Becomes: one pairs count (and one failed count) per batch and one daily quota for the whole line.

</removal_impact>

<assumptions>
What the brief still picks itself, where neither the visit nor Dylan's answers settle it. Each
becomes a STATUS open question and, once built, part of a DECISIONS entry. **Confirm or change them
in Step 1 of their phase.** Items now confirmed keep their number and say so.

- **A-1 (26)** Confirmed: the roll is a **Roll** in the UI and in code (DQ-1): `model Roll` with
  `@@map("batches")`, so no table is renamed. ASSUMPTION: new roll codes read `R-YYYY-NNNN`; old
  ones keep `B-`.
- **A-2 (27)** A batch's length is working time: lunch doesn't count. A batch ends where its working
  time reaches the interval; a batch whose working time runs out exactly when lunch starts ends when
  lunch ends (C-26). ASSUMPTION: the last batch ends at the shift end, even if shorter.
- **A-3 (27)** How often: every 1, 2, 3 or 4 hours (as now) or once at the end of the day. The
  default stays every 4 hours (D-083), so with the default lunch the batches end at 13:00 and 17:00.
- **A-4 (27)** Confirmed: one lunch break a day and no other break (C-40), the same on every
  working day, Saturday too (C-25), set by the System Admin (C-3); the interval stays the FM's
  (C-6). ASSUMPTION: it is optional and inside the shift, the default is 11:00–12:00 (the visit's
  example), and a change applies from tomorrow, like the schedule (D-083). The pure rule takes a
  list of breaks (only lunch for now), so adding one later needs no rework.
- **A-5 (27)** A batch's status is worked out from the clock and its record, never stored:
  **Upcoming**, **In progress** (reads "Paused for lunch" during lunch), **Due** at its end,
  **Late** 30 minutes after (D-084), then **Finished**, or **Missed** at midnight. A corrected batch
  stays Finished with a "Corrected" tag. It can be finished from 10 minutes before its end (C-28)
  until midnight. Why derived: a stored status needs a job to flip it on time, and there is no job
  runner in the two-container setup (D-003); a derived one is always right. The notices go by the
  clock, so for a batch that ends at 12:00 after lunch the first one comes at 11:50.
- **A-6 (27)** Confirmed: finishing a batch records **Pairs finished** and **Of these, failed
  inspection** (0 up to the pairs finished), with optional notes (C-27); the quota, the pace and the
  shortfall sentence count the pairs that passed, finished − failed (C-41). ASSUMPTION: pairs
  finished run from 0 to 2,000 (as Phase 23's counts); reports show finished, failed and the failed
  share. Same-day correction with a reason stays (D-084).
- **A-7 (27)** Confirmed (C-29): the FM finishes the batches on a day attendance shows no QI present
  (D-088).
- **A-8 (27)** Confirmed (C-30): one daily quota for the whole line, with the same suggestion
  (D-085), worked out from passed pairs (C-41).
- **A-9 (27)** Confirmed (C-31, DQ-4): at 10 minutes before and at each batch's end, a notice on
  whatever page is open, a bell listing due and late batches, and the tab title starting with "(1)".
  No browser notification, push or sound.
- **A-10 (all)** Confirmed (DQ-2): no real CPoint data exists yet. Migrations convert what they can,
  so `npm run db:deploy` works on the dev database and in CI (Fixable becomes Pass, Needs review
  becomes Reject, per-type counts and quotas are summed), and drop what no longer exists. Dylan backs
  up and runs `npm run demo:reset -- --yes` after each phase for a fresh demo week.
- **A-11 (25)** "For salvage" is what reports call a rejected section (C-15); it moves no leather
  (C-20). ASSUMPTION: reports count rejected sections (and their defect area once Phase 30B measures
  it) per day, roll, supplier and defect type. No workflow.
- **A-12 (25)** A class key the system doesn't know counts as **Not accepted**: the section is
  rejected, the key is listed in Settings → Unknown classes, and the Admin home says so until the
  Admin sets the type up. With no review queue and no corrections, nobody else would ever see it.
  This is also how a fine-tuned model's new classes arrive (C-22).
- **A-13 (25)** Outcomes for the model's classes (data, in Settings): crease **Usable** (C-11),
  scratch **Usable** at any length (C-19, C-39), hole **Not accepted** (C-12), cut **Not accepted** until Phase 30B
  measures length, then Not accepted from 3 inches and Usable below (C-37). "A defect counts as found
  at" (50%, D-053) stays; D-011's two thresholds go.
- **A-14 (25)** Withdrawn: nobody corrects a verdict (C-21, DQ-5).
- **A-15 (26)** Confirmed (C-23): only constructors the System Admin allows capture
  (`User.canCapture`, D-075, set in Users only). The FM's Camera → Camera operators panel goes. The QI
  and the FM no longer capture (C-18).
- **A-16 (26)** The constructor starts a roll on Capture (supplier required, roll code optional),
  captures it shot by shot and finishes it. One open roll per constructor; their captures go to it.
  The FM can finish or cancel any open roll from Reports, for a roll left open. The simulator's
  device token feeds the oldest open roll (D-020's fallback).
- **A-17 (26)** Rolls have no stages: `Stage`, `currentStage`, `BatchStageLog`, `targetQuotaPairs`,
  `cv_settings.activeBatchId` and the shoe type on a roll go. The received date becomes optional.
  D-082's "All 10 pieces scanned" hint goes (C-33).
- **A-18 (30)** Measuring a roll: each phone sits at a fixed position (C-24) and is calibrated once
  on its stand ("This phone sees __ in across the table", remembered per browser and saved with
  every scan), because the constructors' own phones differ (C-23). A roll's area is the sum of its
  shots' leather area (C-33); its defect area is the union of the defect outlines (masks), or boxes if
  outlines prove no better; share = defect area ÷ roll area, and every found defect counts (C-35).
  **More than** the limit (10%, C-9) and the system marks the roll **Return to supplier** (C-20); the
  constructor sees it at Finish roll; the FM decides **Returned to supplier** or **Keep**, with a note
  (C-36), and may also return a roll under the limit. The constructor captures edge to edge; 30A
  measures what overlap between shots costs.
- **A-19 (30B)** Confirmed (C-35): every found defect counts toward the 10%; no per-type switch.
- **A-20 (30B)** Length limits are data (Settings → Defect types → "Not accepted from __ in
  long"): cut 3 in (C-37); none for scratch (C-39). ASSUMPTION: lengths show in inches
  (C-37's unit) and are stored in centimetres; areas show in square feet (leather's trade unit).
  Length is the box's diagonal (a cut is thin) or the outline's longest span, whichever 30A finds
  closer to a ruler.
- **A-21 (29)** Inventory: a **Count stock** sheet records the counted quantity of every item in one
  save, as ADJUST movements (D-023), on any day (C-32); deliveries are recorded any time, on the
  sheet ("Received since last count") or the item page, as IN. The FM home reminds on Wednesdays and
  Fridays (C-32; a setting with that default). The item page's **Use stock** (OUT) goes. Used =
  previous count + received − this count.
- **A-22 (29)** Phase 24 of `production-progression.md` (materials per pair, automatic use from
  check-ins) is dropped. Starting a roll no longer takes a roll item out of stock (D-023's option);
  rolls are counted like everything else.
- **A-23 (28)** The demo tools exist only when `DEMO_LOGIN_TOOLS=true` (default off, never for real
  use) and `SEED_DEMO_USERS=true`. "Sign in as …" uses the demo password on the server. "Reset demo
  data" runs the same reset as `npm run demo:reset -- --yes` (also in a production build while the
  flag is on, which D-056 otherwise refuses), after typing RESET, one at a time. Every page shows a
  "Demo mode" band while the flag is on.
- **A-24 (26, 27)** Phone layouts for the constructor's Capture and the QI's Batches only, from
  360 px wide. Everything else stays desktop first (D-034). Touch targets at least 44 px, inputs at
  16 px (no zoom on iPhone), one primary action at the bottom above the safe area.
- **A-25 (28)** The Admin keeps Users (with the "May capture" switch, C-23), Settings (defect types,
  the found-at value, suppliers, the lunch break, later the supplier limit and the length limits),
  API tokens, Audit log and the camera status (today's Camera page). No read-only views of
  production, attendance or inventory.
- **A-26 (28)** The FM's Reports keep Operations and Quality and gain Rolls. A section's page is
  reached from its roll; the Scans list and the Latest scans widget go. The QI loses Reports.

</assumptions>

<decisions_to_record>
Write these as new DECISIONS entries in the phase that builds them, taking the next free number
(D-091 onward). Each names what it supersedes, so old entries are never edited. Cite the visit
notes or "Dylan, 23 Oct 2026" as the source.

| Phase | Entry                                                                                                    | Supersedes or amends                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 24    | Material requests and procurement are removed                                                            | D-029 to D-031, D-035 to D-046; D-023's delivery link                                              |
| 25    | The camera gives Pass or Reject and its verdict is final; each defect type is Usable or Not accepted     | D-011's thresholds, D-053's Rework action, D-020's unknown → review, the override (`scan:decide`)  |
| 25    | No Review Queue, Repair Station or Salvage; rejected sections are counted "for salvage"                  | D-007, D-021, D-022, D-028, D-070, D-073, D-074's four colours                                     |
| 25    | New databases start with the model's four classes and CPoint's outcomes                                  | D-052's "bootstrap unchanged"                                                                      |
| 26    | A roll starts and finishes at Capture; allowed constructors capture on their own phones; it's a Roll     | D-005 (name), D-019 (codes), D-020 and D-067 (targeting), D-066, D-082, D-023 option; amends D-075 |
| 26    | Phone layouts for Capture and Batches                                                                    | D-008's "desktop only", D-034 for those pages, CLAUDE.md's "no phone design"                       |
| 27    | A batch is a check-in interval; lunch pauses it and a batch running into lunch carries on after it       | D-083's slot times, the batch meaning of D-082                                                     |
| 27    | Batch statuses are worked out; the QI finishes a batch with pairs finished and failed; on-screen notices | D-084's opening time and "no notifications"                                                        |
| 27    | No shoe types                                                                                            | D-085's per-type quota, D-087's per-type production, shoe types in D-024                           |
| 28    | Each role sees only its modules                                                                          | the master spec's roles table; D-023, D-079 (Admin reads), D-033 (QI report)                       |
| 28    | Demo-only sign-in and reset on the login page, behind a flag                                             | D-056 (reset in production builds); the guard rule for those two endpoints                         |
| 29    | Inventory by stock count, reminders on Wednesdays and Fridays; use worked out from counts                | D-023 (normal path); Phase 24 of `production-progression.md`; D-033 cover                          |
| 30A   | How a roll and its defects are measured (from the check's report)                                        | —                                                                                                  |
| 30B   | Cuts from 3 inches are Not accepted; a roll over 10% is marked Return to supplier and the FM decides     | D-072 (claim sheet content)                                                                        |
| 31    | The master spec describes the current system; history lives in DECISIONS                                 | —                                                                                                  |

</decisions_to_record>

<phase_24>

## Phase 24 — Remove Material Requests and Procurement

**Goal:** the module is gone end to end; inventory, suppliers, the homes and the reports still work.
**Covers:** C-1, part of C-18. **Supersedes:** D-029 to D-031, D-035 to D-046 (their procurement
parts), D-023's link from deliveries to movements, the procurement rows of the master spec.

**Read for this phase:** `<removal_impact>` → Procurement; `src/server/policies/{permissions,
navigation}.ts`; `src/app/(app)/{floor-manager,constructor,inventory}/page.tsx`;
`src/app/(app)/admin/users/**`; `src/server/services/{ops-report,bootstrap,demo-seed,demo-reset,
auth,user-admin,inventory}.service.ts`; `src/server/models/{demo-reset,inventory,user,
ops-report}.model.ts`; `src/lib/ops-rules.ts`; `prisma/schema.prisma` (the procurement block and
its relations on `User`, `Supplier`, `InventoryItem`, `InventoryMovement`).

**1. Find every caller first.** List each file that imports a procurement module or reads a
purchase table, and what replaces the call (usually nothing). The plan shows the list.

**2. Data (migration `drop_procurement`).** Drop the eight `purchase_*` tables, both enums,
`users.canRequestLeatherRolls` and the relations. Stock movements stay; their reason text keeps
the history. Files on disk: the migration doesn't touch them; `demo:reset` already clears
`UPLOADS_DIR` (say so in the handoff).

**3. Removed:** the pages, the 16 routes, the controller, service, model and validator,
`procurement-rules.ts`, `attachment-type.ts`, the feature components, the leather-roll switch
(Users → More actions, the requesters tab, `canRequestLeatherRollsFor`, the session field), the
five permissions, the nav item and the label map.

**4. Changed:**

- FM home: no Pending requests card.
- Constructor home, until Phase 26 replaces it: a Capture card for an allowed constructor, or one
  sentence ("Your work in the system is at the camera. Ask the System Admin for camera access.").
- Inventory: no Requested badge or Request button.
- Operations report: no purchasing section and no request attention items; the low-stock item
  no longer says "Raise a purchase request"; `stock.csv` loses "Open request".
- Bootstrap, demo week and `demo:reset`: no requests and no leather-roll flag.

**5. Tests.** Delete the `procurement-rules`, `procurement.service` and `attachment-type` unit
tests and `tests/e2e/procurement.spec.ts`. Update `permissions.test.ts`,
`validator-messages.test.ts`, `ops-report.service.test.ts`, `demo-seed.test.ts`,
`demo-reset.test.ts`, `bootstrap.service.test.ts`, and the e2e specs that assert procurement
(`auth.spec.ts` nav lists, `inventory.spec.ts`, `smoke.spec.ts`, `reports.spec.ts`).

**6. Removal check** (paste the output). It finds nothing (migrations aren't searched):

```sh
rg -n -i "procure|purchase|material request|requestLabelsFor|canRequestLeatherRolls|MR-" src tests scripts prisma/schema.prisma
```

**7. Docs.** `docs/API.md` loses Procurement; the README demo script; the master spec's roles
table; ROADMAP marks Phases 9 and 11 to 13 "removed in Phase 24"; STATUS closes the procurement
open questions (D-037, D-040, D-041, D-042, D-045, survey Q14) as "module removed".

**Ask in Step 1:** nothing expected. If the plan finds procurement data used anywhere else, ask
with a recommendation.

**Done when:** no page, route, nav item, permission, table, seed row or test mentions procurement
or material requests (check 6 is clean); Inventory, supplier quality, the FM home and the Operations
report work; a constructor signs in to a working page; `npm run check` passes.

**Codex QA focus:** every role's nav; `/procurement` and its API answer 404; Inventory, the FM home
and Operations without purchasing; `demo:reset` and the demo week on a throwaway stack.
</phase_24>

<phase_25>

## Phase 25 — Pass or Reject: a final verdict, no Review Queue, Repair Station or Salvage

**Goal:** every section is Pass or Reject, from each defect type's Usable or Not accepted
outcome, and nobody can change it; the Review Queue, the Repair Station and Salvage are gone;
rejected sections are reported "for salvage".
**Covers:** C-1, C-11 to C-15, C-19 to C-22, DQ-5, DQ-7. **Supersedes:** D-007, D-011's thresholds,
D-020's unknown-class rule, D-021, D-022, D-028, D-053's Rework action, D-070, D-073, D-074's four
colours, the verdict override (`scan:decide`), and D-052's "bootstrap unchanged". Amends D-025,
D-033 and D-072 (no Fixable %, no AI agreement).

**Read for this phase:** `src/lib/{decision-engine,outcome-rules,capture-rules,report-rules,
ops-rules,domain}.ts`; `src/server/services/{scan-ingest,scan-decision,scan-query,rework,salvage,
settings,report,ops-report,batch,demo-seed,demo-reset,bootstrap}.service.ts`;
`src/server/models/{scan,outcome,report,ops-report,batch}.model.ts`;
`src/server/lib/{leather-scan.ts,cv/mapper.ts}`; `src/app/(app)/{review,rework,salvage,scans,
quality-inspector,floor-manager,batches/[id],camera/capture,admin/settings}/**`;
`src/app/api/v1/scans/[id]/decision/route.ts`;
`src/components/features/{verdict-badge.tsx,charts/*,rework/*,batches/in-repair-badge.tsx}`,
`src/components/ui/badge.tsx`, `src/styles/tokens.css`; `cv/cpoint_cv` (the preview verdict),
`cv/README.md`, `cv/MODEL_CARD.md`; `docs/STATION_SETUP.md`.

**1. Rules (pure, unit-tested, `decision-engine.ts`).**

- A detection of an active, known type at or above "counts as found at" gives its type's outcome.
  Any **Not accepted** → **Reject**; otherwise **Pass**. Below found-at it counts for nothing.
  Inactive types are ignored. An unknown key → **Reject** (A-12), with `unknownKeys` kept for
  Settings.
- The snapshot stores `foundAtOrAbove` and the outcomes in force; `readSnapshot` still reads old
  scans.
- The Python preview in `cpoint_cv` gives the same verdict for the same detections (as D-053
  required), and `evaluate`'s labels use Pass and Reject.
- Tests: no detections; 0.4999 and 0.50; Usable plus Not accepted (Reject); only Usable (Pass); an
  inactive Not accepted type ignored; an unknown key alone and beside a Usable one; several types;
  an old snapshot read back.

**2. Data (migration `pass_or_reject`).**

- Convert rows first (A-10): REWORK → PASS; NEEDS_REVIEW → REJECT (a pending one becomes decided).
  Then `Verdict` is PASS or REJECT. Drop `ScanStatus` and `PENDING_REVIEW` if nothing still needs
  them (the plan says which). Drop the override fields (C-21); `aiVerdict` and `finalVerdict` stay
  equal from now on unless merging them is simpler (`<removal_impact>`).
- `DefectType.action` → `outcome` (`USABLE` or `NOT_ACCEPTED`, required): Rework → Usable, Reject →
  Not accepted, none → Not accepted (ASSUMPTION; the Admin can change it). Drop `handling` and
  `DefectHandling`.
- `CvSettings`: drop `rejectAtOrAbove` and `reworkAtOrAbove`; keep `foundAtOrAbove` and
  `earlyModelNotice` (`activeBatchId` goes in Phase 26).
- Drop `rework_tickets`, `salvage_items`, `ReworkStatus` and `SalvageStatus`.

**3. Access.** Remove `scan:review`, `scan:decide`, `rework:manage`, `salvage:read` and
`salvage:manage`. The Review queue, Repair Station and Salvage nav items go.

**4. Screens.** Plain words; colour never alone.

- Verdict badges, filters, legends and charts: Pass and Reject only (two chart series; check the
  colours with the dataviz validator in light and dark, as D-025 did).
- Capture's Last scan and Floor view: green **Pass** or red **Reject**, each defect marked Usable or
  Not accepted. `docs/STATION_SETUP.md`: two results instead of four bins.
- Settings → Defect types: **When found: Usable or Not accepted** (required; "When Fixable" goes).
  Thresholds keeps only "A defect counts as found at" and the early-model notice. Unknown classes
  says those sections are rejected until the type is set up.
- A section's page: "Rules used" shows the outcomes. No way to change the verdict (C-21).
- A roll's page: passed, rejected (for salvage) and total; no "In repair" and no "Salvage reused
  here".
- Homes: the QI loses the flagged count and review links; the FM loses Open repairs.
- Reports: Quality shows the two-way split and defects by type; the AI agreement figure goes.
  Operations loses the Repair Station section; supplier quality keeps Reject % ("for salvage") and
  the top defect; **For salvage** counts per day, roll, supplier and defect type; CSV headers follow.

**5. API.** Remove `/api/v1/rework/**`, `/api/v1/salvage/**`, `/api/v1/reports/repairs` and
`POST /api/v1/scans/{id}/decision`. `PUT /api/v1/settings/cv` takes the found-at value and the notice
only; defect types take a required `outcome`; verdicts in every response are `PASS` or `REJECT`.
Update `docs/API.md`.

**6. Messages** (D-038):

- "Choose whether a found Crease is Usable or Not accepted."
- "Enter the found-at value as a percentage from 1 to 100, like 50."

**7. Seeds.** Bootstrap (DQ-7): a new database gets the model's four classes, crease and scratch
Usable, cut and hole Not accepted (A-13); existing rows are never overwritten (D-017). The demo
week: two outcomes, no repairs, salvage or corrections, one unknown-class section showing it is
rejected and listed. `demo:reset` sets A-13's outcomes. The simulator keeps `sim-unknown`.

**8. Tests.** Unit: §1 in `decision-engine.test.ts`; `scan-ingest` (no rework or salvage rows),
`leather-scan`, `cv-mapper-parity`, `settings.service`, `report-rules`, `report.service`,
`ops-rules`, `ops-report.service`, `demo-seed` and `demo-reset`; delete `outcome-rules.test.ts`,
`rework-salvage.service.test.ts` and `scan-decision.test.ts`; pytest for the preview. E2E
(**written, not run**): delete `outcomes.spec.ts`, `rework-columns.spec.ts` and
`cut-around-or-clean.spec.ts`; update `cv.spec.ts`, `capture.spec.ts`, `reports.spec.ts`,
`supplier-quality.spec.ts`, `admin.spec.ts`, `smoke.spec.ts` and `auth.spec.ts`.

**9. Removal check** (paste the output). It finds nothing but lines that read old scans' snapshots
or assert a word is gone, each listed in the report:

```sh
rg -n "REWORK|NEEDS_REVIEW|PENDING_REVIEW|Fixable|Repair Station|Review queue|ReworkTicket|SalvageItem|DefectHandling|scan:decide" src tests scripts cv/cpoint_cv prisma/schema.prisma
```

**Ask in Step 1:**

- An unknown class: Reject (recommended, A-12) or Pass with a warning?
- `aiVerdict` and `finalVerdict`: keep both columns (recommended: a smaller migration) or merge them?

**Done when:** the engine, the API, every screen, the CSVs, the Floor view and the Python preview
know only Pass and Reject; defect types are Usable or Not accepted in Settings; no verdict can be
changed after the camera decides; no review queue, repair station, salvage or decision page, route,
permission or table remains (check 9 is clean); reports count rejected sections as for salvage;
`npm run check` and the `cv/` checks (ruff, mypy, pytest) pass.

**Codex QA focus:** a capture of each outcome (the fake camera gives Pass; use the simulator for
Reject and the unknown class); Settings; a section's page offers no change; reports and CSVs; the
removed URLs answer 404.
</phase_25>

<phase_26>

## Phase 26 — Capture on the constructors' own phones

**Goal:** a Shoe Constructor the System Admin allows does their whole job on one page on their own
phone: start a roll, capture it shot by shot, finish it. The FM reads the rolls in Reports.
**Covers:** C-8 (no shoe type on a roll), C-18 (constructors: Capture with a phone layout; the QI
and FM stop capturing), C-23, C-24, C-33, DQ-1. **Supersedes:** D-005's name, D-019's codes (its
`409 STALE` rule carries over to Finish and Cancel), D-020 and D-067 (which roll a capture goes
to), D-066 (the QI and the FM capture), D-082 (who starts and finishes, the stages, the 10-pieces
hint), D-034 for this page, CLAUDE.md's "no touch or phone design" for this page, D-023's roll
option (A-22). Amends D-075: only the System Admin grants capture.

**Read for this phase:** `src/app/(app)/camera/capture/**`, `src/app/(app)/batches/**`,
`src/app/(app)/camera/{page.tsx,operators-panel.tsx,active-batch-form.tsx}`,
`src/app/(app)/constructor/page.tsx`, `src/app/(app)/admin/users/**`, `src/app/(app)/layout.tsx`,
`src/components/features/app-shell/sidebar.tsx`; `src/server/services/{batch,camera,capture,
scan-ingest,inventory}.service.ts`; `src/server/models/{batch,stage-log}.model.ts`;
`src/lib/{stage-machine,capture-rules,camera-rules}.ts`; `src/app/api/v1/{batches,camera,
scans}/**`; `scripts/cv-simulate.ts`; `src/app/(app)/reports/claims/[batchId]/**`; `DESIGN.md`;
`docs/STATION_SETUP.md`.

**1. Rename (DQ-1).** `Batch` → `Roll` in code: `model Roll { … @@map("batches") }`, `rollId`
fields with `@map("batchId")`, `roll.service.ts` and friends, `/api/v1/rolls`, permission keys
`roll:*`. No table renamed, no data moved. Do it as one mechanical step on its own green checkpoint
(typecheck and unit tests) before any behaviour change.

**2. Data (migration `rolls_at_capture`).**

- Roll status `OPEN` (being captured), `FINISHED`, `CANCELLED`: `PLANNED` and `IN_PROGRESS` become
  OPEN, `COMPLETED` becomes FINISHED.
- `createdById` stays as who started the roll; add `startedAt`, `finishedAt` and `finishedById`,
  filled from `batch_stage_logs` before it is dropped; `rollCode` and `receivedAt` optional; codes
  `R-YYYY-NNNN` for new rolls from the same `batch_sequences` counter (A-1).
- Drop `currentStage`, `Stage`, `batch_stage_logs`, `targetQuotaPairs`, the roll's `shoeTypeId`
  (the `shoe_types` table goes in Phase 27) and `cv_settings.activeBatchId` (A-17).
  `users.canCapture` stays (C-23).

**3. Rules (pure, unit-tested, `src/lib/roll-rules.ts`).** Where a capture goes (the capturer's
open roll; none → "Start a roll first"); one open roll per person; starting needs an active
supplier; finishing needs at least one section (none → Cancel instead); the FM may finish or cancel
any open roll. A test for each move and refusal.

**4. Access.** `camera:capture` → Shoe Constructors with `canCapture` (C-23), checked by
`canCaptureFor`; starting and finishing their own roll comes with it. `camera:operators` → System
Admin only: Users → More actions → **May capture**. The FM's Camera → Camera operators panel goes,
and the Camera page loses its batch picker (`camera:manage` goes). The QI and the FM lose Capture.
`batch:read`, `batch:manage` and `batch:finish` become `roll:read` and `roll:manage` (finish or
cancel any open roll) → FM.

**5. Capture (`/camera/capture`), phone first** (intent brief at the top; worst case: a section
sent to the wrong roll):

- **Without camera access:** one sentence, "Ask the System Admin for camera access.", and nothing
  else.
- **No open roll:** Start a roll: **Supplier** (required, active suppliers), **Roll code**
  (optional, "the number on the supplier's tag"), **Start roll**.
- **Open roll:** a header ("Roll R-2026-0012 · Marikina Leather Trading · 6 shots"), the live
  camera, a large **Capture** button at the bottom (Space still captures on a keyboard), the last
  result (Pass or Reject, shot number, each defect Usable or Not accepted), a short guide ("Move the
  roll edge to edge after each shot. Finish when all of it is in.", C-33), **Finish roll** (the
  confirmation names the roll and its shot count) and **Cancel roll** (only with no shots). D-082's
  "All 10 pieces scanned" hint goes.
- **A roll left open from an earlier day:** "You still have R-2026-0012 open from Tue, 22 Oct.
  Finish it or keep capturing."
- The phones reach the app over HTTPS through the Cloudflare Tunnel (D-076), as the camera needs.
  Floor view stays for a station with a monitor. Every camera problem keeps its own message and fix
  (Phase 18). `409 BATCH_MOVED` becomes `409 ROLL_FINISHED`: "This roll was finished. Start the next
  roll."

**6. The phone shell (A-24).** Below 640 px the sidebar becomes a top bar: logo, page title and an
account menu (Change password, theme, Sign out). A role with one page gets no page menu. Touch
targets 44 px, inputs 16 px, the primary action above the safe area, no sideways scroll. Write it
into `DESIGN.md` as "Phone layout"; Phase 27 reuses it.

**7. Rolls for the FM (Reports → Rolls).** A list (code, supplier, started, finished, shots,
passed, rejected for salvage, status; filters for supplier, status and days; 15 a page) and a roll
page `/reports/rolls/[id]` (shots with photos, verdicts and defects; Finish or Cancel while open;
the Claim sheet, now `/reports/claims/[rollId]`). No constructor's name on either (D-008, D-072).
`/batches` (the old roll pages) and `/api/v1/batches/**` are removed; the URL goes to Phase 27.

**8. API.** `GET /api/v1/rolls` (FM); `POST /api/v1/rolls` (start, constructor with access);
`GET /api/v1/rolls/current` (the capturer's open roll, or for a device token the oldest open roll);
`POST /api/v1/rolls/{id}/finish`; `POST /api/v1/rolls/{id}/cancel`. `POST /api/v1/scans/capture`
and `POST /api/v1/scans` take `rollId`; `scripts/cv-simulate.ts` follows. Update `docs/API.md`.

**9. Messages:**

- "Choose the supplier this roll came from."
- "You already have R-2026-0012 open. Finish it before starting another."
- "A roll needs at least one shot to finish. Cancel it instead."
- "Roll code can be up to 40 characters."

**10. Seeds.** Demo rolls are started and finished by demo constructors with access (Noel Manalo
and a few of the twelve), 10 shots each (D-090); none by the FM or the QI, so D-090's "the FM
captures on the day the QI is absent" moves to a constructor. `demo:reset` follows.

**11. Tests.** Unit: the roll rules, the service's moves and `409`s, where a capture goes for a
person and for a device token, a constructor without access refused, permissions, and the D-008
payload test on roll lists; delete `stage-machine.test.ts`; update `camera-operators.test.ts` (the
Admin only) and the `batch.service`, `batch.validator`, `capture.service`, `capture-route`,
`camera-rules` and `camera-status` tests. E2E (**written, not run**): `capture.spec.ts` as a
constructor with access at 390 × 844 (start, capture, finish; one without access, the QI and the FM
refused); `rolls.spec.ts` replaces `batches.spec.ts` (Reports → Rolls, a roll page, a claim sheet);
axe at phone width.

**12. Docs.** CLAUDE.md's "No touch or phone design" becomes "Desktop first; phone layouts only for
Capture and Batches (D-0xx)"; `DESIGN.md`; `docs/STATION_SETUP.md` (a constructor's own phone on a
stand at a fixed position, the tunnel address, the constructor starts and finishes the roll);
`docs/API.md`; README.

**Ask in Step 1:**

- One open roll per constructor (recommended)?
- The FM finishes or cancels a roll left open (recommended)?
- Supplier required at Start roll (recommended: a return to the supplier needs it)?

**Done when:** a constructor with access on a 390 px phone signs in, starts a roll with a supplier,
captures shots and finishes it; one without access sees the one sentence; the QI and the FM can't
capture; the FM sees every roll and its shots in Reports, with the claim sheet; only the System Admin
grants capture; no stage or batch picker remains; `npm run check` passes.

**Codex QA focus:** the whole constructor flow on a phone-sized viewport and on the desktop station
with Floor view; two constructors capturing at once go to their own rolls; granting and removing
access in Users; the simulator; the refusals.
</phase_26>

<phase_27>

## Phase 27 — Batches are the check-in intervals

**Goal:** a batch is one stretch of the working day between check-ins; lunch pauses it; the QI sees
a notice 10 minutes before and at its end and finishes it with the pairs finished and failed, on a
phone; shoe types are gone.
**Covers:** C-2 to C-8, C-18 (the QI's Batches with a phone layout), C-25 to C-31, C-40, C-41. **Supersedes:**
D-083's slot times, D-084's opening time and "no notifications", D-085's per-type quota, D-087's
per-type production, the shoe types in D-024; amends D-086 (no shoe-type rows; failed pairs per day).

**Read for this phase:** `src/lib/production-rules.ts` (`slotsFor`, `slotState`, `checkInWindow`,
`suggestQuota`, `explainShortfall`); `src/server/services/production.service.ts`;
`src/server/models/production.model.ts`; `src/server/validators/production.validator.ts`;
`src/app/(app)/production/**`; `src/components/features/production/*`;
`src/app/api/v1/{production,shoe-types}/**`; `src/app/(app)/admin/settings/**`;
`docs/prompts/plans/phase-23-plan.md`; `tests/unit/production-*.test.ts`;
`tests/e2e/production.spec.ts`.

**1. Data (migration `batches_are_intervals`).**

- `LunchBreak`: `startTime` and `endTime` ("HH:mm", Manila), `effectiveFrom`, `createdById`; a
  switch or an empty row for "no lunch break". The bootstrap creates 11:00–12:00 (A-4).
- `ProductionSchedule` gains "once at the end of the day" beside every 1 to 4 hours (for example
  a null `intervalMinutes`; the plan picks).
- `ProductionCheckIn.pairs` (Int) = the sum of its `ProductionCount` rows; add `failedPairs` (Int,
  default 0); then drop `production_counts`.
- `DailyQuota` without `shoeTypeId`: for each `effectiveFrom`, the sum of the per-type quotas in
  force that day. Drop `shoe_types` and its relations.
- Internal names stay (`ProductionCheckIn` is a finished batch, `production.*` the code); add the
  glossary line to CLAUDE.md.

**2. Rules (pure, unit-tested).**

- `batchesFor(schedule, breaks, day)`: for each batch its number, start, end, the break inside it,
  working minutes and label ("Batch 2 · 10:00–13:00, lunch 11:00–12:00"). Working time leaves out
  the breaks; a batch whose working time runs out at a break's start ends when the break ends
  (C-26); the last batch ends at the shift end; end of day is one batch. `breaks` is a list (A-4).
- **Required tests: the visit's own examples** (08:00–17:00, lunch 11:00–12:00). Every 4 hours →
  Batch 1 08:00–13:00, Batch 2 13:00–17:00. Every 2 hours → 08:00–10:00, 10:00–13:00 (lunch inside),
  13:00–15:00, 15:00–17:00. End of day → 08:00–17:00. Also C-26's boundary: every 3 hours → Batch 1
  08:00–12:00 (its working time runs out at 11:00, so it carries on past lunch), Batch 2
  12:00–15:00, Batch 3 15:00–17:00; every hour → Batch 3 10:00–12:00. And: no lunch (every 4 hours
  gives today's 12:00, 16:00, 17:00); two breaks; a lunch outside the shift refused; a lunch change
  from tomorrow; a day that isn't a working day.
- `batchState(batch, record, now)`: A-5's states. `FINISH_OPENS_MINUTES = 10` (C-28) and the
  30-minute Late (D-084, an ASSUMPTION comment); Missed at midnight.
- `noticesFor(batches, now)`: the next notice times (10 minutes before the end, and the end, by the
  clock), shared by the browser and the tests.
- The quota suggestion, the pace and the shortfall sentence without shoe types, from passed pairs
  (C-41).

**3. Access.** The QI finishes and corrects; the FM only on a day with no QI present (C-29,
`mayEnterCheckIns`); the FM plans (interval, shift, working days, quota); the System Admin sets the
lunch break (`settings:manage`).

**4. Screens.**

- **`/batches`** (the QI's home and the FM's Batches; phone first for the QI): today's batches as
  cards with the number and times (and lunch), a status badge (icon and word), and when finished
  "40 pairs, 3 failed inspection · Finished 13:04 by Maricel Dizon" (a log-book fact). The due or
  late one, and the next one from 10 minutes before its end, has **Finish batch**. Today against the
  quota (one number). The FM also sees Recent days (14 working days, the chart and the shortfall
  sentences, otherwise as today).
- **Finish batch** (a sheet on a phone, a dialog on a desk): "Pairs finished in Batch 2
  (10:00–13:00)" and "Of these, failed inspection" (0 to start), both large number fields with the
  numeric keypad, notes, **Finish batch 2**. **Correct** the same day, with a reason.
- **`/batches/plan`** (FM): shift start and end; **How often**: every 1, 2, 3 or 4 hours, or once at
  the end of the day; working days; "Applies from tomorrow"; a preview ("Tomorrow: Batch 1
  08:00–13:00, Batch 2 13:00–17:00"); the daily quota with its suggestion; history of both.
- **Settings → Lunch break** (Admin): start, end, "No lunch break", applies from tomorrow, history.
- **Notices (A-9)** for the QI, and for the FM on a covering day, on every page: at 10 minutes
  before the end, "Batch 2 ends at 13:00. Get ready to count the finished pairs."; at the end,
  "Batch 2 is due. Finish it now." with **Finish batch**. A bell in the top bar lists due and late
  batches; the tab title starts with "(1)". No browser notification, push or sound (C-31). Built on
  `noticesFor` and today's batches (refetched every 60 s and when the tab returns); no server-side
  scheduler.
- FM home: **Today's batches** replaces Today's production.
- Reports → Operations: Production per day with pairs finished, failed and the failed share, no
  shoe types; `production.csv` has one row a day with those columns. Per day and batch only, never
  per person (D-008).
- Removed: Settings → Shoe types, every shoe-type field, filter and column, and the `/production`
  pages (they move to `/batches`).

**5. API.** The `/api/v1/production/*` routes stay with the internal names; their bodies lose the
shoe types:

- `GET /api/v1/production/today`: today's batches with their states, the lunch break and the quota.
- `GET /api/v1/production/days`: the recent days, finished and failed each.
- `POST /api/v1/production/check-ins` `{ slotAt, pairs, failedPairs, notes? }` finishes a batch
  (`slotAt` is its end).
- `PATCH /api/v1/production/check-ins/{id}` `{ pairs, failedPairs, reason, expectedUpdatedAt }`
  corrects it.
- `PUT /api/v1/production/schedule` (adds once at the end of the day) and
  `PUT /api/v1/production/quotas` (one number).
- New: `PUT /api/v1/settings/lunch-break` (Admin). Removed: `/api/v1/shoe-types/**`.

Update `docs/API.md`.

**6. Messages:**

- "Enter the pairs finished in Batch 2 as a whole number, like 24. Enter 0 if none."
- "Failed inspection can't be more than the pairs finished (24)."
- "Batch 3 can be finished from 14:50."
- "Lunch must end after it starts."
- "Lunch must be inside the shift (08:00 to 17:00)."
- "Choose how often: every 1, 2, 3 or 4 hours, or once at the end of the day."
- "Enter the daily quota as a whole number of pairs, at least 1."

**7. Seeds.** The default schedule and lunch (batches end at 13:00 and 17:00). The demo week's
batches finished by the QI with a few failed pairs a day, one late and one missed, the FM covering
on the day the QI is absent (D-088, D-090); one quota number. `demo:reset` clears finished batches,
quotas, schedules and lunch breaks but keeps the defaults.

**8. Tests.** Unit: §2 in `production-rules.test.ts`; `production.service.test.ts` (one finish per
batch, a second is `409 STALE`; finishing before the 10-minute mark refused; failed above finished
refused; a correction keeps both counts in the audit; changes from tomorrow); validators;
permissions; the D-008 payload test. E2E (**written, not run**): a new `batches.spec.ts` (Phase 26
renamed the old one) with Playwright's clock: the QI at 390 × 844 sees the notice 10 minutes before
the end and at it, and finishes the due batch with failed pairs; a second finish is refused; the FM
sets end of day; the Admin sets the lunch; a constructor is refused. It replaces
`production.spec.ts`.

**Ask in Step 1:**

- Default lunch 11:00–12:00 (recommended, the visit's example)?
- What the QI sees: today only (recommended) or the last 7 days too?

**Done when:** the visit's three examples give exactly the visit's batches, and every 3 hours gives
08:00–12:00, 12:00–15:00, 15:00–17:00; the QI on a 390 px phone sees a notice 10 minutes before and
at a batch's end and finishes it with pairs finished and failed; each batch reads Upcoming, In
progress, Due, Late, Finished or Missed; reports show failed pairs per day; the FM sets how often
(including end of day) and the quota, and the Admin the lunch break; no shoe type remains anywhere;
`npm run check` passes.

**Codex QA focus:** the three schedules and the lunch boundary; the notices with a mocked clock;
finishing early, a second finish, failed above finished, a correction; the FM covering; phone width.
</phase_27>

<phase_28>

## Phase 28 — Each role sees only its modules, and the demo sign-in tools

**Goal:** the sidebar, homes and permissions match the visit's list exactly, and the login page has
the demo-only tools.
**Covers:** C-17, C-18, C-23. **Supersedes:** the master spec's `<roles_and_modules>`; amends D-023
and D-079 (the Admin's read access), D-033 (the QI's Quality report), D-056 (a reset from the login
page), D-066 and D-067 (the Camera page).

**Read for this phase:** `src/server/policies/{permissions,navigation,guard}.ts`;
`src/lib/domain.ts` (`ROLE_HOME`); every `page.tsx` under `src/app/(app)`;
`src/app/(auth)/login/**`; `src/server/services/{auth,demo-reset}.service.ts`;
`src/server/lib/env.ts`; `.env.example`; `tests/e2e/auth.spec.ts`.

**1. The matrix.** The plan pastes the before and after from `permissions.ts`. The after:
`camera:capture` → Shoe Constructor, with `canCapture` (C-23); `production:read` and
`production:checkin` → QI and FM (the FM's check-in only on a covering day, D-088);
`production:plan`, `roll:*`, `scan:read`, `report:*`, `inventory:*` and `attendance:*` → Floor
Manager; `camera:view`, `camera:operators`, `user:manage`, `settings:manage`, `token:manage`,
`audit:read` and `system:health` → System Admin.

| Role              | Sidebar, in order                                        | Home     |
| ----------------- | -------------------------------------------------------- | -------- |
| Shoe Constructor  | Capture                                                  | Capture  |
| Quality Inspector | Batches                                                  | Batches  |
| Floor Manager     | Overview, Batches, Attendance, Reports, Inventory        | Overview |
| System Admin      | Overview, Users, Settings, Camera, API tokens, Audit log | Overview |

A constructor without camera access still lands on Capture, which says to ask the System Admin
(Phase 26). Everything else answers 403 for that role through `requirePermission`. The Admin's
**Camera** is today's `/camera` (status, model card, early-model notice), moved under
Administration.

**2. Removed views.** The QI home `/quality-inspector` (their home is Batches); the QI's Reports;
the Scans list `/scans` with its `GET /api/v1/scans` unless the plan finds a caller (the
simulator's `POST` stays) and the Latest scans widget (A-26; a section's page is reached from its
roll); the Admin's read-only Attendance, Inventory and Batches; the FM's Camera page.

**3. Homes.** FM: Today's batches, Attendance, Rolls today (checked, rejected for salvage, still
open), Low stock, Daily summary. Admin: system health, users, unknown classes, camera status, lunch
break.

**4. Demo tools (A-23).**

- `DEMO_LOGIN_TOOLS` in `env.ts` and `.env.example`: "For the demo only. Never turn on for real use."
- The login page, under the form: **Demo sign-in** with four buttons ("Floor Manager · Rodel
  Pascual", "Quality Inspector · Maricel Dizon", "System Admin · Jerome Salazar", "Shoe Constructor ·
  Noel Manalo"), and **Reset demo data**: a dialog that says what it deletes and keeps, asks to type
  RESET, shows progress (about a minute) and ends with "Fresh demo week loaded."
- Server: answers 404 when the flag is off; signs in through the normal credentials path with the
  server's `DEMO_USER_PASSWORD`, which never reaches the browser; runs `demo-reset` one at a time;
  audits `user.login` with `method: "demo"` and `system.demo_reset` with `origin: "login page"`.
- Every page shows a thin **Demo mode** band while the flag is on.
- These are the only endpoints without `requireApiPermission`; the DECISIONS entry says why and
  how they are fenced.

**5. Tests.** Unit: the matrix per role; `navigationFor` per role, exactly; the flag off → 404 and
nothing runs; the reset lock. E2E (**written, not run**): `auth.spec.ts` nav per role, each home, a
sample of refused pages per role, the demo buttons only with the flag, axe on the login page.

**Ask in Step 1:**

- Remove the Scans list (recommended) or keep it under Reports?
- The FM home's cards as listed (recommended)?
- The flag's name `DEMO_LOGIN_TOOLS` (recommended)?

**Done when:** each role sees exactly its row of the table and is refused everywhere else; the
demo tools appear and work only with the flag; `npm run check` passes.

**Codex QA focus:** every role's sidebar and home; direct URLs to every removed or foreign page; the
demo tools with the flag on and off; a reset on a throwaway stack.
</phase_28>

<phase_29>

## Phase 29 — Inventory by stock count, with weekly consumption

**Goal:** the FM enters stock counts and deliveries by hand any day, is reminded on Wednesdays and
Fridays, and the system works out what was used and ties it to the pairs made.
**Covers:** C-16, C-32. **Supersedes:** Phase 24 of `production-progression.md` (A-22); amends D-023
(counts become the normal way stock is corrected; no roll taken when a roll starts) and D-033 (days
of cover from counts).

**Read for this phase:** `src/server/services/inventory.service.ts` (`postMovement`,
`recordMovement`, `reverseMovement`); `src/lib/inventory-rules.ts`;
`src/server/models/inventory.model.ts`; `src/app/(app)/inventory/**`;
`src/components/features/inventory/*`; `ops-report.service.ts` (stock position, days of cover);
D-023.

**1. Data (migration `stock_counts`).** `StockCount` (`countedOn` as a Manila date, `countedById`,
`note`, `createdAt`); `StockCountLine` (`countId`, `itemId`, `bookQuantity`, `countedQuantity`,
`receivedQuantity`, the movement ids); a new single-row `InventorySettings` (like `CvSettings`)
with `reminderDays` (ISO weekdays, default Wednesday and Friday, C-32). A count saves in one
transaction: per item an IN for what was received and an ADJUST to what was counted, through
`postMovement` (D-023), and one audit row.

**2. Rules (pure, unit-tested).** Used = previous count + received − this count, per period between
counts and per week (Monday to Sunday, Manila, by the count's date); used per 100 pairs (pairs
finished in the same period, failed ones included because they used materials too; ASSUMPTION); days of cover at the recent rate;
`countReminderDue` (a reminder day with no count saved yet that day). Tests: the first count
(nothing used yet); receipts missing (used comes out negative → "Check the deliveries since Wed,
21 Oct"); no pairs; two counts in one week; an item added between counts.

**3. Screens.**

- **Inventory → Count stock** (`/inventory/count`, FM, any day): every active item by category with
  the last count (quantity and date), **Received since last count**, **Counted now** and the
  difference ("12 boxes used since Wed, 21 Oct"); **Save count (N items)**; the sheet keeps unsaved
  entries and asks before leaving. Items left blank stay as they were.
- Reminder: on a reminder day, until a count is saved, the FM home shows **Stock count today** and
  the bell from Phase 27 lists it. The Inventory list shows **Last counted**. The item page keeps
  **Receive stock** (IN), the one-item **Stock count** for a quick fix, and its history; **Use
  stock** (OUT) goes (A-21).
- **Reports → Materials** (FM): per item, used this week and last week (difference and %), an 8-week
  trend, used per 100 pairs, days of cover and "may run out before the next count"; leather rolls
  used (by count) beside rolls checked by the camera; `materials-used.csv`.
- **Settings for the reminder** (FM, on the Count stock page): the reminder days.

**4. API.** `GET` and `POST /api/v1/inventory/counts`; `PUT /api/v1/inventory/settings`;
`GET /api/v1/reports/materials`; `GET /api/v1/reports/materials-used.csv`. Update `docs/API.md`.

**5. Messages:**

- "Enter the counted Nails as a number with at most 2 decimals, like 12.5."
- "Received can't be negative."
- "Pick at least one reminder day."

**6. Seeds.** Counts on the demo week's Wednesday and Friday with receipts; CI's "stock equals the
ledger" still holds.

**7. Tests.** Unit: §2; the count service (one transaction; an item changed since the sheet loaded
is `409 STALE`, naming it); validators. E2E (**written, not run**): a full count, a partial count,
the reminder on a Wednesday (mocked clock), the report, axe.

**Ask in Step 1:**

- Remove Use stock (recommended, A-21)?
- Show used per 100 pairs (recommended)?

**Done when:** the FM counts every item in one save on any day and the ledger stays the only way
stock changes; the reminder shows on Wednesdays and Fridays until a count is saved; each item shows
what was used per week against the week before and per 100 pairs; `npm run check` passes.

**Codex QA focus:** a full and a partial count; receipts; the consumption figures by hand against
the report; the reminder on a reminder day and gone after a count (mocked clock).
</phase_29>

<phase_30>

## Phase 30 — The whole-roll check and the return to the supplier

### Part A (now 30B) — Can the camera measure a whole roll? (a check with real rolls)

> Since D-103 the roll's area is entered, so 30B only checks that defects are measured in inches,
> on an A4 piece of leather; see `docs/prompts/plans/phase-30b-plan.md`.

**Goal:** answer C-10 and C-33 with numbers before building C-9.

1. **Claude** adds `python -m cpoint_cv measure <folder> --width-in <W>` to the `cv/` toolkit. For
   one roll's shots it reports per photo: the leather's share of the frame (a threshold against the
   plain table, or "whole frame" when it can't tell), each defect's box and outline (mask) area, each
   cut's and scratch's length (box diagonal and outline span); and for the roll: its area, defect
   area and share, by box and by outline, in inches and square feet. It writes
   `cv/reports/<date>-roll-measure.md`. ruff, mypy and pytest pass; nothing in the app changes.
2. **Dylan** at the station (`docs/STATION_SETUP.md` gets a "Calibrate your phone" step): at least two
   different phones, each on the stand at the fixed position (C-24), an A4 sheet (11.7 in long) flat
   on the table to measure the width each sees; two or three real rolls captured whole, shot after
   shot, edge to edge with little overlap; a few cuts and scratches measured with a ruler.
3. **The report answers:** shots and minutes per roll; whether a roll's area adds up across shots
   and what overlap costs; outline and box against the ruler; whether the leather needs finding in
   the frame; how far apart the two phones' figures are; the formula to use. Dylan picks; a
   DECISIONS entry records it before Part B.

### Part B (now 30C) — Large cuts from 3 inches, and the 10% rule in the app

**Goal:** a cut of 3 inches or more is Not accepted, each finished roll shows its defect share, and
a roll over the limit is marked Return to supplier for the FM to decide.
**Covers:** C-9 to C-12, C-20, C-33 to C-37, C-39. **Amends:** the Phase 25 outcomes (length limits) and
D-072 (the claim sheet).

1. **Settings (Admin).** **Supplier limit:** "Mark a roll Return to supplier when defects cover more
   than __% of it" (default 10, C-9). Per defect type: "Not accepted from __ in long" (optional; cut
   3, C-37; scratch none, C-39).
2. **Calibration (Capture, per phone, A-18).** "This phone sees __ in across the table", with the A4
   steps from Part A; remembered per browser and saved with every scan in the snapshot. A phone
   without it gets "Calibrate this phone" on Capture.
3. **Ingest.** Each detection gets `lengthCm` and `areaCm2` (from the outline if Part A says so,
   which means decoding the model's mask output in `src/server/lib/cv`; otherwise the box); each scan
   gets `leatherAreaCm2`. Without calibration nothing is measured, and a type with a length limit
   counts as Not accepted (the safe side, as before this phase).
4. **Engine.** A type with a length limit is Not accepted at or above it and Usable below it: a cut
   under 3 in is small, from 3 in large (C-11, C-12, C-37).
5. **Rolls.** At Finish roll: share = defect area (the union per shot, every found defect, C-35) ÷
   the roll's area as the FM entered it (D-103; it replaces "the sum of its shots", C-33). **More than** the limit, and the system marks the
   roll **Return to supplier** (C-20). The constructor sees "12.4% of this roll has defects (limit
   10%). Set it aside for the Floor Manager." Reports → Rolls gets **To return**: the roll's
   findings (area, defect area, share, the limit, defects by type, the photos) and the FM's decision,
   **Returned to supplier** (date, note) or **Keep** (reason) (C-36). The FM may also return a roll
   under the limit. The claim sheet carries the same findings.
6. **Reports.** Supplier quality adds the defect area share, rolls marked and rolls returned; the
   CSVs follow.
7. **Tests.** Unit: area and length maths with fixtures from Part A's photos; "more than" is strict
   (exactly 10% isn't marked); overlapping boxes counted once; no calibration; 2.99 in and 3.00 in;
   services and validators. E2E (**written, not run**): a marked roll from capture to the FM's
   decision and the claim sheet.

**Ask in Step 1:** outlines or boxes (Part A's answer); calibration per phone (recommended, A-18) or
one shared number for a single station phone.

**Done when:** with a calibrated phone, a cut of 3 inches or more is Not accepted and a shorter one
Usable; a finished roll shows its area, defect area and share; a roll over the limit is marked
Return to supplier, the FM decides returned or kept, and the claim sheet carries the findings; on
Part A's photos the app's figures match the toolkit's; `npm run check` and the `cv/` checks pass.
</phase_30>

<phase_31>

## Phase 31 — The documentation matches the system

**Goal:** every live doc and the paper's figures describe the system as built; history stays in
DECISIONS, SESSION_LOG and the dated QA files.

1. Rewrite the master spec's `<context>`, `<domain_rules>`, `<roles_and_modules>`,
   `<data_model_outline>` and `<cv_integration_contract>` to the current system, with a short
   "Changed since the rebuild" list that links the D-entries. Keep its architecture, gates and
   protocols.
2. Bring these up to date: README (features, setup, the demo script with the demo tools),
   `docs/API.md` (every route in `src/app/api`, nothing else), `DESIGN.md`, `docs/STATION_SETUP.md`,
   `cv/README.md`, `cv/MODEL_CARD.md` (intended use: Pass or Reject, final; stretch marks not a class
   until the model is fine-tuned), CLAUDE.md and AGENTS.md (the words from `<context>`, the
   non-negotiables), ROADMAP (removed phases marked), STATUS.
3. **Sweep** (paste the output):

   ```sh
   rg -n -i "fixable|repair station|review queue|salvage module|procurement|material request|shoe type|needs review|stage monitoring|override" docs README.md DESIGN.md CLAUDE.md AGENTS.md cv/README.md cv/MODEL_CARD.md src
   ```

   Every hit is fixed or sits inside a history section. Compare `src/app/api/**/route.ts` with
   `docs/API.md`, and the master spec's roles table with `permissions.ts`.

4. The vault: each phase summary current; `Inbox/CPoint commands and where to look.md` still right.
5. **The paper's figures (DQ-6).** `modules-figure` and `system-architecture-figure` (HTML and PNG)
   live in the project's shared files (`paper/`), not the repo, and still show procurement, the
   review queue and the stages. A laptop session can't reach them: write
   `docs/prompts/paper-figures.md`, the facts each figure must show after Phase 30 (modules per role,
   the flow from capture to Return to supplier, the two containers), for the project thread that
   redraws them.

**Done when:** the sweep is clean, `docs/API.md` lists exactly the routes, the roles table matches
`permissions.ts`, the figures' facts are written down, and `npm run check` passes.
</phase_31>

<questions_for_cpoint>
Dylan answered Q-1 to Q-20 and the follow-ups F-1 to F-3 on 23 Oct 2026; the answers are C-19 to
C-41, and the vault's visit note has them beside each question. No question for CPoint is open. A
new one found while planning goes in the phase's Step 1 with a recommendation, and into
STATUS → Open questions.

</questions_for_cpoint>

<project_rules>
Dylan's standing rules. They override the master spec where they differ.

- **Vault first, and record every change there** (D-089): today's Daily note (Did, Next, Questions,
  one "Agent sessions" line linking the brief, plan, handoff, Codex prompt and report) and the
  phase's summary in `Notes/Phases/` (created when the phase is planned, listed in `Phases.md`).
- **Plan first.** Start in plan mode, lay out the changes and stop for Dylan's approval before
  writing code. Save the approved plan as `docs/prompts/plans/phase-N-plan.md`.
- **Resuming:** check which phase or step was last completed (this file, `docs/STATUS.md`,
  `git status`, recent changes) and continue from there. One phase per session.
- **No git without Dylan's word.** Don't create branches, commits, pushes or PRs. Work in
  `C:\dev\CPoint-PMS` and leave the changes uncommitted. At the end, give Dylan one copy-paste block:
  a new branch from the latest `main` (D-032), `git add` with only this phase's files (never
  `git add .` or `-A`), `git commit -m`, `git push -u origin <branch>`, and a reminder to open the
  PR. List the files included and the uncommitted files left out on purpose.
- **Checks Claude runs:** `npm run check` (lint, typecheck, unit tests, build) and, when `cv/`
  changes, its ruff, mypy and pytest. **Never browser or e2e tests** (Playwright, axe), even where
  the master spec lists them: write or update the specs; Codex runs them. Paste the real output
  summaries. Never say a check passed without running it.
- **CI fails on the PR:** fix it yourself (D-092): read the failing check, fix it and rerun
  `npm run check`. For an `e2e` or `docker` failure, also write
  `qa/CODEX_PROMPT_CI_RECHECK_<branch>.md` from `qa/templates/ci-recheck-prompt.md` for Dylan to
  give Codex, which reruns that job and reports. Codex never applies a fix.
- **QA handoff** after each phase: `qa/handoffs/YYYY-MM-DD-phase-N-<topic>.md` from
  `qa/templates/handoff.md` (what changed by role, files, the migration, the data to use, clickable
  scenarios with at least one negative per feature, every role's access, out of scope; a phone-width
  pass for Phases 26 to 28) and the paste-in `qa/CODEX_PROMPT_PHASE_N.md`.
- **Migrations:** `npm run db:migrate -- --name <change>`, then `npm run db:generate`. Remind Dylan
  to back up before `npm run demo:reset -- --yes`.
- **UI craft:** `DESIGN.md` and the ui-craft skill, tokens only, readable sizes, plain human copy,
  inline messages that name the exact field and the fix (D-038), the existing design.
- **Never invent a business rule.** Anything not confirmed is an `ASSUMPTION` in code comments and
  in STATUS → Open questions.
- Every mutation runs in `runInTransaction` and calls `recordAudit(tx, …)` with the same `tx`.

</project_rules>

<workflow>
For **each** phase:

**Step 1: Plan (plan mode; stop for approval).**

- What you read and what you'll reuse, by file.
- For a removal: every caller, and what replaces it.
- The schema diff, the migration name, and what happens to existing rows (A-10).
- Permissions and the sidebar per role, before and after.
- The files you'll add, change or delete, by layer; the unit and e2e tests; the doc changes.
- Any conflict between this brief and the code, a decision or the visit notes, with the smallest
  fix.
- The phase's **Ask in Step 1** questions in one batch, each with a recommended option.

**Step 2: Build** at green checkpoints (typecheck and unit tests passing). A rename or a removal is
its own checkpoint before any new behaviour.

**Step 3: Checks.** `npm run check` (and the `cv/` checks when `cv/` changed); the phase's removal
sweep where it has one; the ui-craft Definition of Done on every touched screen at 1280 px and, for
the phone pages, at 390 px. If a check can't run, say so.

**Step 4: Docs** (`/wrap-up`, without the commit and push): `docs/STATUS.md` (progress, test counts,
next step, open questions from `<assumptions>`), `docs/SESSION_LOG.md`, `docs/DECISIONS.md` (from
`<decisions_to_record>`), `docs/ROADMAP.md` (tick the phase's criteria; mark what this phase
replaced), `docs/API.md`, the README demo script, the master spec's roles table.

**Step 5: Hand over.** The QA handoff and Codex prompt; the vault's Daily note and phase summary;
the git commands.

**Step 6: Report** in the master spec's `<final_report_format>`. Before you send it, re-read the
phase's **Done when** and mark each item with its evidence (a test, a file, an output). The "Next
session" prompt names the next phase in this file or the Codex run. Then stop.
</workflow>

<constraints>
- The CLAUDE.md non-negotiables all apply: MVC layering with Prisma in `models/` only; pages call
  services; `requirePermission` on every page and `requireApiPermission` on every API route (the two
  demo endpoints of Phase 28 are the one documented exception); `runInTransaction` and `recordAudit`;
  tokens only; desktop first (phone layouts only for Capture and Batches once D-0xx is written); no
  new containers.
- **Data, never code:** defect types and their outcomes, the found-at value, length limits, the
  supplier limit, the calibration, the schedule, the lunch break, the quota and the reminder days.
- **No per-person workforce metrics (D-008)**, as `<context>` spells out.
- Manila time for display and day boundaries; UTC in storage.
- Stock changes only through ledger movements (D-023).
- **Removing means deleting:** no dead flags, hidden routes or commented-out code. A removed URL
  answers 404.
- Notices, the demo reset and the measuring run inside the `app` container. No Redis, queue, push
  service or new external dependency without Dylan's word.
- The camera's API changes only as each phase says (`rollId`, two verdicts), and `docs/API.md` says
  so in the same phase.
- If this brief conflicts with a settled decision, the code or the visit notes, say so in the plan
  and propose the smallest change. Don't silently pick one.

</constraints>
