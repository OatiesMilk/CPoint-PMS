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

A batch is one leather roll (D-005). Reads need `batch:read` (Floor Manager, Quality Inspector,
System Admin). Writes need `batch:manage` (Floor Manager). All writes are audited.

| Method & path                      | Body                                                | Returns                                                                          |
| ---------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /api/v1/batches`              | query: `status`, `stage`, `shoeTypeId`, `q`, `page` | `{ data: Batch[], meta: { total, page, pageCount } }`, 20 per page, newest first |
| `POST /api/v1/batches`             | `BatchForm`                                         | `201 { data: Batch }`, status `PLANNED`                                          |
| `GET /api/v1/batches/{id}`         | —                                                   | `{ data: { batch, actions, durations } }`                                        |
| `PATCH /api/v1/batches/{id}`       | `BatchForm`                                         | `{ data: Batch }`                                                                |
| `POST /api/v1/batches/{id}/stages` | `{ action, expectedStage, reason? }`                | `{ data: { code, status, currentStage } }`                                       |
| `POST /api/v1/batches/{id}/cancel` | `{ reason, expectedStage? }`                        | `{ data: { code, status, currentStage } }`                                       |

**`BatchForm`**: `rollCode` (1–50 chars), `shoeTypeId` (uuid), `supplierId?` (uuid),
`receivedAt` (`YYYY-MM-DD`, not in the future in Manila time), `targetQuotaPairs?` (1–100,000),
`notes?` (≤ 500), `rollItemId?` (create only: a leather-roll inventory item; one roll is recorded as
used for the batch in the same transaction, or `422` on `rollItemId` if none is left). The shoe
type can't change once production has started. Cancelling a **planned** batch returns its roll.

**Stage actions:** `start` (PLANNED → Preparation), `advance` (next stage; no skipping),
`complete` (only from Finishing), and `move_back` (previous stage; `reason` required, 3–300 chars).
`expectedStage` is the stage the caller last saw:

- If the batch has moved since, the answer is `409 { error: { code: "STALE" } }`. Reload and retry.
- A move the rules don't allow returns `409 CONFLICT`, with the reason in `message`.

`durations` in the detail response is milliseconds spent per stage, counting repeat visits and
the open stage up to now.

## Camera ingestion (device token)

A camera machine (the YOLO service, a phone/webcam client, or `npm run cv:simulate`) sends each
capture to the system. It authenticates with a **device token** created by a System Admin under
**API tokens**: `Authorization: Bearer cpt_…`. The token is shown once and stored only as a hash.
A revoked, expired or unknown token gets `401`.

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

**Decision (D-011):** the highest confidence among _active_ defect types decides, using the
thresholds set by the admin (default ≥ 0.90 → `REJECT`, ≥ 0.60 → `REWORK`, otherwise `PASS`).
Any `classKey` the system doesn't know → `NEEDS_REVIEW` (the scan waits in the review queue, and the
class is stored and flagged). Class keys are matched exactly (`cut`, `hole`, `abrasion`, `dirt`).
Add new ones under Admin → Settings when the model is retrained.

**Outcome rows:** `REWORK` opens a repair ticket; `REJECT` creates a salvage item (D-007).

**`201`** `{ "data": { "scanId", "batchId", "batchCode", "sequence", "verdict", "status" } }`.
`409` when no batch is at Preparation (`message` says what to do). `413` over 10 MB. `422` for invalid fields.

### Which batch: `GET /api/v1/batches/current`

The single Preparation camera feeds **the batch picked on the Camera page**. If none is picked, or
it has left Preparation, it feeds **the batch that has been at Preparation the longest** (D-020).
Call this before capturing to show the operator where scans will go. It accepts a device token or
a signed-in session.

`200 { "data": { "batchId", "batchCode", "rollCode", "shoeType", "selection": "selected" | "oldest", "stageStartedAt" } }`,
or `404 NO_BATCH_AT_PREPARATION`.

## Scans (session)

| Method & path                      | Permission    | Notes                                                                                                                               |
| ---------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/scans`                | `scan:read`   | filters `verdict`, `status`, `source`, `batch` (code), `override=1`, `page`; or `limit=1…50` for the latest scans (the live widget) |
| `GET /api/v1/scans/{id}`           | `scan:read`   | scan, detections (with boxes), rework/salvage history, who decided                                                                  |
| `GET /api/v1/scans/{id}/image`     | `scan:read`   | the captured image (`Cache-Control: private`)                                                                                       |
| `POST /api/v1/scans/{id}/decision` | `scan:decide` | `{ verdict: PASS\|REWORK\|REJECT, reason?, expectedFinalVerdict }`                                                                  |

**Decisions:**

- Resolving a `NEEDS_REVIEW` scan needs no reason. Changing an existing decision (an override)
  needs a `reason` (3–300 characters).
- `expectedFinalVerdict` is the verdict the person saw (`null` for pending). If it changed, the
  answer is `409 STALE`.
- The repair ticket or salvage item is swapped to match the new verdict.
- `409` once the batch is closed, or once the material has moved on (repair started, salvage
  reused or discarded).

## Rework and salvage (session)

Every REWORK verdict opens a **repair ticket**; every REJECT keeps the section as **salvage**
(D-007). These endpoints move them along. Each takes `expectedStatus` (what the caller last saw)
and answers `409 STALE` if it changed. All moves are audited.

