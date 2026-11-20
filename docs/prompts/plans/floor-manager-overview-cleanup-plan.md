# Plan: a cleaner Floor Manager Overview

Status: **plan only, written 2026-11-20 (planning thread, no code touched). Nothing is built; waits for
Dylan's answers (§14) and go.** Asked 2026-11-20: Dylan finds the Overview messy (screenshot: a
full-width banner, a greeting, two alert cards leaving an empty third column, then an uneven grid with
mismatched card heights and gaps). One feature, one session. **Recommendation: its own small phase after
Phase 34 merges (§12).**

Read for this plan: vault `CLAUDE.md`, `Rules.md`, `Home.md`, "CPoint commands and where to look",
today's Daily note, `Notes/Phases/Defense revisions (32 to 36)`; repo `CLAUDE.md`, `AGENTS.md`,
`DESIGN.md`, `ui-craft/SKILL.md`, `docs/STATUS.md`, `qa/phase-34-files.txt`, and the Overview code
below. DESIGN.md wins on every look decision here (tokens only, D-034 grids, one primary per view).

## 1. Intent brief (ui-craft §1)

- **Who:** the Floor Manager at the office desk, glancing at the Overview several times a shift (D-025).
- **The one job:** see in two seconds whether anything needs me now, then how the line is doing.
- **Worst case:** a real exception (no plan, stock update missed, attendance not taken, low stock) sits
  among equal-looking cards and goes unseen, or the same prompt shows twice and gets ignored.
- **Density:** compact, expert user (DESIGN.md). Tone: plain, factual.

## 2. Problems observed (screenshot and code)

Code: `src/app/(app)/floor-manager/page.tsx` renders one `grid grid-cols-1 items-start gap-4
xl:grid-cols-3` with eight children in a fixed order; the banner comes from the app layout.

| #   | Problem                                                                                                                                                                                                                                                        | Cause in code                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Same prompt twice.** A full-width banner and a "Plan today" card say the same sentence ("Today has no plan yet, so there are no batches.") and both have a Plan today button.                                                                                | `PlanNoticeBanner` is rendered by `src/app/(app)/layout.tsx` on every page for the FM (A-37, D-114); `PlanTodayCard` is also rendered by the Overview. The "Today's batches" card repeats the sentence a third time through `nextLine()` in `production-cards.tsx`. |
| P2  | **Banner sits above the page title**, so the first thing read is an alert, then the greeting, then another alert.                                                                                                                                              | The layout puts banners before `{children}`.                                                                                                                                                                                                                        |
| P3  | **Two alert cards leave an empty third column**, and a lone alert card is a 1/3-width box with a big button.                                                                                                                                                   | The alert cards are ordinary grid items (`items-start`, one column each).                                                                                                                                                                                           |
| P4  | **Uneven rows, ragged heights, big gaps.** Today's batches is 2 columns and short; Work in progress sits in the third column of the same row but a different height; the later six cards start on new rows with `items-start`, so each card is its own height. | `items-start` on a 3-column grid with a `xl:col-span-2` card and seven 1-column cards; 8 or 9 cards never fill rows of 3.                                                                                                                                           |
| P5  | **No hierarchy.** Exceptions, the main status and reference numbers are all the same card, size and weight.                                                                                                                                                    | One flat list.                                                                                                                                                                                                                                                      |
| P6  | **Three primary buttons possible at once** (Plan today, Update stock, Take attendance all default `primary`).                                                                                                                                                  | DESIGN.md: one primary per view.                                                                                                                                                                                                                                    |
| P7  | **Work in progress card is cramped**: a fixed `grid-cols-2` for stages, a repeated "Open" link, and a sentence that mixes repairs and the waiting line.                                                                                                        | `wip-card.tsx` (Phase 34, uncommitted).                                                                                                                                                                                                                             |
| P8  | **Empty states are uneven**: Low-stock says "Nothing to reorder" with a tick, Rolls today a description only, Attendance a caution + button, Today's batches a quota block ("0 pairs passed") on a day with no plan.                                           | Per card.                                                                                                                                                                                                                                                           |

## 3. The proposal in one paragraph

