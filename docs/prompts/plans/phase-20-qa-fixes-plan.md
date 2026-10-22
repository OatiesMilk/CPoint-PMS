# Phase 20 QA fixes plan

Status: **approved by Dylan on 2026-10-20 ("go ahead").**

Source: `qa/reports/2026-10-20-phase-20-website-camera-and-reports.md` (Codex, verdict FAIL:
56 passed, 4 failed, 9 blocked; e2e 75 passed, 10 failed, 1 skipped). Work stays on the `main`
checkout, uncommitted. Claude runs only lint, typecheck, unit tests and build; Codex runs e2e.

---

## Step 1. App fixes (3 failures)

**F7, old Rework wording**

- `src/app/(app)/review/review-row-actions.tsx:32`: the middle button reads **Fixable**, not
  Rework.
- `src/app/(app)/scans/[id]/decision-panel.tsx:174-175`: the Override dialog names the camera's
  verdict with the same labels as the verdict badge (Pass, Fixable, Reject, Needs review) instead
  of lower-casing the internal value, and the second sentence becomes "Your decision and reason are
  recorded, and the Cut around or clean board is updated to match." Export the label map from
  `src/components/features/verdict-badge.tsx` so both places share it.

**Other leftover wording from the report (§4), same fix**

- `src/app/(app)/reports/_components/ops-sections.tsx:70`: "Fixable leather sections, with how far
  each has got. Updated live, not by the range."
- `src/app/(app)/reports/_components/ops-parts.tsx:234`: "8 in repair" becomes "8 being handled".
- A final `grep` for user-facing "rework", "repair" and "salvage record" strings in `src/app` and
  `src/components`, fixing any that a user sees (internal names and URLs like `/rework` stay).

**F9, threshold message**

- `src/app/(app)/admin/settings/thresholds-form.tsx`: while typing, run `validateThresholds()` and
  show its field message under the field it names (for 95 vs 90: "Fixable must start below Reject
  (90%)." under "Fixable at or above"), with `aria-invalid` set. A server error still wins. The
  generic line in the preview box stays only for an empty or non-numeric value.

**Q6, Rolls CSV header**

- `src/server/services/ops-report.service.ts:347`: "Sections scanned" becomes **Sections**. Update
  the unit test that pins the header, if one exists.

## Step 2. Stale e2e tests (10 failures, all test-side)

| #   | Spec                                | Fix                                                                                                                         |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1-2 | `auth.spec.ts`                      | Add **Capture** after Camera in the manager and inspector `EXPECTED_NAV`.                                                   |
| 3-4 | `cut-around-or-clean.spec.ts:50,72` | After `signIn`, wait for the role's home URL before `goto`.                                                                 |
| 5-6 | `outcomes.spec.ts:54,93`            | Card name is `` `${batch.code} · section #1` ``.                                                                            |
| 7   | `rework-columns.spec.ts:19`         | Button is `/^To handle, \d+ sections?$/`.                                                                                   |
| 8   | `smoke.spec.ts:111`                 | Create its own inventory item through the API, search for it, receive stock into it (no reliance on demo "Contact cement"). |
| 9   | `smoke.spec.ts:151`                 | Card name is `` `${batch.code} · section #2` ``.                                                                            |
| 10  | `supplier-quality.spec.ts:142`      | The Reports `loading.tsx` streams, so the status is 200: assert the rendered "This page doesn't exist." instead.            |

## Step 3. Blocked items: unblock what Codex can do alone

Five need Dylan's hardware and stay on his list: P18 S3 (leather under the webcam), S12 (second
device on HTTP), S13-S15 (iPhone Safari with trusted HTTPS), S18 (camera held by another app).

The handoff gives Codex its own setup for the other four:

- **Q3** (supplier at 30+ sections): start one batch on a roll from one supplier and run
  `npm run cv:simulate -- --count 35 --interval 1` against it, then read Operations.
- **P18 S7** (all batches at Preparation): a throwaway Docker stack (`-p cpoint-qa`, other ports)
  with only the demo week, so the dev database isn't touched.
- **P19 S5** (received request with a proof photo): record a delivery on an ordered request using
  a sample JPEG, then open it in Docker; or use the demo week's received request in the throwaway
  stack.

## Step 4. Checks, docs and handoff

- Run `npm run lint`, `npm run typecheck`, `npm run test` (Vitest) and `npm run build`; report the
  real results.
- Update `docs/STATUS.md` (test counts, next step), prepend `docs/SESSION_LOG.md`, and fix any doc
  that still describes old wording (README, `docs/API.md` for the CSV header).
- Write `qa/handoffs/2026-10-20-phase-20-qa-fixes.md` from `qa/templates/handoff.md` (re-test F7,
  F9, Q6, the leftover wording, the 10 e2e tests and the four unblocked scenarios) and
  `qa/CODEX_PROMPT_PHASE_20_RUN2.md`.
- No branch, commit, push or PR.
