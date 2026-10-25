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

**Validation errors (D-038).** A `422` carries `details[]` with one issue per field: `path` is the
full path (`["marks", 1, "present"]`) and `message` names the field and the fix ("Enter a
quantity greater than 0."). The top-level `message` is that sentence when there is one issue, or
"N fields need fixing. Start with this one: …" when there are several. This holds for every
endpoint.

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

## Rolls (`/api/v1/rolls`, Phase 26)

A roll is one leather roll from a supplier (D-095). A Shoe Constructor with camera access starts it
at Capture, captures it shot by shot and finishes it once all of it is in; several rolls may be
open at once. The Floor Manager reads every roll (Reports → Rolls) and may cancel an open one with
a reason. Nothing is deleted: a cancelled roll keeps its shots, which the reports leave out. Every
write is audited (`roll.start`, `roll.finish`, `roll.cancel`). No response names a person (D-008).

| Method & path                    | Who                                                             | Body / query                                            | Returns                                                                                                     |
| -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/rolls`              | `roll:read` (Floor Manager)                                     | `status`, `supplierId`, `days` (7, 30, 90), `q`, `page` | `{ data: Roll[], meta: { total, page, pageCount } }`, 15 a page, newest first, with `passed` and `rejected` |
| `GET /api/v1/rolls/{id}`         | `roll:read`                                                     | —                                                       | the roll with its shots and their detections                                                                |
| `POST /api/v1/rolls`             | a Shoe Constructor with camera access                           | `{ supplierId, tagCode? }`                              | `201 { data: OpenRoll }`, status `OPEN`, code `R-YYYY-NNNN`                                                 |
| `GET /api/v1/rolls/open`         | a Shoe Constructor with camera access                           | —                                                       | `{ data: OpenRoll[] }`, every open roll (the Capture page's Roll dropdown)                                  |
| `POST /api/v1/rolls/{id}/finish` | a Shoe Constructor with camera access                           | `{}`                                                    | `{ data: { id, code, status: "FINISHED", shots } }`                                                         |
| `POST /api/v1/rolls/{id}/cancel` | camera access (an empty roll), or `roll:manage` (any open roll) | `{}`, or `{ reason }` from the Floor Manager            | `{ data: { id, code, status: "CANCELLED" } }`                                                               |
| `GET /api/v1/rolls/current`      | a device token (`scans:create`)                                 | —                                                       | the roll open the longest, or `404 NO_OPEN_ROLL`                                                            |

**`OpenRoll`**: `{ id, code, tagCode, supplier, shots, startedAt, mine }`; `mine` only says whether
the person asking started it, to start the dropdown on their own roll. `/current` leaves it out.

- `supplierId` is required and must be an active supplier (`422` on `supplierId`, "Choose the
  supplier this roll came from."). `tagCode` is the number on the supplier's tag, up to 40.
- Finish needs at least one shot (`409` "A roll needs at least one shot to finish. Cancel it
  instead."). At Capture only an empty roll can be cancelled; the Floor Manager's cancel needs a
  `reason` of 1 to 200 characters.
- A roll that is already finished or cancelled answers `409 CONFLICT`; if someone else closed it
  between the read and the write, `409 STALE` (D-019).
- Removed (`404`): `/api/v1/batches/**`, `POST …/stages`, `PATCH` of a roll. Rolls from before
  Phase 26 keep their `B-` codes; their stage history went with the migration `rolls_at_capture`.

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
| `rollId`       | no       | The roll the scan belongs to. Omitted: the roll open the longest (see "Which roll")                                                                                                                                                                                |
| `captureId`    | no       | A UUID the camera makes for each capture. Send the same one on every retry: a repeat returns the first scan instead of making a second one (D-051). `cpoint_cv` always sends it                                                                                    |

**Decision (D-093):** every section is `PASS` or `REJECT`, final at once. A detection of an
_active_ defect type at or above `foundAtOrAbove` (Settings, default 0.5) gives its type's outcome:
`USABLE` or `NOT_ACCEPTED`. Any `NOT_ACCEPTED` → `REJECT`, otherwise `PASS`. Any `classKey` the
system doesn't know → `REJECT` (A-12), and the class is stored and listed under Settings → Unknown
classes. Class keys are matched exactly. A new database gets `crease` and `scratch` Usable and
`cut`, `hole`, `abrasion` and `dirt` Not accepted; for yolo-v1 turn `abrasion` and `dirt` off
under Admin → Settings (D-052, `cv/README.md`). Add new ones there when the model is retrained.
A rejected section is reported for salvage; nothing else is created.

**`201`** `{ "data": { "scanId", "rollId", "rollCode", "sequence", "verdict", "duplicate": false, "defects": [{ "label", "confidence", "unknown", "effect": "USABLE" | "NOT_ACCEPTED" | null }] } }`.

**`200`** the same body with `"duplicate": true` (and `defects: []`) when this device already sent
the `captureId`: nothing new is stored or audited, even if the roll has since been finished.

`409` `NO_OPEN_ROLL` when no roll is open, `ROLL_CLOSED` when the `rollId` sent was finished or
cancelled (checked again under the row lock, so no shot lands on a closed roll), or `CONFLICT` when
another device already used the `captureId` (`message` says which). `413` over 10 MB. `422`
for invalid fields (`details` names each one).

### `POST /api/v1/scans/capture` (the website's Capture page, Phase 18)

The Capture page (`/camera/capture`) sends the frame on screen here. It uses the **signed-in
session**, not a device token, and needs a Shoe Constructor the System Admin gave camera access
(`camera:capture` + `canCapture`, D-075, Phase 26). The Quality Inspector and the Floor Manager no
longer capture. The app runs the model itself (ONNX Runtime, D-064) and then decides exactly as for
`POST /api/v1/scans`: the same `ingestScan` and decision engine.

`multipart/form-data`:

| Field        | Required | Notes                                                                                                        |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| `image`      | yes      | JPEG, PNG or WebP (checked by content), ≤ 10 MB. The page sends the camera frame as a JPEG                   |
| `captureId`  | yes      | A UUID the page makes for each press. A retry with the same one returns the first scan without running again |
| `rollId`     | yes      | The roll chosen in the Roll dropdown. It must still be open                                                  |
| `source`     | no       | `WEBCAM` (default) or `PHONE` (the page sends `PHONE` from a phone or tablet)                                |
| `capturedAt` | no       | ISO 8601 with offset: when Capture was pressed                                                               |

There is no `detections` or `modelVersion` field: the server produces both.

**`201`** `{ "data": { "scanId", "rollId", "rollCode", "sequence", "verdict", "duplicate": false, "defects": [...], "detections": [...], "modelVersion", "inferenceMs" } }`.
**`200`** the same with `"duplicate": true` (and `detections: []`) for a repeated `captureId`.

| Status | `code`              | When                                                                      |
| ------ | ------------------- | ------------------------------------------------------------------------- |
| `401`  | `UNAUTHENTICATED`   | Not signed in                                                             |
| `403`  | `FORBIDDEN`         | Not allowed to capture (anyone but a Shoe Constructor with camera access) |
| `409`  | `NO_ROLL_CHOSEN`    | No `rollId`: choose the roll this shot belongs to                         |
| `409`  | `ROLL_CLOSED`       | The chosen roll was finished or cancelled; checked before the model runs  |
| `409`  | `CONFLICT`          | The `captureId` was already used by a device-token scan                   |
| `413`  | `PAYLOAD_TOO_LARGE` | Over 10 MB                                                                |
| `422`  | `VALIDATION_FAILED` | A field is wrong; `message` names it                                      |
| `503`  | `MODEL_UNAVAILABLE` | The model files aren't on the server (the message says where to put them) |

The scan stores no person (D-008): `deviceTokenId` is null for a website scan, and the audit row
`scan.create` names the signed-in user as the actor with `origin: "website"`.

### Which roll

A shot from the Capture page goes to the roll chosen in its Roll dropdown (`rollId`). A device token
(the simulator) may name a roll; without one its scan goes to **the roll open the longest**
(D-020's fallback). `GET /api/v1/rolls/current` tells a device which roll that is.

### Who may capture: `PUT /api/v1/camera/operators/{userId}`

`camera:operators` (System Admin only since Phase 26; the Floor Manager gets `403`). Body
`{ "canCapture": true | false }` for an active Shoe Constructor (D-075). `200 { "data": { "id",
"canCapture" } }`; `404` for an unknown person, `409` for anyone who isn't an active Shoe
Constructor. Audited as `camera.capture_access.grant` / `.revoke`. Applies on the person's next
request. In the app: Users → More actions → Give camera access.

Any use of a device token is recorded (at most once a minute, shown under API tokens). The
station check-in that used it (D-054) was retired with the station app in Phase 20 (D-069).

**How a scan is decided (D-053, D-093).** See "Decision" above. The scan keeps the rule in
`thresholdsSnapshot`: `{ foundAtOrAbove, outcomes: { key: "USABLE" | "NOT_ACCEPTED" } }`. Scans
from before 24 Oct 2026 keep the earlier shape (`rejectAtOrAbove`, `reworkAtOrAbove`, sometimes
`actions`); their REWORK verdicts were converted to `PASS` and NEEDS_REVIEW to `REJECT`.

## Scans (session)

| Method & path                  | Permission                   | Notes                                                                                     |
| ------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/v1/scans/{id}`       | `scan:read` (FM)             | scan and detections (with boxes); no person                                               |
| `GET /api/v1/scans/{id}/image` | `scan:read` or `camera:view` | the captured image (`Cache-Control: private`); the Admin's Camera page shows the last one |

There is no scans list since Phase 28 (A-26, D-100): `GET /api/v1/scans` answers `405` (only the
device `POST` remains), and a section is reached from its roll (`/api/v1/rolls/{id}`).

The camera's verdict is final (D-093): there is no decision endpoint. The Review Queue, the Repair
Station and Salvage, with `/api/v1/rework/**`, `/api/v1/salvage/**` and
`POST /api/v1/scans/{id}/decision`, were removed in Phase 25 (D-094) and answer `404`.

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
- `{ "type": "OUT", "quantity": 1, "reason"? }`: stock used. `409` if it would go below zero
  ("Only 2 rolls in stock…"). Usage names no roll since Phase 26; older movements keep their link.
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

| Method & path                      | Body                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET / PUT /api/v1/settings/cv`    | `{ foundPercent, earlyModelNotice? }`, e.g. `50` (1 to 100, one decimal). `rejectPercent` or `reworkPercent` is refused with a named message (D-093) |
| `GET /api/v1/defect-types/unknown` | class keys the camera sent that no defect type covers: `{ rawClassKey, detections, lastSeen }`                                                       |
| `GET / POST /api/v1/defect-types`  | `{ key, label, outcome, description?, sortOrder? }` (key fixed; `outcome` `USABLE` or `NOT_ACCEPTED`, required, D-093)                               |
| `GET / POST /api/v1/suppliers`     | `{ name, contactPerson?, phone?, notes? }`                                                                                                           |
| `PUT /api/v1/settings/lunch-break` | `{ startTime, endTime }` (`HH:mm`, inside tomorrow's shift, end after start) or `{ none: true }`; applies from tomorrow (D-097)                      |
| `PATCH /api/v1/<list>/{id}`        | the same fields, or `{ isActive }`. There are no deletes.                                                                                            |

A new found-at value or outcome applies to new scans only; each scan keeps its `thresholdsSnapshot`.
Shoe types and `/api/v1/shoe-types/**` were removed in Phase 27 (D-099, `404`).

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

## Batches (session, Phase 27; before it Production, Phase 23)

A batch is one check-in interval of the working day (D-097 to D-099): the schedule and the one
daily quota (Floor Manager), the lunch break (System Admin, under Settings above) and each batch's
pairs finished and failed inspection (Quality Inspector). Everything is per batch or day for the
whole line (D-008); the only name is who finished or corrected a batch. Days are Manila calendar
days. The paths keep `production`; a finished batch is a `check-in` row whose `slotAt` is the
batch's end.

| Method & path                             | Permission           | Body / query                                             |
| ----------------------------------------- | -------------------- | -------------------------------------------------------- |
| `GET /api/v1/production/today`            | `production:read`    | —                                                        |
| `GET /api/v1/production/days?from=&to=`   | `production:read`    | default the last 14 days, at most 92                     |
| `POST /api/v1/production/check-ins`       | `production:checkin` | `{ slotAt, pairs, failedPairs?, notes? }`                |
| `PATCH /api/v1/production/check-ins/{id}` | `production:checkin` | `{ expectedUpdatedAt, pairs, failedPairs?, reason }`     |
| `PUT /api/v1/production/schedule`         | `production:plan`    | `{ shiftStart, shiftEnd, intervalMinutes, workingDays }` |
| `PUT /api/v1/production/quotas`           | `production:plan`    | `{ pairs, suggestedPairs? }`                             |

`production:read` is the Floor Manager, the Quality Inspector and the System Admin;
`production:checkin` the Quality Inspector, and the Floor Manager **only on a day attendance shows no
Quality Inspector present** (D-088; otherwise `403` "A Quality Inspector is present today, so they
finish the batches." or "Take today's attendance first. …"); `production:plan` the Floor Manager.

- **today** → `{ day, dayLabel, schedule, lunch, workingDay, rows: [{ number, slotAt, startTime,
time, lunch, times, label, state, pausedForLunch, canFinishNow, finishOpensAt, lateBy, checkIn }],
progress: { finished, failed, passed, quota, share, pace }, next, late, missed, workforce,
shortfall, canEnter, covering, enterNote }`. `state` is `UPCOMING`, `IN_PROGRESS`, `DUE`, `LATE`
  (30 minutes past the end), `FINISHED` or `MISSED` (after midnight), worked out on each request.
  `checkIn` carries `pairs`, `failedPairs`, `constructorsPresent` read at save,
  `attendanceChanged`, notes, `enteredLate` and any correction. The browser's notices are worked
  out from this.
- **days** → `{ days: [{ day, batches, finishedBatches, missed, full, finished, failed, passed,
failedShare, quota, share, attendanceTaken, constructorsPresent, constructorsOnRoster,
pairsPerConstructor, shortfall }] }`, from the first day a batch was ever finished. `share` is
  passed ÷ quota (C-41); `pairsPerConstructor` is a line average.
- **check-ins (Finish batch):** `slotAt` must be the end of a batch on that day; Finish batch is
  open from 10 minutes before the end until midnight Manila. `pairs` 0–2,000; `failedPairs`
  0–2,000 (default 0) and never more than `pairs`. Returns `{ id, number, time }`. Errors: `422`
  keyed `pairs` ("Enter the pairs finished in Batch 2 as a whole number, like 24. Enter 0 if
  none.") or `failedPairs` ("Failed inspection can't be more than the pairs finished (12).");
  `409 CONFLICT` "Batch 3 can be finished from 14:50.", "Batch 1 of Mon, 20 Oct closed at
  midnight. …" or "There's no batch ending at 12:00 on …"; `409 STALE` "Lea Santos already
  finished Batch 1 at 13:04. Refresh to see it."
- **corrections:** the same Manila day only, `reason` 5–300 characters; the audit row keeps both
  counts. `409 STALE` when it changed since it was loaded.
- **schedule:** times `HH:mm`, shift end after start, `intervalMinutes` 60, 120, 180 or 240, or
  `null` (or `"end"`) for once at the end of the day, at least one ISO weekday. Always applies
  from tomorrow.
- **quotas:** one `pairs` 1–50,000 for the whole line. The first quota applies from today, a change
  from tomorrow; a value equal to the one already set for that day is skipped. Returns
  `{ saved, effectiveFrom }`.

## Reports (session)

Aggregates per Manila day, defect type, supplier or roll, never per person (D-025, D-008). Shots of a cancelled roll are left out (Phase 26). Range params:
`?preset=today|7d|14d|30d` or `?from=YYYY-MM-DD&to=YYYY-MM-DD` (Manila days, inclusive). The
default is the last 14 days, at most 92, and never past today.

| Method & path                            | Permission          | Returns                                                                                                                   |
| ---------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/reports/quality`            | `report:quality`    | `{ range, totals: { scanned, pass, reject }, days[], defects[] }`                                                         |
| `GET /api/v1/reports/production`         | `report:production` | `{ days[], totals: { finished, failed, passed, failedShare, share, daysBelow, daysWithQuota } }` (Phase 27)               |
| `GET /api/v1/reports/daily.csv`          | `report:quality`    | one row per day: Scanned, Pass, Reject (for salvage)                                                                      |
| `GET /api/v1/reports/defects.csv`        | `report:quality`    | one row per defect type (by each scan's top detection): Scans, Pass, Reject (for salvage)                                 |
| `GET /api/v1/reports/production.csv`     | `report:production` | one row per day: pairs finished, failed, % failed, passed, quota, % of quota (passed), batches, constructors, shortfall   |
| `GET /api/v1/reports/operations`         | `report:production` | `{ kpis, attention[], production, days[], stock, suppliers[], rejectedRolls[], lineRejectShare, forSalvage, checkpoint }` |
| `GET /api/v1/reports/operations.csv`     | `report:production` | one row per day: rolls started and finished, sections scanned, Pass, Reject (for salvage)                                 |
| `GET /api/v1/reports/stock.csv`          | `report:production` | every active item: on hand, reorder level, used and received, days of cover, status                                       |
| `GET /api/v1/reports/suppliers.csv`      | `report:production` | per supplier: rolls, sections, Pass, Reject (for salvage), Pass %, Reject %, top defect, High (D-072)                     |
| `GET /api/v1/reports/supplier-rolls.csv` | `report:production` | the 100 rolls with the most rejects: roll, tag number, supplier, sections, rejected, main defects (D-072)                 |

- **Verdicts** are Pass and Reject (D-093); the final verdict is the camera's.
- **For salvage** (`forSalvage`): `{ total, byDefect: [{ key, label, known, sections }] }`, the
  rejected sections by main defect (A-11). `/api/v1/reports/repairs` was removed (D-094).
- **CSV:** UTF-8 with a BOM and CRLF, so it opens correctly in Excel. Text cells starting with
  `= + - @` are prefixed with `'`.

## Demo tools (no session, Phase 28, D-101)

Only while `DEMO_LOGIN_TOOLS=true` and `SEED_DEMO_USERS=true`; otherwise both answer `404`. The
only routes without `requireApiPermission`.

| Method & path               | Body                               | Notes                                                                                                                                                                                                       |
| --------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/demo/sign-in` | `{ role }` (one of the four roles) | signs in as that role's demo account with the server's `DEMO_USER_PASSWORD`; `200 { data: { redirectTo } }`. `409 DEMO_ACCOUNT_MISSING` or `DEMO_PASSWORD_MISSING`; `401 SIGN_IN_FAILED` (locked, inactive) |
| `POST /api/v1/demo/reset`   | `{ confirm: "RESET" }`             | the `demo:reset` plus a fresh demo week (about a minute); `200 { data: { removed, demoWeek } }`; `409 RESET_RUNNING` while one runs; `422` for any other word                                               |

## Coming next

No endpoints are planned beyond the roadmap. Component tracking waits on CPoint's answers.

The Phase 3 CV ingestion contract is specified in `docs/prompts/system-rebuild.md` →
`<cv_integration_contract>`. Keep it stable once published, because the YOLO service depends on it.
