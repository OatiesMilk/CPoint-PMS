# API Reference

Base URL: `http://<host>:3000`. Versioned business endpoints live under `/api/v1` (from Phase 2).
Operational endpoints such as health are unversioned.

## Conventions

- JSON in and out, except uploads, which are `multipart/form-data` (Phase 3).
- Timestamps are ISO 8601 in UTC (`2026-10-02T13:11:21.193Z`). The UI shows them in `Asia/Manila`.
- Every error uses one shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Some fields need fixing.", "details": [] } }
```

| Status | `code`              | When                                                        |
| ------ | ------------------- | ----------------------------------------------------------- |
| 400    | `BAD_REQUEST`       | Malformed request                                           |
| 401    | `UNAUTHENTICATED`   | No or invalid session / device token                        |
| 403    | `FORBIDDEN`         | Signed in, but the role isn't allowed                       |
| 404    | `NOT_FOUND`         | The resource doesn't exist                                  |
| 409    | `CONFLICT`          | Conflicts with the current state (e.g. skipping a stage)    |
| 422    | `VALIDATION_FAILED` | Body failed validation; `details` lists the fields          |
| 500    | `INTERNAL`          | Unexpected server error. Details are logged, never returned |

## Authentication

- **People** sign in on `/login`. The session is an HTTP-only cookie (Auth.js JWT, 12 hours).
  `/api/auth/*` is handled by Auth.js; don't call it directly.
- **API routes** check the session and the caller's role on every request. No session → `401`;
  wrong role → `403`. Deactivated accounts get `401` immediately, even with a valid cookie.
- **Camera devices** (Phase 3) will use `Authorization: Bearer <device token>` instead of a session.

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

## Coming next

| Phase | Endpoints                                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------- |
| 2     | `/api/v1/batches`, `/api/v1/batches/{id}`, `/api/v1/batches/{id}/stages`                                               |
| 3     | `POST /api/v1/scans` (CV device token), `GET /api/v1/batches/current?stage=PREPARATION`, `/api/v1/scans/{id}/decision` |
| 4–6   | rework, salvage, inventory, users, defect types, CV settings, reports                                                  |

The Phase 3 CV ingestion contract is specified in `docs/prompts/system-rebuild.md` →
`<cv_integration_contract>`. Keep it stable once published, because the YOLO service depends on it.
