# The paper's figures: the facts each must show (Phase 31, DQ-6)

The figures live in the project's shared files, not the repo. Phase 31 checked the versions dated
2026-11-07 against the code on `main` (`c5b1848`) and found them current; nothing needed
redrawing. The 14 Oct versions in `paper/` (`modules-figure*`, `system-architecture-figure*`)
still show procurement, the review queue and the stages: they are history, don't use them.

| Figure                       | File (project files)                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| Conceptual framework, 1 of 2 | `conceptual-framework/conceptual-framework-legend-2026-11-07.png`  |
| Conceptual framework, 2 of 2 | `conceptual-framework/conceptual-framework-modules-2026-11-07.png` |
| System architecture          | `architecture/system-architecture-2026-11-07.png`                  |

Redraw a figure when one of the facts below changes; each fact names the file that proves it.

## Modules per role (`src/server/policies/permissions.ts`, `navigation.ts`)

- **Shoe Constructor** (only those the System Admin allows, D-075): Capture and Floor view.
- **Quality Inspector:** Batches, its home; finishes each batch (pairs finished and failed).
- **Floor Manager:** Overview, Batches (Plan days, Recent days), Attendance, Reports (Operations,
  Quality, Rolls, Materials), Inventory (Add rolls, Update stock). Finishes a batch only on a day
  no Quality Inspector is present (D-088).
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
   Materials, CSV.

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

## The containers (`docker-compose.yml`)

- Exactly two services: `app` (Next.js 16 on Node.js 24, the model inside it, `cv/models` mounted
  read-only) and `db` (PostgreSQL 18, volume `pgdata`); the `uploads` volume holds the photos.
- The Cloudflare Tunnel runs on the host, not in a container (D-076). The `cv/` toolkit is outside
  the running system: it trains and exports the model.

## One wording note

The architecture figure says scan photos are "never deleted". True in normal use; only
`npm run demo:reset` (demo and test data) removes them. Leave it unless the panel asks.
