# The paper's figures: the facts each must show (Phases 31 and 36, DQ-6)

The figures live in the project's shared files, not the repo. Phase 31 checked the versions dated
2026-11-07 against the code on `main` (`c5b1848`) and found them current. **Phase 36 redrew all
three on 2026-11-22** (HTML rendered in Chromium, the same look as 2026-11-07, the five module
titles unchanged) to add the defense revisions of Phases 32 to 35 and the Overview clean-up: new
items carry a **NEW** chip. The 2026-11-07 files stay as history. The 14 Oct versions in `paper/`
(`modules-figure*`, `system-architecture-figure*`) still show procurement, the review queue and the
stages: don't use them.

Also copied to the vault folder `Inbox/figures-2026-11-22/` on the laptop.

| Figure                       | File (project files)                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| Conceptual framework, 1 of 2 | `conceptual-framework/conceptual-framework-legend-2026-11-22.png`  |
| Conceptual framework, 2 of 2 | `conceptual-framework/conceptual-framework-modules-2026-11-22.png` |
| System architecture          | `architecture/system-architecture-2026-11-22.png`                  |

Redraw a figure when one of the facts below changes; each fact names the file that proves it.

## Modules per role (`src/server/policies/permissions.ts`, `navigation.ts`)

- **Shoe Constructor** (only those the System Admin allows, D-075): Capture (with My stage), Find
  roll and Floor view.
- **Quality Inspector:** Batches, its home (Queue, Today, Work in progress read-only); inspects
  each batch (pairs finished and failed, what was wrong) and each repair.
- **Floor Manager:** Overview, Batches (Queue, Today, Work in progress, Plan days, Recent days),
  Attendance, Reports (Operations, Quality, Rolls, Materials; by day, week, month or dates, printed),
  Inventory (Add rolls, Update stock, Storage locations, labels), Find roll. Inspects a batch only
  on a day no Quality Inspector is present (D-088); the only one who corrects past records (D-133).
- **System Admin:** Overview, Users (camera access), Settings (defect types, thresholds,
  suppliers, lunch break), API tokens, Audit log. No Camera page (D-119).
- Nothing per person: figures by batch, day, roll, material or supplier (D-008).

## The five modules of the conceptual framework

1. User access, security and system settings: sign-in, lockout after 5 tries for 15 minutes,
   12-hour sessions, the audit log, the health check.
2. Batches, day planning and attendance: the calendar (rolls to be used, quota of passed pairs,
   every 4 hours or once a day, shift; Non-working / Holiday), batches as check-in intervals with
   lunch left out, on-screen notices, attendance as a one-day log book.
3. Leather inspection at Preparation: leather then roll, the marker card on a roll's first shot,
   YOLO finds defects, a cut from 3 in and holes are Not accepted, Pass or Reject is final, more
   than 10% defects → Returned to supplier, the scanning timer.
4. Inventory: Added, Used, Correction on one sheet; leather rolls with their area; a roll leaves
   stock at Finish roll; low stock and reminder days.
5. Dashboards and reports: role homes, Operations, Quality, Rolls (claim sheet, supplier quality),
   Materials, CSV; since Phase 35A by period, with sort, filters and a print layout.

Since Phases 32 to 35 the figures also show: storage locations, roll moves and QR labels with Find
roll (module 4); the Inspection queue with batch codes `B-YYMMDD-N`, final defects, repair jobs
`RP-YYMMDD-<batch>-<n>`, stage assignments and counts, and Work in progress (module 2); corrections
by the Floor Manager (modules 2 and 4).

## From capture to Returned to supplier (`scan-ingest.service.ts`, `roll.service.ts`)

1. The constructor picks the leather, then the roll, and presses Start scanning.
2. The phone photographs one section; on the roll's first shot the browser reads the marker card
   (js-aruco2) and sends its corners with the photo over HTTPS (Cloudflare Tunnel) to
   `POST /api/v1/scans/capture`.
3. The server runs the YOLO model (ONNX Runtime, CPU) and drops boxes on the card and classes with
   no defect type (D-108).
4. Each defect gets its length (box diagonal) in inches; the defect type's outcome decides: any Not
   accepted → Reject, else Pass.
5. The scan, its detections and the rule used are saved in one transaction with an audit row; the
   photo goes to the `uploads` volume.
6. Finish roll: the roll's defect share (union of boxes over its area, plus 1% per long cut); over
   10% → Returned to supplier, else Scanning passed; the roll leaves stock; the scanning time is
   saved.

## Where a roll is kept, and from a batch to a repaired pair (Phases 32 and 34)

- Roll: the Floor Manager adds it with its area and a place; each roll and place gets an A4 label
  with a QR of the plain code (`LR-…`, `LOC:…`); Find roll shows where it is and its history (no
  names); a roll picked at Capture leaves its place; a roll over 10% is set aside until the
  supplier picks it up; every move is one row (D-128).
- Batch: it has a code and waits in the Queue across days (Urgent first, then oldest); the
  Quality Inspector enters pairs finished and failed and what was wrong; each fixable line is a
  repair job At stage → Back for inspection → passed, scrapped or sent back again; passed repaired
  pairs count toward the quota that day; reports and corrections follow (D-129, D-130, D-133).

## The containers (`docker-compose.yml`)

- Exactly two services: `app` (Next.js 16 on Node.js 24, the model inside it, `cv/models` mounted
  read-only) and `db` (PostgreSQL 18, volume `pgdata`, 31 tables); the `uploads` volume holds the photos.
- The architecture figure's **92 handlers** are the exported route handlers (`GET`, `POST`, `PUT`, `PATCH`,
  `DELETE`) in `src/app/api/**/route.ts`: 92 in 77 route files on `main` at `dec06e7` (45 GET, 27 POST, 10 PATCH,
  9 PUT, 1 DELETE; count them with `grep -rE "^export (const|async function|function) (GET|POST|PUT|PATCH|DELETE)\b" src/app/api`).
  `docs/API.md` lists 82 rows because some rows cover more than one method; redraw the figure if the count changes.
- The Cloudflare Tunnel runs on the host, not in a container (D-076). The `cv/` toolkit is outside
  the running system: it trains and exports the model.

## One wording note

The architecture figure says scan photos are "never deleted". True in normal use; only
`npm run demo:reset` (demo and test data) removes them. Leave it unless the panel asks.
