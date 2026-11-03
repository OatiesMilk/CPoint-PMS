# QA handoff: no repeat schedule or lunch saves

| Field           | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| Date            | 2026-11-02                                                                         |
| Feature         | no-repeat-schedule-saves                                                           |
| Branch          | `main` at 2e63908, change uncommitted in `C:\dev\CPoint-PMS` (laptop)              |
| Spec / prompt   | `docs/prompts/plans/groupmates-feedback-plan.md`, F1 (team QA notes, 2 Nov); D-107 |
| Written by      | Claude                                                                             |
| Previous report | `qa/reports/2026-11-02-weekdays-only-run2.md` (PASS)                               |

## 1. What changed

- **Floor Manager, Batches → Plan batches and quota:** saving a schedule that is the same as the
  one already set for tomorrow saves nothing. The toast reads "Nothing changed: this schedule
  already applies from Tue 3 Nov, so nothing was saved." Schedule history gets no new row and no
  audit row is written. A different schedule saves as before ("Schedule saved. It applies from …").
- **System Admin, Settings → Lunch break:** the same for a lunch break (or No lunch break) equal to
  tomorrow's: "Nothing changed: this lunch break already applies from …, so nothing was saved."
- The daily quota already worked this way ("Nothing changed, so nothing was saved."). Unchanged.
- API: `PUT /api/v1/production/schedule` and `PUT /api/v1/settings/lunch-break` now answer
  `{ data: { saved, effectiveFrom, id? } }`; `saved: false` when nothing changed.
- Days are compared as a set: Mon–Fri ticked in any order is the same schedule.

## 2. Files touched

| File                                                                                             | Change                                                                                                      |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `src/server/services/production.service.ts`                                                      | `saveSchedule` and `saveLunchBreak` skip a value equal to tomorrow's; return `saved`                        |
| `src/app/(app)/batches/actions.ts`, `src/app/(app)/admin/settings/actions.ts`                    | pass `saved` on                                                                                             |
| `src/app/(app)/batches/plan/plan-forms.tsx`, `src/app/(app)/admin/settings/lunch-break-form.tsx` | the "Nothing changed" toast                                                                                 |
| `tests/unit/production.service.test.ts`                                                          | 2 new tests (617 in all)                                                                                    |
| `tests/e2e/batches.spec.ts`                                                                      | a second Save adds no history row and shows Nothing changed; the first save accepts either toast on a rerun |
| `docs/API.md`                                                                                    | the `{ saved, effectiveFrom }` answer                                                                       |

Database migration in this change: **no**

## 3. How to run the app locally

Standard (template). On the laptop: `npm run db:up`, `npm run db:deploy`, `npm run build`,
`npm run start` (or `PORT=3001`). Demo users on (`SEED_DEMO_USERS=true`).

```bash
npm run build && npx playwright test tests/e2e/batches.spec.ts
```

## 4. Test accounts and data

`manager@cpoint.local` (FM, home `/floor-manager`), `admin@cpoint.local` (Admin, `/admin`), password
`DEMO_USER_PASSWORD`. No special data. Note the schedule and lunch break before you start and put
them back at the end.

## 5. Test scenarios

| ID  | Role  | Steps                                                                                                                              | Expected result                                                                                                                             | Priority |
| --- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | FM    | Batches → Plan batches and quota. Note the number of rows in Schedule history. Without changing anything, click **Save schedule**. | Toast "Nothing changed: this schedule already applies from <tomorrow>, so nothing was saved." Schedule history has the same number of rows. | High     |
| S2  | FM    | Click **Save schedule** three more times.                                                                                          | Same toast each time; still no new row (the 27 Oct case from the team's notes).                                                             | High     |
| S3  | FM    | Change How often (e.g. Every 2 hours), Save. Then Save again unchanged.                                                            | First: "Schedule saved. It applies from <tomorrow>." and one new row. Second: Nothing changed, no row.                                      | High     |
| S4  | FM    | Untick and re-tick Monday (same five days), Save.                                                                                  | Nothing changed (days compared as a set).                                                                                                   | Medium   |
| S5  | FM    | API: `PUT /api/v1/production/schedule` with tomorrow's exact values.                                                               | 200, `data.saved` is `false`, `data.effectiveFrom` tomorrow.                                                                                | Medium   |
| S6  | Admin | Settings → Lunch break. Note Lunch history. Save without changes.                                                                  | "Nothing changed: this lunch break already applies from <tomorrow>, so nothing was saved." No new row.                                      | High     |
| S7  | Admin | Change the lunch (e.g. 11:30 to 12:30), Save; Save again; tick No lunch break, Save; Save again.                                   | Saved / Nothing changed / "No lunch break from …" / Nothing changed. One new row per real change.                                           | High     |
| S8  | Admin | Audit log, filter production.schedule.set and production.lunch.set.                                                                | One audit row per real change only; none for the Nothing changed saves.                                                                     | Medium   |
| S9  | FM    | Lunch inside the shift still checked: Admin saves lunch 06:00 to 07:00.                                                            | Refused under the field "Lunch must be inside the shift (08:00 to 17:00)." as before.                                                       | Low      |
| S10 | FM    | Quota: Save the same quota.                                                                                                        | "Nothing changed, so nothing was saved." as before.                                                                                         | Low      |

### Access checks

| ID  | Role that must NOT have access | URL or action                      | Expected |
| --- | ------------------------------ | ---------------------------------- | -------- |
| A1  | Quality Inspector              | `PUT /api/v1/production/schedule`  | 403      |
| A2  | Floor Manager                  | `PUT /api/v1/settings/lunch-break` | 403      |

Also run axe on `/batches/plan` and `/admin/settings?tab=lunch` after a Nothing changed toast: 0
violations.

## 6. Out of scope / known issues

- Old duplicate rows already in Schedule history stay (history is never deleted).
- The rest of the team's notes (Materials report, the leather split) is planned as Phase 30D after
  30C; not in this run.
- `batches.spec.ts` fails between 00:00 and 01:00 Manila (known); rerun after 01:00.