Three stacked zones with 32 px between zones (DESIGN rhythm) and 16 px between cards:
**(A) Needs attention**, shown only when something needs doing: slim action rows, one or two, full
width of their share, no empty column. **(B) On the line now**: Today's batches (wide) beside Work in
progress, equal height. **(C) Today so far**: Attendance, Rolls today, Low-stock alerts, Daily summary in
a 2 × 2 grid (one row of four on very wide windows), equal height per row. The plan banner no longer
shows on the Overview itself (the Plan today row replaces it there); it stays on every other page.

## 4. Layout (wireframes)

Content width = window width − sidebar (240 px from 1024 px, a 56 px rail below) − page padding
(80 px from 1024 px, 32 px below). So 1280 px → about 960 px of content; 1536 px → about 1216 px;
1024 px → about 704 px.

### 4.1 Wide (xl ≥ 1280 px, about 960 px of content and up)

```
Good day, Dylan                                              (PageHeader, unchanged)
Today on the production line.

┌ NEEDS ATTENTION  (zone A, only if something is due; auto-fit, 1 row) ─────────────┐
│ ▣ Plan today                              [ Plan today ]  │ ▣ Stock update today  [Update stock] │
│   No plan yet, so no batches. Set the rolls, quota and    │   Enter what was added and used…     │
│   check-in interval.                      (primary)       │                       (secondary)    │
└─────────────────────────────────────────────────────────────────────────────────────┘
   With one item it takes the whole row; with none the zone is not rendered (no gap).
                                              gap-8
┌ Today's batches ─────────────────────────── Open ┐ ┌ Work in progress ────────── Open ┐
│ 86 of 120 pairs passed  72%                       │ │ Pairs at each stage, as last      │
│ ████████░░░░░                                     │ │ counted today.                    │
│ 90 finished, 4 failed inspection. On pace…        │ │ Preparation 33   Construction 28  │
│ 1 batch is late. …                                │ │ Sole-ing    –    Finishing   12   │
│ (shortfall note)                                  │ │ ─ 2 pairs in repair. 1 batch      │
└───────────────────────────────────────────────────┘ │   waiting for inspection.         │
   2fr, same height as WIP (grid stretch)             └───────────────────────────────────┘ 1fr
                                              gap-8
┌ Attendance ────────── Edit ┐ ┌ Rolls today ──────── Rolls ┐      (2 × 2; 4 across at 2xl,
│ 5 Shoe Constructors present│ │ 12 scanned · 1 returned · 2 │       window ≥ 1536 px)
└────────────────────────────┘ └─────────────────────────────┘
┌ Low-stock alerts ── Inventory ┐ ┌ Daily summary ────── Reports ┐
│ ✓ Nothing to reorder          │ │ table, yesterday | today      │
└───────────────────────────────┘ │ Reports · Download 14-day CSV │
                                  └───────────────────────────────┘
```

### 4.2 Medium (lg–xl, 1024–1279 px, about 704–944 px of content; also md 768 px)

```
Good day, Dylan
┌ Needs attention: rows side by side if both fit (22 rem each), else stacked ─────┐
┌ Today's batches (full width) ───────────────────────────────────────────────────┐
┌ Work in progress (full width; the four stage figures sit in one row) ───────────┐
┌ Attendance ─────────────────┐ ┌ Rolls today ─────────────────────────────────────┐   (md and up: 2 columns)
┌ Low-stock alerts ───────────┐ ┌ Daily summary ──────────────────────────────────┐
```

### 4.3 Narrow (below 768 px; the app stays desktop-first, D-034, but must not scroll sideways)

One column, same order: Needs attention, Today's batches, Work in progress, Attendance, Rolls today,
Low-stock alerts, Daily summary. Action rows stack: text above, button full width (`max-sm:w-full`).

### 4.4 Grid rules (D-034)

- **Zone A:** `grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-4`. Auto-fit, so one
  row takes the full width and two share it; no fixed column count.
- **Zone B:** `grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`. `xl:` stacking is the
  rule D-034 allows (the same pattern as `batches/page.tsx` and Capture). `items-stretch` (default), and
  each card gets `h-full` so the two are the same height.
- **Zone C:** `grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4`. Pure `md:`/`2xl:` stacking. I
  tried `auto-fit` here and rejected it: with four cards it leaves one orphan card alone on a row at
  both 960 px (3 + 1) and 1216 px (3 + 1). Stacking breakpoints give 2 × 2 and 4 × 1 with no orphan.
