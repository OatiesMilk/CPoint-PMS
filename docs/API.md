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

## Rolls (`/api/v1/rolls`, Phase 26; from Inventory since Phase 30A)

A roll is one leather roll from a supplier (D-095). Since Phase 30A (D-103) the Floor Manager adds
each roll to its leather item in Inventory with its own area; a Shoe Constructor with camera access
picks the leather, then the roll, at Capture (Phase 30E, D-113), captures it shot by shot and
finishes it, and then it **leaves stock (−1)** whatever its Defect % (D-112). Nobody ticks rolls
Fully used and the Floor Manager no longer returns or keeps them; those rolls from before stay as
history. Several rolls may be scanned at once. Nothing is deleted: a removed roll keeps its shots,
which the reports leave out. Every write is audited (`roll.add`, `roll.start`, `roll.finish`,
`roll.cancel`, `roll.remove`; the migration's one `roll.leave_stock_at_capture`). No response names
a person (D-008).

| Status (`status`) | Reads                | How it gets there                                      | Stock |
| ----------------- | -------------------- | ------------------------------------------------------ | ----- |
| `IN_STOCK`        | Not scanned          | the FM adds it (`POST /inventory/{id}/rolls`)          | +1    |
| `OPEN`            | Being scanned        | picked at Capture (`POST /rolls/{id}/start`)           |       |
| `FINISHED`        | Scanned              | `POST /rolls/{id}/finish`, at least one shot           | −1    |
| `CANCELLED`       | Removed              | the FM's `POST /rolls/{id}/remove`, with a reason      | −1    |
| `USED`            | Fully used           | history only (ticked at Finish batch before Phase 30E) |       |
| `RETURNED`        | Returned to supplier | history only (the FM's decision in Phase 30C)          |       |

| Method & path                       | Who                                   | Body / query                                                                                         | Returns                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/inventory/{id}/rolls` | `inventory:manage` (Floor Manager)    | `{ receivedOn, rolls: [{ areaSqFt, tagCode? }] }`                                                    | `201 { data: { added: [{ id, code, areaSqFt, tagCode }], quantityOnHand } }`, codes `LR-<supplier>-001`                                                                   |
| `GET /api/v1/rolls`                 | `roll:read` (Floor Manager)           | `status` (`NOT_SCANNED`, `PASSED`, `RETURNED`, D-116), `supplierId`, `days` (7, 30, 90), `q`, `page` | `{ data: Roll[], meta: { total, page, pageCount } }`, 15 a page, newest first, with `passed` and `rejected`                                                               |
| `GET /api/v1/rolls/{id}`            | `roll:read`                           | —                                                                                                    | the roll with its item, area, shots and their detections                                                                                                                  |
| `POST /api/v1/rolls`                | —                                     | —                                                                                                    | `405`: rolls are added in Inventory and picked at Capture                                                                                                                 |
| `GET /api/v1/rolls/ready`           | a Shoe Constructor with camera access | —                                                                                                    | `{ data: ReadyRoll[] }`, rolls not scanned yet, oldest first                                                                                                              |
| `POST /api/v1/rolls/{id}/start`     | a Shoe Constructor with camera access | `{}`                                                                                                 | `{ data: OpenRoll }`, status `OPEN`; `409` named when it isn't `IN_STOCK` any more                                                                                        |
| `GET /api/v1/rolls/open`            | a Shoe Constructor with camera access | —                                                                                                    | `{ data: OpenRoll[] }`, every roll being scanned (the Capture page's Roll dropdown), each with `scale` (`{ widthIn, width, height, shot }` or null) and `lunches` (D-121) |
| `GET /api/v1/rolls/plan`            | a Shoe Constructor with camera access | —                                                                                                    | `{ data: CapturePlanDay[] }`, today and the next planned days (5 in all) with `planned` and `scanned` (D-118)                                                             |
| `POST /api/v1/rolls/{id}/finish`    | a Shoe Constructor with camera access | `{}`                                                                                                 | `{ data: { id, code, status: "FINISHED", shots, sharePct, limitPct, marked, notMeasured, scanningMs } }` (Phase 30C)                                                      |
| `POST /api/v1/rolls/{id}/cancel`    | a Shoe Constructor with camera access | `{}`                                                                                                 | put back: an empty roll from Inventory returns to `IN_STOCK`; one from before Phase 30A is `CANCELLED`                                                                    |
| `POST /api/v1/rolls/{id}/remove`    | `roll:manage` (Floor Manager)         | `{ reason }` (1 to 200 characters)                                                                   | `{ data: { id, code, status: "CANCELLED" } }`                                                                                                                             |
| `GET /api/v1/rolls/current`         | a device token (`scans:create`)       | —                                                                                                    | the roll being scanned the longest, or `404 NO_OPEN_ROLL`                                                                                                                 |

Phase 32 (D-128) adds where each roll is kept; see **Storage locations** below for the routes. On
the routes above: `POST /inventory/{id}/rolls` takes an optional `locationId` (an active location;
each roll is placed there), `POST /rolls/{id}/cancel` (put back) takes an optional
`{ locationId }` (an empty body still works), and the start, put back and remove audits carry the
location before and after.

**`ReadyRoll`**: `{ id, code, tagCode, supplier, item, areaSqFt, location }` (`location` is
`{ code, name }` or null, Phase 32). **`OpenRoll`**: the same plus
`{ shots, startedAt, mine, fromInventory, takenFromId }`; `mine` only says whether the person
asking picked it, to start the dropdown on their own roll; `takenFromId` is the location it was
taken from when picked (to prefill Put back), and an open roll's `location` is null. `/current`
leaves `mine` out.

- **Add rolls:** the item must be an active Leather roll item with an active supplier (its code
  makes the roll codes), else `409` named. `receivedOn` is a date, not after today (Manila).
  `areaSqFt` is 0.1 to 200 with at most two decimals; each message names the roll ("Roll 2: enter
  its area in square feet, like 24.5."), at `rolls.<i>.areaSqFt`. `tagCode` is the number on the
  supplier's tag, up to 40. Up to 50 rolls a save. Each roll is an `IN` +1 with its `rollId`.
- **Start** (Phase 30E, D-113): Capture lists the rolls waiting by leather, then the chosen
  leather's rolls by code and area; `POST /rolls/{id}/start` picks one (`409` named when it isn't
  in stock any more).
- **Finish** needs at least one shot (`409` "A roll needs at least one shot to finish. Put it back
  instead."). It takes the roll off its item's stock (`OUT` −1, "Roll LR-… scanned at Capture",
  D-112). It saves the roll's **defect share** (Phase 30C, D-106, D-110): the sum of its shots'
  defect areas (each shot's union of boxes, overlaps once) over its entered area, plus the flat
  shares (a cut from 3 in counts 1%). More than `returnSharePct` (Settings, default 10, strict) sets
  `markedForReturn` (`marked: true`): the roll is **Returned to supplier** (D-116; Reports →
  Rolls' status, Materials' Leather rolls, Supplier quality). `sharePct` is null and `notMeasured` says why (`no-area`, `no-shots`,
  `unscaled`: a shot had no scale, from a marker card or an older calibration) when it can't be worked out (A-28);
  such a roll isn't marked. **Cancel** at Capture only for a roll with no shots.
- **Remove:** a roll from Inventory still in stock or being scanned (`OUT` −1); a scanned roll is
  already off stock (`409` "LR-… is already scanned."); a roll from before Phase 30A only while it
  is open.
- **Gone in Phase 30E:** `POST /api/v1/rolls/{id}/return-decision` (404) and Fully used:
  `usedRollIds` on the check-ins is ignored, and `GET /api/v1/production/today` has no
  `rollsToTick`. Batches finished before still list `checkIn.usedRolls` as history.
- A roll that is already finished or removed answers `409 CONFLICT`; if someone else changed it
  between the read and the write, `409 STALE` (D-019).
- Removed (`404`): `/api/v1/batches/**`, `POST …/stages`, `PATCH` of a roll. Rolls from before
  Phase 30A keep their `R-` or `B-` codes, have no item or area and can't be ticked.

## Camera ingestion (device token)

A camera machine (the YOLO service, a phone/webcam client, or `npm run cv:simulate`) sends each
capture to the system. It authenticates with a **device token** created by a System Admin under
**API tokens**: `Authorization: Bearer cpt_…`. The token is shown once and stored only as a hash.
A revoked, expired or unknown token gets `401`; a token without the `scans:create` scope gets `403`.
Real captures come from the website's Capture page (`POST /api/v1/scans/capture`, below); the
camera station app was retired in Phase 20 (D-069). The simulator is the token client now.

### `POST /api/v1/scans`

`multipart/form-data`, one leather section per request:

| Field           | Required | Notes                                                                                                                                                                                                                                                              |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `image`         | yes      | JPEG, PNG or WebP (checked by content, not file name), ≤ 10 MB                                                                                                                                                                                                     |
| `detections`    | no       | JSON array, ≤ 50: `[{ "classKey": "cut", "confidence": 0.93, "box": { "x": 0.12, "y": 0.40, "width": 0.08, "height": 0.05 } }]`. `box` is in fractions (0–1) of the image width and height, from the top-left corner. Omit it or send `[]` when nothing was found. |
| `source`        | no       | `SIMULATOR`, `PHONE`, `WEBCAM` (default), `DEDICATED_CAMERA`                                                                                                                                                                                                       |
| `modelVersion`  | no       | e.g. `yolov8n-cpoint-2026-10`, shown on the scan                                                                                                                                                                                                                   |
| `capturedAt`    | no       | ISO 8601 with offset; defaults to the time received                                                                                                                                                                                                                |
| `rollId`        | no       | The roll the scan belongs to. Omitted: the roll open the longest (see "Which roll")                                                                                                                                                                                |
| `captureId`     | no       | A UUID the camera makes for each capture. Send the same one on every retry: a repeat returns the first scan instead of making a second one (D-051). `cpoint_cv` always sends it                                                                                    |
| `widthIn`       | no       | The scale (Phase 30C): the inches the photo covers across its width, 4 to 120. Without it (and without `markerCorners`) nothing is measured                                                                                                                        |
| `markerCorners` | no       | The scale marker cards on the photo (D-120), as for `POST /api/v1/scans/capture`. When sent, the scale comes from them and `widthIn` is ignored                                                                                                                    |

**Decision (D-093):** every section is `PASS` or `REJECT`, final at once. A detection of an
_active_ defect type at or above `foundAtOrAbove` (Settings, default 0.5) gives its type's outcome:
`USABLE` or `NOT_ACCEPTED`. Any `NOT_ACCEPTED` → `REJECT`, otherwise `PASS`. A `classKey` with no
defect type is dropped: not stored and no effect on the verdict (D-108). Class keys are matched exactly. A new database gets `crease` and `scratch` Usable and
`cut`, `hole`, `abrasion` and `dirt` Not accepted; for yolo-v1 turn `abrasion` and `dirt` off
under Admin → Settings (D-052, `cv/README.md`). Add new ones there when the model is retrained.
A rejected section is not cut (D-116); nothing else is created.

**Measuring (Phase 30C, D-106, D-110):** with `widthIn` and the photo's size (read from the image,
EXIF turns applied) each detection gets `lengthIn` (its box diagonal) and `areaSqIn`, and the scan
`defectAreaSqIn` (the union of its found defects counted by area) and `flatSharePct` (the flat
shares of its found defects counted that way). A type with `notAcceptedFromIn` is `NOT_ACCEPTED`
at or above that length and `USABLE` below; unmeasured (no `widthIn`) it is `NOT_ACCEPTED`. The
snapshot keeps `lengthLimits`, `flatShares` and `widthIn`.

**The marker card (D-120):** with `markerCorners` the scale is the cards' square side (2.00 in)
in pixels, averaged over the cards, and the snapshot keeps `markerCorners`. A detection whose box
centre lies on a card (the square plus its printed white border and caption) is dropped before the
verdict, like a class with no defect type (A-46). Cards that can't give a scale (a side under 24
px, sides more than 15% apart, or 4 to 120 in across not met) are `422` `MARKER_UNREADABLE` with
what to do; nothing is stored.

**`201`** `{ "data": { "scanId", "rollId", "rollCode", "sequence", "verdict", "duplicate": false, "defects": [{ "label", "confidence", "effect": "USABLE" | "NOT_ACCEPTED" | null, "lengthIn": number | null }] } }`.

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

| Field           | Required | Notes                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`         | yes      | JPEG, PNG or WebP (checked by content), ≤ 10 MB. The page sends the camera frame as a JPEG                                                                                                                                                                                                                                                                                        |
| `captureId`     | yes      | A UUID the page makes for each press. A retry with the same one returns the first scan without running again                                                                                                                                                                                                                                                                      |
| `rollId`        | yes      | The roll chosen in the Roll dropdown. It must still be open                                                                                                                                                                                                                                                                                                                       |
| `source`        | no       | `WEBCAM` (default) or `PHONE` (the page sends `PHONE` from a phone or tablet)                                                                                                                                                                                                                                                                                                     |
| `capturedAt`    | no       | ISO 8601 with offset: when Capture was pressed                                                                                                                                                                                                                                                                                                                                    |
| `markerCorners` | no       | The scale marker cards Capture read on this frame (D-120): a JSON array of 1 to 4 cards, each four corners `{ "x", "y" }` in fractions of the photo, top-left first as printed. The server works out the scale from them (a 2.00 in square). There is no `widthIn`. Without it (or `""`) the shot takes the roll's scale: its latest marked shot of the same picture size (D-121) |

There is no `detections` or `modelVersion` field: the server produces both.

**`201`** `{ "data": { "scanId", "rollId", "rollCode", "sequence", "verdict", "duplicate": false, "defects": [...], "detections": [...], "modelVersion", "inferenceMs" } }`.
**`200`** the same with `"duplicate": true` (and `detections: []`) for a repeated `captureId`.

| Status | `code`              | When                                                                                                               |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `401`  | `UNAUTHENTICATED`   | Not signed in                                                                                                      |
| `403`  | `FORBIDDEN`         | Not allowed to capture (anyone but a Shoe Constructor with camera access)                                          |
| `409`  | `NO_ROLL_CHOSEN`    | No `rollId`: choose the roll this shot belongs to                                                                  |
| `409`  | `ROLL_CLOSED`       | The chosen roll was finished or cancelled; checked before the model runs                                           |
| `409`  | `CONFLICT`          | The `captureId` was already used by a device-token scan                                                            |
| `413`  | `PAYLOAD_TOO_LARGE` | Over 10 MB                                                                                                         |
| `422`  | `VALIDATION_FAILED` | A field is wrong; `message` names it                                                                               |
| `422`  | `MARKER_REQUIRED`   | No `markerCorners` and the roll has no marked shot of this picture size yet (D-121); checked before the model runs |
| `422`  | `MARKER_UNREADABLE` | The cards sent can't give a scale (too small, tilted, out of range); the message says what to do                   |
| `503`  | `MODEL_UNAVAILABLE` | The model files aren't on the server (the message says where to put them)                                          |

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

| Method & path                  | Permission       | Notes                                                                                                                                     |
| ------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/scans/{id}`       | `scan:read` (FM) | scan and detections (with boxes); no person                                                                                               |
| `GET /api/v1/scans/{id}/image` | `scan:read`      | the captured image (`private, no-cache` with an `ETag`: checked on every load, `304` when unchanged); the System Admin gets `403` (D-119) |

There is no scans list since Phase 28 (A-26, D-100): `GET /api/v1/scans` answers `405` (only the
device `POST` remains), and a section is reached from its roll (`/api/v1/rolls/{id}`).

The camera's verdict is final (D-093): there is no decision endpoint. The Review Queue, the Repair
Station and Salvage, with `/api/v1/rework/**`, `/api/v1/salvage/**` and
`POST /api/v1/scans/{id}/decision`, were removed in Phase 25 (D-094) and answer `404`.

## Storage locations (session, Phase 32, D-128)

Racks, bins and areas where leather rolls are kept, and each roll's location history. CPoint
hasn't confirmed its rack layout (A-53); codes like `R1-B3` are placeholders the Floor Manager
replaces. A location is never deleted. Only a roll in storage has a location: one in stock, or one
Returned to supplier that the supplier hasn't picked up yet (A-55, A-77).

| Method & path                       | Permission                                                  | Body / query                                                                     | Response                                                                                               |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/locations`             | the Floor Manager, or a Shoe Constructor with camera access | `active=false` to include deactivated ones                                       | `{ data: Location[] }`, by the Floor Manager's order, then code                                        |
| `POST /api/v1/locations`            | `location:manage` (Floor Manager)                           | `{ code, kind, name?, notes? }`                                                  | `201 { data: Location }`                                                                               |
| `GET /api/v1/locations/{id}`        | as `GET /locations`                                         | —                                                                                | `{ data: Location }`                                                                                   |
| `PATCH /api/v1/locations/{id}`      | `location:manage`                                           | any of `{ code, kind, name, notes, isActive }`                                   | `{ data: Location }`; `409` named when the code is locked or the location still holds rolls            |
| `POST /api/v1/rolls/move`           | `roll:move` (Floor Manager)                                 | `{ rollIds: [1..50], toLocationId, note? }`                                      | `{ data: { moved: [{ id, code, from, to }] } }`; all or nothing                                        |
| `POST /api/v1/rolls/{id}/set-aside` | `roll:move`, or a Shoe Constructor with camera access       | `{ locationId }`                                                                 | `{ data: { id, code, location: { code, name } } }`; only a roll Returned to supplier and not picked up |
| `POST /api/v1/rolls/{id}/picked-up` | `roll:manage` (Floor Manager)                               | `{}`                                                                             | `{ data: { id, code, pickedUpAt } }`; the roll leaves storage                                          |
| `GET /api/v1/rolls/find`            | as `GET /locations`                                         | `q`: a roll code, part of one or a supplier tag, or a location label `LOC:R1-B3` | `{ data: { rolls: FoundRoll[], location: Location & { contents: FoundRoll[] } \| null, message } }`    |
| `GET /api/v1/rolls/{id}/moves`      | as `GET /locations`                                         | —                                                                                | `{ data: [{ id, at, reason, label, from, to, note }] }`, newest first, no names (A-78)                 |

**`Location`**: `{ id, code, name, kind (RACK | BIN | AREA), notes, isActive, rolls }`, `rolls`
being the rolls kept there now. **`FoundRoll`**: `{ id, code, tagCode, status, statusText, item,
supplier, areaSqFt, receivedOn, location, where, canMove, awaitsPickup }`; `where` says it in one
line ("R1-B3 · Rack 1, bin 3", "Not placed yet", "Being scanned at Capture", "Left storage: scanned
on …", "Picked up by the supplier on …").

- **Codes:** trimmed and upper-cased, 2 to 20 letters, numbers or dashes ("Location code: use 2 to
  20 letters, numbers or dashes, like R1-B3."), unique ("R1-B3 is already a location. Choose
  another code.", `422` at `code`). A code can't change once a roll was placed there or taken
  from it, because it is printed on labels (A-79). `name` up to 60, `notes` up to 200.
- **Deactivate** (`isActive: false`) only when empty ("R1-B3 still holds 3 rolls. Move them
  first."); a deactivated location is left out of every picker and refuses rolls.
- **Moves:** each roll is `PLACED` (it had no location) or `MOVED`; moving to where it already is,
  a roll being scanned ("LR-MLT-004 is being scanned at Capture. Put it back first."), or a roll
  that left storage is `409` naming the roll, and nothing moves. A move that lost a race is
  `409 STALE`.
- **Automatic history rows:** Add rolls with a location (`PLACED`), Start scanning (`TAKEN_FOR_USE`,
  the location is cleared), Put back with a location (`PUT_BACK`), Remove (`REMOVED`, the reason
  as the note), set aside (`SET_ASIDE_FOR_RETURN`) and picked up (`PICKED_UP_BY_SUPPLIER`).
- **Labels** are pages, not API routes: `/inventory/labels?item=<id>` (the item's rolls not scanned
  yet) or `?rolls=<id>,<id>`, and `/inventory/locations/labels?ids=…` (the Floor Manager). The QR
  holds the roll's code alone or `LOC:<code>` for a location (A-80), drawn on the server by
  `qrcode` as SVG; up to 105 labels a page.
- Audited: `location.add`, `location.edit`, `location.deactivate`, `location.reactivate`,
  `roll.move` (one row per move, on the target location), `roll.set_aside`, `roll.picked_up`.
- The Quality Inspector and the System Admin get `403` on every route here.

## Inventory (session)

Stock is a ledger (D-023): `quantityOnHand` changes **only** through a movement, and movements are
never edited or deleted. Quantities are numbers with at most 2 decimals. Since Phase 29 (D-102)
stock changes on the **Update stock** sheet: one save posts, per item, an `IN` (Added), an `OUT`
(Used) and an `ADJUST` (Correction), each linked to the save by `updateId`.

| Method & path                          | Permission         | Body / query                                                                            |
| -------------------------------------- | ------------------ | --------------------------------------------------------------------------------------- |
| `GET /api/v1/inventory`                | `inventory:read`   | `?category=&stock=low\|out&q=&inactive=1&page=` → `{ rows, total, page, pageCount }`    |
| `POST /api/v1/inventory`               | `inventory:manage` | `ItemForm` → `201`                                                                      |
| `GET /api/v1/inventory/{id}`           | `inventory:read`   | `?page=` → `{ item, movements, total, page, pageCount }` (newest first, `balanceAfter`) |
| `PATCH /api/v1/inventory/{id}`         | `inventory:manage` | `ItemForm` (quantity is never editable), or `{ isActive }`                              |
| `GET /api/v1/inventory/{id}/movements` | `inventory:read`   | `?page=`                                                                                |
| `GET /api/v1/inventory/updates`        | `inventory:read`   | the 15 latest saves: `{ id, createdAt, by, items, note }` (items changed, not entries)  |
| `POST /api/v1/inventory/updates`       | `inventory:manage` | `StockUpdate` → `201 { id, items }`                                                     |
| `GET /api/v1/inventory/settings`       | `inventory:read`   | `{ reminderDays }` (ISO weekdays, 1 = Monday)                                           |
| `PUT /api/v1/inventory/settings`       | `inventory:manage` | `{ "reminderDays": [3, 5] }` (at least one day; 1 to 5 only, D-105)                     |

Gone since Phase 29: `POST /api/v1/inventory/{id}/movements` answers `405`, and
`POST /api/v1/inventory/movements/{id}/undo` is removed.

**`ItemForm`**: `sku` (2–20, letters/numbers/dashes, unique; stored upper-case), `name` (2–80),
`category` (`LEATHER_ROLL|NAILS|ADHESIVE|THREAD|EQUIPMENT|OTHER`), `unit` (1–20, e.g. `roll`),
`reorderLevel` (≥ 0), `openingStock?` (create only; recorded as an IN "Opening stock"),
`supplierId?` (required for `LEATHER_ROLL`: "Choose the supplier of this leather roll."; ignored
and cleared for the other categories).

**`StockUpdate`**: `{ "lines": [{ "itemId", "seenQuantity", "added"?, "used"?, "correction"?,
"reason"? }], "note"? }`, 1 to 1,000 lines, one per item.

- `seenQuantity` is the stock the sheet showed. If the item has changed since, the whole save is
  `409 STALE`, naming the item.
- `added` and `used` are ≥ 0; `correction` is signed (`-1`, `+2`). At least one of them per line.
- Used can't take the item below zero after what was added ("Only 8 spools of … in stock. Enter a
  smaller amount."); a correction can't either; a correction needs a `reason` (3–300).
- Problems come back as `422` under `lines.<itemId>.<added|used|correction|reason>`. Nothing is
  saved unless every line is fine. One `inventory.update` audit row per save.

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

| Method & path                                                                                              | Body                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET / PUT /api/v1/settings/cv`                                                                            | `{ foundPercent, earlyModelNotice?, returnPercent? }`, e.g. `50` (1 to 100, one decimal); `returnPercent` the supplier limit (1 to 100, one decimal, default 10, Phase 30C). `rejectPercent` or `reworkPercent` is refused with a named message (D-093)                       |
| `GET / POST /api/v1/defect-types`                                                                          | `{ key, label, outcome, description?, sortOrder?, notAcceptedFromIn?, flatSharePct? }` (key fixed; `outcome` `USABLE` or `NOT_ACCEPTED`, required, D-093; `notAcceptedFromIn` 0.1 to 100 in and `flatSharePct` 0.1 to 100, blank or `null` clears, left out keeps, Phase 30C) |
| `GET / POST /api/v1/suppliers`                                                                             | `{ name, code?, contactPerson?, phone?, notes? }` (`code`: 2 to 6 capital letters or digits, unique; from the initials when left out, D-104)                                                                                                                                  |
| `PUT /api/v1/settings/lunch-break`                                                                         | `{ startTime, endTime }` (`HH:mm`, inside tomorrow's shift, end after start) or `{ none: true }`; applies from tomorrow (D-097)                                                                                                                                               |
| `GET / POST /api/v1/final-defect-types`                                                                    | `{ key, label, description?, sortOrder? }` (key fixed: capital letters, numbers or `_`; Phase 34, D-130): the defects the QI finds on finished shoes, a separate list from `defect-types`. `OTHER` always exists.                                                             |
| `PATCH /api/v1/defect-types/{id}`, `PATCH /api/v1/final-defect-types/{id}`, `PATCH /api/v1/suppliers/{id}` | the same fields, or `{ isActive }` (`OTHER` can't be switched off, `409`). There are no deletes.                                                                                                                                                                              |

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

A batch is one check-in interval of a planned working day (D-097 to D-099, D-114): the day plans
(Floor Manager), the lunch break (System Admin, under Settings above) and each batch's pairs
finished and failed inspection (Quality Inspector). Everything is per batch or day for the whole
line (D-008); the only names are who finished or corrected a batch and who last changed a day's
plan. Days are Manila calendar days. The paths keep `production`; a finished batch is a `check-in`
row whose `slotAt` is the batch's end.

| Method & path                                              | Permission                       | Body / query                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/production/today`                             | `production:read`                | —                                                                                                                                                                                                                                                                                                                              |
| `GET /api/v1/production/days?from=&to=`                    | `production:read`                | default the last 14 days, at most 92                                                                                                                                                                                                                                                                                           |
| `GET /api/v1/production/batches?day=&status=&priority=&q=` | `production:read`                | the Inspection queue (Phase 33, D-129); `status` `WAITING`, `LATE` or `INSPECTING`, `priority` `NORMAL` or `URGENT`, `q` part of a code                                                                                                                                                                                        |
| `POST /api/v1/production/batches/{id}/start`               | `production:checkin`             | `{ expectedUpdatedAt }`: Start inspection (A-60)                                                                                                                                                                                                                                                                               |
| `PUT /api/v1/production/batches/{id}/priority`             | `production:prioritise`          | `{ priority: "URGENT", reason, expectedUpdatedAt }` or `{ priority: "NORMAL", expectedUpdatedAt }`                                                                                                                                                                                                                             |
| `POST /api/v1/production/batches/{id}/void`                | `production:prioritise`          | `{ reason, expectedUpdatedAt }` (A-59)                                                                                                                                                                                                                                                                                         |
| `POST /api/v1/production/check-ins`                        | `production:checkin`             | `{ batchId \| slotAt, pairs, failedPairs?, notes?, findings? }`: `findings` is `[{ finalDefectTypeId, pairs, remedy, returnStage?, note? }]`, required when `failedPairs > 0` and adding up to it (Phase 34, D-130); a `FIXABLE` line starts a repair job. `201` returns `repairs: [{ code, pairs, stage }]` (no rolls, D-111) |
| `PATCH /api/v1/production/check-ins/{id}`                  | `production:checkin`             | `{ expectedUpdatedAt, pairs, failedPairs?, findings?, reason }`; `findings` remakes the lines and the batch's At-stage repairs, and the failed pairs can't change once a repair from the batch is Back for inspection or Done (`409`, A-93)                                                                                    |
| `GET /api/v1/production/defect-suggestions`                | `production:checkin`             | `{ [finalDefectTypeId]: { remedy, returnStage, count, total, text } }`: the usual answer once a type has 5 findings in the last 4 weeks (A-76)                                                                                                                                                                                 |
| `PATCH /api/v1/production/repairs/{id}`                    | `repair:update`, `repair:manage` | `{ action: "back" }` (the constructor assigned to the job's stage today, or the Floor Manager), `{ action: "move", stage, reason }` or `{ action: "notFixable", reason }` (Floor Manager, only while At stage; `409` after)                                                                                                    |
| `POST /api/v1/production/repairs/{id}/inspect`             | `production:checkin`             | `{ passedPairs, scrappedPairs, resend: [{ stage, pairs }] }`, adding up to the job's pairs; `resend` makes child jobs, with no limit (A-88). Returns `{ code, passedPairs, scrappedPairs, children[] }`                                                                                                                        |
| `GET /api/v1/production/stages/{day}`                      | `stage:assign`                   | who works at each stage that day, the active constructors (with `absent` and `captureAccess`), and `prefill` for an empty day (A-74); a constructor with Capture access is always at Preparation and isn't in `assignments` or `prefill` (A-95)                                                                                |
| `PUT /api/v1/production/stages/{day}`                      | `stage:assign`                   | `{ assignments: [{ stage, userIds }] }`; a planned day from today on, one stage per person (A-86); `409` for a past or unplanned day; `422` for a constructor with Capture access at any stage but Preparation (A-95; Preparation is accepted and nothing is stored for them)                                                  |
| `POST /api/v1/production/stage-counts`                     | `stage:count`                    | `{ stage, pairs }` for today: the Floor Manager any stage, a constructor only the stage assigned to them today (`403` otherwise)                                                                                                                                                                                               |
| `GET /api/v1/production/wip`                               | `stage:read`                     | the work in progress board: `{ cards[] (stage, label, pairs, asOf, repairs, assigned), preparation, waiting, canCount }`                                                                                                                                                                                                       |
| `GET /api/v1/production/plans?month=`                      | `production:plan`                | `month` `YYYY-MM`, default this month (D-114)                                                                                                                                                                                                                                                                                  |
| `PUT /api/v1/production/plans/{day}`                       | `production:plan`                | `{ rollsPlanned, quota, suggestedQuota?, intervalMinutes, shiftStart, shiftEnd, expectedUpdatedAt }`                                                                                                                                                                                                                           |
| `PUT /api/v1/production/plans/{day}/non-working`           | `production:plan`                | `{ expectedUpdatedAt }` (body optional): mark Non-working / Holiday                                                                                                                                                                                                                                                            |
| `DELETE /api/v1/production/plans/{day}/non-working`        | `production:plan`                | `{ expectedUpdatedAt }`: undo the mark                                                                                                                                                                                                                                                                                         |

`production:read` is the Floor Manager, the Quality Inspector and the System Admin;
`production:checkin` the Quality Inspector, and the Floor Manager **only on a day attendance shows no
Quality Inspector present** (D-088; otherwise `403` "A Quality Inspector is present today, so they
finish the batches." or "Take today's attendance first. …"; since Phase 33 it is **today's**
attendance, whatever the batch's day, A-82); `production:plan` and `production:prioritise` the
Floor Manager. Phase 34 (D-130): `stage:assign` and `repair:manage` are the Floor Manager's;
`stage:count` and `repair:update` the Floor Manager's and the Shoe Constructors' (a constructor only
for the stage assigned to them today, `mayCountStage`); `stage:read` the Floor Manager's and the
Quality Inspector's. `GET /api/v1/production/batches` also returns `repairs[]` (Back for
inspection, longest wait first), `repairsDone[]` (the last 7 days) and `repairsTotal`; repairs are
not in the tab title's due count (A-90).
`PUT /api/v1/production/schedule` and `PUT /api/v1/production/quotas` are gone (`404`, Phase
30E-2).

**Day plans (D-114, D-115).** A day has batches only when it has a plan; nothing is copied from
another day. `{day}` is `YYYY-MM-DD`, a weekday from today to the end of the third month ahead
(A-40); otherwise `409 CONFLICT` "Saturdays and Sundays can't be planned. The factory works Monday
to Friday.", "Tue, 3 Nov has passed, so its plan can't change." or "Days can be planned up to Sun,
28 Feb.". Today can change only until one of its batches is finished (`409` "A batch is already
finished today, so today's plan can't change. …", A-36). `rollsPlanned` 0–200 (an estimate),
`quota` 1–50,000 passed pairs, `intervalMinutes` `240` or `null` (or `"end"`) for once at the end
of the day (`422` "Choose the check-in interval: every 4 hours, or once at the end of the day."),
`shiftStart` from `08:00`, `shiftEnd` up to `17:00` and after the start (D-105).
`expectedUpdatedAt` is the plan's `updatedAt` the form loaded, or `null` for a day with nothing
saved; anything else is `409 STALE` "Rodel Pascual changed Thu, 5 Nov at …. Refresh to see it.".
Each write answers `{ saved, day }`; a plan equal to the one saved, or a second mark, is skipped
(`saved: false`, no audit). Undoing a mark on a day that isn't marked is `409`. A Non-working day
has no batches, no start-of-day notice and no stock reminder. Days before Phase 30E-2 were converted
from the old schedule and quota (no author, `rollsPlanned` null, and possibly an interval of 60 to
180).

**The Inspection queue (Phase 33, D-129).** Every batch of a planned day has a row and a code,
`B-YYMMDD-N` (A-57), made when the plan or the lunch break is saved and on first read (old
batches too: a finish is linked to its batch; a batch that ended before the queue began and was
never finished is `VOID` "Not inspected, from before the queue", A-61). Only `status` (`OPEN`,
`INSPECTING`, `INSPECTED`, `VOID`) and `priority` are stored; the queue's `state` (`WAITING`
from the end, `LATE` 30 minutes after, `INSPECTING`) comes from the clock. A plan or lunch save
that would move a batch someone acted on is `409` "B-261116-1 is being inspected, so Mon, 16 Nov's
batches can't change." (also "is already inspected", "was voided", "is marked Urgent").

- **batches** → `{ today, waiting: [item], done: [item] (inspected or void, the last 7 days),
total, urgent, late, days: [{ day, label }], filters, canInspect, inspectNote, canPrioritise }`;
  `waiting` is Urgent first, then the oldest end (A-58). An item is `{ id, code, day, dayLabel, times,
state, stateLabel, priority, priorityReason, priorityBy, waiting ("Waiting 3 hours 10 minutes"),
rolls ("6 rolls (Full-grain black ×4, Suede brown ×2)", A-83), inspectingBy, inspectingSince,
inspectingByMe, finished: { pairs, failedPairs, by, at } | null, voidReason, voidedBy, canFinish,
updatedAt }`. Names are who is inspecting, who marked it Urgent and who voided it (log-book facts).
- **start:** `{ id, code, started }` (`started: false` when you already started it). `409` "Lea
  Santos is already inspecting B-261116-2 (since 09:05). Pick another batch.", "B-… is already
  inspected.", "B-… was voided. It isn't in the queue.", "B-… can be inspected from 16:50.";
  `409 STALE` when it changed since loaded.
- **priority / void:** `{ id, code, saved }`. `reason` 5–200 characters: `422` "Say why this batch
  is urgent, at least 5 characters, …" or "Say why this batch won't be inspected, at least 5
  characters, …". `409` "B-… hasn't started yet. …" for a batch that hasn't begun.
- **plans** → `{ month, today, weeks: [[day | null] × 7], days: [{ day, label, weekend, past,
isToday, kind (PLANNED | NON_WORKING | null), plan: { rollsPlanned, quota, intervalMinutes,
shiftStart, shiftEnd, short, batches } | null, updatedAt, changed: { by, at } | null, lunch,
rollsScanned (today and past days), editable, lockedReason }], prevMonth, nextMonth, suggestion,
factory }`.
- **today** → `{ day, dayLabel, schedule, lunch, workingDay, plan, nonWorking, planNeeded,
rollsPlanned, rollsScanned, rows: [{ number, code, batchId, queue, slotAt, startTime, time, lunch, times, label, state,
pausedForLunch, canFinishNow, finishOpensAt, lateBy, checkIn }], progress: { finished, failed,
passed, quota, share, pace }, next, late, missed, workforce, shortfall, canEnter, covering,
enterNote }`. `planNeeded` is a weekday with no plan and no mark (the Floor Manager's notice,
  A-37). `state` is `UPCOMING`, `IN_PROGRESS`, `DUE`, `LATE` (30 minutes past the end),
  `FINISHED` or `MISSED` (after midnight), worked out on each request. `checkIn` carries `pairs`,
  `failedPairs`, `constructorsPresent` read at save, `attendanceChanged`, notes, `enteredLate` and
  any correction. The browser's notices are worked out from this.
- **days** → `{ days: [{ day, batches, finishedBatches, missed, full, finished, failed, passed,
failedShare, quota, share, rollsPlanned, rollsScanned, attendanceTaken, constructorsPresent,
constructorsOnRoster, pairsPerConstructor, shortfall }] }`, from the first day a batch was ever
  finished. `share` is passed ÷ quota (C-41); `rollsScanned` counts the rolls whose Finish roll
  was that day; `pairsPerConstructor` is a line average.
- **check-ins (Finish batch):** `batchId` (a queued batch) or `slotAt` (the end of a batch on
  that day); Finish batch opens 10 minutes before the end and, since Phase 33, stays open until the
  batch is inspected or voided (no midnight close). `pairs` 0–2,000; `failedPairs` 0–2,000
  (default 0) and never more than `pairs`. Returns `{ id, number, code, time }`; the batch becomes
  `INSPECTED`. Errors: `422` keyed `pairs` ("Enter the pairs finished in B-261116-2 as a whole
  number, like 24. Enter 0 if none.") or `failedPairs` ("Failed inspection can't be more than the
  pairs finished (12)."); `409 CONFLICT` "B-261116-3 can be finished from 14:50.", "B-… was
  voided: <reason>. It can't be finished." or "There's no batch ending at 12:00 on …"; `409 STALE`
  "Lea Santos already finished B-261116-1 at 13:04. Refresh to see it."
- **corrections:** on the day the batch was inspected (Phase 33, until Phase 35), `reason` 5–300
  characters; the audit row keeps both counts. `409` "A batch can only be corrected on the day it
  was inspected. This one was inspected on Mon, 16 Nov."; `409 STALE` when it changed since it
  was loaded.
- The lunch break (Settings) sits inside the factory's hours, 08:00 to 17:00, and applies from
  tomorrow; a day planned with a shorter shift that leaves it out ignores it.

## Reports (session)

Aggregates per Manila day, defect type, supplier or roll, never per person (D-025, D-008). Shots of a cancelled roll are left out (Phase 26). Range params:
`?preset=today|7d|14d|30d` or `?from=YYYY-MM-DD&to=YYYY-MM-DD` (Manila days, inclusive). The
default is the last 14 days, at most 92, and never past today.

| Method & path                            | Permission          | Returns                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/reports/quality`            | `report:quality`    | `{ range, totals: { rolls, passed, returned }, days[], defects[] }`: rolls finished at Capture in the range, each Scanning passed or Returned to supplier; `defects[]` is `{ key, label, rolls, returned }`, the rolls each type was found on (D-117)                                        |
| `GET /api/v1/reports/production`         | `report:production` | `{ days[], totals: { finished, failed, passed, failedShare, share, daysBelow, daysWithQuota } }` (Phase 27)                                                                                                                                                                                  |
| `GET /api/v1/reports/daily.csv`          | `report:quality`    | one row per day: Rolls scanned, Scanning passed, Returned to supplier (D-117)                                                                                                                                                                                                                |
| `GET /api/v1/reports/defects.csv`        | `report:quality`    | one row per defect type: Rolls found on, Returned to supplier (a detection at or above found-at, D-117)                                                                                                                                                                                      |
| `GET /api/v1/reports/production.csv`     | `report:production` | one row per day: pairs finished, failed, % failed, passed, passed after repair (Phase 34), quota, % of quota (passed), batches, rolls planned and scanned, constructors, shortfall                                                                                                           |
| `GET /api/v1/reports/operations`         | `report:production` | `{ kpis: { pairs, failedPairs, ofQuota, rollsPassed, rollsReturned }, attention[], production, finalDefects, origins, repairs, wip, days[], stock, suppliers[], mostDefects[], lineReturnedShare, checkpoint }` (D-117; Phase 34 adds `finalDefects`, `origins`, `repairs` and `wip`, D-130) |
| `GET /api/v1/reports/operations.csv`     | `report:production` | one row per day: Rolls started, Rolls scanned, Scanning passed, Returned to supplier (D-117)                                                                                                                                                                                                 |
| `GET /api/v1/reports/rolls.csv`          | `roll:read`         | the rolls Reports → Rolls shows (same filters, up to 5000): Roll, Leather, Supplier, Area, Started scanning, Finished, Scanning time, Scanning time (min), Shots, Passed, Rejected, Defect %, Status (D-121)                                                                                 |
| `GET /api/v1/reports/stock.csv`          | `report:production` | every active item: on hand, reorder level, used and added, days of cover, status                                                                                                                                                                                                             |
| `GET /api/v1/reports/materials`          | `report:production` | `?year=&month=&week=&q=` (D-109): `{ today, selected, previous, weeks[], days, q, itemCount, rows[], leather[], pace, years[], reminderDays, daysToNextReminder }`. Weeks are days 1–7, 8–14 … of the month; no or an invalid week gives today's                                             |
| `GET /api/v1/reports/materials-used.csv` | `report:production` | same query; one row per item and week (the 8 weeks ending with the selected one): week, from, to, item code, item, category, supplier, unit, used, pairs finished (no per 100 pairs, D-116)                                                                                                  |
| `GET /api/v1/reports/suppliers.csv`      | `report:production` | per supplier, rolls finished in the range: Rolls, Scanning passed, Returned to supplier, Returned %, Top defect, High (D-117)                                                                                                                                                                |
| `GET /api/v1/reports/supplier-rolls.csv` | `report:production` | the 100 rolls finished in the range with the highest Defect %: Roll, Tag number, Supplier, Defect %, Status, Defects (D-117)                                                                                                                                                                 |

- **Verdicts** are Pass and Reject (D-093); the final verdict is the camera's.
- **By roll** (D-117): the reports count whole leather rolls on the day they were finished, each
  Scanning passed or Returned to supplier (D-116); each shot's Pass or Reject stays on the roll's
  own page. `forSalvage`, `rejectedRolls` and `lineRejectShare` are gone (the Rejected sections
  card was removed). `/api/v1/reports/repairs` was removed (D-094).
- **CSV:** UTF-8 with a BOM and CRLF, so it opens correctly in Excel. Text cells starting with
  `= + - @` are prefixed with `'`.

## Demo tools (no session, Phase 28, D-101)

Only while `DEMO_LOGIN_TOOLS=true` and `SEED_DEMO_USERS=true`; otherwise both answer `404`. The
only routes without `requireApiPermission`.

| Method & path               | Body                                                                     | Notes                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/demo/sign-in` | `{ role }` (one of the four roles)                                       | signs in as that role's demo account with the server's `DEMO_USER_PASSWORD`; `200 { data: { redirectTo } }`. `409 DEMO_ACCOUNT_MISSING` or `DEMO_PASSWORD_MISSING`; `401 SIGN_IN_FAILED` (locked, inactive)      |
| `POST /api/v1/demo/reset`   | `{ confirm: "RESET" }`                                                   | the `demo:reset` plus a fresh demo week (about a minute); `200 { data: { removed, demoWeek } }`; `409 RESET_RUNNING` while one runs; `422` for any other word                                                    |
| `POST /api/v1/demo/clock`   | `{ date: "YYYY-MM-DD", time: "HH:MM" }` (Manila) or `{ realTime: true }` | moves the demo clock (D-125): the whole app runs from that time and keeps ticking; `200 { data: { on, offsetMs, now } }`; `422` for a date more than a year away or an unreadable date or time. Signed in or not |

## Scanning time (D-121)

A roll's `scanningMs` (finish, `GET /api/v1/rolls`, `GET /api/v1/rolls/{id}`)
is the working time from Start scanning to Finish roll: the day's lunch break and, for a roll left
open overnight, the night (17:00, or its start if later, to 08:00 Manila) are left out. `null` while being scanned or for a roll never started.
`GET /api/v1/rolls` adds `meta.scanning: { averageMs, count }` for the rolls the filters show.

## Coming next

No endpoints are planned. This file lists every route in `src/app/api` (Phase 31 checked it
against the code); a route not listed here was removed and answers `404` or `405`, as noted in its
section. The capture contract is summarised in `docs/prompts/system-rebuild.md` →
`<cv_integration_contract>`.
