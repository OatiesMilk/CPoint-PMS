# Design

Source of truth for how CPoint PMS looks and behaves. Tokens live in `src/styles/tokens.css` and
are mapped to Tailwind utilities in `src/app/globals.css`. **Components use tokens only:** no raw
hex, oklch, or arbitrary pixel values. This file overrides the defaults in `.claude/skills/ui-craft`.

## Intent

- **Who:** the Floor Manager at a desktop in the factory office, all shift long; the Quality
  Inspector on Batches, often on a phone (D-096); the System Admin occasionally. Shoe Constructors
  use only Capture, on their own phones, once the System Admin allows them (D-075, D-095).
- **Core job:** see what the line and the camera are doing right now, and act on exceptions:
  rolls returned to the supplier, short days, low stock.
- **Worst case:** a wrong verdict goes unnoticed (good leather discarded, or bad leather cut), or
  the UI shows data as current when it's stale. Verdicts are always labelled, each section's page explains its verdict, and every list shows when it was last updated.
- **Density:** compact. These are expert users who come back often. Body text is 14px, tables 13px.
- **Tone:** plain, factual English. Say what happened and what to do next. No exclamation marks.

## Character

| Axis      | Decision                                                                                                                                                                                            | Why                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Type      | **Figtree** (self-hosted via `@fontsource-variable/figtree`), weights 400/500/600. Tabular numbers on by default. `ui-monospace` for codes (batch, roll, token).                                    | Kept from the legacy system; friendly but clear. Self-hosted so the factory LAN works offline.   |
| Color     | Warm neutral ramp tinted toward the logo yellow. **Ink** (near-black) is the primary in light mode; **CPoint yellow** is the primary in dark mode. Yellow otherwise marks the brand and highlights. | Comes straight from the logo (yellow field, black lettering).                                    |
| Brand red | **Logo only.** Never used for buttons, links, or chrome.                                                                                                                                            | On a QC screen, red means Reject. A red brand accent would make every button look like an alarm. |
| Verdicts  | Pass = green, Reject = red, and nothing else (D-093). Always icon + label + color. Orange (`caution`) and blue (`info`) are status tones for warnings and notes, never a verdict.                   | Fixed meaning everywhere. Orange is not yellow, so it never reads as "brand".                    |
| Space     | 4px base. Scale 4/8/12/16/24/32/48. Tight inside groups, loose between sections.                                                                                                                    | Dense tables, readable page rhythm.                                                              |
| Finish    | Radius 6px (`rounded-md`); 4px badges. 1px borders for structure; two-layer `shadow-1` for cards and tables, `shadow-2` for popovers/dialogs only; a top light in dark. No gradients.               | Soft-industrial: crisp, not bubbly. Three surface levels (30F).                                  |
| Icons     | Lucide, 16px in controls, 14px in badges, stroke 2.                                                                                                                                                 | Matches Figtree's weight.                                                                        |

## Tokens

Names match the code (`--name` in CSS → `bg-name` / `text-name` in Tailwind).

| Group   | Tokens                                                                                                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface | `background`, `card`, `popover`, `muted`, `sidebar`, `sidebar-active`, `sidebar-indicator`                                                                                   |
| Text    | `foreground`, `muted-foreground` (≥ 6:1 on every surface), `*-foreground` pairs                                                                                              |
| Action  | `primary`, `secondary`, `accent` (yellow wash for hover/selected), `destructive`, `ring`                                                                                     |
| Lines   | `border` (dividers, 1.3:1), `input` (field outlines, ≥ 3:1 per WCAG 1.4.11)                                                                                                  |
| Brand   | `brand-yellow`, `brand-ink`, `brand-red` (logo only)                                                                                                                         |
| Verdict | `pass`, `reject`, each with `-soft` background; status tones `caution`, `info` (renamed from `rework`, `review` in Phase 25). Text-on-soft ≥ 4.7:1 in both themes.           |
| Chart   | `chart-pass`, `chart-reject` (CVD-validated for stacked marks: Pass lighter than Reject, D-093), `chart-info` (the quota line), `chart-bar`, `chart-bar-muted`, `chart-grid` |
| Type    | `text-xs` 12 · `sm` 13 · `base` 14 · `lg` 16 · `xl` 20 · `2xl` 24 · `3xl` 32 · `text-kpi` 28 (key figures)                                                                   |
| Finish  | `--radius` 6px → `rounded-sm/md/lg`; `shadow-1`, `shadow-2`                                                                                                                  |
| Motion  | `--ease-out`, `--ease-in-out`, `--dur-press` 120ms, `--dur-fast` 150ms, `--dur-base` 220ms                                                                                   |