- Cards in zones B and C are `h-full flex flex-col`; a card's footer links use `mt-auto` so a short card
  stretched to a taller neighbour keeps its links at the bottom, not floating mid-card.
- Zone spacing: the layout already wraps `{children}` in `flex flex-col gap-8`, so the page returns the
  PageHeader and the zones as siblings: 32 px between the header and each zone, 16 px between cards
  (`gap-4`), as DESIGN → Look → Rhythm says. Zone A returns nothing when empty, so it adds no gap.

## 5. Grouping and card order

DOM order is the reading and tab order (also the narrow order):

| Zone                               | Order | Card                                   | Why here                                                                           |
| ---------------------------------- | ----- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| A. Needs attention (only when due) | 1     | Plan today (`PlanTodayCard`)           | The day cannot start without it (A-37).                                            |
|                                    | 2     | Stock update today (`StockUpdateCard`) | Reminder day, until saved (C-32).                                                  |
| B. On the line now                 | 3     | Today's batches                        | The core status: quota, next batch, late and missed.                               |
|                                    | 4     | Work in progress                       | The line's second status view (Phase 34).                                          |
| C. Today so far                    | 5     | Attendance                             | People today; has its own "Not taken yet" prompt.                                  |
|                                    | 6     | Rolls today                            | The camera check, today.                                                           |
|                                    | 7     | Low-stock alerts                       | The materials exception; its own card stays here because it is mostly "all clear". |
|                                    | 8     | Daily summary                          | Reference: yesterday against today.                                                |

Order of A items matches the bell menu (Plan, then Stock). Low-stock is not promoted into zone A:
at 0 items it would be a wasted action row, and its count is already visible in zone C.

## 6. The duplicate prompt (P1, P2)

**Recommendation (A): on the Overview the Plan today row is the only prompt; the banner is hidden on
that page only.** Everywhere else nothing changes.

| Surface                                                                            | Today                                                                                                       | After                                                                                                                      |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Banner (`PlanNoticeBanner`, FM only, `planDue`)                                    | on every page, above the page                                                                               | on every page **except `/floor-manager`**                                                                                  |
| Plan today card                                                                    | first card on the Overview                                                                                  | first row in zone A on the Overview (slimmer, same `data-testid="plan-today-card"`)                                        |
| Bell item "Today has no plan yet. Plan today."                                     | in the bell                                                                                                 | unchanged                                                                                                                  |
| Today's batches line "Today has no plan yet, so there are no batches."             | third repeat                                                                                                | "Nothing to count until today is planned." (no repeat, and no second call to action)                                       |
| Quality Inspector                                                                  | reads "No batches yet today. The Floor Manager plans them first." on Batches; never sees `PlanNoticeBanner` | unchanged (it is FM-only already, `planDue` is false for every other role)                                                 |
| Admin                                                                              | sees neither banner                                                                                         | unchanged                                                                                                                  |
| `BatchNoticeBanner` (due or "get ready" batch, the QI, and the FM covering, D-088) | on every page including the Overview                                                                        | unchanged; it is the only banner left on the Overview and is a time-critical Finish batch action, not a repeat of any card |

Why hide the banner and keep the card (and not the reverse):

1. The stock update already works this way (bell + Overview card, no banner), so plan and stock
   behave alike. DESIGN's Batch notices section lists three surfaces for the plan; this removes one,
   on the page where another already says it.
2. The banner sits above the page title and the card sits in the page's reading order beside
   the other status. The row keeps the alert tone (`border-info bg-info-soft`, `BellRing`), so it still
   reads as an alert.
3. `PlanNoticeBanner` is already a client component in `batch-notices.tsx`, so reading
   `usePathname()` there needs no new file, and the server layout still decides _whether_ the notice is
   due.
4. The reverse (drop the card, keep the banner) would leave the Overview with no plan row at the
   position the FM looks, and break the existing `plan-today-card` assertion for no gain.

This amends D-114's "banner on every page" (new D-entry, §11). The layout wrapper around the banner
gets `empty:hidden` (as the `BatchNoticeBanner` wrapper has), or a hidden banner would still add a 32 px
flex gap above the page.

