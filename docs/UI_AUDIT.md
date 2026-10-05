# UI audit — Phase 8

The ui-craft audit (`.claude/skills/ui-craft/SKILL.md`) across every screen, plus an automated axe
pass. It was run on 2026-10-03 against the demo week (`npm run demo:seed`), so every list holds
realistic volumes.

## How it was checked

- **Screenshots:** every screen at 1280 px (and 1440 px for the dense ones), in light and dark. Each
  screen was checked as the role that uses it (FM, QI, System Admin, Shoe Constructor), with the
  demo week loaded. Also covered: sign-in, 403, 404, the password page and `/components`.
- **Checklist:** the skill's audit list and `DESIGN.md`:
  - hierarchy (one primary action per view);
  - state completeness (empty, loading, error, stale);
  - copy;
  - colour-only meaning;
  - truncation at 1280;
  - focus;
  - motion;
  - tokens only.
- **Automated:** `tests/e2e/smoke.spec.ts` runs axe (WCAG 2.0/2.1 A and AA) on:
  - every sidebar page for every role;
  - sign-in in both themes;
  - the FM pages in dark mode;
  - the detail pages visited in the journeys.

  Serious and critical violations fail the test.

- **Token grep:** `src/components` and `src/app` contain no raw hex, `oklch()`, `rgb()`, arbitrary
  px values or `transition-all`. Chart colours come from the `--chart-*` tokens (D-025).

## Findings

Severity follows ui-craft: **Critical** blocks a task or excludes users. **High** is a visible
defect on a main screen. **Medium** is confusing but workable. **Low** is polish.

| #   | Severity | Where                       | Problem                                                                                                   | Fix                                                                                           | Why                                                                        | Commit    |
| --- | -------- | --------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------- |
| A1  | High     | Scans, scan detail, homes   | The overridden camera verdict was faded with `opacity-60`, so its text failed AA contrast (axe).          | Struck through instead, with sr-only "Camera said" before it.                                 | Superseded but still readable. The strike carries the meaning, not colour. | `b683c99` |
| A2  | High     | Review queue                | The queue showed only the oldest 50 with no sign of more, so a new section could sit unseen past the cap. | A `?batch=` filter, plus "Showing the 50 oldest of N" when truncated.                         | The QI must be able to reach every pending section.                        | `b683c99` |
| H1  | High     | Batches list                | At 1280 px the table overflowed: Received and Target were clipped behind horizontal scroll.               | Dropped the Supplier column (it stays on the batch detail). Status badges wrap.               | The FM scans this table all day. Dates matter more than the supplier name. | `3718944` |
| H2  | High     | Rework board                | "Repaired, last 7 days" rendered every ticket: about 76 cards, so the page was about 11,500 px tall.      | Shows the 12 newest, then "N more finished this week. Filter by batch to find one."           | The board is for open work. History lives in Reports.                      | `3718944` |
| A3  | Medium   | Admin home                  | The system-health list put icons directly inside `<dl>`, an invalid structure for screen readers (axe).   | Each item is `div > dt + dd`, with the icon inside the `dd`.                                  | Screen readers announce term/value pairs correctly.                        | `b683c99` |
| A4  | Medium   | All `loading.tsx` skeletons | `aria-label` on a plain `div` is ignored (axe: prohibited attribute), so nothing announced loading.       | Skeleton roots get `role="status"` with the label.                                            | Loading is announced once.                                                 | `b683c99` |
| M1  | Medium   | Admin sidebar               | On `/admin/*`, both Overview (`/admin`) and the current page looked active (prefix match).                | The home link matches exactly.                                                                | One "you are here".                                                        | `3718944` |
| M2  | Medium   | Latest scans (FM/QI homes)  | In the narrow column the batch code was cut off, and later ran under the verdict badge.                   | The code and `· #N` wrap as separate units. Only the defect label truncates.                  | The batch and section identify the leather. They must show in full.        | `3718944` |
| L1  | Low      | Batch detail                | "All 0 scans of this batch" link on a planned batch.                                                      | The link appears only when the batch has scans.                                               | No link to an empty list.                                                  | `3718944` |
| L2  | Low      | Salvage                     | Discard (destructive) sat 8 px from "Use in batch".                                                       | Wider gap between the two.                                                                    | Lowers the chance of a mis-click. Discard also asks for a reason.          | `3718944` |
| L3  | Low      | Latest scans (stale state)  | When the feed went stale, rows faded with `opacity-60`, the same contrast problem as A1.                  | `grayscale` instead.                                                                          | It still reads as "not live" without losing contrast.                      | `b683c99` |
| L4  | Low      | API tokens                  | The demo seed's token shows "Last used: Never" even though it "sent" a week of scans.                     | **Won't fix.** The seed calls the services directly, not over HTTP. A real camera updates it. | Demo-data artefact only.                                                   | —         |

No Critical findings.

## Phase 9 additions (2026-10-05)

The new procurement screens were checked the same way, at 1280 px in light and dark:

- the list, the form and the detail page;
- the Requesters tab;
- the FM home card, the constructor home, and the Inventory badge.

The axe smoke covers every new page for the FM, the constructor and the Admin, and the manager
smoke now creates an urgent pending request first.

| #   | Severity | Where                           | Problem                                                                                                                       | Fix                                                                                                     | Commit    |
| --- | -------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------- |
| P1  | High     | Request detail, Items table     | At 1280 px the "Now" column was clipped ("In…", "Not in in…"): three badges shared one cell.                                  | Badges moved under the item name; the stock columns hold plain numbers, with the reorder level as text. | `aa68eb8` |
| P2  | Medium   | FM home, Purchase requests card | axe (serious, definition-list): the "N marked urgent" line sat inside the `<dl>`. Seen only with an urgent request pending.   | Moved outside the list. The manager smoke test now creates that state, so it's checked every run.       | `5677a24` |
| P3  | Medium   | Latest scans (FM/QI homes)      | axe (serious, listitem) during loading: `role="status"` on the skeleton `<ul>` removed its list role (from Phase 8's A4 fix). | The skeleton is a status `div` of plain bars.                                                           | `5026a6e` |
| P4  | Low      | Procurement tabs                | On the Requesters tab the status counts showed "(–)".                                                                         | Counts load on every tab.                                                                               | `aa68eb8` |

## Checked and fine

- **Hierarchy:** each page has one filled primary button (New batch, Receive stock, New token…).
  The secondary actions are outline or ghost buttons.
- **States:** every list has an empty state that says what to do next. Every data page has a
  `loading.tsx` and an `error.tsx` with Try again. The live feeds show "Updated Ns ago" and a
  stale state.
- **Meaning is never colour-only:** verdict, stock and status badges carry an icon and a word. The
  report chart has a legend and the data table below it (D-025).
- **Dark mode:** chosen per surface, not inverted. The homes, batches, reports, salvage and
  inventory pages were checked at 1280 px, and axe passes on the FM pages in dark mode.
- **Workforce:** no per-person ranking or score on any screen (D-008). Names appear only as
  "by …" on records.

## Known limits of this audit

- Keyboard focus order was spot-checked on the forms and dialogs (batch new, receive stock, override,
  discard), not exhaustively on every screen.
- Reduced motion is handled globally (`globals.css` cuts every animation and transition to 1 ms).
  It was read in code, not tested with the OS setting on.
- No screen-reader session beyond what axe checks.
- No real users. The panel demo is the first outside look.