**Dark mode** values are chosen, not inverted: ink surfaces with a slight warm tint, primary
flips to yellow with ink text, and verdict colors are lightened to keep ≥ 6.7:1 on cards. The
theme is set on `<html data-theme>` by an inline script before first paint. The saved choice
wins; otherwise the OS setting applies.

Contrast was measured for every text/surface pair (see `docs/SESSION_LOG.md`, Phase 0).
Re-measure whenever a color token changes.

## Look (Phase 30F, D-122)

What makes the app read as one finished product. Built on shadcn/ui (`new-york`) and Radix,
restyled with these tokens; no second component library.

- **Rhythm:** page padding 16 px on a phone, 40 px from `lg`; 32 px (`gap-8`) between a page's
  sections, 16 px between cards in a grid, 20 px inside a card. Tight inside a group, loose between.
- **Page header** (`PageHeader`): optional back link (muted, `ArrowLeft`), the title (`text-3xl`
  600 `tracking-tight`) with an optional addon such as a status badge, one line of description
  (`text-lg` muted), an optional meta line (`text-sm` muted), the page's actions at the right.
  **No rule under it**: the space before the content separates them.
- **Three surface levels:** the page (`background`), cards and tables (`card`, `shadow-1`, a
  border), and popovers and dialogs (`popover`, `shadow-2`). The sidebar sits a step below the
  page.
- **Card links** (`CardLink`): a card's way out ("Open", "Edit", "Inventory") is muted `text-sm`
  with an arrow, darker with a wash on hover. Never bold black: it mustn't compete with the title.
- **Key figures** (`KpiTile`): a small muted label, the figure in `text-kpi`, then at most two
  short muted lines; tiles in a row share one height. Inside a card, the same figure without a
  surface is a `Stat` in a `dl` (Rolls today, Materials at risk, the Audit log count).
- **Page actions** sit at the right of the title from `lg` (the description wraps beside them);
  a detail page (a roll, an item, a scan) uses the header's back link and puts its status badge
  beside the title. A card's single way out goes in its header; a second one sits in a footer
  row above a line.
- **Wide tables at 1280 px:** cells 10 px at the sides; long text columns wrap with a width cap
  and a code's second line truncates with a tooltip; headers of number columns may wrap onto two
  lines. The widest tables take `Table dense` (8 px sides) and let a long status badge wrap
  (`max-w-32 whitespace-normal`). A long sentence per row (Production's shortfall note) goes on a
  muted line under its row, across the table, not in a column. Drop a column only when it is on
  the detail page too and no test reads it. Never nest a block (`details`, `div`) inside a `p`:
  React rebuilds the page on load.
- **States** (`states.tsx`): `SkeletonHeader`, `SkeletonTable`, `SkeletonTiles`, `EmptyState`
  (icon in a muted circle, why, one next step, dashed border) and `ErrorState` (what happened,
  that nothing changed, Try again). Pages pass their own words.
- **Tabs** (Reports, Settings) stay links with `aria-current`, restyled, not Radix Tabs.

## Hierarchy rules

- **One primary button per view** (`variant="primary"`). Two solid buttons means neither is primary.
- Secondary = `variant="secondary"` (outline). Tertiary = `ghost` or `link`.
- **Destructive** = `variant="destructive"` (red outline, never solid), placed apart from the primary.
- Headings: page `text-3xl`/600, section `text-xl`/600, card title `text-lg`/600. Metadata uses
  `text-sm` + `muted-foreground`.
- Tables: numbers right-aligned, text left-aligned, one row height (36px), sortable headers marked
  with an icon.
- A table whose rows open a page of their own ends with an **Actions** column (header named for
  screen readers only) holding **View** (eye icon + the word, ghost `sm`, `TableViewLink`), beside
  any other row action. The first cell's link stays; View makes the way in visible.
- Layout: desktop first, left sidebar + content. Below 1024px the sidebar is an icon rail, grids
  reflow (`auto-fit`, `xl:` stacking) and tables scroll inside their card (D-034). Phone layouts
  only where the brief asks for them: Capture (Phase 26) and Batches (Phase 27), see "Phone
  layout" (D-096).

## Phone layout (D-096)

For the pages used on a phone by the line: Capture (the Shoe Constructor), Batches (the Quality
Inspector, Phase 27) and Find roll (the Floor Manager and constructors in the store, Phase 32,
D-128, A-71). Every other page stays desktop first.

- **Shell:** below 640px (`sm`) the sidebar is replaced by a top bar (`h-14`): the logo, the page's
  name, a page menu (`Menu`, "Pages") only when the role has more than one page, then the account
  menu (Change password, Sign out) and the theme switch. A Shoe Constructor with camera access has
  two pages, Capture and Find roll (Phase 32), so the page menu shows; without it, Capture only and
  no page menu. The Floor Manager has no Find roll item: Inventory has a **Find roll** button (Phase 41,
  D-138), and `/find` marks Inventory and titles the bar "Inventory".
- **Touch:** every control a thumb uses is at least 44px tall (`h-11`, `size="lg"`); the one
  primary action of a phone page is fixed at the bottom of the screen above the safe area
  (`pb-[max(0.75rem,env(safe-area-inset-bottom))]`) and the page leaves room for it (`pb-28`).
  From `sm` up it goes back into the page (`sm:static`).
- **Reading at arm's length:** what the action applies to repeats in large text (`text-xl`
  semibold), e.g. "Roll R-2026-0012 · Marikina Leather Trading · 6 shots", right above the action.