| Method & path                        | Permission       | Body / query                                                               |
| ------------------------------------ | ---------------- | -------------------------------------------------------------------------- |
| `GET /api/v1/rework`                 | `rework:manage`  | `?batch=` → `{ waiting, inProgress, done }` (done = last 7 days)           |
| `POST /api/v1/rework/{id}/status`    | `rework:manage`  | `{ move: start\|done\|reopen\|unstart, expectedStatus, note? }`            |
| `GET /api/v1/salvage`                | `salvage:read`   | `?status=AVAILABLE\|ASSIGNED\|DISCARDED&batch=` → `{ rows, counts }`       |
| `POST /api/v1/salvage/{id}/assign`   | `salvage:manage` | `{ batchId, expectedStatus, note? }`, another planned or in-progress batch |
| `POST /api/v1/salvage/{id}/unassign` | `salvage:manage` | `{ expectedStatus }`, only while the receiving batch is open               |
| `POST /api/v1/salvage/{id}/discard`  | `salvage:manage` | `{ reason, expectedStatus }`; final                                        |

**Repairs:**

- **Flow:** `start` (OPEN → IN_PROGRESS) and `done` (IN_PROGRESS → DONE). Each can be undone one
  step: `unstart` (IN_PROGRESS → OPEN) and `reopen` (DONE → IN_PROGRESS).
- **Usable count:** a repaired section counts as usable in its batch (usable = passed + repaired).
- **Closing a batch:** a batch can be completed while repairs are open (D-022). Its repairs stay
  workable, and `GET /api/v1/batches` rows carry `openRepairs` for the "In repair" tag. Only a
  cancelled batch freezes its repairs (`409`): cancelling cancels the unfinished ones.

## Inventory (session)

Stock is a ledger (D-023): `quantityOnHand` changes **only** through a movement, and movements are
never edited or deleted. Quantities are numbers with at most 2 decimals.

| Method & path                                | Permission         | Body / query                                                                         |
| -------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `GET /api/v1/inventory`                      | `inventory:read`   | `?category=&stock=low\|out&q=&inactive=1&page=` → `{ rows, total, page, pageCount }` |
| `POST /api/v1/inventory`                     | `inventory:manage` | `ItemForm` → `201`                                                                   |
| `GET /api/v1/inventory/{id}`                 | `inventory:read`   | `?page=` → `{ item, movements, page, pageCount }` (newest first, `balanceAfter`)     |
| `PATCH /api/v1/inventory/{id}`               | `inventory:manage` | `ItemForm` (quantity is never editable), or `{ isActive }`                           |
| `GET /api/v1/inventory/{id}/movements`       | `inventory:read`   | `?page=`                                                                             |
| `POST /api/v1/inventory/{id}/movements`      | `inventory:manage` | `Movement` → `201 { movementId, onHandAfter, message }`                              |
| `POST /api/v1/inventory/movements/{id}/undo` | `inventory:manage` | records the opposite of a recent IN/OUT (within 10 minutes, once)                    |

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

| Method & path                        | Body                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `GET / PUT /api/v1/settings/cv`      | `{ rejectPercent, reworkPercent }`, e.g. `90`, `60`; rework must be below reject               |
| `GET /api/v1/defect-types/unknown`   | class keys the camera sent that no defect type covers: `{ rawClassKey, detections, lastSeen }` |
| `GET / POST /api/v1/defect-types`    | `{ key, label, description?, sortOrder? }` (key fixed after creation)                          |
| `GET / POST /api/v1/shoe-types`      | `{ code, name, sortOrder? }`                                                                   |
| `GET / POST /api/v1/suppliers`       | `{ name, contactPerson?, phone?, notes? }`                                                     |
| `GET / POST /api/v1/component-types` | `{ name, shoeTypeId?, sortOrder? }`                                                            |
| `PATCH /api/v1/<list>/{id}`          | the same fields, or `{ isActive }`. There are no deletes.                                      |

New thresholds apply to new scans only; each scan keeps its `thresholdsSnapshot`.

**Audit log**: `GET /api/v1/audit-logs?actor=&action=&entity=&entityId=&from=&to=&page=`
(`from`/`to` are Manila calendar days) → `{ entries, total, page, pageCount }`, newest first, 50
per page. Each entry carries the changed fields as `diff: [{ key, before, after }]`.

## Reports (session)

Aggregates per Manila day, defect type or stage, never per person (D-025, D-008). Range params:
`?preset=today|7d|14d|30d` or `?from=YYYY-MM-DD&to=YYYY-MM-DD` (Manila days, inclusive). The
default is the last 14 days, at most 92, and never past today.

| Method & path                     | Permission          | Returns                                                                       |
| --------------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| `GET /api/v1/reports/quality`     | `report:quality`    | `{ range, totals, days[], defects[], matrix[] }`                              |
| `GET /api/v1/reports/production`  | `report:production` | `{ range, stages[], bottleneck, days[], totals }` (stage times in ms)         |
| `GET /api/v1/reports/daily.csv`   | `report:quality`    | one row per day: scanned, verdicts, pending, overridden, agreement %, repairs |
| `GET /api/v1/reports/defects.csv` | `report:quality`    | one row per defect type (by each scan's top detection), by final verdict      |
| `GET /api/v1/reports/stages.csv`  | `report:production` | per stage: visits, median/average hours, in stage now, bottleneck             |

- **Verdicts** count the **final** verdict.
- **AI agreement** = scans the AI decided whose final verdict is the same / scans the AI decided
  (NEEDS_REVIEW excluded).
- **CSV:** UTF-8 with a BOM and CRLF, so it opens correctly in Excel. Text cells starting with
  `= + - @` are prefixed with `'`.

## Coming next

| Phase | Endpoints                                      |
| ----- | ---------------------------------------------- |
| 8     | none planned; hardening of the endpoints above |

The Phase 3 CV ingestion contract is specified in `docs/prompts/system-rebuild.md` →
`<cv_integration_contract>`. Keep it stable once published, because the YOLO service depends on it.
