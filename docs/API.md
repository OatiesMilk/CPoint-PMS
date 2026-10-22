# API Reference

Base URL: `http://<host>:3000`. Versioned business endpoints live under `/api/v1` (from Phase 2).
Operational endpoints such as health are unversioned.

## Conventions

- JSON in and out, except scan uploads, which are `multipart/form-data`.
- Timestamps are ISO 8601 in UTC (`2026-10-02T13:11:21.193Z`). The UI shows them in `Asia/Manila`.
- Every error uses one shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Some fields need fixing.", "details": [] } }
```

| Status | `code`                     | When                                                             |
| ------ | -------------------------- | ---------------------------------------------------------------- |
| 400    | `BAD_REQUEST`              | Malformed request                                                |
| 401    | `UNAUTHENTICATED`          | No or invalid session / device token                             |
| 403    | `FORBIDDEN`                | Signed in, but the role isn't allowed                            |
| 403    | `PASSWORD_CHANGE_REQUIRED` | Temporary password: choose your own at `/account/password` first |
| 404    | `NOT_FOUND`                | The resource doesn't exist                                       |
| 409    | `CONFLICT`                 | Conflicts with the current state (e.g. skipping a stage)         |
| 409    | `STALE`                    | Someone else changed the record first; reload and retry          |
| 413    | `PAYLOAD_TOO_LARGE`        | Upload over the size limit (10 MB per image)                     |
| 422    | `VALIDATION_FAILED`        | Body failed validation; `details` lists the fields               |
| 500    | `INTERNAL`                 | Unexpected server error. Details are logged, never returned      |

## Authentication

- **People** sign in on `/login`. The session is an HTTP-only cookie (Auth.js JWT, 12 hours).
  `/api/auth/*` is handled by Auth.js; don't call it directly.
- **API routes** check the session and the caller's role on every request. No session → `401`;
  wrong role → `403`. Deactivated accounts get `401` immediately, even with a valid cookie.
- A password reset or change ends every session that signed in before it (D-024): those requests
  get `401`. An account on a temporary password gets `403 PASSWORD_CHANGE_REQUIRED` until it
  chooses its own.
- Signing out revokes that session on the server (D-025): its token gets `401` even if the cookie
  is replayed.
- **Camera devices** use `Authorization: Bearer <device token>` instead of a session (see below).

## `GET /api/health`

Liveness and readiness check. Used by the Docker `HEALTHCHECK`, CI and the home page.
No authentication required.

**200 OK** when the database is reachable, **503 Service Unavailable** when it isn't (or doesn't
answer within 2 s):

```json
{
  "status": "ok",
  "checks": { "app": "up", "database": "up" },
  "version": "dev",
  "uptimeSeconds": 4,
  "time": "2026-10-02T13:11:21.193Z"
}
```

`status` is `"degraded"` and `checks.database` is `"down"` in the 503 case.

## Batches (`/api/v1/batches`)

A batch is one leather roll (D-005, D-082). Reads need `batch:read` (Floor Manager, Quality
Inspector, System Admin). Writes need `batch:manage` (Floor Manager), except **finish**, which needs
`batch:finish` (Floor Manager, Quality Inspector). All writes are audited.

| Method & path                      | Body                                             | Returns                                                                          |
| ---------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `GET /api/v1/batches`              | query: `status`, `shoeTypeId`, `q`, `page`       | `{ data: Batch[], meta: { total, page, pageCount } }`, 15 per page, newest first |
| `POST /api/v1/batches`             | `BatchForm`                                      | `201 { data: Batch }`, status `PLANNED`                                          |
| `GET /api/v1/batches/{id}`         | —                                                | `{ data: { batch, actions, openRepairs, rollFromInventory } }`                   |
| `PATCH /api/v1/batches/{id}`       | `BatchForm`                                      | `{ data: Batch }`                                                                |
| `POST /api/v1/batches/{id}/stages` | `{ action: "start" \| "finish", expectedStage }` | `{ data: { code, status, currentStage } }`                                       |
| `POST /api/v1/batches/{id}/cancel` | `{ reason, expectedStage? }`                     | `{ data: { code, status, currentStage } }`                                       |

**`BatchForm`**: `rollCode` (1–50 chars), `shoeTypeId` (uuid), `supplierId?` (uuid),
`receivedAt` (`YYYY-MM-DD`, not in the future in Manila time), `notes?` (≤ 500), `rollItemId?` (create only: a leather-roll inventory item; one roll is recorded as
used for the batch in the same transaction, or `422` on `rollItemId` if none is left). The shoe
type can't change once the roll has started. Cancelling a **planned** batch returns its roll.
`targetQuotaPairs` is no longer taken (Phase 23: the daily quota replaced it); old values stay in
the table.

**Roll actions (D-082):** `start` (Planned → At Preparation, `batch:manage`) and `finish` (At
Preparation, or an older batch still past it → Finished, `batch:finish`). Finishing is allowed with
sections at the Repair Station. `expectedStage` is the stage the caller last saw:

- `advance`, `move_back` or `complete` → `422` "Choose start or finish. A roll no longer moves
  through stages."
- If the batch has changed since, `409 { error: { code: "STALE" } }` "This roll was already changed
  by someone else. Refresh to see where it is now."
- A move the rules don't allow → `409 CONFLICT` ("This roll is already finished.", "Start the roll
  first.", "This roll was cancelled.").

`GET /api/v1/batches/current` (the camera's next roll) also returns `scanned`, the sections scanned
so far, for the "All 10 pieces scanned. Finish this roll?" hint.

## Camera ingestion (device token)

A camera machine (the YOLO service, a phone/webcam client, or `npm run cv:simulate`) sends each
capture to the system. It authenticates with a **device token** created by a System Admin under
**API tokens**: `Authorization: Bearer cpt_…`. The token is shown once and stored only as a hash.
A revoked, expired or unknown token gets `401`; a token without the `scans:create` scope gets `403`.
Real captures come from the website's Capture page (`POST /api/v1/scans/capture`, below); the
camera station app was retired in Phase 20 (D-069). The simulator is the token client now.

### `POST /api/v1/scans`

`multipart/form-data`, one leather section per request:

| Field          | Required | Notes                                                                                                                                                                                                                                                              |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `image`        | yes      | JPEG, PNG or WebP (checked by content, not file name), ≤ 10 MB                                                                                                                                                                                                     |
| `detections`   | no       | JSON array, ≤ 50: `[{ "classKey": "cut", "confidence": 0.93, "box": { "x": 0.12, "y": 0.40, "width": 0.08, "height": 0.05 } }]`. `box` is in fractions (0–1) of the image width and height, from the top-left corner. Omit it or send `[]` when nothing was found. |
| `source`       | no       | `SIMULATOR`, `PHONE`, `WEBCAM` (default), `DEDICATED_CAMERA`                                                                                                                                                                                                       |
| `modelVersion` | no       | e.g. `yolov8n-cpoint-2026-10`, shown on the scan                                                                                                                                                                                                                   |
| `capturedAt`   | no       | ISO 8601 with offset; defaults to the time received                                                                                                                                                                                                                |
| `batchId`      | no       | Only for multi-camera setups. Normally omitted (see "Which batch")                                                                                                                                                                                                 |
| `captureId`    | no       | A UUID the camera makes for each capture. Send the same one on every retry: a repeat returns the first scan instead of making a second one (D-051). `cpoint_cv` always sends it                                                                                    |

**Decision (D-011):** the highest confidence among _active_ defect types decides, using the
thresholds set by the admin (default ≥ 0.90 → `REJECT`, ≥ 0.60 → `REWORK`, otherwise `PASS`).
Any `classKey` the system doesn't know → `NEEDS_REVIEW` (the scan waits in the review queue, and the
class is stored and flagged). Class keys are matched exactly. The bootstrap creates `cut`, `hole`,
`abrasion` and `dirt`; for yolo-v1, add `crease` and `scratch` and turn `abrasion` and `dirt` off
under Admin → Settings (D-052, `cv/README.md`). Add new ones there when the model is retrained.

**Outcome rows:** `REWORK` opens a repair ticket; `REJECT` creates a salvage item (D-007).

**`201`** `{ "data": { "scanId", "batchId", "batchCode", "sequence", "verdict", "status", "duplicate": false } }`.

**`200`** the same body with `"duplicate": true` when this device already sent the `captureId`:
nothing new is stored or audited, even if the batch has since left Preparation.

`409` when no batch is at Preparation, when the `batchId` sent isn't in progress at Preparation, or
when another device already used the `captureId` (`message` says which). `413` over 10 MB. `422`
for invalid fields (`details` names each one).

### `POST /api/v1/scans/capture` (the website's Capture page, Phase 18)

The Capture page (`/camera/capture`) sends the frame on screen here. It uses the **signed-in
session**, not a device token, and needs someone who may capture: the Floor Manager and the
Quality Inspector (`camera:capture`, D-066), or a Shoe Constructor the Floor Manager or System
Admin allowed (`canCapture`, D-075). The app runs the model itself (ONNX Runtime, D-064) and then decides exactly as for
`POST /api/v1/scans`: the same `ingestScan`, decision engine and outcome rows.

`multipart/form-data`:

| Field        | Required | Notes                                                                                                        |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| `image`      | yes      | JPEG, PNG or WebP (checked by content), ≤ 10 MB. The page sends the camera frame as a JPEG                   |
| `captureId`  | yes      | A UUID the page makes for each press. A retry with the same one returns the first scan without running again |
| `batchId`    | no       | The batch the page showed. Kept while it is at Preparation, like the station (D-050)                         |
| `source`     | no       | `WEBCAM` (default) or `PHONE`                                                                                |
| `capturedAt` | no       | ISO 8601 with offset: when Capture was pressed                                                               |

There is no `detections` or `modelVersion` field: the server produces both.

**`201`** `{ "data": { "scanId", "batchId", "batchCode", "sequence", "verdict", "status", "duplicate": false, "detections": [...], "modelVersion", "inferenceMs" } }`.
**`200`** the same with `"duplicate": true` (and `detections: []`) for a repeated `captureId`.

| Status | `code`                    | When                                                                                       |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------ |
| `401`  | `UNAUTHENTICATED`         | Not signed in                                                                              |
| `403`  | `FORBIDDEN`               | Not allowed to capture (System Admin, or a Shoe Constructor without `canCapture`)          |
| `409`  | `NO_BATCH_AT_PREPARATION` | No batch is at Preparation                                                                 |
| `409`  | `BATCH_MOVED`             | The batch shown has left Preparation. `details.current` is the batch the next scan goes to |
| `409`  | `CONFLICT`                | The `captureId` was already used by a device-token scan                                    |
| `413`  | `PAYLOAD_TOO_LARGE`       | Over 10 MB                                                                                 |
| `422`  | `VALIDATION_FAILED`       | A field is wrong; `message` names it                                                       |
| `503`  | `MODEL_UNAVAILABLE`       | The model files aren't on the server (the message says where to put them)                  |

The scan stores no person (D-008): `deviceTokenId` is null for a website scan, and the audit row
`scan.create` names the signed-in user as the actor with `origin: "website"`.

### Which batch: `GET /api/v1/batches/current`

The single Preparation camera feeds **the batch picked on the Camera page**. If none is picked, or
it has left Preparation, it feeds **the batch that has been at Preparation the longest** (D-020).
Call this before capturing to show the operator where scans will go. It accepts a device token or
a signed-in session with `camera:view` or capture rights (an allowed constructor, D-075).

### Who may capture: `PUT /api/v1/camera/operators/{userId}`

`camera:operators` (Floor Manager, System Admin). Body `{ "canCapture": true | false }` for an
active Shoe Constructor (D-075). `200 { "data": { "id", "canCapture" } }`; `404` for an unknown
person, `409` for anyone who isn't an active Shoe Constructor. Audited as
`camera.capture_access.grant` / `.revoke`. Applies on the person's next request.

`200 { "data": { "batchId", "batchCode", "rollCode", "shoeType", "selection": "selected" | "oldest", "stageStartedAt" } }`,
or `404 NO_BATCH_AT_PREPARATION`.

Any use of a device token is recorded (at most once a minute, shown under API tokens). The
station check-in that used it (D-054) was retired with the station app in Phase 20 (D-069).

**How a scan is decided (D-011, D-053).** Each detection of an active defect type gives a result
and the worst decides: a type with a **When found** action (`REWORK` or `REJECT`) gives it from
`foundAtOrAbove` (Settings, default 0.5) up; other types use `reworkAtOrAbove` and
`rejectAtOrAbove`; an unknown class key sends the scan to review. The scan keeps the rule in
`thresholdsSnapshot`: `{ rejectAtOrAbove, reworkAtOrAbove, foundAtOrAbove, actions: { key: action } }`
(the last two are missing on scans from before D-053).

## Scans (session)

| Method & path                      | Permission                                      | Notes                                                                                                                               |
| ---------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/scans`                | `scan:read`                                     | filters `verdict`, `status`, `source`, `batch` (code), `override=1`, `page`; or `limit=1…50` for the latest scans (the live widget) |
| `GET /api/v1/scans/{id}`           | `scan:read`                                     | scan, detections (with boxes), rework/salvage history, who decided                                                                  |
| `GET /api/v1/scans/{id}/image`     | `scan:read`                                     | the captured image (`Cache-Control: private`)                                                                                       |
| `POST /api/v1/scans/{id}/decision` | `scan:decide`; `scan:review` for a flagged scan | `{ verdict: PASS\|REWORK\|REJECT, reason?, expectedFinalVerdict }`                                                                  |

**Decisions:**

- A scan the camera flagged (`aiVerdict: NEEDS_REVIEW`) is decided only by a Quality Inspector
  (`scan:review`), both while it waits and after it's resolved. Anyone else gets `403 FORBIDDEN`
  (D-028). Other scans can be overridden by the Floor Manager or the Quality Inspector.
- Resolving a `NEEDS_REVIEW` scan needs no reason. Changing an existing decision (an override)
  needs a `reason` (3–300 characters).
- `expectedFinalVerdict` is the verdict the person saw (`null` for pending). If it changed, the
  answer is `409 STALE`.
- The repair ticket or salvage item is swapped to match the new verdict.
- `409` once the batch is closed, or once the material has moved on (repair started, salvage
  reused or discarded).

## Rework and salvage (session)

Every REWORK verdict (shown as **Fixable**, D-070) opens a ticket on the **Repair Station**
board (D-073); every REJECT keeps the section as **salvage**
(D-007). These endpoints move them along. Each takes `expectedStatus` (what the caller last saw)
and answers `409 STALE` if it changed. All moves are audited.

| Method & path                        | Permission       | Body / query                                                                                       |
| ------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------- |
| `GET /api/v1/rework`                 | `rework:manage`  | `?batch=` → `{ waiting, inProgress, done }` (done = last 7 days)                                   |
| `POST /api/v1/rework/{id}/status`    | `rework:manage`  | `{ move: start\|done\|reopen\|unstart, expectedStatus, note? }`                                    |
| `GET /api/v1/salvage`                | `salvage:read`   | `?status=AVAILABLE\|ASSIGNED\|DISCARDED&batch=&page=` → `{ rows, total, page, pageCount, counts }` |
| `POST /api/v1/salvage/{id}/assign`   | `salvage:manage` | `{ batchId, expectedStatus, note? }`, another planned or in-progress batch                         |
| `POST /api/v1/salvage/{id}/unassign` | `salvage:manage` | `{ expectedStatus }`, only while the receiving batch is open                                       |
| `POST /api/v1/salvage/{id}/discard`  | `salvage:manage` | `{ reason, expectedStatus }`; final                                                                |

**Repair Station (the "rework" endpoints, D-070, D-073):**

- **Flow:** `start` (OPEN → IN_PROGRESS) and `done` (IN_PROGRESS → DONE). Each can be undone one
  step: `unstart` (IN_PROGRESS → OPEN) and `reopen` (DONE → IN_PROGRESS).
- **What it needs:** each card carries `handling`, `CLEAN` or `CUT_AROUND`, from its defect
  types' "When Fixable" setting: `CLEAN` only when every defect on the section is cleaned.
- **Usable count:** a done section counts as usable in its batch (usable = passed + done).
- **Closing a batch:** a batch can be completed while repairs are open (D-022). Its repairs stay
  workable, and `GET /api/v1/batches` rows carry `openRepairs` for the "Being handled" tag. Only a
  cancelled batch freezes its repairs (`409`): cancelling cancels the unfinished ones.

## Inventory (session)

Stock is a ledger (D-023): `quantityOnHand` changes **only** through a movement, and movements are
never edited or deleted. Quantities are numbers with at most 2 decimals.

| Method & path                                | Permission         | Body / query                                                                            |
| -------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------- |
| `GET /api/v1/inventory`                      | `inventory:read`   | `?category=&stock=low\|out&q=&inactive=1&page=` → `{ rows, total, page, pageCount }`    |
| `POST /api/v1/inventory`                     | `inventory:manage` | `ItemForm` → `201`                                                                      |
| `GET /api/v1/inventory/{id}`                 | `inventory:read`   | `?page=` → `{ item, movements, total, page, pageCount }` (newest first, `balanceAfter`) |
| `PATCH /api/v1/inventory/{id}`               | `inventory:manage` | `ItemForm` (quantity is never editable), or `{ isActive }`                              |
| `GET /api/v1/inventory/{id}/movements`       | `inventory:read`   | `?page=`                                                                                |
| `POST /api/v1/inventory/{id}/movements`      | `inventory:manage` | `Movement` → `201 { movementId, onHandAfter, message }`                                 |
| `POST /api/v1/inventory/movements/{id}/undo` | `inventory:manage` | records the opposite of a recent IN/OUT (within 10 minutes, once)                       |

**`ItemForm`**: `sku` (2–20, letters/numbers/dashes, unique; stored upper-case), `name` (2–80),
`category` (`LEATHER_ROLL|NAILS|ADHESIVE|THREAD|EQUIPMENT|OTHER`), `unit` (1–20, e.g. `roll`),
`reorderLevel` (≥ 0), `openingStock?` (create only; recorded as an IN "Opening stock").

**`Movement`**:

- `{ "type": "IN", "quantity": 3, "reason"? }`: stock received (default note "Delivery received").
- `{ "type": "OUT", "quantity": 1, "reason"?, "batchId"? }`: stock used. `409` if it would go below
  zero ("Only 2 rolls in stock…").
- `{ "type": "ADJUST", "counted": 4, "expectedQuantity": 5, "reason" }`: a stock count. The stored
  change is `counted − current`; `409 STALE` if the stock isn't `expectedQuantity` any more.

Low stock means an active item with `quantityOnHand ≤ reorderLevel` (out of stock at 0).

## Procurement (session)

Material requests (D-029, D-031, D-035 to D-040). The UI calls this "Material requests" for Shoe
Constructors and "Procurement" for the Floor Manager and System Admin; the paths and permission
keys stay `procurement`. Any Shoe Constructor asks for materials; **leather rolls** only
if the Floor Manager or System Admin has allowed them. The Floor Manager approves or rejects
**each item** of a request (D-039), then marks the request received. A request is never edited
after it's sent: cancel it and send a new one. Every change adds a timeline event and an audit row.

**Item decisions (D-039).** Each line carries `decision` (`PENDING | APPROVED | REJECTED`) and
`rejectionReason`. The request's status follows from its lines: `APPROVED` when at least one line
is approved, `REJECTED` when every line is rejected. The detail also carries `decided`
(`{ approved, rejected, total, label }`, e.g. "1 of 2 items approved", or `null` while pending),
and list rows carry `partlyApproved` (that label when some lines were rejected, else `null`).

**Stock guidance (D-040).** On the detail, each line has `wellStocked` (on hand is more than 2×
the reorder level; never true with a reorder level of 0), `suggestedDecision` (`REJECTED` for a
well-stocked item, `APPROVED` for a low or out-of-stock one, otherwise `null`) and
`suggestedReason`. These are suggestions for the decision panel; nothing is decided until
`POST …/decide`.

**Urgency** is never stored. Every read works it out from `neededBy` and today's Manila date,
counting working days (Monday to Friday): `HIGH` up to 3 working days or overdue, `MEDIUM` up to
7, `LOW` after that. Rows and the detail carry `urgency` and `daysLeft` ("in 2 working days");
both are `null` once the request is received, rejected or cancelled.

**Delivery late** is never stored either: `late` is `true` on rows and the detail when the request
is `ORDERED` or `PARTIALLY_RECEIVED` and `expectedDeliveryOn` is before today's Manila date.
`raisedByFloorManager` is `true` when the requester is the Floor Manager (D-045).

```
PENDING ─decide every item─▶ APPROVED (at least one approved) ─order─▶ ORDERED
   │                       └▶ REJECTED (every item rejected)            │
   └─cancel (requester)─▶ CANCELLED ◀─cancel with a reason (FM)─ APPROVED or ORDERED

ORDERED ─delivery (some short)─▶ PARTIALLY_RECEIVED ─the rest─▶ RECEIVED
                                  └─close short (FM, reason)─▶ RECEIVED (closedShortAt set)
```

Every move is conditional on the status the server loaded (`409 STALE` if someone else moved it),
and a move the status doesn't allow answers `409 CONFLICT` with one sentence saying why, e.g.
"Only pending, approved or ordered requests can be cancelled. This one is received."

| Method & path                                          | Who                                                                                | Body / query                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/procurement/requests`                     | `procurement:read` (constructors: own)                                             | `?status=&category=&urgency=&late=&item=&from=&to=&page=` → `{ rows, total, counts, page, pageCount }`. `urgency` (`HIGH\|MEDIUM\|LOW`) matches open requests only; `late=1` matches late deliveries. Pending is ordered by `neededBy`, ordered and partly received by `expectedDeliveryOn`                                                                                                                                                       |
| `POST /api/v1/procurement/requests`                    | `procurement:request` (constructors, leather rolls need the OK; the Floor Manager) | `RequestForm` → `201 { id, code, alreadyRequested[] }`                                                                                                                                                                                                                                                                                                                                                                                            |
| `GET /api/v1/procurement/requests/{id}`                | `procurement:read` (constructors: own)                                             | lines (stock snapshot + current stock, decision, stock guidance, `receivedQuantity`, `outstanding`), the order (`supplier`, `orderReference`, `expectedDeliveryOn`, `orderedBy`, `orderedAt`), `deliveries` (lines + `attachments`), `late`, `decided`, `events`, `remarks`, `copiedFrom`, `copies`, `actions`, `cancelBlocked`, `canCopy`, `canAddProof`, `canRemark`                                                                            |
| `POST /api/v1/procurement/requests/{id}/decide`        | `procurement:decide` (FM)                                                          | `{ lines: [{ lineId, decision: "APPROVED"\|"REJECTED", reason? }], note? }`. Every line of the request exactly once; `reason` (3–300) is required to reject. One transaction                                                                                                                                                                                                                                                                      |
| `POST /api/v1/procurement/requests/{id}/approve`       | `procurement:decide` (FM)                                                          | `{ note? }` (send `{}` for none). Approves every line                                                                                                                                                                                                                                                                                                                                                                                             |
| `POST /api/v1/procurement/requests/{id}/reject`        | `procurement:decide` (FM)                                                          | `{ reason }` (3–300). Rejects every line with the one reason                                                                                                                                                                                                                                                                                                                                                                                      |
| `GET /api/v1/procurement/suppliers`                    | `procurement:decide` (FM)                                                          | active suppliers `{ id, name }`, for the order form                                                                                                                                                                                                                                                                                                                                                                                               |
| `POST /api/v1/procurement/requests/{id}/order`         | `procurement:decide` (FM)                                                          | `{ supplierId, reference?, expectedDeliveryOn, note? }`. APPROVED → ORDERED. `expectedDeliveryOn` is `YYYY-MM-DD`, today or later, at most 365 days ahead; the supplier must be active                                                                                                                                                                                                                                                            |
| `POST /api/v1/procurement/requests/{id}/deliveries`    | `procurement:decide` (FM)                                                          | **multipart/form-data**: `data` = JSON `{ deliveredOn, note?, lines: [{ lineId, quantity }] }`, `files` = 1–5 proof files. → `201 { id, code, status, deliveryId, message }`. One quantity per approved line (0 allowed, never more than outstanding, not all 0); `deliveredOn` not in the future and not before the order. Posts an inventory **IN** ("Delivery for MR-…") per inventory line. Status becomes `PARTIALLY_RECEIVED` or `RECEIVED` |
| `POST /api/v1/procurement/deliveries/{id}/attachments` | `procurement:decide` (FM)                                                          | **multipart/form-data**: `files` = 1–5 proof files, up to 10 per delivery in all → `201`. Proof is only ever added                                                                                                                                                                                                                                                                                                                                |
| `GET /api/v1/procurement/attachments/{id}`             | `procurement:read` (constructors: own request)                                     | the file, with `Cache-Control: private`, `X-Content-Type-Options: nosniff` and `Content-Disposition: inline`. `404` for anyone who can't see the request                                                                                                                                                                                                                                                                                          |
| `POST /api/v1/procurement/requests/{id}/close-short`   | `procurement:decide` (FM)                                                          | `{ reason }` (3–300). PARTIALLY_RECEIVED → RECEIVED with `closedShortAt` and `closedShortReason`                                                                                                                                                                                                                                                                                                                                                  |
| `POST /api/v1/procurement/requests/{id}/cancel`        | the requester while PENDING; the FM once APPROVED or ORDERED                       | `{ note? }` for a pending one; `{ reason }` (3–300, required) after approval. `409` once anything has arrived                                                                                                                                                                                                                                                                                                                                     |
| `POST /api/v1/procurement/requests/{id}/remarks`       | FM; the requester on their own                                                     | `{ body }` (1–500) → `201`. Remarks are never edited or deleted                                                                                                                                                                                                                                                                                                                                                                                   |
| `GET /api/v1/procurement/items`                        | `procurement:request`                                                              | active items: `sku, name, category, unit, onHand, reorderLevel, low, allowed, openRequestCode` (`allowed: false` for leather rolls without the OK)                                                                                                                                                                                                                                                                                                |
| `GET /api/v1/procurement/requesters`                   | `procurement:designate` (FM, Admin)                                                | active Shoe Constructors with `canRequestLeatherRolls`                                                                                                                                                                                                                                                                                                                                                                                            |
| `PUT /api/v1/procurement/requesters/{userId}`          | `procurement:designate` (FM, Admin)                                                | `{ canRequestLeatherRolls }`. `409` unless the person is an active Shoe Constructor                                                                                                                                                                                                                                                                                                                                                               |

**Proof files** (D-042): JPEG, PNG, WebP or PDF, recognised from the file's first bytes (the name
and the browser's content type are ignored), at most 10 MB each. A refusal is a `422` whose
`details` carry `path: ["files"]` and a message naming the file, e.g. "“receipt.pdf” isn't a photo
or a PDF. Attach a JPEG, PNG, WebP or PDF file." An upload over the total size is `413`.

**`RequestForm`** (changed in Phase 11: `priority` and `justification` are gone): `neededBy`
(required, `YYYY-MM-DD`, today or later in Manila time and at most 180 days ahead), `remarks?`
(up to 500; saved as the request's first remark), `copiedFromId?` (Phase 13: the caller's own
rejected or cancelled request this one is copied from, else `409`), `lines` (1–10). Each line is `{ inventoryItemId, quantity,
note? }`, or `{ itemName, category, unit, quantity, note? }` for something not in inventory yet
(`category` is an inventory category, so a typed leather roll is recognised). The same
item can't appear twice. `alreadyRequested` lists items another open request already asks for:
a heads-up, never a block.

**Validation errors (D-038).** A `422` carries `details[]` with one issue per field: `path` is the
full path (`["lines", 1, "quantity"]`) and `message` names the field and the fix ("Enter a
quantity greater than 0."). The top-level `message` is that sentence when there is one issue, or
"N fields need fixing. Start with this one: …" when there are several. This holds for every
endpoint, not only procurement.

**Errors:**

- `403 LEATHER_ROLLS_NOT_ALLOWED`: a line is a leather roll (picked or typed) and the constructor
  isn't allowed leather rolls. A change to the flag applies on their next request; they stay
  signed in.
- `422` on `decide`: a line of the request has no decision (`["lines", i, "decision"]`, "Choose
  Approve or Reject for Shoe tacks."), a rejected line has no reason (`["lines", i, "reason"]`),
  or a `lineId` isn't on the request. `i` is the line's position on the request.
- `409 CONFLICT`: the status doesn't allow it ("Only a pending request can be approved…", "Only a
  pending request can be decided…").
- `409 STALE`: someone else changed the request after it was loaded.
- `404`: a constructor asking for someone else's request.

## Administration (session, System Admin)

All of these need the System Admin role (`user:manage`, `settings:manage`, `audit:read`) and are
audited (D-024).

**Users**

| Method & path                            | Body / query                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /api/v1/users`                      | `?role=&status=active\|deactivated\|locked&q=&page=`                             |
| `POST /api/v1/users`                     | `{ name, email, role }` → `201 { id, name, temporaryPassword }` (**shown once**) |
| `PATCH /api/v1/users/{id}`               | `{ name, email, role }`, or `{ isActive }`                                       |
| `POST /api/v1/users/{id}/reset-password` | → `{ name, temporaryPassword }` (shown once); ends the account's sessions        |
| `POST /api/v1/users/{id}/unlock`         | clears a sign-in lockout                                                         |

`409` when the change would deactivate or demote yourself, or the last active System Admin. A
duplicate email is `422` on `email`.

**Settings**

| Method & path                      | Body                                                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET / PUT /api/v1/settings/cv`    | `{ rejectPercent, reworkPercent, foundPercent? }`, e.g. `90`, `60`, `50`; rework below reject (D-053)                                                            |
| `GET /api/v1/defect-types/unknown` | class keys the camera sent that no defect type covers: `{ rawClassKey, detections, lastSeen }`                                                                   |
| `GET / POST /api/v1/defect-types`  | `{ key, label, action?, handling?, description?, sortOrder? }` (key fixed; `action` REWORK or REJECT, D-053; `handling` CLEAN or CUT_AROUND, the default, D-070) |
| `GET / POST /api/v1/shoe-types`    | `{ code, name, sortOrder? }`                                                                                                                                     |
| `GET / POST /api/v1/suppliers`     | `{ name, contactPerson?, phone?, notes? }`                                                                                                                       |
| `PATCH /api/v1/<list>/{id}`        | the same fields, or `{ isActive }`. There are no deletes.                                                                                                        |

New thresholds apply to new scans only; each scan keeps its `thresholdsSnapshot`.

**Audit log**: `GET /api/v1/audit-logs?actor=&action=&entity=&entityId=&from=&to=&page=`
(`from`/`to` are Manila calendar days) → `{ entries, total, page, pageCount }`, newest first, 15
per page. Each entry carries the changed fields as `diff: [{ key, before, after }]`.

## Attendance (session, Phase 22)

A one-day log book of who came in (D-077). Every response is one day for the whole line; nothing
returns a person's history, absence count or streak (D-008). Days are Manila calendar days.

| Method & path                  | Permission          | Body / query                                          | Returns               |
| ------------------------------ | ------------------- | ----------------------------------------------------- | --------------------- |
| `GET /api/v1/attendance?day=`  | `attendance:read`   | `day` = `YYYY-MM-DD`, default today                   | the day (below)       |
| `PUT /api/v1/attendance/{day}` | `attendance:manage` | `{ expectedUpdatedAt, marks: [{ userId, present }] }` | the saved day (below) |

The day: `{ day, today, taken, updatedAt, takenAt, takenBy, editable, lockedReason, workforce:
{ taken, constructorsPresent, constructorsOnRoster, othersPresent }, summary, roster: [{ id, name,
email, role, present }] }`. `workforce` is the system's only worker count (D-080): only Shoe
Constructors count as workers, and a day never saved is `taken: false` with null counts, never 0.

- **Roster** (D-078): every active user created by the end of that day, plus anyone already marked
  on it. Shoe Constructors first, then by role and name.
- **Saving** (D-079): the Floor Manager only, today and the 7 days before. Send the `updatedAt`
  you loaded (`null` for a day never saved); anyone on the roster you leave out is saved absent.
  One transaction with one audit row (`attendance.take` or `attendance.update`: present and
  absent counts before and after, and who changed).
- **Errors:** `422` "Pick a real date, like 2026-10-21." or "The same person is in the list
  twice…"; `403` for anyone but the Floor Manager; `409 STALE` "Someone else saved this day's
  attendance. Refresh to see it."; `409 CONFLICT` "Days more than 7 days ago are locked.",
  "Attendance can't be taken for a future day." or "Someone in this list isn't on the roster for
  21 Oct. Refresh the list."

## Production (session, Phase 23)

Production progression (D-083 to D-087): the check-in schedule, the daily quota per shoe type and
the Quality Inspector's counts. Everything is per check-in, day or shoe type for the whole line
(D-008); the only name is who entered or corrected a check-in. Days are Manila calendar days.

| Method & path                             | Permission           | Body / query                                                     |
| ----------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| `GET /api/v1/production/today`            | `production:read`    | —                                                                |
| `GET /api/v1/production/days?from=&to=`   | `production:read`    | default the last 14 days, at most 92                             |
| `POST /api/v1/production/check-ins`       | `production:checkin` | `{ slotAt, counts: [{ shoeTypeId, pairs }], notes? }`            |
| `PATCH /api/v1/production/check-ins/{id}` | `production:checkin` | `{ expectedUpdatedAt, counts: [{ shoeTypeId, pairs }], reason }` |
| `PUT /api/v1/production/schedule`         | `production:plan`    | `{ shiftStart, shiftEnd, intervalMinutes, workingDays }`         |
| `PUT /api/v1/production/quotas`           | `production:plan`    | `{ quotas: [{ shoeTypeId, pairs, suggestedPairs? }] }`           |

`production:read` is the Floor Manager, the Quality Inspector and the System Admin;
`production:checkin` the Quality Inspector, and the Floor Manager **only on a day attendance shows no
Quality Inspector present** (D-088; otherwise `403` with the reason); `production:plan` the Floor
Manager.

- **today** → `{ day, schedule, workingDay, rows: [{ slotAt, time, since, state, lateBy, checkIn }],
shoeTypes, progress: [{ shoeTypeId, name, pairs, quota, share, pace }], next, late, missed,
workforce, shortfall, canEnter }`. `state` is `UPCOMING`, `DUE`, `LATE` (more than 30 minutes
  past), `ENTERED` or `MISSED`. `checkIn` carries the counts, `constructorsPresent` read at save,
  `attendanceChanged`, notes and any correction.
- **days** → `{ shoeTypes: [{ id, label }], days: [{ day, checkIns, entered, missed, full, byType:
[{ shoeTypeId, label, pairs, quota }], pairs, quota, share, attendanceTaken, constructorsPresent,
constructorsOnRoster, pairsPerConstructor, shortfall }] }`, from the first day a check-in was ever
  entered. `pairsPerConstructor` is a line average for the day.
- **check-ins:** every active shoe type needs a whole number from 0 to 2,000. The slot must be on
  that day's schedule and open (from its time to midnight Manila). Errors: `422` keyed
  `counts.<shoeTypeId>` ("Enter the School Shoes finished since 10:00 as a whole number, like 24.
  Enter 0 if none."); `409 CONFLICT` "The 14:00 check-in isn't open yet. You can enter it from
  14:00." or "The check-in for Mon, 20 Oct closed at midnight. …"; `409 STALE` "Lea Santos already
  entered the 12:00 check-in at 12:04. Refresh to see it."
- **corrections:** the same Manila day only, `reason` 5–300 characters; the audit row keeps both
  counts. `409 STALE` when it changed since it was loaded.
- **schedule:** times `HH:mm`, shift end after start, an interval of 60, 120, 180 or 240 minutes,
  at least one ISO weekday. Always applies from tomorrow.
- **quotas:** `pairs` 1–50,000 per shoe type. A shoe type's first quota applies from today, a change
  from tomorrow; a value equal to the one already set for that day is skipped. Returns `{ saved }`.

## Reports (session)

Aggregates per Manila day, shoe type, defect type or batch, never per person (D-025, D-008). Range params:
`?preset=today|7d|14d|30d` or `?from=YYYY-MM-DD&to=YYYY-MM-DD` (Manila days, inclusive). The
default is the last 14 days, at most 92, and never past today.

| Method & path                            | Permission          | Returns                                                                                                                           |
| ---------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/reports/quality`            | `report:quality`    | `{ range, totals, days[], defects[], matrix[] }`                                                                                  |
| `GET /api/v1/reports/production`         | `report:production` | `{ shoeTypes[], days[], totals: { pairs, share, daysBelow, daysWithQuota } }` (Phase 23)                                          |
| `GET /api/v1/reports/daily.csv`          | `report:quality`    | one row per day: scanned, verdicts, pending, overridden, agreement %, repairs                                                     |
| `GET /api/v1/reports/defects.csv`        | `report:quality`    | one row per defect type (by each scan's top detection), by final verdict                                                          |
| `GET /api/v1/reports/production.csv`     | `report:production` | one row per day and shoe type: pairs, quota, % of quota, check-ins, constructors present, line average, shortfall                 |
| `GET /api/v1/reports/operations`         | `report:production` | `{ kpis, attention[], production, days[], repairs, stock, procurement, suppliers[], rejectedRolls[], checkpoint }` (D-033, D-072) |
| `GET /api/v1/reports/repairs`            | `report:quality`    | `{ waiting, beingRepaired, doneInRange, medianTurnaroundMs, rows[] }` repair station now                                          |
| `GET /api/v1/reports/operations.csv`     | `report:production` | one row per day: rolls started and finished, scans by verdict, repairs done                                                       |
| `GET /api/v1/reports/stock.csv`          | `report:production` | every active item: on hand, reorder level, used and received, days of cover, status                                               |
| `GET /api/v1/reports/suppliers.csv`      | `report:production` | per supplier: rolls, batches, sections, verdict counts, pass %, Fixable %, reject %, top defect, High (D-072)                     |
| `GET /api/v1/reports/supplier-rolls.csv` | `report:production` | the 100 rolls with the most rejects: roll, batch, supplier, sections, rejected, main defects (D-072)                              |

- **Verdicts** count the **final** verdict.
- **AI agreement** = scans the AI decided whose final verdict is the same / scans the AI decided
  (NEEDS_REVIEW excluded).
- **CSV:** UTF-8 with a BOM and CRLF, so it opens correctly in Excel. Text cells starting with
  `= + - @` are prefixed with `'`.

## Coming next

No endpoints are planned beyond the roadmap. Component tracking waits on CPoint's answers.

The Phase 3 CV ingestion contract is specified in `docs/prompts/system-rebuild.md` →
`<cv_integration_contract>`. Keep it stable once published, because the YOLO service depends on it.