- **Forms:** one column, labels above, `h-11` inputs, native `<select>` (the phone's own picker).
- **Never** a sideways scroll at 390px; long words wrap, tables stay off phone pages.
- **Batches (Phase 27, history: since Phase 33 every title is the batch's code, "B-261116-2", not
  "Batch 2"):** one card per batch ("Batch 2 10:00–13:00", the lunch line, a status badge
  with icon and word); the batch that can be finished now is the page's bottom action, with
  "Batch 2 · 10:00–13:00" in `text-xl` above **Finish batch 2**. The Finish batch dialog opens as a
  bottom sheet (`max-sm:bottom-0`, no bottom radius, safe-area padding) with `h-12` numeric fields
  (`inputMode="numeric"`) and the buttons stacked `h-11`. On desktop each card's action column is one width, so
  every Finish batch and Correct button is the same size and lines up; the quota card's top lines up
  with the first batch card. The dialog is `size="lg"`: the two counts side by side, the rolls
  below in a bordered list: each roll shows only its code (it names the supplier) with the
  area at the right, and the item under it, cut short if long. The QI sees no tables there (today only);
  the Floor Manager's Recent days table is desktop.
- **Capture (30F-3):** the order is the Roll card (or Start a roll), the live picture, the marker
  card line, Floor view, the Camera line, then Last scan, the roll counts card and Model (on `xl`
  the last three are the right column). Below `sm` the page description is `sr-only`, so the
  picture is on the first screen at 390 × 844. A hint shows once: "Choose the roll this shot
  belongs to." lives under the Capture button only.
- **Find roll (Phase 32):** the Floor Manager reaches it from the Inventory page's **Find roll** button
  (`variant="secondary"`, first and `h-11` below `sm`, Phase 41), constructors from their menu; the page
  has a back link to Inventory for the Floor Manager only. One column, at most `max-w-xl`: the search field (`h-11`, monospace,
  "Roll code or tag number") and two `size="lg"` buttons, **Find** and **Scan label**, side by side
  from `sm`, stacked below it. The answer repeats the roll's code in `text-xl` and **Where it is**
  in `text-xl` semibold; the location history is a list (when, what, from → to), never a table.
  Scan label opens a bottom sheet with the camera picture (square), a frame to aim with, and
  "Looking for a QR code…"; camera problems use Capture's own messages.
- **Fixed bottom bars** are `bg-card` with `shadow-2` and a top border in both themes; the batch
  that can be finished now has a `border-ring` card.

## Batch notices (D-098)

For whoever finishes today's batches (the QI, or the Floor Manager covering, D-088), on every page:

- **Banner** at the top of the main column (`role="status"`, polite): the most urgent notice only.
  At 10 minutes before a batch's end, muted (`bg-muted/60`, `Hourglass`): "B-261116-2 ends at
  13:00. Get ready to count the finished pairs." At the end, info (`border-info bg-info-soft`,
  `BellRing`): "B-261116-2 is due. Finish it now." with **Finish B-261116-2** (`size="lg"`,
  `h-11`). Since Phase 33 every batch is named by its code, never "Batch 2" alone (D-129).
  **Not now** hides that notice until the next one; it stays in the bell.