## 7. Action-needed zone against the status zone

- **Zone A (action):** only things the FM must do, each with one button: Plan today, Update stock. No
  data, no figures, info tone. Hidden entirely (not an empty box) when neither is due.
- **Zones B and C (status):** read-only figures and links. Their own prompts stay inside them:
  Attendance's "Not taken yet today" with **Take attendance**, and Today's batches' late/missed
  sentence. **Take attendance does not move to zone A** (open question 2): it needs the card's context
  (the count shows once it is taken) and moving it would change the tested card.
- **One primary button per view (P6):** the first action row present has the primary Plan today /
  Update stock button; the second is `variant="secondary"`. `StockUpdateCard` gets a `primary` prop,
  false when `production.planNeeded`. **Take attendance** becomes `variant="secondary"` always (it is
  a card-level action; the page's primary is in zone A).

## 8. Empty and quiet states, per card

| Card             | When quiet or empty                       | After                                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Needs attention  | nothing due                               | not rendered; no gap, no "all clear" box                                                                                                                                                                                    |
| Today's batches  | no plan / Non-working / not a working day | description says it in one muted line (no repeat of the Plan today text, no button); the existing quota block stays so the card keeps its height (hiding it would break `batches.spec.ts` D-088 test on a weekend, see §10) |
| Today's batches  | every batch finished                      | unchanged ("Every batch for today is finished.")                                                                                                                                                                            |
| Work in progress | a stage not counted today                 | the figure shows "–" with a visually hidden "not counted today"; if every stage is "–", one muted line "No stage has been counted today."                                                                                   |
| Work in progress | nothing in repair, nothing waiting        | one muted line "No repairs open. Nothing is waiting for inspection." (from the same `waiting.line` text, no new rule)                                                                                                       |
| Attendance       | not taken                                 | unchanged: caution icon, "Not taken yet today.", **Take attendance** (now secondary)                                                                                                                                        |
| Rolls today      | no roll finished                          | description "No roll finished at Capture yet today." stays; the three figures show 0 (no card collapse)                                                                                                                     |
| Low-stock alerts | none                                      | tick + "Nothing to reorder right now." (unchanged); card is shorter than its row neighbour and stretched, content top-aligned, link in the header                                                                           |
| Daily summary    | quiet day                                 | the table always shows (zeros); footer links `mt-auto`                                                                                                                                                                      |

Copy rule (vault memory "plain copy"): screen text stays short and plain; the new strings are listed
in §9 and queue until Codex finishes the Phase 34 run, then are built with this phase (§12).

## 9. Files to change, with the approach per file

Only the Overview's files. **No Prisma, service, controller, route or validator change** (all data and
behaviour kept).

