# QA handoff: demo clock

| Field           | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Date            | 2026-11-09                                             |
| Feature         | demo-clock                                             |
| Branch          | `feature/demo-clock` (or uncommitted on the PC)        |
| Spec / prompt   | Dylan's request, 2026-11-09; `docs/DECISIONS.md` D-125 |
| Written by      | Claude                                                 |
| Previous report | none for this change                                   |

## 1. What changed

While the demo tools are on (`DEMO_LOGIN_TOOLS=true`, `SEED_DEMO_USERS=true`), the **Demo mode**
band at the top of every page (and the login page) shows the app's time: "Real time: Mon, 9 Nov
2026 · 15:00", or "Demo clock: …" once moved. **Change time** opens a Date (Manila) and Time field
with **Set clock** and **Cancel**; **Back to real time** shows while the clock is moved. The clock
keeps ticking from the time set, for every role and device. Batches, the batch notices, Late,
Capture's scanning timer, the stock reminder days, reports' "today" and Reset demo data's week all
follow it. Sign-in, sessions and API tokens keep real time.

## 2. Files touched

| File                                                                                       | Change                                    |
| ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261109090000_demo_clock/`                     | the `demo_clock` table (one row)          |
| `src/lib/clock.ts`                                                                         | `appNow`, the one "now"                   |
| `src/server/models/demo-clock.model.ts`, `services/demo-clock.service.ts`                  | load, set, audit                          |
| `src/server/controllers/demo.controller.ts`, `src/app/api/v1/demo/clock/`                  | `POST /api/v1/demo/clock`                 |
| `src/server/validators/demo.validator.ts`, `scan.validator.ts`                             | the input; capture time follows the clock |
| `src/server/policies/guard.ts`, `src/instrumentation.ts`                                   | load the clock once per process           |
| `src/components/features/demo-band.tsx`, `demo-clock-control.tsx`                          | the band's clock and form                 |
| about 15 services, `src/lib/format.ts`, `report-rules.ts`, Reports, batch notices, Capture | `appNow` in place of `new Date()`         |

Database migration in this change: **yes** (`20261109090000_demo_clock`)

## 3. How to run the app locally

```bash
npm run db:up
npm run db:deploy      # applies demo_clock
npm run dev
```

`.env`: `DEMO_LOGIN_TOOLS=true`, `SEED_DEMO_USERS=true`, `SEED_DEMO_WEEK=true`.

## 4. Scenarios

| #   | Role          | Steps                                                  | Expected                                                                                                     |
| --- | ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| C1  | None          | Login page                                             | The band reads "Real time:" with today's Manila date and time and a Change time button                       |
| C2  | None          | Change time, clear the date, Set clock                 | "Pick the date to show…" under Date; nothing changes                                                         |
| C3  | None          | Change time, a date two years ahead, Set clock         | The message under Date names the allowed range ("up to a year either way")                                   |
| C4  | Floor Manager | Change time to a weekday this week at 15:55, Set clock | Band reads "Demo clock: <that day> · 15:55"; Back to real time shows; Batches shows that day                 |
| C5  | QI            | Sign in (another window) after C4                      | Same demo time in the band; at 16:50 the Finish batch notice opens (C-28) for the 13:00–17:00 batch          |
| C6  | Constructor   | Capture a shot of a roll while the clock is moved      | The shot is accepted (not "capturedAt can't be in the future"); the scanning timer counts from the demo time |
| C7  | Floor Manager | Change time to a Wednesday 10:00                       | The stock update reminder shows                                                                              |
| C8  | None          | Login page, Reset demo data while the clock is moved   | Reports → Rolls shows the demo week ending on the demo day                                                   |
| C9  | Admin         | Audit log                                              | `demo_clock.set` rows, by the user or System, with the before and after time                                 |
| C10 | Any           | Back to real time                                      | Band reads "Real time:" again; Batches back on today                                                         |
| C11 | Any           | `.env` `DEMO_LOGIN_TOOLS=false`, restart               | No band; `POST /api/v1/demo/clock` answers 404; the app runs at real time                                    |
| C12 | All           | `npx playwright test` (full suite)                     | Passes as before                                                                                             |
