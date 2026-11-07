# Phase 30F-3 plan — The phone pages and Floor view

Brief: `docs/prompts/premium-ui.md`, part 30F-3. Baseline: `qa/reports/2026-11-06-phase-30f-baseline.md`
and the 30F-2 run 1 after shots. Status: **approved by Dylan (2026-11-07, "go" with all three recommendations); built**.

## 1. Intent (ui-craft step 1)

- **Who:** a Shoe Constructor at the table with a phone in one hand (Capture), the QI walking the
  line with a phone (Batches), and the constructor glancing at a monitor about 2 m away (Floor
  view). The FM sees Capture's and Batches' desktop layouts.
- **Job of this part:** on a 390 × 844 phone, what the person needs now is on the first screen:
  the roll, the live picture and the Capture button (Capture); the batch to finish and its button
  (Batches). Desktop keeps the same order in two columns.
- **Worst case:** a shot of the wrong roll, a capture the person can't see the picture for, or a
  changed word that breaks a test (A-P1). So: words, roles, labels and test ids stay, and the
  three copy changes below are opt-in.

## 2. Audit (most-seen first)

| #   | What reads as unfinished                                                                                                                                                      | Where                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | **The live picture is below the fold** on a phone (starts near y = 650, under the fixed Capture bar). The roll counts card and a three-line description come first (30F-1 F1) | `capture-client.tsx`, `capture/page.tsx`      |
| 2   | **"Choose the roll this shot belongs to" shows three times** with no roll chosen: the dropdown's empty option, the line under it, and under the Capture button                | `roll-bar.tsx:177, 197`, `capture-client.tsx` |
| 3   | **The controls under the picture are loose:** Floor view, its help line and the Camera select wrap in a row on desktop and stack unevenly on a phone                          | `capture-client.tsx`                          |
| 4   | **The marker card message** (caution) sits under the picture, away from the Capture button it explains                                                                        | `capture-client.tsx`                          |
| 5   | **The Roll card** packs the dropdown, Start another roll, the roll line, the timer, a hint and the Finish / Put back buttons with the same weight                             | `roll-bar.tsx`                                |
| 6   | **Last scan and Model** close the phone page at the same weight; Model is reference, Last scan is the result                                                                  | `capture-client.tsx`                          |
| 7   | **Batches on a phone:** the notice banner is a large card above the page; the plan line repeats the interval ("every 4 h, 08:00 to 17:00, every 4 hours")                     | `batch-notices.tsx`, `batches/page.tsx`       |
| 8   | **Batch cards** read as plain boxes: title, time, badge and "Can be finished from 12:50" at similar sizes; the fixed bottom bar has no card surface in dark mode              | `batches/page.tsx`                            |
| 9   | **The Finish batch sheet** is good; its field labels and the footer spacing differ from the 30F-1 dialog                                                                      | `finish-batch-dialog.tsx`                     |
| 10  | **Floor view** reads well at a distance; only its header's border and spacing differ from the shell                                                                           | `floor-view.tsx`                              |

## 3. Changes per page

### Capture (390 and desktop)

- **Order on a phone:** Roll card (or Start a roll), then the **live picture**, then the marker
  card message, then Last scan, then the roll counts card, then the Floor view and Camera row,
  then Model. On desktop (`xl`) the left column is Roll, picture, message, controls; the right
  column is the roll counts card, Last scan, Model. The counts card moves with CSS order only, so
  its refresh and test id stay (audit 1, 6).
- **The page description** stays word for word but is hidden below `sm` (`max-sm:sr-only`), so
  it is still read by screen readers and the picture moves up about 70 px (audit 1).
- **The Roll card:** the roll line stays the large text; the timer and the hint sit under it as
  one muted block; Finish roll and Put roll back in one row at the card's foot, Start another roll
  quieter (`ghost`, same words) at the top right. On a phone the card is tighter (`p-3`) (audit 5).
- **The marker card message** moves directly above the Capture bar on a phone (and under the
  picture on desktop, as now), in the 30F-1 caution style (audit 4).
- **Under the picture:** one row on desktop (Floor view, the Camera select, aligned to the
  bottom); on a phone a two-column grid that wraps. The help lines stay, as muted text under each
  control (audit 3).
- **The fixed Capture bar:** `bg-card` with `shadow-2` and a top border in both themes; the
  button stays 56 px; the off reason or "Space also captures." stays under it.
- **Last scan:** the frame with boxes keeps ScanImage's Pass/Reject tones; the verdict line uses
  the 30F-1 verdict badge size.

### Floor view

- Header: the same padding scale as the shell, no other change. The frame, the band's colours,
  sizes and words stay (brief). Checked at 1440 and 1920.

### Batches (390 and desktop)

- **Notice banner on a phone:** one compact line with the icon and the words, the action button
  on the right (or below at 390 if it doesn't fit), "Not now" as a quiet link (audit 7).
- **Batch cards:** the batch title and time on one line, the status badge to the right, the
  detail lines muted under them; the card for the batch due now gets the `ring` accent border.
  The fixed bottom bar uses `bg-card` and `shadow-2` like Capture's (audit 8).
- **Finish batch sheet:** the 30F-1 dialog spacing and header; fields stay `h-12`, buttons
  `h-11` (audit 9).
- **Desktop:** the quota card and Recent days as in 30F-2; nothing else moves.

## 4. E2E risk (A-P1)

- No visible word, heading, label, `aria-*`, role or test id changes, except the opt-in copy
  below. The tests find Capture by role and name ("Roll", "Start another roll", "Finish roll",
  "Put roll back", "Floor view", "Print the marker card", "Read the card again") and the counts
  card by `plan-counter`; all stay.
- Moving the counts card is a CSS order change, so DOM order changes only if needed for the tab
  order; I keep the tab order the same as the reading order (DESIGN.md).
- `smoke.spec.ts` axe in both themes: every new colour pair uses existing tokens.
- `batches.spec.ts` reads the batch cards by `batch-N` test ids and the plan line isn't asserted.

## 5. Files

- **Change:** `src/app/(app)/camera/capture/{capture-client.tsx, roll-bar.tsx, plan-counter.tsx,
last-scan.tsx, floor-view.tsx, page.tsx}`, `src/app/(app)/batches/{page.tsx,
finish-batch-dialog.tsx}`, `src/components/features/batches/batch-notices.tsx`, and with Q3
  `src/server/services/production.service.ts` (or `src/lib/production-rules.ts`).
- **Tests:** a unit test for the plan line if Q3 changes it. No e2e change.
- **Docs:** DESIGN.md "Phone layout" (the order of Capture), UI_AUDIT, STATUS, SESSION_LOG,
  ROADMAP, the handoff and Codex prompt (390 × 844 and 1440, light and dark, a weekday for Finish
  batch), the vault.

## 6. Questions (recommendation first)

1. **The repeated hint (audit 2), copy:** show "Choose the roll this shot belongs to." once, under
   the Capture button (the off reason), and make the dropdown's empty option "Choose a roll" and
   drop the line under the dropdown. **Recommend yes.**
2. **The order on a phone (audit 1):** the roll counts card after Last scan (and the description
   hidden visually below 640 px), so the picture is on the first screen. **Recommend yes.**
3. **The plan line (audit 7), copy:** "Plan: 5 rolls · 128 pairs, 08:00 to 17:00, every 4 hours.
   Lunch: …" (the short "every 4 h" dropped). **Recommend yes.**