| File                                                                                                                                                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/floor-manager/page.tsx`                                                                                                                                 | Replace the one grid with three zones (§4.4). Zone A is a `div` rendered only if `production.planNeeded \|\| stock.due`, with a visually hidden `<h2>` "Needs attention" (`aria-labelledby`). Pass `primary={!production.planNeeded}` to `StockUpdateCard`. Keep every data call as is (`Promise.all` untouched). Update the intent comment at the top. **Phase 34 also edits this file** (adds the WipCard import and call): see §12. |
| `src/app/(app)/floor-manager/wip-card.tsx`                                                                                                                             | `h-full flex flex-col`; stage figures in `grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]` (2 × 2 at about 315 px, 4 in a row at full width); the repairs/waiting sentence split into a muted footer line; the "–" and all-"–" quiet states of §8. Keep `data-testid="wip-card"` and the stage labels (`stage-wip.spec.ts` reads "Preparation"). **Phase 34 file.**                                                                 |
| `src/components/features/production/production-cards.tsx`                                                                                                              | `PlanTodayCard` rebuilt on the shared `ActionCard` (below), same testid, one-line copy; `TodaysBatchesCard` loses `xl:col-span-2` (the page's zone-B grid owns the width), gains `h-full`, and `nextLine()`'s no-plan wording changes (§6). Not a Phase 34 file.                                                                                                                                                                       |
| **new** `src/components/features/overview/action-card.tsx`                                                                                                             | `ActionCard({ testId, icon, title, description, action })`: a `Card` with `border-info bg-info-soft`, `flex flex-col gap-3 p-4 sm:flex-row sm:items-center`: icon + `h2` title + one muted line at the left, the button at the right (`sm:ml-auto`, `max-sm:w-full`). Tokens only.                                                                                                                                                     |
| `src/components/features/inventory/stock-update-card.tsx`                                                                                                              | Rebuilt on `ActionCard`; new `primary?: boolean` prop (default true) that sets the button `variant`. Same testid, same `describeReminderDays` sentence.                                                                                                                                                                                                                                                                                |
| `src/components/features/attendance/attendance-card.tsx`                                                                                                               | `h-full`; **Take attendance** `variant="secondary"`; nothing else.                                                                                                                                                                                                                                                                                                                                                                     |
| `src/components/features/reports/home-cards.tsx`                                                                                                                       | `RollsTodayCard` and `DailySummaryCard`: `h-full flex flex-col`; Daily summary's link row gets `mt-auto`. Titles unchanged (`reports.spec.ts` reads "Rolls today", "Rolls scanned", "Returned to supplier", "Daily summary").                                                                                                                                                                                                          |
| `src/components/features/inventory/low-stock-card.tsx`                                                                                                                 | `h-full`; content unchanged.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/components/features/batches/batch-notices.tsx`                                                                                                                    | `PlanNoticeBanner`: `usePathname()`; return `null` when it is `/floor-manager`. (The file already has `"use client"` and imports `usePathname`.)                                                                                                                                                                                                                                                                                       |
| `src/app/(app)/layout.tsx`                                                                                                                                             | Add `empty:hidden` to the `print:hidden` wrapper around `PlanNoticeBanner`.                                                                                                                                                                                                                                                                                                                                                            |
| `DESIGN.md`                                                                                                                                                            | Update "Plan today (D-114, A-37)" and the `LowStockCard` row: the banner shows on every page except the Overview; add a short "Floor Manager Overview" section with the three zones.                                                                                                                                                                                                                                                   |
| `docs/STATUS.md`, `SESSION_LOG.md`, `DECISIONS.md`, `ROADMAP.md`, `docs/USER_MANUAL.md` (the Overview list near line 306), `README.md` line ~150 if it names the order | wrap-up docs for the new phase.                                                                                                                                                                                                                                                                                                                                                                                                        |

Do **not** touch (Phase 34 files that are not needed): `production-parts.tsx` (`QuotaProgress`),
`stage.service.ts`, `repair-rules.ts`, `wip-board.tsx`.

## 10. Components and tokens (existing, no new tokens)

- Existing: `PageHeader` (unchanged), `Card`, `CardHeader`, `CardTitle`, `CardDescription`,
  `CardContent`, `CardLink`, `Stat`, `Button` (`primary`, `secondary`, `sm`), `Badge`, `StockBadge`.
- Colour: `border-info`, `bg-info-soft`, `text-info`, `text-caution`, `text-muted-foreground`,
  `text-pass`. No red, no yellow text, no raw values.
- Sizes: `text-kpi` for key figures (already), `text-xl` for the WIP stage numbers (already), `text-sm`
  for descriptions, card padding `p-5` (action row `p-4`, the one place it is tighter, so it reads as
  a slim notice).
- Shared page header and KPI tile: kept as they are. KPI tiles are not used (the cards already use
  `Stat` in a `dl`, which DESIGN names for "Rolls today"). States: `EmptyState` is not used inside these
  cards (a dashed box would shout); the quiet lines above are the card-level equivalent.
- No motion added. No gradients, no shadows beyond `shadow-1` (already on `Card`).

## 11. Decisions and assumptions to log (D-entry, A-entries)

- **New D-entry (number set at build; D-131 if still next):** "The Overview has three zones and the
  plan banner is hidden on it." Amends D-114's banner sentence; D-098 and A-37 otherwise stand.
- **ASSUMPTION (A-97, this plan):** the plan banner is hidden on `/floor-manager` only, because the Plan
  today row there says the same thing; every other page keeps it.
- **ASSUMPTION (A-98):** the Overview keeps Attendance's "Not taken yet today" prompt in its own card,
  not in the Needs attention zone.
- **ASSUMPTION (A-99):** when both action rows show, Plan today is the primary button and Update stock
  is secondary (one primary per view).
