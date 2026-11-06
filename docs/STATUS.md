# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-11-06 (D-119 QA passed, run 2; git commands given)
**Branch:** `main` at 12448b5 has the card once per roll and the scanning timer (D-121, #40).
**Uncommitted (laptop, `C:\dev\CPoint-PMS`):** the System Admin reaches only the administration
modules (D-119). Handoff `qa/handoffs/2026-11-06-admin-modules.md`, prompt
`qa/CODEX_PROMPT_ADMIN_MODULES.md`.

- **Current work (D-119, Dylan's observation of 4 Nov):** the Camera page (the last capture's
  photo, rolls being captured) was production, not administration. It is removed: the Admin's
  sidebar is Overview, Users, Settings, API tokens, Audit log; the Admin home has no Camera card;
  `/camera` answers 404 for everyone; `camera:view` is gone from the matrix; the scan image route
  takes `scan:read` only (the Admin gets `403`). The Admin keeps the camera's administration: Users
  → May capture, Settings (defect types, thresholds, early-model notice) and API tokens. No
  migration, no other role changes.
- Checks: `npm run check` passed (**704 unit tests**, build OK) in a cloud copy of main 12448b5
  with these changes. E2E not run (Codex): `auth.spec.ts` updated (Admin nav; `/camera` 404, no
  card, image `403`).
- **Codex run 1 FAIL** (`qa/reports/2026-11-06-admin-modules-run1.md`): 9 of 10 passed; `auth.spec`
  21/0/1; full e2e 91/8/2 (1 not run), all eight timeouts passed alone (37/0/0). F1: the image
  route let the browser reuse a photo for a day (`max-age=86400, immutable`), so after the FM
  signed out the Admin in the same browser saw the cached copy. It now sends `private, no-cache`
  with an `ETag` (the role check runs on every load; 304 when unchanged; 4 unit tests). The
  early-model notice in Settings named the Camera page; it now names Capture. `npm run check`
  passed (**708**).
- **Codex run 2 PASS** (`qa/reports/2026-11-06-admin-modules-run2.md`): R1 (the Admin's first load
  of a photo the FM had loaded is 403, no photo; the FM's second load 304 with the photo) and R2
  (the notice names Capture) passed; `auth.spec` 21/0/1; full e2e 93/6/2 (1 not run), all six
  timeouts passed alone (27/0/0). QA done for D-119.
- **Next:** Dylan commits D-119 on a new branch (git commands in its thread) and opens the PR. Then
  Phase 31.
- **Agent workflow (D-089, D-092):** Claude builds and fixes every failure, failing CI checks
  included; Codex only tests and reports; every agent reads the Obsidian vault first.
- **Overall:** 38 phases and features built (0 to 29, 30A to 30E-2, the reports by roll, the scale
  marker, D-121) plus D-119 (uncommitted); 1 planned (31).

## Phase progress

- [x] 0. Foundation
- [x] 1. Data & auth
- [x] 2. Batches & stages
- [x] 3. CV skeleton
- [x] 4. Rework & salvage
- [x] 5. Inventory
- [x] 6. Admin
- [x] 7. Dashboards & reports
- [x] 8. Hardening & demo
- [x] 9. Procurement & review access (procurement removed in Phase 24, D-091)
- [x] 10. Operations reports
- [x] 11. Material requests: naming, remarks, urgency, specific messages (removed in Phase 24)
- [x] 12. Item-level decisions guided by stock (removed in Phase 24)
- [x] 13. Ordering, delivery with proof, and the remaining gaps (removed in Phase 24)
- [x] 14. Camera YOLO model: intake and the inference core
- [x] 15. Camera station: capture, send, recover
- [x] 16. Camera page, a small model check, clean data and the demo
- [x] 17. The camera station window (retired by Phase 20, D-069)
- [x] 18. Capture from the website (checked in Phase 20 run 1; device checks need Dylan)
- [x] 19. Project cleanup and optimization (checked in Phase 20 run 1)
- [x] 20. Website-only camera, "Cut around or clean", supplier quality, no components (QA passed;
      device checks need Dylan)
- [x] 21. Repair Station, Floor view, constructor capture, no mkcert (QA passed; station checks
      need Dylan)
- [x] 22. Attendance (QA passed)
- [x] 23. Production progression in place of stage monitoring (QA passed)
- ~~24. Materials used, worked out from the check-ins~~ (replaced by the factory-visit plan;
  CPoint counts stock by hand)
- [x] 24. Remove Material Requests and Procurement (QA passed, 18 of 18)
- [x] 25. Pass or Reject, a final verdict; remove the Review Queue, Repair Station and Salvage
      (QA passed, run 3)
- [x] 26. Capture on the constructors' own phones; rolls start and finish there (QA passed, run 2)
- [x] 27. Batches are the check-in intervals (lunch break, notices, failed pairs, no shoe types)
      (QA passed, run 5; merged #25)
- [x] 28. Each role sees only its modules; demo sign-in and reset on the login page (QA passed,
      run 2; merged #26)
- [x] 29. Stock updated on one sheet, reminders on Wednesdays and Fridays, Reports → Materials
      (QA passed, run 2; merged #27)
- [x] 30A. Leather rolls come from Inventory, each with its own area; picked at Capture; ticked
      Fully used at Finish batch (QA passed, run 4; merged #28, #29)
- [x] 30B. The measuring check: a cut in inches, on a letter-size piece of leather (`cv/` only);
      measured by the box, D-106 (QA passed, run 4; merged #30, follow-up PR next)
- [x] 30C. Cuts from 3 inches Not accepted; a roll over 10% defects marked Return to supplier
      (D-110; QA passed, run 3; merged #34)
- [x] 30E-1. The constructor picks the leather, then the roll; a roll leaves stock at Finish roll;
      the QI counts pairs only (D-111 to D-113; QA passed, run 3; merged, CI green)
- [x] 30E-2. A planning calendar: rolls to be used, quota, check-in interval and shift per day;
      Non-working / Holiday (D-114, D-115; QA passed, run 3; merged #36)
- [x] Reports by roll: a roll over the limit is Returned to supplier; reports count whole rolls
      (D-116, D-117; QA passed, run 3; merged #37)
- [x] 30D. Roll counts on Capture, the calendar and Materials; the team's last QA notes (D-118;
      QA passed, run 2; uncommitted)
- [x] Scale marker: a printed card read on every shot replaces the tap calibration (D-120; QA passed,
      run 4; merged #39)
- [x] The card once per roll and a scanning timer per roll (D-121; QA passed, run 3; merged #40)
- [ ] The System Admin reaches only the administration modules; no Camera page (D-119; QA
      passed, run 2; uncommitted)
- [ ] 31. The documentation and the paper's figures match the system

## What works right now

- **The System Admin's modules (D-119; uncommitted):** Overview, Users, Settings, API tokens,
  Audit log only. No Camera page (`/camera` is 404), no Camera card on the Admin home, no
  `camera:view`; scan photos for the Floor Manager only. Where the bullets below mention the
  Admin's Camera page or its Camera card, D-119 removed them.
- **The card once per roll and the scanning timer (D-121; merged #40):** the card on a roll's
  first shot only, then "Scale set at the first shot: N in across." with Read the card again; a
  later shot's page reads "Measured with the roll's marker card from Shot #1". A scanning timer
  from Start scanning to Finish roll (lunch and nights left out) on Capture, Finish roll, Reports →
  Rolls (Scanning time column, the average, Download CSV) and the roll's page. Where the bullet
  below says Capture is off without the card, that is now the roll's first shot only.

- **The scale marker card (D-120; uncommitted):** Capture reads the printed card (ArUco 4x4_50 id
  0, 2.00 in) in the live picture and on the frame it sends: "Marker card found. This shot will be
  measured (19.2 in across)." or "Show the marker card to capture." with **Print the marker card**
  (`/cpoint-scale-marker-2in.pdf`); too small or tilted cards say so. Capture and Space are off
  without it. The server takes the scale from the corners and ignores boxes on the card. A scan's
  page reads "Measured with the marker card: N in across". Where the bullets below mention "Set up
  this phone", "Calibrate this phone" or tapping a sheet's corners, D-120 replaced them.

- **Roll counts (Phase 30D, D-118; uncommitted):**
  - **Capture:** a card above the roll: "Today, Wed, 4 Nov", **Leather rolls scanned 3/15** with a
    bar ("Plan reached" once met), or "The Floor Manager hasn't planned today yet." / "Today is
    marked Non-working / Holiday."; then **Next planned days** (up to 4, planned days only,
    "Leather rolls scanned 0/12"). Recounts after this phone finishes or puts back a roll, every
    60 s and when the tab returns. `GET /api/v1/rolls/plan`.
  - **Batches → Plan days:** "3 of 5 rolls scanned · 1 returned"; the dialog: "…so far: 2 used, 1
    returned to the supplier (over the defect limit)."
  - **Reports → Materials, Leather rolls:** Rolls used (checked − returned), Rolls checked by the
    camera (30C returns included), Returned to supplier, Removed (other), Pairs finished; each
    week with "N working days". A leather item's row reads "Rolls that left stock: used, returned
    or removed".
- **Reports count whole rolls (D-117; uncommitted):**
  - Every report counts the rolls finished at Capture on their Manila day, each **Scanning passed**
    or **Returned to supplier**; a shot's Pass or Reject shows only on the roll's page and Capture.
  - **Quality:** tiles Rolls scanned, Scanning passed, Returned to supplier; **Rolls scanned per
    day**; Defects by type counts Rolls found on and Returned; `daily.csv` and `defects.csv` follow.
  - **Operations:** tiles Pairs finished ("all pairs the QI counted at Finish batch, failed ones
    included"), Failed inspection, Of quota, **Rolls passed**, **Returned to supplier**; no Rolls
    finished, Rolls open, First-pass yield, Reject rate or Rejected sections. Daily summary and
    `operations.csv`: Rolls started, Rolls scanned, Scanning passed, Returned to supplier.
  - **Supplier quality:** Rolls, Scanning passed, Returned to supplier, Returned %, Top defect
    (no Sections or Defect area); High from 5 rolls (A-43). **Rolls with the most defects** by
    Defect % with Status; `suppliers.csv` and `supplier-rolls.csv` follow.
  - FM home: Rolls today (Rolls scanned, Returned to supplier, open) and Daily summary by rolls.
  - Where the bullets below mention sections, Pass % or Reject % on reports, D-117 replaced them.

- **Simpler reports (D-116; uncommitted):**
  - **Reports → Rolls:** Status filter **Not yet scanned**, **Scanning passed**, **Returned to
    supplier** (`?status=NOT_SCANNED|PASSED|RETURNED`); the Status badge says the same (Being
    scanned and Removed as before) and the Too many defects badge is gone. A roll over the limit
    reads "Returned to supplier: defects cover 16.7% of this roll, over the 10% limit."
  - **"for salvage" removed:** just Reject or Rejected on every report, chart, CSV, the FM home and
    Inventory; Operations' card is **Rejected sections**; Capture says "Reject: this part of the
    roll is not for cutting." and Floor view "Set aside, not for cutting".
  - **Reports → Materials:** no 8 weeks to selected or Per 100 pairs (nor in
    `materials-used.csv`); Leather rolls has **Returned to supplier** per week. Supplier quality's
    column and `suppliers.csv` read Returned to supplier.
  - Settings → Thresholds: "Mark a roll Returned to supplier when defects cover more than __%";
    Finish roll tells the constructor "… so it is marked Returned to supplier. Set it aside for the
    Floor Manager."
  - Where the bullets below mention Too many defects or "for salvage", D-116 replaced them.

- **Rolls leave stock at Capture (Phase 30E-1, D-111 to D-113; uncommitted):**
  - **Capture → Start a roll:** **Leather** ("Brown suede (topsiders) · Marikina Leather Trading ·
    3 rolls"), then **Roll on the table** ("LR-MLT-012 · 24.5 sq ft · tag 88-14"), then **Start
    scanning**; nothing to type. **Finish roll** takes it off stock ("… It is taken off the Brown
    suede (topsiders) stock."). Put roll back for an empty roll, as before.
  - **Finish batch:** pairs finished and failed only; no roll list (old ticks show as history).
  - **Reports → Rolls:** Defect % and **Too many defects** (information only); no To return band or
    filter, no Send back or Keep. **Remove** works on a roll in stock or being scanned (−1); a
    scanned roll is already off stock. The claim sheet stays. Supplier quality: Too many defects
    (Returned gone).
  - Settings → Thresholds: "A roll has too many defects when they cover more than __%".
  - Inventory is unchanged from 30A: **Add rolls** with each roll's area; the count follows the
    rolls.
  - API: `POST /api/v1/rolls/{id}/return-decision` is gone (404); check-ins take no `usedRollIds`.
  - Where the bullets below mention Fully used ticks or Return to supplier decisions, Phase 30E-1
    replaced them.
- **Cuts from 3 inches and the return to the supplier (Phase 30C, D-106, D-110; uncommitted):**
  - **Settings → Thresholds:** "Mark a roll Return to supplier when defects cover more than __%"
    (default 10, strict). **Settings → Defect types:** "Not accepted from __ in long" and "Counts as
    a flat share of the roll (%)"; cut 3 in and 1%, the rest empty (box area). A "Counts toward the
    roll" column.
  - **Capture:** "Calibrate this phone": tap an A4 or letter sheet's four corners (or type the
    toolkit's number); kept per browser, camera and frame size. Each shot sends `widthIn`; Last
    scan shows each defect's length. Without it every cut counts as Not accepted.
  - **Ingest:** each detection's length (box diagonal) and area, each shot's union area and flat
    shares; the snapshot keeps the limits and the scale.
  - **Finish roll:** the share (union areas over the entered area, plus 1% per cut from 3 in) is
    saved with the limit; over it the roll is marked and the constructor reads "12.4% of this roll
    has defects (limit 10%). Set it aside for the Floor Manager." A shot from an uncalibrated phone
    makes the roll Not measured.
  - **Reports → Rolls:** Defect % column, a "N rolls are marked Return to supplier" band and a To
    return filter; the roll's page shows its findings and **Returned to supplier…** (status
    Returned to supplier, OUT −1) or **Keep…** (reason). A marked roll can't be ticked Fully used
    until kept. Inventory shows Defect %; the claim sheet carries the findings and lengths;
    Supplier quality adds Defect area, Marked and Returned (and `suppliers.csv`).
  - Demo week: calibrated shots; three rolls with a long cut on every shot go over 10% (returned,
    kept, waiting). `demo:reset` sets cut 3 in and 1%.
- **Rolls from Inventory (Phase 30A, D-103, D-104):**
  - A leather roll is added by the FM on its leather item (**Add rolls**: the day they arrived,
    then one row per roll with its **Area** in sq ft, 0.1 to 200, two decimals, and the supplier's
    tag). Codes `LR-<supplier code>-001`. Each roll is +1 on the item; the item starts at 0 and its
    row on Update stock is read-only ("Counted from its rolls").
  - Statuses: **Not scanned** → **Being scanned** (picked at Capture) → **Scanned** (Finish roll)
    → **Fully used** (ticked at Finish batch, −1). **Removed** by the FM with a reason (any roll
    not fully used). An empty roll picked by mistake is **put back** at Capture.
  - The item page lists its rolls: Roll, Area, Arrived, Status, Shots, Rejected, Defects found,
    **Defect %** ("To be implemented" until 30C), Remove; a status filter; 15 a page. No person.
  - **Capture:** "Scan a roll" lists the rolls not scanned (Find box above five) with **Scan this
    roll**; the line reads "Roll LR-MLT-001 · item · 24.5 sq ft · N shots". `POST /api/v1/rolls`
    is `405`.
  - **Finish batch:** an optional **Rolls fully used** list of scanned rolls; a same-day
    **Correct** ticks or unticks (an untick puts the roll back in stock). A roll not scanned or
    already used is `409`, named. The batch row reads "Fully used: LR-…".
  - **Settings → Suppliers:** a **Code** (2 to 6 capital letters or digits, unique), filled from the
    initials when left blank; the migration filled the existing ones (MLT, MT, JLS).
  - Reports → Rolls and the claim sheet show the area; old `R-`/`B-` rolls stay, with no item or
    area, and can't be ticked.
  - Demo week: rolls with areas on three leather items (LR-003 "Black cowhide (store)" is new),
    picked oldest first, ticked Fully used at a batch the day after their scan; one shelf roll
    removed for water damage. `demo:reset` deletes rolls before items.
- **Stock updates (Phase 29, D-102, C-16, C-32):**
  - **Inventory → Update stock** (`/inventory/update`, FM, any day): every active item with
    **Added (+)**, **Used (−)**, **Correction** and a **Reason** (only with a correction), and
    After shown live. Blank rows are left alone; **Save update (N items)** saves the rest in one
    transaction with one audit row; an item changed since the sheet loaded is `409 STALE`, named.
    Find box, Category filter, 15-row pager, a warning before leaving with unsaved entries,
    Recent updates.
  - The item page has **Update stock** (opens the sheet on that item), Edit and Deactivate; the
    Receive, Use and Stock count dialogs and Undo are gone (`POST …/movements` is `405`). The
    Inventory list shows **Last updated** and the supplier.
  - A **Leather roll** item needs its **Supplier**; other materials have none.
  - **Reminder:** on Wednesday and Friday (set on the sheet), until an update is saved that day,
    the FM home shows **Stock update today** first and the bell lists it.
  - **Reports → Materials** (FM): per item this week and last week with the change, an 8-week
    trend, per 100 pairs and days left (last 28 days, or since the item's first stock entry), "May run out
    before the next update"; leather rolls used beside rolls checked; `materials-used.csv`.
    Corrections and Added are never use. `stock.csv` says "Added in period".
  - Demo week: the FM saves an update on each past Wednesday and Friday at 16:30 (the Friday one
    corrects the tacks by −1 with a reason); LR-001 is from Meycauayan Tannery, LR-002 from
    Marikina Leather Trading. `demo:reset` removes the updates and puts Wednesday and Friday back.
  - Where the bullets below mention Receive stock, Use stock, Stock count or Undo, Phase 29
    replaced them.
- **Each role sees only its modules (Phase 28, D-100, C-18):**
  - Sidebars, one flat list each: constructor **Capture**; QI **Batches** (its home;
    `/quality-inspector` is 404); FM **Overview, Batches, Attendance, Reports, Inventory**; Admin
    **Overview, Users, Settings, Camera, API tokens, Audit log**. Everything else is the 403 page.
  - Matrix: `camera:view` Admin; `scan:read`, `inventory:read`, `attendance:read`,
    `report:quality` FM; `production:read` FM and QI.
  - Gone (A-26): the Scans list `/scans` and `GET /api/v1/scans` (405; the device `POST` stays),
    the Latest scans widget, the QI's Reports, the Admin's Batches, Attendance and Inventory, the
    FM's and QI's Camera. A section's page stays for the FM, from its roll ("Roll R-…" back link).
  - FM home: Today's batches, Attendance, **Rolls today** (sections checked, rejected for salvage,
    rolls still open), Low stock, Daily summary. Admin home: System health, Users, **Camera**,
    Unknown defect classes, **Lunch break**, Audit log. The Admin's Camera keeps the last capture's
    photo (`/api/v1/scans/{id}/image` takes `scan:read` or `camera:view`).
- **Demo tools (Phase 28, D-101, C-17):** with `DEMO_LOGIN_TOOLS=true` and `SEED_DEMO_USERS=true`
  the login page has **Demo sign-in** (four buttons, the server's `DEMO_USER_PASSWORD`, audited
  `method: "demo"`) and **Reset demo data** (type RESET; the same reset as
  `npm run demo:reset -- --yes` with a fresh week, one at a time, also in a production build;
  audited `origin: "login page"`), and every page shows a **Demo mode** band. Off: nothing shows
  and `POST /api/v1/demo/{sign-in,reset}` answer 404. Default off in `.env.example` and Compose.
- Where the bullets below mention the QI home, the Scans list, Latest scans, the QI's Reports or
  the Admin's read-only views, Phase 28 replaced them.
- **Batches (Phase 27, D-097 to D-099):**
  - A **batch** is one check-in interval of the working day (C-2). Production is now **Batches**
    (`/batches`; `/production` is 404). Internally a finished batch is still a `ProductionCheckIn`.
  - **Lunch** (C-3, C-25, C-26, C-40): Settings → **Lunch break** (System Admin): start and end, or
    "No lunch break", applies from tomorrow, with a history. Default 11:00 to 12:00. Working time
    leaves lunch out; a batch whose working time runs out at lunch's start ends when lunch ends;
    the last batch ends at the shift end. With the defaults the batches are **08:00–13:00 (lunch
    11:00–12:00) and 13:00–17:00**; every 2 hours gives 08–10, 10–13, 13–15, 15–17.
  - **How often** (FM, Batches → Plan batches and quota): every 1, 2, 3 or 4 hours, or **once at
    the end of the day** (`intervalMinutes` null, C-4); a preview of tomorrow's batches.
  - **Status is worked out, never stored** (D-098): Upcoming, In progress ("Paused for lunch"
    during lunch), Due at its end, Late 30 minutes after, Finished (Finished late, Corrected),
    Missed at midnight.
  - **Finish batch** (QI; the FM on a day no QI is present, D-088) opens **10 minutes before the
    end** (C-28) until midnight: "Pairs finished in Batch 2 (10:00–13:00)" and "Of these, failed
    inspection" (starts at 0, at most the pairs finished), notes; one finish per batch (`409
STALE`); a same-day **Correct** with a reason keeps both counts in the audit.
  - **Notices** (A-9, C-6, C-31) for whoever finishes: a banner on every page at end − 10 ("Batch
    2 ends at 13:00. Get ready to count the finished pairs.") and at the end ("Batch 2 is due.
    Finish it now." with Finish batch), a bell beside the logo listing the due batches, and "(n)"
    at the start of the tab title. Worked out in the browser from `/api/v1/production/today`
    (every 60 s and when the tab returns). No push, browser notification or sound.
  - **One daily quota** for the whole line (C-8, D-099), counted on **passed** pairs (finished −
    failed, C-41); the suggestion is the average passed pairs per full working day over the last
    10 such days. **Shoe types are gone**: no Settings tab, API (`/api/v1/shoe-types` 404), field
    or column.
  - Phone layout (D-096) for Batches: one column, `h-11` controls, the batch to finish fixed at the
    bottom, the Finish batch dialog as a bottom sheet. The QI sees today only; the FM also sees
    Recent days (chart and table). The QI keeps the Overview home (Next batch card) until Phase 28.
  - Reports → Operations: KPI tiles Pairs finished and **Failed inspection**, Of quota on passed
    pairs; `production.csv` is one row a day (Date (Manila), Pairs finished, Failed inspection, %
    failed, Pairs passed, Daily quota, % of quota (passed), Batches finished, Batches scheduled, …).
  - Migration `batches_are_intervals` converts first (A-10): a check-in's pairs are the sum of its
    per-type counts (failed 0); each quota day becomes one quota, the sum of the per-type quotas in
    force; then `production_counts` and `shoe_types` are dropped. The default lunch starts from the
    beginning on a database with no check-ins, otherwise from tomorrow, so past days keep their old
    check-in times.
  - Demo week: the QI finishes both batches a day with one or two failed pairs each, one late, one
    missed, the FM covering on the QI's absent day; one quota of 128; the three short days still
    line up with the absences. `demo:reset` clears lunch rows and puts the default back.
  - Where the bullets below mention check-ins at 12:00, 16:00 and 17:00, quotas per shoe type or
    Production, Phase 27 replaced them.
- **Rolls at Capture (Phase 26, D-095, D-096):**
  - `Batch` is `Roll` in the code (tables keep their names). A roll is Open, Finished or
    Cancelled; new codes `R-YYYY-NNNN`, older rolls keep `B-`; the supplier's code is the
    optional tag. No stages, quota, notes or shoe type (migration `rolls_at_capture`).
  - **Capture** (`/camera/capture`) is the Shoe Constructor's home and only page, for those the
    **System Admin** gives camera access (Users → More actions). The QI, FM and Admin don't
    capture. Start roll (supplier required), the **Roll** dropdown over every open roll,
    **Finish roll** (at least one shot), **Cancel roll** for an empty roll. A shot to a closed roll
    is `409 ROLL_CLOSED`, none chosen `409 NO_ROLL_CHOSEN`, both before the model runs.
  - Phone layout (D-096): below 640 px a top bar replaces the sidebar; Capture fits 390 × 844 with
    a bottom Capture button. Other pages stay desktop first.
  - **Reports → Rolls** (FM): every roll with supplier, start, finish, shots, passed, rejected (for
    salvage) and status; filters; a roll's page with its shots and claim sheet; **Cancel** any open
    roll with a reason (nothing deleted). `/batches`, `/constructor`, `/api/v1/batches/**` are 404;
    Inventory has no "For roll".
  - Devices and the simulator send `rollId` and go to the roll open longest (`409 NO_OPEN_ROLL`
    with none). Demo week: four allowed constructors capture on phones (PHONE), the newest roll
    stays open, one roll is cancelled by the FM.
  - Where the bullets below mention batches, Start or Finish roll by the FM, the operators panel or
    the QI and FM capturing, Phase 26 replaced them.
- **Pass or Reject (Phase 25, D-093, D-094):**
  - every section is **Pass** or **Reject** and the camera's verdict is final: no review, no
    override, no correction (C-21). `aiVerdict` and `finalVerdict` are both kept and always equal;
  - each defect type has an outcome, **Usable** or **Not accepted** ("When found", a required
    choice in Settings → Defect types). A detection at or above "A defect counts as found at"
    (50%) gives its type's outcome; any Not accepted → Reject, otherwise Pass. An unknown class →
    Reject, listed under Settings → Unknown classes (the Admin home says when some are waiting);
  - Settings → Thresholds keeps found-at and the early-model notice; the two confidence
    thresholds are gone (old keys get a named 422);
  - rejected sections are reported **for salvage**: Reports → Quality (Scanned, Pass, Reject (for
    salvage)), Operations (Reject rate KPI, a For salvage card, Supplier quality by Reject % with
    Pass %); the CSVs follow. The system moves no leather (A-11);
  - Capture and Floor view show green Pass ("Goes on to cutting") or red Reject ("Set aside for
    salvage"); `docs/STATION_SETUP.md` has two bins;
  - removed: `/review`, `/rework`, `/salvage` (404), their APIs, `POST /scans/{id}/decision`,
    `/reports/repairs`, five permissions, three nav items, the tables `rework_tickets` and
    `salvage_items`, and the scan status and override columns. Their audit rows stay as history;
  - migration `pass_or_reject` converts first (A-10): Fixable → Pass, Needs review → Reject, a
    pending scan takes its converted camera verdict; a type's Rework → Usable, Reject or no action
    → Not accepted;
  - a new database gets crease and scratch Usable, cut, hole, abrasion and dirt Not accepted
    (A-13 and plan question 3); `demo:reset` sets cut and hole Not accepted, crease and scratch Usable, abrasion and
    dirt off;
  - the `cv/` preview, `predict` and `evaluate` use the same rule (`[preview.outcomes]`; old keys
    in a local `config.toml` warn).
- The bullets below are from before Phase 25. Where they mention Fixable, Needs review, the
  Repair Station, Salvage, review or two thresholds, Phase 25 replaced them.
- **Database:** 20 migrations (the latest is `pass_or_reject`, D-093/D-094; before it
  `drop_procurement`, D-091; before it
  `production_progression`, D-082 to D-087, applied to the dev database on 2026-10-21; before it `attendance`, D-077; before it `user_can_capture`, D-075; before it `defect_handling`, D-070, and `drop_component_types`, D-071). UUIDv7 ids (D-018).
- **Bootstrap on start** (D-017):
  - reference data and the first System Admin;
  - demo users and inventory when `SEED_DEMO_USERS=true`.
- **Demo week** (D-026, D-090): `SEED_DEMO_WEEK=true` or `npm run demo:seed`.
  - 14 batches and about 120 scans (10 sections a roll, Capture page captures with model
    `yolo-v1-1d729fb0`, no device token), two left for review;
  - named demo accounts: Rodel Pascual (FM), Maricel Dizon (QI), Jerome Salazar (Admin), Noel
    Manalo (constructor; may capture); four demo suppliers;
  - one past day the QI is absent: the FM captures and enters that day's check-ins (D-088);
  - two deliveries in the week as plain stock IN ("Delivery from …"); no requests (D-091).
- **Sign-in & access** (D-016, D-024, D-025):
  - 12-hour sessions, lockout, a role × permission matrix, and server-side sign-out;
  - the Shoe Constructor has no permission in the matrix (D-091); the camera switch (D-075) is
    read fresh on every request, and their home shows Capture or who grants it.
- **Modules:**
  - batches as leather rolls (D-082: Start roll, Finish roll; the old stage moves are gone) and
    the camera with the decision engine (D-011, D-020);
  - **flagged scans are decided by the Quality Inspector only** (D-028, team-confirmed). The FM
    sees them read-only;
  - the Repair Station (the Fixable board, D-021, D-022, D-070, D-073) and salvage, the inventory ledger (D-023), admin (D-024), reports (D-025).
- **Material requests and Procurement: removed** (Phase 24, D-091): no page, API, permission,
  table, leather-roll switch or seed row; `/procurement` answers 404. Stock movements that
  deliveries posted stay with their reason text. The FM home, Inventory and Operations have no
  request parts; `stock.csv` has no "Open request".
- **Camera page (Phase 16, D-055; Phase 20, D-069):** badges **Capture page active** (or "Scans
  arriving" for a device token), **Simulator active** and **No recent captures**; a Model card with
  the last scan's `modelVersion` and an early-model notice (a Settings switch); "Ways to capture"
  (the Capture page; the simulator). Each scan's page shows the model and the rules used.
- **Fixable and the Repair Station (Phase 20, D-070; renamed in Phase 21, D-073):** the REWORK verdict reads **Fixable**
  everywhere a user sees it. Each defect type is **Clean before cutting** or **Cut around the
  marked area** (`handling`, Settings → Defect types → "When Fixable"; migration
  `defect_handling`, dirt → Clean). The board (`/rework`) is the **Repair Station** ("Clean the section or cut around the defect."): To handle,
  Being handled, Done, usable; each card says what the section needs.
- **Supplier quality (Phase 20, D-072):** Reports → Operations: per supplier the rolls, sections,
  Fixable %, Reject %, top defect and **High** (same rule as the attention item), worst first;
  **Rolls with the most rejects** (top 5) each with a **Claim sheet** (`/reports/claims/[batchId]`,
  Save as PDF through print; FM only; no person named). `suppliers.csv` and `supplier-rolls.csv`.
  The demo week spreads rolls over Marikina Leather Trading (more defects), Meycauayan Tannery and
  JM Leather Supply (Divisoria) (D-090).
- **Component tracking: removed** (Phase 20, D-071): no page, Settings tab, API or table
  (migration `drop_component_types`).
- **"When found" actions (D-053):** a defect type can be Fixable or Reject when found (from "A
  defect counts as found at", default 50%); other types keep the two thresholds; the worst result
  decides. Migration `defect_actions` (13 migrations).
- **`npm run demo:reset` (D-056):** dry run by default; `-- --yes` keeps the demo accounts, the
  bootstrap admin and the `CV_DEVICE_TOKEN` token, removes all test data and files, sets cut/hole
  Reject and crease/scratch Fixable when found (abrasion/dirt off) and seeds a fresh demo week. The
  dry run on the dev database found 135 test accounts, 131 tokens, 248 batches, 541 scans, 167
  requests, 172 items and 3,680 audit rows; Dylan had it run with `--yes` on 2026-10-19 (no
  backup, his call): four demo accounts, a fresh demo week of 14 batches and 293 scans.
- **Capture page (Phase 18, D-064 to D-067):** Quality → **Capture** (`/camera/capture`) for the
  QI and the FM (`camera:capture`). Live camera (a phone's back camera by default, a picker
  remembered per browser), "Next scan goes to …" refreshed every 20 s, **Capture** or Space sends
  the frame on screen; the app runs the model itself and **Last scan** shows the verdict, section,
  defects and the frame with boxes. No live boxes. A failed send retries 3 times with the same
  `captureId`, then **Send again**; a batch that left Preparation is refused before the model
  runs (`409 BATCH_MOVED`); every camera problem has its own message and fix.
  - `POST /api/v1/scans/capture` (session, not a token) → model → the same `ingestScan`. Website
    scans have no `deviceTokenId` and no person; the audit row names the user (`origin: "website"`).
  - The model: `python -m cpoint_cv export-onnx` writes `cv/models/yolo-v1.onnx` + `.json`
    (git-ignored); `onnxruntime-node` runs it on the CPU, about 0.65 s per 1920 × 1080 frame and
    1.2 s per 1536 square photo (host and Docker). `npm run cv:parity` matched the station on 7 of
    7 photos (the "rect" letterbox and OpenCV-style resize are needed for that). Missing files:
    `503 MODEL_UNAVAILABLE` and a message on the page.
  - Docker: `node:24-bookworm-slim` (ONNX Runtime has no Alpine build), 692 → 854 MB, 826 MB since
    Phase 19 (sharp's musl build left out, D-068);
    `cv/models` mounted read-only at `/app/models`. HTTPS comes from a Cloudflare Tunnel run on the
    host (D-076; mkcert and port 3443 removed in Phase 21). Still two containers.
  - **Floor view (Phase 21, D-074):** a full-screen mode of Capture for a monitor facing the
    operator: live preview, "Next scan goes to …", and after each capture a coloured frame and band
    (Pass green, Fixable orange, Reject red, Needs review blue) with the section and the bin, until
    the next capture. No sounds. Esc leaves; remembered per browser. Space on the station's
    keyboard captures (no pedal, Dylan 2026-10-20). Station guide: `docs/STATION_SETUP.md`.
  - **Constructor capture (Phase 21, D-075):** `User.canCapture`, set by the FM (Camera → Camera
    operators) or the Admin (Users → More actions); `canCaptureFor` guards Capture, its API,
    `batches/current` and the nav. They see the verdict and section, not Scans.
  - The Camera page shows "Capture page active" and "Ways to capture"; the QI home has
    **Capture sections**.
- **Model toolkit (`cv/`, Phases 14–16, D-048 to D-058; Phase 20, D-069):** the `cpoint_cv` Python
  package runs `yolo-v1.pt` (`cv/models/`, git-ignored, SHA-256 in `cv/MODEL_CARD.md`), about
  255 ms per image on Dylan's RTX 3060 at `imgsz` 1536.
  - `predict <folder>`: detections, `modelVersion` (`yolo-v1-1d729fb0`), time and a preview
    verdict; `evaluate <folder>` compares preview verdicts with `labels.csv` (D-058, 5 of 5 on
    the five sample photos, a small check); `export-onnx` writes the website's model files.
  - The station app (window, `run`, `doctor`, spool) was retired in Phase 20 (D-069). Device
    tokens and the token scan API stay for the simulator; a repeated `captureId` still returns the
    first scan (D-051). `DEDICATED_CAMERA` scans from before still show.
- **Attendance (Phase 22, D-077 to D-081):** Production → **Attendance** for the Floor Manager
  (the Admin views it). One day at a time: every active user on that day with a role badge and a
  Present tick, Find, a role filter and the 15-row pager, **Mark everyone present** and **Save
  attendance (N changes)**. Today and 7 days back are editable; older days are locked, the future
  refused. A stale save is `409 STALE`. The FM home has an **Attendance** card. `workforceFor` is
  the only worker count (constructors present / on the roster); Phase 23 reads it. No per-person
  history, count or streak anywhere (D-008). 12 demo Shoe Constructors (random passwords) and a
  week of attendance in the demo week; `demo:reset` keeps them.
- **Production progression (Phase 23, D-082 to D-087):** replaces stage monitoring.
  - **Schedule** (Production → Schedule and quota, FM): shift start and end, every 1 to 4 hours,
    working days; changes apply from tomorrow. Bootstrap default 08:00 to 17:00 every 4 hours,
    Monday to Saturday: check-ins at **12:00, 16:00 and 17:00**.
  - **Check-ins** (Production, the **QI**; the **FM only on a day attendance shows no QI present**,
    D-088): pairs finished since the previous check-in, per active
    shoe type, with notes; Due, Late after 30 minutes, Missed at midnight; one entry per slot
    (`409 STALE`); a same-day **Correct** needs a reason and the audit keeps both counts. The
    constructors present are read from attendance at save (never blocking).
  - **Daily quota** per shoe type for the whole line (FM), with a **suggestion** from the last 10
    full working days and **Use suggestion**; a first quota applies today, a change tomorrow.
  - **Production page:** today's check-ins, today against the quota with the pace, the last 14
    working days (chart and table) with one sentence for each short day ("Below quota by 18
    pairs. 3 of 12 Shoe Constructors were absent."). Never a name.
  - **Homes:** Next check-in (QI); Today's production replaces Batches by stage (FM).
  - **Operations report:** a Production section, KPI tiles Pairs made, Of quota, Rolls finished,
    Rolls at Preparation; "3 of the last 5 working days were below quota"; `production.csv`
    replaces `stages.csv`.
  - **Rolls:** Start roll (FM), **Finish roll** (FM or QI) with the hint "All 10 pieces scanned.
    Finish this roll?" on the batch and Capture pages; old batches past Preparation read "Started
    before rolls were tracked" and can be finished. The target quota left the batch form.
  - Demo week: quotas and the QI's check-ins (one late, one missed); its three short days line up
    with the absences. `demo:reset` clears check-ins, quotas and saved schedules.
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`.
- **Pagination** (D-047): every list that can grow pages at 15 rows with one pager; Settings
  has a Find box.
- **Form messages** (D-038): every message names the field and the fix; errors sit under their
  field, focus goes to the first invalid one, and a summary shows at 3 or more.
- **Quality:**
  - Phase 30A (Codex, 2026-10-27, run 9): **PASS**. The trimmed Rolls fully used lines: code and
    area on one line, item below (an ellipsis when long), none of the 14 supplier names, sheet
    edges at 0 and 390 px with no sideways scroll after tabbing, axe 0; `batches` alone 6/0;
    ledger 0. R3 (Ticked in this batch) not possible: no roll ticked in today's batches.
  - Phase 30A (Codex, 2026-10-27, run 8): **PASS**. E2E 88 passed, 0 failed, 2 skipped; `batches`
    alone 6/0; U3 to U7 (button sizes, alignment, 672 px dialogs, phone sheet, Add rolls) and axe
    0 passed; ledger 0. Built before the roll lines were trimmed (run 9).
  - Phase 30A (Codex, 2026-10-27, run 7): **PASS**. Full e2e 88 passed, 0 failed, 2 skipped;
    `batches.spec.ts` alone 6/0 three times; F1 by hand (focus moves to the failed field after the
    refused save, and Pairs finished keeps 12); migration up to date, build passed, ledger 0.
  - Phase 30A (Codex, 2026-10-27, run 6): FAIL. Full suite 88 passed, 0 failed, 2 skipped;
    `batches.spec.ts` alone 2 passed, 1 failed, 3 not run: after the refused 3/4, `fill("12")` left
    Pairs finished at 3. `focusFirstInvalid` moved focus a frame later and took it from the field
    being typed in; it now only moves focus that hasn't moved since (3 unit tests). Ledger 0.
  - Phase 30A (Codex, 2026-10-27 Manila, run 5): FAIL on timing only. U1 (Day label), U2 (View on
    six tables at 1440 and 1280, keyboard focus), A1 (axe 0 on seven pages) passed. E2E 84 passed,
    1 failed, 2 skipped, 3 not run: the QI batch notice test ran at 00:09 Manila, before the first
    hourly batch is due (01:00). Rolls 6/0, inventory 8/0; ledger 0.
  - Phase 30A (Codex, 2026-10-26, run 4): **PASS**. Playwright started its own server (port 3100,
    `--keepAliveTimeout 70000`): e2e 88 passed, 0 failed, 2 skipped (demo tools off, model
    missing); `batches.spec.ts` alone 6/0; migration up to date, build passed, ledger 0 before and
    after.
  - Phase 30A (Codex, 2026-10-26, run 3): FAIL. Run 2's F1 and F2 passed (admin 6/0, cv 7/0
    alone); R1 not needed. E2E 85 passed, 1 failed, 2 skipped, 2 not run: `batches.spec.ts:369`
    `read ECONNRESET` on `GET /api/v1/attendance`, then batches alone 6/0. The tests ran against a
    server started with plain `npm run start` (E2E_BASE_URL), which closes idle connections after
    5 s; Playwright's own launch uses `--keepAliveTimeout 70000` (the 2026-10-14 fix). Ledger 0.
  - Phase 30A (Codex, 2026-10-26, run 2): FAIL. R1 (demo item chips), R2 (Name first, codes), R4
    (axe 0) passed; R3 Add rolls and Capture passed, Finish and Correct blocked (both of today's
    batches finished by the reset; they passed in run 1). E2E 86 passed, 2 failed, 2 skipped;
    files: admin 5/1, batches 6/0, inventory 8/0, smoke 10/0. Both failures were tests (the admin
    code read from the whole row; `cv.spec.ts` expected `R-`/`B-` codes), fixed. The first attempt
    was blocked: in PowerShell `npm run demo:reset -- --yes` drops the `--`; use
    `npm run demo:reset '--' --yes`.
  - Phase 30A (Codex, 2026-10-26, run 1): FAIL. Manual 21 of 22 passed (S14 blocked: the dev
    database wasn't reset, so the demo item had no rolls); ledger 0 throughout. E2E 81 passed, 4
    failed, 2 skipped, 3 not run. F1: Settings → Suppliers rows were named by the new Code column
    (Name is first again). F2: e2e rolls shared one item per supplier (now one each). F3: the
    Materials test read the next page too early. F4: the smoke test clicked the list's Update
    stock before the item page opened. F5: axe ran on a toast still fading in (the test waits for
    it). `npm run check` passed (604).
  - Phase 30A: `npm run check` passed, **604 unit tests** (roll codes, supplier codes, areas, the
    moves and ticks, the services, validators, the demo seed). The demo week and `demo:reset` ran
    on a scratch database: every item's count equals its ledger. E2E: `capture`, `rolls`,
    `batches` (tick and untick), `inventory` (Add rolls, the sheet refuses leather), `admin`
    (supplier codes), `smoke` and `supplier-quality` updated; CI's Docker job checks the demo
    rolls. Not run (Codex).
  - Phase 29 (Codex, 2026-10-25): run 1 FAIL, 8 of 17 passed, 4 failed, 5 blocked; e2e 86
    passed, 1 failed, 2 skipped (F1 to F4, fixed). Run 2 **PASS**: R1 to R5, e2e 87 passed, 0
    failed, 2 skipped, ledger 0. (Run 2's first attempt stopped at a `.next` delete step that
    Codex's policy blocks; the step was removed from the prompt.)
  - Phase 29 run 1 fixes: `npm run check` passed, **572 unit tests** (a round-trip test of the item
    form's parsed values).
  - Phase 29: `npm run check` passed, **571 unit tests** (the sheet's line rules, stock rules, the
    update and materials services, validators, the demo seed). E2E: `inventory.spec.ts` (the sheet
    with a refused Used and a correction, STALE, `405` on the old API, reminder days, Materials and
    its CSV, a leather roll's supplier, access) and `smoke.spec.ts`; CI's Docker job checks the
    stock updates. Not run (Codex).
  - Phase 28: `npm run check` passed, **548 unit tests** (the matrix and sidebars per role, the demo
    endpoints off → 404, the reset lock, the demo sign-in audit). E2E: `auth.spec.ts` (nav, homes,
    refused pages per role, the demo tools both ways, axe on the login page) and nine other specs
    updated; not run (Codex).
  - Phase 27: `npm run check` passed, **526 unit tests** (the shoe-type and per-type tests went;
    the batch, lunch, notice and quota tests came). E2E: `batches.spec.ts` replaces
    `production.spec.ts`; `reports`, `admin` and `rolls` specs updated; not run (Codex).
  - 519 unit tests pass (Vitest; 588 before Phase 25, the difference is the deleted review, repair
    and salvage tests; 716 before Phase 24), plus 81 model-toolkit tests (pytest; they also pass
    without OpenCV or torch, as in CI). 521 since the Phase 25 QA fixes; 506 since Phase 26 (the
    stage-machine tests went, the roll tests came).
  - Phase 26 (Codex, 2026-10-24, run 1): FAIL, 25 of 29 scenarios, e2e 57 passed, 18 failed, 1
    skipped. App faults: the desktop sidebar had `hidden` without `sm:flex` (13 e2e failures and S1);
    the camera-access 403 lacked "Only the System Admin chooses who can capture."; no link from a
    scan to its roll's scans; Inventory's Roll column always empty after a reset (now shown only
    when a row has a roll). Test faults: an ambiguous `getByLabel('Roll')`, a "Shots" table name
    that only exists when the table scrolls, the CSV's BOM. Dev data: only `constructor@` had
    camera access: the other demo constructors don't exist on that database (they're created at
    start with `SEED_DEMO_USERS=true`, D-081; the seed skips missing ones). `npm run check` passed
    (506).
  - Phase 26 (Codex, 2026-10-24, run 2): **PASS**. R1 to R5 passed (desktop sidebar at 1440 and
    640 px, phone bar at 390; the named 403; no Roll column; "Scans of this roll"). E2E 73 passed,
    2 failed, 1 skipped; both `rolls.spec.ts` failures (a slow navigation, a sign-in timeout under
    the parallel run) passed alone with one worker. Watch them in CI.
  - Phase 25 (Codex, 2026-10-24): runs 2 and 3 after the fixes. Run 2 FAIL, two test faults in
    `production.spec.ts` (a fixed D-088 note; axe on a fading toast), fixed. Run 3 **PASS**: the
    production spec 5 of 5 three times, e2e 75 passed, 0 failed, 1 skipped.
  - Phase 25 (Codex, 2026-10-24, run 1): FAIL, 22 of 24 scenarios, e2e 71 passed, 1 failed, 1
    skipped. Fixes: the Production check-in e2e test matched earlier runs' rows by a fixed note
    (now a note of its own per run); Space right after entering Floor view sent no picture with
    "Press Capture again" (now it waits for a frame and says "The camera is still starting. Wait a
    moment, then press Space again."); two handoff expectations were wrong (the daily CSV starts
    "Date (Manila)"; the demo week has at least one unknown-class section, seven in that run).
    CI on PR #21: run 1 failed (two e2e locators, the docker job's old counts), fixed, run 2
    green.
  - Phase 20 (Codex, 2026-10-20, run 1, which also covered Phases 18 and 19): 56 of 69 passed, 4
    failed, 9 blocked; e2e 75 passed, 10 failed, 1 skipped (86). The app faults were old wording
    (a "Rework" button in Review, "the camera decided rework" in Override, "need rework" and "in
    repair" on Operations), no inline "Fixable must start below Reject" message in Settings →
    Thresholds, and "Sections scanned" in the Rolls CSV header. All ten e2e failures were stale
    tests. All fixed (lint, typecheck, 591 unit tests and build pass); e2e not re-run yet. Three
    blocked checks (P20 Q3, P18 S7, P19 S5) move to a throwaway `cpoint-qa` Docker stack in run 2;
    six still need Dylan's devices (P18 S3, S12 to S15, S18).
  - Phase 20 run 2 (Codex, 2026-10-20): 14 of 14 browser scenarios passed (R1 to R10, A1, and U1
    to U3 in a throwaway `cpoint-qa` stack, which unblocked P20 Q3, P18 S7 and P19 S5). E2E 81
    passed, 4 failed, 1 skipped. All four were test problems: two long tests hit the 30 s limit
    under the parallel run (the reset test and close-short; now 60 s), the Defect types row was on
    page 2 (now found with the Find box), and the smoke item code was too long with no reorder
    level. Fixed; lint, typecheck, 591 unit tests and build pass.
  - Phase 20 run 3 (Codex, 2026-10-20): two full e2e runs, each 84 passed, 1 failed, 1 skipped.
    The reset and close-short tests passed both times (the 60 s limit was right). The one failure
    was the Defect types test looking up rows by class key, but a row is named by its label; it now
    matches the key in the row's text.
  - Phase 20 run 4 (Codex, 2026-10-20): **PASS**. The fixed test passed alone; the full e2e suite
    85 passed, 0 failed, 1 skipped (the capture API test that needs missing model files).
  - Test data clean-up (2026-10-20, Dylan asked): the dev database was backed up to
    `storage/backups/before-cleanup-2026-10-20.dump` (git-ignored), then `npm run demo:reset -- --yes`
    removed 85 test accounts, 96 tokens, 182 batches, 223 scans, 95 requests, 109 items, 2,123 audit
    rows and the test shoe types, suppliers and defect types, and seeded a fresh demo week (14
    batches, 308 scans, 9 requests). The throwaway `cpoint-qa` stack (containers, volumes, network)
    was removed.
  - Phase 23 (Codex, 2026-10-22): run 1 FAIL, 45 of 46 scenarios, e2e 90 passed, 5 failed, 1
    skipped (one fault: wide tables not keyboard-reachable). Run 2 **PASS**: R1 to R5, e2e 99
    passed, 0 failed, 1 skipped.
  - Phase 22 (Codex, 2026-10-21): run 1 FAIL, 16 of 18 scenarios, e2e 92 passed, 2 failed, 1
    skipped (the summary dropped "· 0 others present"; the handoff named the wrong saver; two
    `auth.spec.ts` tests assumed untouched demo accounts). Run 2 **PASS**: R1 to R4, e2e 94 passed,
    0 failed, 1 skipped. Codex removed the attendance it added to the dev database both times.
  - Phase 21 (Codex, 2026-10-20): **PASS**, 29 of 31 scenarios; e2e 87 passed, 0 failed, 1
    skipped. Blocked: R4 (no batch with an open Fixable section at completion in the dev data) and
    F3 (the fake camera only gives Pass, so orange and red need real leather). Docker without
    certificates: health 200, only port 3000. Clean-up afterwards: backup
    `storage/backups/before-cleanup-2026-10-20-phase21.dump`, then `demo:reset -- --yes` removed 18
    test accounts, 20 tokens, 52 batches, 347 scans, 28 requests, 1,099 audit rows and the test
    types; fresh demo week (14 batches, 313 scans, 9 requests); Codex's `p21-floor` stack removed.
  - Phase 16 (Codex, 2026-10-19, run 1): 19 of 21 passed, the app end to end with the real
    station. S14 failed because Dylan's local `cv/config.toml` lacked the "When found" preview
    settings (now added; `predict`/`evaluate` warn when they're missing); one e2e assertion was
    stale (fixed); A4 axe was blocked on the connected states. Run 2: 4 of 4, including axe with 0
    violations on Station connected, Camera station active and Simulator active for every role,
    and the e2e admin and cv specs 14/14. No app fault remains. The e2e tests post their own
    `e2e-rule-*` defect types, so they don't depend on Settings.
  - Phase 15 (Codex, 2026-10-19, run 1): 18 of 19 scenarios passed, the model end to end on the
    website. The two failures (an e2e test still using `crease` as unknown, and `attempts` missing
    on refused log lines) and a duplicate `crease` row in Defects by type are fixed. Run 2: 5 of 6;
    the fixes all passed (e2e cv.spec 8/8, no duplicate-key warning, one row per type). The one
    failure was a wrong expectation in the handoff: the QI home card counts today only, and no
    `scratch` scan was taken today. No app fault remains. 75 e2e tests exist, with axe (WCAG 2.1 A/AA) on every page of every
    role and on the new procurement screens;
  - Phase 14 (Codex, 2026-10-19, runs 1–2): 9 of 10 scenarios passed, including the camera e2e
    spec 8/8 and the contract test. The one failure (S6) was a wrong step in the handoff, now fixed;
    S6 itself is not re-run. The missing-model message now names the config file and its folder;
  - Phase 13 in a browser (Codex, 2026-10-14): run 1 passed 47 of 54 manual checks, with one
    app fault (a chosen proof file could disappear) and six blocked. Run 2, after the fix, passed
    13 of 13, covering the fix and the six blocked scenarios. No known app fault remains;
  - Phase 13 e2e (Codex run 5, 2026-10-14): three parallel runs of 45: 44/1, 45/0, 45/0. The
    one failure was the full request-to-delivery test running past 30 s under load; it now has
    60 s (not re-run; CI runs it on the PR). The earlier colour-contrast and connection-reset
    findings were test and test-server issues and are fixed;
  - Docker demo-week check passed on 2026-10-14 (throwaway stack): 9 requests across every
    state, proof files on the uploads volume, stock equals the ledger, no second seed on restart;
  - ui-craft audit in `docs/UI_AUDIT.md`, now with a Phase 9 section;
  - CI checks the Docker stack with the demo week.

## Next step (exact)

0. Dylan: commit D-119 with the git commands in its thread, push, open the PR.
1. Dylan: time a roll by hand at the factory and compare with Reports → Rolls' Scanning time.
2. Dylan, at the station: with the card on the leather, capture a few real knife cuts on scrap
   leather (2.5, 3 and 4 in) to check the 3-inch line on real cuts.
3. Phase 31.
4. Dylan: delete `%TEMP%\cpoint-qa-uploads-phase26` if still there, and the two Phase 25 folders.
5. Optional (Dylan's call): the backups in `storage/backups/` and the old `certs/` files;
   `docker image prune -a -f` frees about 8.4 GB.

Later:

- Many open questions below close as Phases 25 to 31 land (the procurement ones closed in 24; the
  review, repair, thresholds and salvage ones in 25; the roll and capture ones in 26; the check-in ones in 27, see D-097 to D-099).
  Each phase updates this list.

## Blockers

- None for the demo.

## Open questions / assumptions awaiting client confirmation

- Decided (Dylan, 2026-11-04 and 06, D-119): the System Admin has only the administration
  modules; the Camera page is removed, not moved to the Floor Manager, who sees every shot from
  Reports → Rolls. Tell CPoint.
- Decided (Dylan, 2026-11-05, D-121): the factory cameras are fixed, so the card is read once per
  roll at its first shot; a scanning timer per roll from Start scanning to Finish roll, lunch left
  out, minutes per roll only, no manual time entered. Tell CPoint.
- ASSUMPTION (A-49, D-121): a roll left open overnight doesn't count the night (from 17:00, or its
  start if later, to 08:00 the next day); time on the same day counts even after 17:00 (overtime,
  evening tests; run 1 F1).
- ASSUMPTION (A-50, D-121): a later card reading replaces the roll's scale for the shots after it.
- ASSUMPTION (A-51, D-121): each picture size needs its own card reading.
- Decided (Dylan, 2026-11-04, D-120): a printed ArUco card (4x4_50 id 0, 2.00 in) read on every
  shot replaces the tap calibration, with no fallback; no card, no shot; the card lies flat on the
  leather. Tell CPoint to keep the card at the station.
- ASSUMPTION (A-46, D-120): a defect box whose centre is on the card (square, white border and
  caption) is ignored; the card isn't leather.
- ASSUMPTION (A-47, D-120): the leather under the card isn't checked on that shot; the constructor
  moves the card between shots if a spot matters.
- ASSUMPTION (A-48, D-120): every new Capture shot is measured, so A-42 now applies only to old
  rolls and simulator shots.
- Decided (Dylan, 2026-11-04, D-118): rolls used = passed by the camera; rolls checked = every roll
  scanned; returned = failed the scan; pairs finished unchanged; Capture shows rolls scanned
  against the plan for today and the next days. Pairs per roll and On hand at week end dropped.
- ASSUMPTION (A-44, D-118): Capture's counter counts every roll finished today, passed or
  returned; the days ahead are planned days only.
- ASSUMPTION (A-45, D-118): a removed roll counts on its removal day; rolls from before Phase 30A
  were never in stock and are left out of Removed (other).
- Decided (Dylan, 2026-11-04, D-113): no color; each roll keeps its own area, entered by the FM when
  added; the constructor picks the leather, then the roll (choice (a)). Planning (30E-2): the FM
  plans any day from a calendar: rolls to be used (one total, an estimate; constructors may start
  more and reports compare), quota and check-in interval. "Go" on the rest of the plan, so these
  are Claude's recommendations, to confirm with CPoint:
- ASSUMPTION (A-31, D-112): a roll over the limit still shows its Defect % and Too many defects,
  for the Floor Manager's information only; the claim sheet stays.
- ASSUMPTION (A-33, D-112): Remove still works on a roll in stock or being scanned (−1); a scanned
  roll can't be removed, since it is already off stock.
- ASSUMPTION (A-35, D-113): old rolls stay as history; rolls in stock stay pickable; scanned rolls
  not yet ticked leave stock in the migration.
- Decided (Dylan, 2026-11-04, 30E-2): every working day must have a plan (no copying; an FM is
  always at the factory to plan); with none, no batches and the start-of-day notice. The FM can mark
  a weekday as a Non-working day / Holiday (no batches, no notice).
- ASSUMPTION (A-36, 30E-2): a day's plan can change until its first batch is finished; lunch stays
  the Admin's, from tomorrow; a holiday mark has no name and can be undone (Dylan: no names).
- ASSUMPTION (A-37, 30E-2): the start-of-day notice is the FM's only, from 00:00 on a working day
  until the plan is saved (banner, bell, FM home); the QI reads "The Floor Manager plans them
  first."
- ASSUMPTION (A-38): 30E before 30D, in two sessions (30E-1 rolls and color, 30E-2 planning).
- Decided (Dylan, 2026-11-04, 30E-2, D-114, D-115): a month calendar; click a weekday to plan it
  (weekends not selectable, no working-days ticks); the check-in interval is every 4 hours or once
  at the end of the day only; the shift is in each day's plan (08:00 to 17:00 prefilled); planned
  against scanned on the calendar, Batches and Operations; no switch-over date, the migration
  converts the old schedule and quota. A-39 is withdrawn: converted days keep their interval as
  history.
- ASSUMPTION (A-40, D-114): a day can be planned up to the end of the third month ahead.
- ASSUMPTION (A-41, D-114): a Non-working / Holiday day has no stock reminder either.
- Decided (Dylan, 2026-11-04, D-116): the system flags a roll over 10% defects of its area and
  marks it Returned to supplier; "for salvage", the 8-week trend and Per 100 pairs go. Tell CPoint.
- ASSUMPTION (A-42, D-116): a roll that couldn't be measured (no phone setup or no area) reads
  Scanning passed.
- Decided (Dylan, 2026-11-04, D-117): the reports count whole rolls, passed or returned, not
  sections; no Rejected sections, Rolls open, Rolls finished or Defect area. Tell CPoint.
- ASSUMPTION (A-43, D-117): a supplier reads High only with at least 5 rolls in the range.
- Decided (Dylan, 2026-11-03, Phase 30C plan, D-110): a cut is Not accepted from 3 in by its box
  diagonal; each cut from 3 in counts a flat 1% of its roll "for now", shorter cuts nothing; holes
  and scratches by box area; phones calibrated once on Capture by tapping a sheet's corners. Tell
  CPoint how the 10% is worked out.
- ASSUMPTION (A-27, D-110): the Floor Manager's Returned or Keep is final; a mistake goes through
  Remove. Keep needs a reason, Returned a day and an optional note.
- ASSUMPTION (A-28, D-110): a roll with any shot from an uncalibrated phone is Not measured and isn't
  marked; the Floor Manager can still return it.
- ASSUMPTION (A-29, D-110): a returned roll leaves stock (OUT −1, "returned to supplier") like a
  fully used one and is reported apart from it.
- ASSUMPTION (A-30, D-110): creases count by box area, like scratches.
- Decided (Dylan, 2026-10-26, Phase 30A plan): each roll's area is entered by the FM, never added
  up from the shots (D-103, changes C-33); rolls come from Inventory, picked at Capture, ticked
  Fully used at Finish batch by whoever finishes it; a roll can't be ticked before it's scanned;
  supplier codes from initials, editable; area 0.1 to 200 sq ft; Correct ticks or unticks; the FM
  removes any roll not fully used; Defect % reads "To be implemented" (D-104). Tell CPoint.
- ASSUMPTION (D-104): someone on the line tells the QI which rolls are fully used; the system
  doesn't track how much of a roll each batch used.
- ASSUMPTION (D-104, A-10): leather counts on an existing database keep their number but have no
  roll records until the FM adds the rolls (or `demo:reset`); the bootstrap's demo inventory has 0
  leather rolls.
- ASSUMPTION (D-104): an empty roll put back at Capture returns to Not scanned with no movement;
  Remove on a roll that is being scanned or scanned takes it out of stock (−1).
- ASSUMPTION: the demo week ticks a roll Fully used at a batch on a later day than its scan, so the
  last day's scanned rolls stay Scanned for the demo.
- Decided (Dylan, 2026-10-25, Phase 29 plan): no deliveries to receive, the FM enters + or − per
  item; a leather roll item has a supplier, other materials don't; pairs that failed inspection
  count as made; a partial save clears the reminder; days left from the last 4 weeks; a
  Correction with a reason that isn't use (D-102). Tell CPoint the sheet replaces the item
  dialogs.
- ASSUMPTION (D-102): the sheet has three boxes per item (Added, Used, Correction) instead of the
  plan's one box with a type, so a delivery and the week's use go in one save.
- ASSUMPTION (D-102): "May run out before the next update" compares days left with the days to
  the next reminder day; an item whose first stock entry is less than 28 days ago is paced from
  that day.
- ASSUMPTION (D-102): the demo week's updates are saved at 16:30 on Wednesday and Friday.
- Decided (Dylan, 2026-10-25, Phase 28 plan): the Scans list is removed (A-26); the FM home cards as
  the brief lists them, with Rolls today; the flag is `DEMO_LOGIN_TOOLS`; one flat sidebar per role
  (D-100, D-101). Tell CPoint the QI's phone opens on Batches and the Admin no longer sees
  production pages.
- ASSUMPTION (A-23, D-101): the demo tools need both `DEMO_LOGIN_TOOLS` and `SEED_DEMO_USERS`; a
  production build may reset only from the login page while the flag is on.
- ASSUMPTION (D-100): "Rolls today" counts the sections checked today, those rejected (for
  salvage), and the rolls open now.
- ASSUMPTION (D-100): the Admin's Camera page keeps the last capture's photo, so the image route
  also takes `camera:view`.
- Decided (Dylan, 2026-10-24, Phase 26 plan): several rolls open at once with a Roll dropdown at
  Capture; a roll finishes only at Capture once fully scanned; the FM cancels any open roll with a
  reason, anyone with camera access an empty one; no stages; the supplier is required; Capture is
  the constructor's home (D-095).
- Decided (Dylan, 2026-10-24, D-095): the Roll dropdown lists every open roll, not only the person's own, and
  starts on the one this browser last used (else the newest this person started, else the only
  one).
- Decided (Dylan, 2026-10-24, D-095): a cancelled roll's shots are left out of the reports.
- Decided (Dylan, 2026-10-24, D-095): new roll codes are `R-YYYY-NNNN`; older rolls keep `B-`.
- ASSUMPTION (D-095): the device and simulator payload's `batchId` is now `rollId`, and without one
  a scan goes to the roll open longest; the scans filter is `?roll=` (old `?batch=` links don't
  filter).
- ASSUMPTION (A-10): old rolls are converted, Planned and In progress → Open, Completed →
  Finished; who started them stays the FM who created them.
- ASSUMPTION: the demo week's leather OUT on each roll reads "Laid out as R-…" (demo data only;
  Phase 29 replaces stock with counts).
- Decided (Dylan, 2026-10-23, the factory visit; brief C-1 to C-41): the five modules go, Pass or
  Reject only and the camera's verdict is final, allowed constructors capture on their own phones,
  a batch is a check-in interval that carries on after lunch, failed pairs are recorded, stock is
  counted by hand with reminders on Wednesdays and Fridays, a cut from 3 inches is Not accepted, a
  roll over 10% defects is marked Return to supplier and the FM decides. Each phase records its
  D-entries.
- Decided (Dylan, 2026-10-23, the follow-ups): a scratch has no length limit (C-39); lunch is the
  only break (C-40); the daily quota counts only the pairs that passed inspection (C-41).
- The brief's other ASSUMPTIONS (A-1 to A-26) are confirmed or changed in Step 1 of their phase and
  added here when built.
- Decided (Dylan, 2026-10-24, Phase 27 plan): default lunch 11:00 to 12:00, set by the System
  Admin (Settings → Lunch break); the QI sees today's batches only; the QI keeps the Overview home
  until Phase 28; the quota suggestion is the average passed pairs per full working day (D-097 to
  D-099). Tell CPoint: batches replace the 12:00, 16:00 and 17:00 check-ins, and shoe types are
  gone.
- ASSUMPTION (D-097, A-2): the last batch of the day ends at the shift end even when it is shorter
  than the others (every 3 hours gives 08:00–12:00, 12:00–15:00 and a 2-hour 15:00–17:00).
- ASSUMPTION (D-098, A-9): the notices are on screen only (banner, bell, tab title) while the app is
  open; nothing reaches a closed browser or a locked phone.
- ASSUMPTION (D-098): Late starts 30 minutes after a batch's end (kept from D-084), and Finish batch
  opens 10 minutes before it (C-28).
- ASSUMPTION (D-097): a lunch the Admin saves outside tomorrow's shift is refused; one that falls
  outside a later shift change is ignored by the batches and the plan page says so.
- Decided (D-082 to D-087, Dylan 2026-10-21): a batch ends with Finish roll; check-ins every 4
  hours (12:00, 16:00, 17:00); only the QI enters them; the suggestion averages 10 full days; a
  first quota applies today. Tell CPoint that stage monitoring is gone.
- Decided (D-088, Dylan 2026-10-22): the FM enters the check-ins on a day attendance shows no QI
  present; with a QI present, or attendance not taken, only the QI can. Tell CPoint.
- ASSUMPTION (D-084): Late starts 30 minutes after a check-in's time; a check-in can be entered
  until midnight and corrected the same day only.
- Closed (D-095, C-33): the 10-pieces hint is gone; roll sizes vary and a section is a shot.
- Decided (Dylan, 2026-11-02, D-107): a repeat schedule or lunch save is skipped; the team's other
  notes become Phase 30D after 30C; weeks on Materials are picked by date ("Week of 26 Oct").
- Decided (Dylan, 2026-11-02, D-108): no unknown defect classes; a class with no defect type is
  ignored (replaces A-12); past scans rejected only by one became Pass; Materials weeks read
  "Week 1: Nov. 2" (week of the month). Tell CPoint the Admin must add a new model's classes.
- To check (team QA): their Materials screenshot showed Pairs finished 0 in every week, even with 8
  rolls used. Taken on a groupmate's PC; check on that database before 30D.
- Decided (Dylan, 2026-11-02, D-105): production works Monday to Friday, 08:00 to 17:00 (replaces
  D-083's Monday to Saturday); the FM may set a shorter shift inside that window; stock reminders
  Monday to Friday. Tell CPoint.

- Closed (D-078; Dylan, 2026-10-23, C-38): every Shoe Constructor gets an account from the System
  Admin.
- Decided (D-077 to D-079, Dylan 2026-10-21): attendance is present or absent only (no reasons),
  taken by the Floor Manager for today and 7 days back, viewed by the Admin. Tell CPoint it is a
  one-day log book with no per-person history.
- Closed (D-093, Dylan 2026-10-24, C-21): nobody reviews or overrides a scan; the camera's
  verdict is final (replaces D-028).
- Confirmed (A-10, DQ-2): old scans are converted, Fixable → Pass and Needs review → Reject; a
  pending scan takes its converted camera verdict.
- ASSUMPTION (A-11, D-093): rejected sections are only reported "for salvage"; the system tracks
  no salvage stock or reuse.
- Decided (A-12, Dylan 2026-10-24): an unknown class rejects the section and is listed under
  Settings → Unknown classes until the Admin sets it up.
- Decided (Dylan 2026-10-24, plan question 3): a defect type with no "when found" action before Phase 25
  (abrasion, dirt, test types) became Not accepted; the Admin can change it.
- Closed, module removed (Phase 24, D-091): the material-request questions of D-029, D-031,
  D-037, D-039, D-040, D-041, D-042, D-044, D-045 and survey Q14 (who orders leather rolls).
- Decided (D-093, Dylan 2026-10-24, C-11, C-12, C-19, A-13): each defect type is Usable or Not accepted from
  50% confidence; the two thresholds of D-011 are gone. cut and hole Not accepted, crease and
  scratch Usable (a scratch at any length, C-39).
- ASSUMPTION: one scan = one leather section of the roll.
- ASSUMPTION: the sign-in lockout (5 tries / 15 minutes) and the 12-hour session suit factory
  shifts. Confirm the shift length.
- Closed (D-094, C-19, C-20): the Repair Station and Salvage are removed; D-021/D-022 no longer
  apply.
- ASSUMPTION (D-026): the demo week's stage times match the survey.
- Closed (D-071, Dylan 2026-10-20): component tracking is out of scope.
- Decided (D-073 to D-076, Dylan 2026-10-20): the board is the Repair Station; Floor view with
  colour-coded bins (`docs/STATION_SETUP.md`); allowed constructors capture; HTTPS through a
  Cloudflare Tunnel. Tell CPoint about the bins and the station setup.
- Decided (D-069 to D-072, Dylan 2026-10-20): the station app retired, capture on the website only,
  no camera check button; "Fixable" and "Cut around or clean" with a Clean / Cut around setting per
  defect type; Supplier quality with a printable claim sheet per roll. Tell CPoint about the new
  wording.
- Decided (D-052, Dylan 2026-10-19): defect types follow the model's own classes. `crease` and
  `scratch` are added and `abrasion` and `dirt` turned off in Settings, by hand per database; the
  bootstrap is unchanged; `demo:reset` applies it. The simulator and demo week draw the model's
  classes.
- Decided (D-050, D-051, Dylan 2026-10-19): Space captures one section; folder replay sends the
  default source (`WEBCAM`); scans carry an optional `captureId` so retries are safe.
- Decided (D-054 to D-058, Dylan 2026-10-19): station check-in through `batches/current`; the
  early-model notice is a setting; `demo:reset`; the duplicate-box filter and IP camera URL;
  `evaluate` with `labels.csv`, run on the five photos as a small check.
- Decided (D-059 to D-063, Dylan 2026-10-19): a Tkinter station window on the camera PC (not the
  website); the preview at 960 and 4 a second, Capture sends the frame on screen at full size;
  failures block Start, warnings don't; the camera choice in a git-ignored file; a `.cmd` launcher
  and a `shortcut` command.
- Decided (D-064 to D-067, Dylan 2026-10-19): server inference with ONNX Runtime on the CPU,
  `node:24-bookworm-slim`, mkcert with a listener in `app` on 3443, live video without boxes,
  QI and FM capture, a Capture nav item, and the station's batch rule (the brief's "current
  batch" was replaced on purpose).
- ASSUMPTION (D-067): a phone or tablet's captures are `PHONE`, a PC's `WEBCAM`, read from the
  browser. Tell CPoint if they want another split.
- ASSUMPTION (D-061): a clock 2 to 5 minutes off is only a warning, because the app accepts those
  scans; only more than 5 minutes ahead blocks Start.
- ASSUMPTION (D-058): the five photos' expected verdicts in `labels.csv` were drafted by Claude
  from the photos; Dylan to confirm.
- Decided (D-049, Dylan 2026-10-19): model files stay out of git (`cv/models/`), not Git LFS.
- Pending: the new YOLO training photos will change the defect classes. They arrive as
  "unknown", reject their sections and show under Settings → Unknown classes until the Admin adds
  them under Settings → Defect types (D-093).

## Known test observations

- Fixed: full e2e runs crashed Chromium late in the run, because helper pages were never closed.
  They're closed now; three local and two Docker full runs since passed 64/64.
- `batches.spec.ts` needs a batch due today, so it fails between 00:00 and 01:00 Manila (16:00 to
  17:00 UTC), in CI too. Rerun the job after that hour; no code fault (Phase 30A run 5).
- The single admin sign-in timeout seen once earlier was probably the same resource exhaustion. It
  hasn't recurred since the fix. Watch CI.

## Environment notes

- Timezone: `Asia/Manila` for display; UTC for storage.
- PowerShell drops a bare `--`, so `npm run demo:reset -- --yes` only dry-runs there. Use
  `npm run demo:reset '--' --yes` in PowerShell.
- On Dylan's PC another project's Vite server often holds port 3000. Start this app with
  `PORT=3001` then (`npm run dev -- --port` doesn't work here).
- Proof-of-delivery files from before Phase 24 may remain under `UPLOADS_DIR/pod` (nothing reads
  them since D-091); `demo:reset` removes them with the scan images.
- Local `.env` needs `AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD` and `DEMO_USER_PASSWORD`. With demo
  users on, `admin@cpoint.local` uses `DEMO_USER_PASSWORD`.
- `npm audit`: 9 highs, all in dev tooling (the Prisma CLI and eslint-config-next, D-027);
  none from `onnxruntime-node`.
- `onnxruntime-node` downloads a CUDA build on Linux unless `ONNXRUNTIME_NODE_INSTALL=skip`
  (set in the Dockerfile and CI). Dylan's old mkcert files are still in `certs/` (git-ignored, no
  longer used since D-076); delete them and run `mkcert -uninstall` when convenient.
- Cloud sandbox only:
  - Build Docker with `--build-arg NODE_IMAGE=<local base image>`, then `up -d`.
  - Use `-p <name>` (and other `DB_PORT`/`APP_PORT` values) for a throwaway stack beside the dev
    DB.
- After `npm run db:migrate`, run `npm run db:generate`.
- E2E:
  - `PLAYWRIGHT_CHROMIUM_PATH` without downloadable browsers.
  - Against Docker: `E2E_BASE_URL`, plus that stack's `DEMO_USER_PASSWORD` and `DATABASE_URL`
    (the helpers write to the DB).
  - The e2e tests create their own Shoe Constructor accounts, so the demo constructor's flag is
    never toggled by tests.