- **Bell** beside the logo (sidebar on a desk, the phone top bar on a phone, `size-11` there): a
  dropdown of the due batches, each linking to Finish batch; its accessible name counts them
  ("Batch notices: 2 batches due"). Hidden for anyone who can't finish.
- **Tab title** starts with "(n)" while n batches are due.
- No sound, push or browser notification; nothing animates beyond the standard fade.

**Plan today (D-114, A-37, D-131)**, for the Floor Manager on a weekday with no plan, from 00:00 until
the day is planned or marked Non-working / Holiday: the same info banner (`border-info bg-info-soft`,
`BellRing`) "Today has no plan yet, so there are no batches. Plan today." with **Plan today**
(`size="lg"`, `h-11`) on every page **except the Overview**, where the Plan today row (below) says the
same thing; and a bell item. The Quality Inspector reads "No batches yet today. The Floor Manager plans
them first." on Batches.

## Floor Manager Overview (Overview clean-up, D-131)

Three zones in the page's `gap-8` flow, with `gap-4` between cards. The DOM order is the reading and tab
order; no CSS `order`. The first job is "does anything need me now?".

- **Needs attention** (a `section` with a screen-reader-only `h2`, rendered only when a row is due):
  `ActionCard` rows (`features/overview/action-card.tsx`): `border-info bg-info-soft`, `p-4`, the icon, the
  title (`h2`, `text-lg`) and one muted line at the left, the button at the right; below `sm` the button
  goes under the text, full width. Rows: **Plan today** and **Stock update today**, in the bell's order,
  in `grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))]` (one row takes the whole width). **One
  primary:** Plan today is the filled button; when it is also due, Update stock is `secondary`.
- **On the line now:** `xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`, Today's batches beside Work in
  progress; below `xl` they stack. Both are `h-full`, so they are one height.
- **Today so far:** Attendance, Rolls today, Low-stock alerts, Daily summary in two columns from `md`
  and four from `2xl` (stacking breakpoints, not `auto-fit`, so no card is left alone on a row).
  Cards are `h-full`; Daily summary's link row is `mt-auto`. Take attendance is `secondary`.