- No business rule is added or changed. Numbers, thresholds, reminder days and who sees what are
  untouched. (A-numbers are the next free ones after A-96; check STATUS at build.)

## 12. Recommendation: its own small phase, after Phase 34 merges

**Ship it as its own small phase, "Overview clean-up" (un-numbered, like "Reports clean-up" and "Demo
seed refresh"), on branch `feature/overview-cleanup`, started only after Phase 34 is merged to `main`.**

Why not inside Phase 34:

- Phase 34 is uncommitted in the same folder, and **two of the files this cleanup changes are Phase 34
  files**: `src/app/(app)/floor-manager/page.tsx` and `src/app/(app)/floor-manager/wip-card.tsx` (both
  in `qa/phase-34-files.txt`). Codex run 2 is running against them now; editing them under it would
  change what Codex is testing and make its report meaningless for the final code.
- The other files (`production-cards.tsx`, `home-cards.tsx`, `attendance-card.tsx`,
  `low-stock-card.tsx`, `stock-update-card.tsx`, `batch-notices.tsx`, `layout.tsx`, `DESIGN.md`) are not
  in the Phase 34 list, so there is **no merge conflict risk on those**, but `DESIGN.md` and the wrap-up
  docs (`STATUS`, `SESSION_LOG`, `DECISIONS`, `ROADMAP`) are in the Phase 34 list: they must be edited
  after Phase 34's commit, not before.
- Phase 34 is a data/behaviour phase with a 47-scenario QA run. A visual rework mixed in would blur
  what a failure belongs to, and the git commit for Phase 34 (a file list in `qa/phase-34-files.txt`)
  stays clean.
- It is small (§9: ten source files, one of them new, no data layer), one session, one short Codex run.
- Phase 35 (reports by period) touches `reports/**` and the report services, not these cards (its plan
  lists no home-card file), so Overview clean-up can go between 34 and 35 without conflict.

Order: Phase 34 Codex pass → Dylan commits and merges Phase 34 → this phase from a fresh `main`.
Before that, nothing in the app changes. Optional interim: none; the current page works.

Conflict summary:

| File                                                                     | Phase 34 touches it | Cleanup touches it         | Risk if done together                     |
| ------------------------------------------------------------------------ | ------------------- | -------------------------- | ----------------------------------------- |
| `floor-manager/page.tsx`                                                 | yes                 | yes (the whole layout)     | high                                      |
| `floor-manager/wip-card.tsx`                                             | yes                 | yes (layout, empty states) | high                                      |
| `DESIGN.md`, `STATUS.md`, `SESSION_LOG.md`, `DECISIONS.md`, `ROADMAP.md` | yes (wrap-up)       | yes                        | medium (both append to the same sections) |
| `production-parts.tsx`                                                   | yes                 | no (avoided on purpose)    | none                                      |
| the other seven card/layout files                                        | no                  | yes                        | none                                      |

## 13. Accessibility

- Heading order: `h1` (page), zone A has a visually hidden `h2` "Needs attention"; each card's title is
  the existing `h2`. The zone headings are not shown for zones B and C (the cards' own titles do the
  job, and a heading above each pair would crowd a compact page). No level is skipped.
- Reading and tab order is the DOM order of §5. No `tabindex`, no positive order values, no visual
  reordering with CSS `order`.
- The plan row keeps the alert tone with icon + words (colour never alone). `role` stays default for
  the cards. The `role="status"` live banner is not rendered on this page, so the row is read in
  page order on load; the bell and other pages still announce it.
- Buttons are real links styled as buttons (`Button asChild`), visible focus ring from `Button`;
  the action rows' buttons are full width on narrow windows. `CardLink`s keep their 28 px desktop
  height (DESIGN: desktop first); not touched.
- Contrast: only existing token pairs (`bg-info-soft` + `text-foreground`, `text-muted-foreground`).
- No sideways scroll at any width: `minmax(0, …)` on the 2fr/1fr columns, `min(100%, 22rem)` on zone A,
  long item names in Low-stock keep `truncate` and `min-w-0`.
- "–" for an uncounted stage gets a visually hidden "not counted today".
- Check light and dark (`data-theme`), at 1024, 1280, 1536 and 1920 px, and a narrow 768 px window.

## 14. Tests

Unit tests: **none of the existing 940 read Overview markup**; nothing in `tests/unit` asserts the
cards (checked with `rg` on the card names and testids). The service and rules functions are
unchanged, so no unit test changes. The new `ActionCard` and the `primary` prop are server-rendered
markup with no unit-test harness in this repo, so they are covered by the e2e spec below.

Existing e2e that touch the Overview (found with `rg` on the testids and card text):

| Spec                                                                 | Line    | Reads                                                                                                    | Change needed                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/batches.spec.ts` "a weekday with no plan has no batches…" | 265–266 | `plan-notice` contains "Today has no plan yet" on the FM home; `plan-today-card` visible                 | **Yes.** On the home: `plan-notice` count 0, `plan-today-card` visible. Then `fm.goto("/batches")`: `plan-notice` contains "Today has no plan yet" (the banner still shows there) before the existing `no-batches` line. Keep 267–274 (bell) and 276–283 (QI). |
| `tests/e2e/batches.spec.ts` D-088 test                               | 506–508 | `todays-batches-card` visible, `quota-progress` "pairs passed"                                           | No (the quota block stays, which is why §8 keeps it; on a weekend it still renders).                                                                                                                                                                           |
| `tests/e2e/stage-wip.spec.ts`                                        | 251–252 | `wip-card` contains "Preparation"                                                                        | No (testid and labels kept). Phase 34 file, do not edit.                                                                                                                                                                                                       |
| `tests/e2e/reports.spec.ts`                                          | 243–248 | `rolls-today`, `rolls-today-open`, "Rolls scanned", "Returned to supplier", `getByText("Daily summary")` | No, if no other element on the page contains the text "Daily summary" (so no sr-only heading with that word).                                                                                                                                                  |
| `tests/e2e/inventory.spec.ts`                                        | 231–232 | `low-stock-card` contains "at or below the reorder level"                                                | No.                                                                                                                                                                                                                                                            |
| `tests/e2e/attendance.spec.ts`                                       | 91–92   | `attendance-card` contains "Shoe Constructors? present"                                                  | No.                                                                                                                                                                                                                                                            |
| `tests/e2e/auth.spec.ts`, `helpers.ts`                               | n/a     | FM home URL `/floor-manager`, sidebar names                                                              | No.                                                                                                                                                                                                                                                            |
| `tests/e2e/capture.spec.ts`                                          | 306     | Capture's plan counter text                                                                              | No (different component).                                                                                                                                                                                                                                      |

New e2e (one small spec, `tests/e2e/overview-layout.spec.ts`), FM at 1280 px unless stated:

1. **Zones and order:** with today unplanned (the `batches.spec.ts` DB setup pattern) the Needs
   attention zone holds `plan-today-card`; the first card in DOM order is the plan row, then
   `todays-batches-card`, `wip-card`, `attendance-card`, `rolls-today`, `low-stock-card`, the Daily
   summary. With a plan saved, the zone is absent (`count 0`, no empty box).
2. **Equal heights:** at 1280 px `todays-batches-card` and `wip-card` have bounding-box heights within 1 px
   of each other; `attendance-card` and `rolls-today` the same; no card overlaps another.
3. **No empty column / orphan:** at 1280 px the four zone-C cards sit in two rows of two (the two tops
   equal pairwise); at 1536 px in one row.
4. **One primary:** with both Plan today and Update stock due, exactly one `Button` of the primary
   variant is in zone A (the stock one is secondary). (Stock due depends on the day; skip on a
   non-reminder day, or set the reminder days through the settings API, as `inventory.spec.ts` does.)
5. **No sideways scroll** at 768 and 1024 px (`scrollWidth <= clientWidth`) and the axe scan, as the plan
   test does today.

## 15. QA handoff outline for Codex (for the build session to write)

`qa/handoffs/2026-MM-DD-overview-cleanup.md` from `qa/templates/handoff.md`, and the paste-in prompt
`qa/CODEX_PROMPT_OVERVIEW_CLEANUP.md`. Codex tests and reports only (D-092); browser checks in its in-app
browser at the `npm run dev` URL, e2e with `E2E_BASE_URL`.

| #   | Scenario                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | FM, today unplanned: one prompt only: the Plan today row at the top of the page; no banner above the title; the bell still lists "Today has no plan yet. Plan today."; the banner shows on `/batches`, `/attendance`, `/reports`. |
| O2  | FM, plan saved: zone A gone, no gap under the header; Today's batches and Work in progress equal height at 1280 and 1536 px.                                                                                                      |
| O3  | Stock reminder day (Wednesday or Friday, or change the reminder days): Stock update row; with both rows due, Plan today is the filled button and Update stock the outlined one.                                                   |
| O4  | Zone C: 2 × 2 at 1280 px, 4 in a row at 1536 px, 1 column at 768 px; tops align per row; no card floats mid-row; Daily summary's links sit at the card's bottom.                                                                  |
| O5  | Empty and quiet states: a day with no stage counts (Work in progress "–" and its one muted line), no low stock, attendance not taken (caution + Take attendance, outlined), no rolls scanned.                                     |
| O6  | A due batch for the FM covering (no QI present): the batch banner still shows above the title with **Finish B-…**; it is the only banner.                                                                                         |
| O7  | The Quality Inspector's and Admin's pages are unchanged (no Overview change for them; QI's Batches message reads as before).                                                                                                      |
| O8  | Dark theme, narrow window 768 px, keyboard Tab order follows the zones, axe clean, no sideways scroll.                                                                                                                            |
| O9  | The new e2e spec and the full suite (two workers on a fresh dev server, per the Phase 32 notes); the edited `batches.spec.ts` test.                                                                                               |

Screenshots of O1, O2 and O4 in `qa/reports/` for Dylan to compare against his "messy" screenshot.

## 16. Build order (one session, Sonnet coding thread, after the go and after Phase 34 merges)

1. `action-card.tsx`; rebuild `PlanTodayCard` and `StockUpdateCard` on it (`primary` prop).
2. `page.tsx` zones and grids; `h-full` on the cards; `wip-card.tsx` and the empty states of §8.
3. `batch-notices.tsx` path hide and the layout `empty:hidden`.
4. Update `batches.spec.ts`; add `overview-layout.spec.ts`.
5. `npm run check` (lint, typecheck, unit tests, build). Claude does not run browser or e2e tests.
6. Handoff, Codex prompt, DESIGN.md, STATUS, SESSION_LOG, DECISIONS, ROADMAP, USER_MANUAL, vault
   Daily note and a phase summary note. Give Dylan the git commands (`feature/overview-cleanup`,
   explicit file list).

## 17. Questions for Dylan (each has a recommendation)

1. **The duplicate Plan today prompt:** hide the banner on the Overview and keep the Plan today row
   (recommended: stock already works that way, and every other page keeps the banner), or keep the
   banner and drop the card?
2. **Attendance "Not taken yet today":** leave it inside the Attendance card (recommended), or move it
   up into the Needs attention zone with Plan today and Update stock?
3. **Zone headings:** keep zones B and C without visible headings (recommended: compact, the card
   titles are enough), or show small headings ("On the line now", "Today so far") above them?

## 18. Assumptions of this plan

- A-97, A-98, A-99 in §11 (new, to be moved to STATUS when approved).
- The widths in §4 (content width = window − 240 px sidebar − 80 px padding from 1024 px) come from
  `sidebar.tsx` (`lg:w-60`) and `(app)/layout.tsx` (`lg:px-10`); the breakpoints are chosen from them,
  not from a measured screenshot, so Codex checks O4 at 1280, 1536 and 1920 px.
- "Needs attention" is shown only for the two items that exist today (Plan today, Stock update today);
  no new alert is added.
- The copy in §6 and §8 ("Nothing to count until today is planned.", "No stage has been counted today.",
  "No repairs open. Nothing is waiting for inspection.") are proposals in plain words, not rules; they
  are built after the Phase 34 Codex run finishes (vault note: copy changes queue until Codex is done).
- Low-stock still shows up to five items (DESIGN → `LowStockCard`); a five-item list makes that row
  taller than Daily summary, which the stretched grid and `mt-auto` footer absorb. If Dylan finds it
  too tall, capping the Overview list at three (with the existing "N more" link) is a one-line change.
- Nothing in the data layer, permissions, audit or routes changes, so no migration and no API.docs
  change (`docs/API.md` is untouched).