- No visible headings for the second and third zones (the card titles do the job). Quiet states are
  one muted line, never a dashed `EmptyState` box: Work in progress shows "–" (read as "not counted
  today") and "No stage has been counted today."; Low-stock "Nothing to reorder right now."

## Inspection queue (Phase 33, D-129)

Batches has two tabs, **Queue** and **Today**: links in a `nav` ("Batches views") under the page
header, `min-h-11`, the current one with a 2 px `border-foreground` underline and
`aria-current="page"`. Queue is the Quality Inspector's home; the Floor Manager opens on Today.

- **Queue card** (one per waiting batch, a `Card` in a list, the same shape as Today's batch
  card): the **code** large in mono (`font-mono text-xl font-semibold`), then its badges, each
  with an icon and a word (colour never alone): **Urgent** (danger, `Flag`), **Late** (warning,
  `Clock`), **Waiting** (info, `Hourglass`), **Being inspected** (brand, `UserCheck`). Below:
  the day and times (muted, tabular), the rolls line ("6 rolls (Full-grain black ×4, Suede brown
  ×2)"), "Waiting 3 hours 10 minutes", the Urgent reason, and who is inspecting it.
- **Actions** on the right on a desk, stacked full width on a phone (`sm:w-44`, `max-sm:h-11`):
  **Start inspection** (secondary, `Play`) and **Inspect** (primary, opens the Finish sheet).
  A batch someone else is inspecting has neither. The Floor Manager's **Mark Urgent** /
  **Set to Normal** and **Void** are small ghost buttons under the text; each opens a reason
  dialog (a bottom sheet on a phone) whose message names the field.
- **Filters** above the list in an auto-fit grid: Batch code, Day, Status, Priority, **Filter**
  (secondary) and **Clear** (ghost). A plain GET form, so the filters are in the address.
- **Inspected and void** below, a card with a divided list: code and badge, day and times and
  rolls, then the counts and who, or the void reason.
- Empty: a dashed box, "No batches are waiting for inspection."

## Final defects, repairs and stages (Phase 34, D-130)

- **Fixable / Not fixable** is a two-option segmented control: radio inputs in a `radiogroup`
  labelled "Can line N be fixed?", each a `min-h-9` bordered label, the chosen one on the
  `primary/10` tint with a primary border. A hint line under a defect offers "Use this"
  (secondary, small) and is never pre-selected. Lines are bordered `bg-muted/30` cards; **Add
  another defect** is a small secondary button, **Remove line N** a small ghost.
- **Batches → Work in progress:** a card per stage in line order in an auto-fit grid. One big
  number (the stage's pairs) and "as of 14:05" or "Not counted today"; repairs in a bordered list
  with their code in mono; the people assigned in a small muted line at the bottom, never beside a
  number. One neutral style for every stage: no red or green, no medals, no ordering by performance.
- **My stage** (Capture, a phone card): a heading "Sole-ing · pairs here now", one 56 px numeric
  field with **Save count**, "Last counted 14:05 for all of Sole-ing" in muted text, the reminder in
  the caution tone, and the stage's repairs below.
- **Who works where** (Plan dialog): a fieldset per stage with a checkbox list of the constructors;
  **Absent** is a warning badge, "At Sole-ing" a muted word beside someone ticked elsewhere; the
  suggestion banner is an info alert.

## Reports: periods, sort, filters and print (Phase 35A, D-132)

- **Period picker** (`PeriodPicker`, above the report): a segmented row of links, **Day · Week ·
  Month · Custom** (Rolls adds **Any time**), then the controls for the chosen one: a date, Year +
  Month + Week selects (a week that hasn't started is disabled), Year + Month, or From + To with
  **Show** and "Up to 366 days". The four quick links (Today, 7 days, 14 days, 30 days) sit beside it
  on Operations and Quality. Everything is in the URL; the range line says the period in words.
- **Sortable header** (`SortableHeader`): the label is a link; the active column shows an arrow and
  `aria-sort`, a second click reverses; one sort per page. No sort control on a table that is
  chronological by nature without a reason to reorder it.
- **Filters:** a plain GET form (select, **Apply**, **Clear**) above the cards it narrows, with a
  line saying which ("Filters the three defect cards below"); each narrowed card shows
  "Filtered: …" with Clear and has its own no-match sentence.
- **Print:** the **Print** button; the header (company, report, period, printed, **Prepared by**,
  filters and sort in words) is hidden on screen. A4 portrait, 12 mm margin; the table header
  repeats, rows don't split, controls and navigation are hidden, the light tokens apply (the dark
  block is `@media not print`). **Remarks** (a textarea that prints as text, or three ruled lines)
  and Prepared by / Checked by lines end the page. **Charts do not print** (`print:hidden`; they came out blank or cut off on A4); the table under each has the same numbers. Rolls prints every matching row (up to 500).

## Corrections to past records (Phase 35B, D-133)

The Floor Manager's, never a rewrite in silence: every one asks **Why are you correcting it?** (a
textarea, at least 5 characters, the message under it) and says in its success toast that the old
and new values are kept in the audit log.

- **A past batch:** under Batches → Queue → **Inspected and void**, a small GET form (**Batch
  date**, **Show this date**, **Last 7 days** to go back) above the list; the card's description
  names the day and, for the Floor Manager, says a past batch can be corrected. Each row carries the
  same **Correct** button and dialog as today's. A corrected batch shows one line, "Corrected by
  <name>, Tue, 17 Nov 10:05: <reason>", under its findings. Operations' production-by-day row shows a
  neutral **Corrected** badge beside the day when a batch of it was corrected on a later day, and a
  muted **See batches** link (hidden in print) to that day's list.
- **A roll's details:** **Edit details** (a secondary button) beside Move and Remove on the roll
  page; a dialog with Tag number, Received on (a date, never after today), Area (sq ft) and, once a
  decision exists, Return note. After Finish roll the area stays in the form but disabled, with the
  reason in muted text under it ("Fixed after Finish roll: …"). Only changed fields are sent.
- **A repair's inspection:** a **Correct** button on the inspected repair's row, opening the
  inspect dialog with the saved numbers and a reason field. When a job it sent back has moved on, the
  button is replaced by the sentence that says which job and why.

## Plan calendar (D-114)

Batches → Plan days, desktop: a month grid, Monday to Sunday (`grid-cols-7`, the one place a fixed
column count is the content itself), each day a card cell (`min-h-24`): the date, a **Today** brand
badge, then the plan in three short lines (rolls, pairs, interval) and, for today and past days,
"3 of 5 rolls scanned". Weekends and past days are muted, not buttons. A weekday from today on is
a button that opens the day dialog (`size="lg"`); **Non-working / Holiday** cells have a dashed
border and `CalendarOff`; today unplanned uses the caution tone with an icon and "Not planned
yet". Below 640 px the grid becomes a list of the month's weekdays. The dialog: Rolls to be used
and Quota side by side, the suggestion box with **Use suggestion**, Check-in interval (two
choices) and the shift, a live batch preview, **Save plan** (primary) and **Mark Non-working /
Holiday** (secondary, left).

## Components

| Component              | Purpose                                                       | Variants                                                                                                                                                                                                                                                                                                                                                                                                             | Required states                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`               | Actions                                                       | primary, secondary, ghost, destructive, link · sm/md/lg/icon                                                                                                                                                                                                                                                                                                                                                         | pressed (`scale .97`), focus ring, disabled + reason, pending (spinner + verb)                                                                                                                                                                               |
| `VerdictBadge`         | Show a scan's verdict                                         | PASS, REJECT                                                                                                                                                                                                                                                                                                                                                                                                         | Always icon + label                                                                                                                                                                                                                                          |
| `ThemeToggle`          | Light/dark switch                                             | —                                                                                                                                                                                                                                                                                                                                                                                                                    | Accessible name; icons swap via CSS (no hydration mismatch)                                                                                                                                                                                                  |
| `Input` / `Label`      | Form fields                                                   | —                                                                                                                                                                                                                                                                                                                                                                                                                    | focus ring, `aria-invalid` red outline, error text below with how to fix, disabled                                                                                                                                                                           |
| `Alert`                | Inline message                                                | info, danger (role=alert), success                                                                                                                                                                                                                                                                                                                                                                                   | icon + text; danger announced to screen readers                                                                                                                                                                                                              |
| `Card`                 | Grouped content                                               | —                                                                                                                                                                                                                                                                                                                                                                                                                    | header (title + description) + content                                                                                                                                                                                                                       |
| `DropdownMenu`         | User menu, row actions                                        | —                                                                                                                                                                                                                                                                                                                                                                                                                    | keyboard navigable, scales from trigger                                                                                                                                                                                                                      |
| Sidebar                | Main navigation                                               | link, active (yellow wash + ink indicator), planned ("Phase N")                                                                                                                                                                                                                                                                                                                                                      | planned items aren't links; screen readers hear "available in Phase N"                                                                                                                                                                                       |
| `Table`                | Dense lists                                                   | `numeric` cells right-aligned                                                                                                                                                                                                                                                                                                                                                                                        | one row height (44px); header row muted; hover wash                                                                                                                                                                                                          |
| `Badge`                | Status labels                                                 | neutral, info, success, warning, danger, brand                                                                                                                                                                                                                                                                                                                                                                       | always icon + label                                                                                                                                                                                                                                          |
| `Select`               | Choices in forms and filters                                  | styled native `<select>`                                                                                                                                                                                                                                                                                                                                                                                             | `aria-invalid`, disabled + hint explaining why                                                                                                                                                                                                               |
| `Dialog`               | Confirm / reason prompts                                      | —                                                                                                                                                                                                                                                                                                                                                                                                                    | title names the item; confirm repeats the verb; Escape/close button; `size="md"` for a confirm or short form, `size="lg"` (672px) for a form with a list or fields side by side; never a sideways scroll, long lines wrap                                    |
| Toast (`sonner`)       | Routine success                                               | —                                                                                                                                                                                                                                                                                                                                                                                                                    | bottom-right, 4s; errors stay inline instead                                                                                                                                                                                                                 |
| Roll list states       | Reports → Rolls (Phase 26)                                    | —                                                                                                                                                                                                                                                                                                                                                                                                                    | first-use empty (who starts rolls), no-match + Clear, skeleton, error + Try again                                                                                                                                                                            |
| `ScanImage`            | Capture with detections                                       | box tone = what the detection does (Not accepted solid red, Usable green, below found-at grey dashed); boxes on the marker card are dropped before they reach it                                                                                                                                                                                                                                                     | label chip per box; hover dims the others; alt text names roll + shot                                                                                                                                                                                        |
| Tables (Phase 2+)      | Lists of rolls, scans, items                                  | —                                                                                                                                                                                                                                                                                                                                                                                                                    | skeleton rows, empty (first-use vs filtered), error + retry, stale label                                                                                                                                                                                     |
| `ScanThumb`            | Small scan image on cards                                     | —                                                                                                                                                                                                                                                                                                                                                                                                                    | fixed size; falls back to an icon + "No image" when the file is missing                                                                                                                                                                                      |
| Roll page              | One roll (Reports → Rolls)                                    | —                                                                                                                                                                                                                                                                                                                                                                                                                    | Scanning passed or Returned to supplier with its Defect % and the limit; shots · passed · rejected; scanning time; shots table with photo, verdict, defects; Remove… (FM, reason required); Claim sheet; no person named                                     |
| `StockBadge`           | Stock level of an item                                        | In stock (success), Low (warning), Out of stock (danger), Deactivated                                                                                                                                                                                                                                                                                                                                                | icon + label; next to the on-hand quantity                                                                                                                                                                                                                   |
| `LowStockCard`         | FM home, Today so far                                         | —                                                                                                                                                                                                                                                                                                                                                                                                                    | count + up to 5 items (on hand · reorder at), "N more" link, empty "Nothing to reorder"                                                                                                                                                                      |
| Update stock sheet     | Added (+) / Used (−) / Correction                             | one row per item, the unit as an input suffix, After shows the result live; the Reason opens only with a correction                                                                                                                                                                                                                                                                                                  | errors under their field, a summary at 3 or more; one save for every filled row ("Save update (N items)"), toast "Stock updated: N items."                                                                                                                   |
| Capture page           | Capture a roll shot by shot (Phases 26, 30E, D-120, D-121)    | Start a roll: Leather, then Roll on the table, Start scanning; Roll dropdown + chosen roll in large text; the marker card on the first shot ("Scale set at the first shot", Read the card again); live video, Capture (primary, fixed at the bottom on a phone, Space too); scanning timer; Finish roll / Put roll back (empty only); Last scan with each defect Usable / Not accepted; roll counts against the plan | no camera access (who grants it), starting, secure address needed, permission refused, no camera, busy, model missing, no roll chosen, card not found or unreadable, roll closed meanwhile, open since an earlier day, checking, failed + Send again, repeat |
| Storage locations      | Inventory → Storage locations (Phase 32, D-128)               | table (tick, Code, Name, Kind, Rolls in it, Status) + Add/Edit dialog; Deactivate with undo toast; Print labels for the ticked ones                                                                                                                                                                                                                                                                                  | first-use empty (Add the first location); a locked code is read-only with the reason (A-79); Deactivate disabled with "Move its rolls first." while it holds rolls                                                                                           |
| Label sheet            | Roll and location labels (Phase 32, A-54)                     | an A4 sheet of 3 × 7 stickers, 70 × 42.3 mm, sized in `globals.css` (`.label-sheet`): QR (30 mm) left, the code in large monospace right, then the lines (roll: leather, supplier, area and arrival, tag; location: name, kind)                                                                                                                                                                                      | same size on screen (dashed outlines) and on paper; the app shell and header hide in print; Print at actual size; empty state names how to choose what to print                                                                                              |
| Move rolls             | Place or move rolls (Phase 32, the Floor Manager)             | one roll ("Move LR-MLT-004", Now: …) or several (tick list in the dialog); Move to (active locations, the current one disabled); Note (optional)                                                                                                                                                                                                                                                                     | errors under the list and the select; "Move 3 rolls"; toast names where; disabled with "Add a storage location first." when there are none                                                                                                                   |
| Scan label             | Read a roll or location QR (Phase 32, A-80)                   | `QrScanner`: BarcodeDetector where it exists, `jsqr` otherwise; stops the camera when a code is read or the sheet closes                                                                                                                                                                                                                                                                                             | starting, looking, insecure address, permission refused, no camera, busy (Capture's messages) + Try again                                                                                                                                                    |
| `ShownOnceSecret`      | Device token / temp password                                  | —                                                                                                                                                                                                                                                                                                                                                                                                                    | "You won't see it again" + Copy (falls back to "copy by hand"); monospace                                                                                                                                                                                    |
| Reference list manager | Settings lists (`ReferenceManager`)                           | table + Add/Edit dialog; Deactivate/Reactivate with undo toast                                                                                                                                                                                                                                                                                                                                                       | locked fields read-only with the reason; inactive rows muted; empty text per list                                                                                                                                                                            |
| Thresholds form        | "A defect counts as found at" and the return limit            | two percent inputs                                                                                                                                                                                                                                                                                                                                                                                                   | live Reject/Pass explanation (icon + label); "Mark a roll Returned to supplier when defects cover more than __%"; save disabled until changed                                                                                                                |
| Audit list             | Read-only trail                                               | `<details>` rows (no JS)                                                                                                                                                                                                                                                                                                                                                                                             | who · action · record; expands to a before/after field table, record link, "its full history"                                                                                                                                                                |
| `VerdictTrendChart`    | Rolls scanned per day (Scanning passed, Returned to supplier) | Recharts stacked columns, fixed series order                                                                                                                                                                                                                                                                                                                                                                         | legend (swatch + icon + label), ≤24px bars, 2px gaps, tooltip, caption; the daily table is its table view                                                                                                                                                    |
| `BarList`              | Ranked/ordered magnitudes                                     | one hue; `muted`; `highlight` tag (e.g. Bottleneck)                                                                                                                                                                                                                                                                                                                                                                  | value at the bar tip; label links; `title`/sr-only detail; never colour-only emphasis                                                                                                                                                                        |
| Report home cards      | FM overview                                                   | Rolls today (rolls scanned, returned to supplier, open), daily summary by rolls                                                                                                                                                                                                                                                                                                                                      | empty text when nothing scanned; link to Reports                                                                                                                                                                                                             |

## Patterns

- **Forms:** labels above fields, `(optional)` marks the minority, validate on blur and then live
  once a field has errored, errors next to the field saying how to fix it, focus moves to the first
  error on submit, and the submit button names the outcome ("Start roll").
- **Confirm vs undo:** irreversible actions (revoke token, deactivate user, cancel a roll) use a confirmation that names the item and the consequence, and the confirm
  button repeats the verb. Reversible actions use an undo toast (6s).
- **Empty states:** say why it's empty, plus one button for the next step.
- **Error copy:** what happened, whether data is safe, what to do next. Never "Something went wrong" on its own.
- **Time:** stored in UTC, shown in `Asia/Manila` (`en-PH`, e.g. "Oct 2, 2026, 9:08 PM").

## Motion

- Press feedback 120ms, hovers 150ms, popovers/dialogs ≤ 220ms. Use `ease-out` for enter/exit and
  `ease-in-out` for on-screen movement. Never use `ease-in`.
- Don't animate high-frequency actions: table navigation, filters, the Latest scans refresh.
- Animate only `transform` and `opacity`. Never use `transition: all`.
- `prefers-reduced-motion`: movement is effectively removed globally; color and opacity changes stay.

## Don't

- Don't use brand red in UI chrome, or yellow as text on light surfaces (it fails contrast).
- Don't use color alone to show meaning.
- Don't show per-person rankings, leaderboards or individual scores (client request, D-008).
- Don't use gradients, glassmorphism, pure black (`#000`) or pure grey neutrals.
- Don't use raw color, spacing or radius values in components. Add a token first.
- Don't use a centered spinner for page content. Use skeletons that match the final layout. A
  skeleton root has `role="status"` and an `aria-label` ("Loading batches").
- Don't fade text with `opacity` to mean "old" or "superseded": it fails contrast. Strike it
  through, or use `grayscale`, and say it in words for screen readers.
- Don't render an unbounded list. A table pages at 15 rows with `TablePager` ("Showing 16–30 of
  42 batches", D-047); a board caps and says how many are hidden ("N more finished this week").
  Offer a filter or a Find box so a known row is found, not browsed for.
- Don't let the page scroll sideways at any width. At 1280 px a table fits without scrolling (drop
  a column that's on the detail page first); narrower, it scrolls inside its card.
