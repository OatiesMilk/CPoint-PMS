# Design

Source of truth for how CPoint PMS looks and behaves. Tokens live in `src/styles/tokens.css` and
are mapped to Tailwind utilities in `src/app/globals.css`. **Components use tokens only:** no raw
hex, oklch, or arbitrary pixel values. This file overrides the defaults in `.claude/skills/ui-craft`.

## Intent

- **Who:** Floor Manager and Quality Inspector, at a desktop in the factory office, all shift long.
  The System Admin is occasional. Shoe Constructors use the system only at the camera, once allowed
  (D-075); material requests and procurement were removed in Phase 24 (D-091).
- **Core job:** see what the line and the camera are doing right now, and act on exceptions:
  rejected sections, short days, low stock.
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
  short muted lines; tiles in a row share one height.
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

For the pages used on a phone by the line: Capture (the Shoe Constructor) and Batches (the Quality
Inspector, Phase 27). Every other page stays desktop first.

- **Shell:** below 640px (`sm`) the sidebar is replaced by a top bar (`h-14`): the logo, the page's
  name, a page menu (`Menu`, "Pages") only when the role has more than one page, then the account
  menu (Change password, Sign out) and the theme switch. A Shoe Constructor has one page, Capture,
  so no page menu.
- **Touch:** every control a thumb uses is at least 44px tall (`h-11`, `size="lg"`); the one
  primary action of a phone page is fixed at the bottom of the screen above the safe area
  (`pb-[max(0.75rem,env(safe-area-inset-bottom))]`) and the page leaves room for it (`pb-28`).
  From `sm` up it goes back into the page (`sm:static`).
- **Reading at arm's length:** what the action applies to repeats in large text (`text-xl`
  semibold), e.g. "Roll R-2026-0012 · Marikina Leather Trading · 6 shots", right above the action.
- **Forms:** one column, labels above, `h-11` inputs, native `<select>` (the phone's own picker).
- **Never** a sideways scroll at 390px; long words wrap, tables stay off phone pages.
- **Batches (Phase 27):** one card per batch ("Batch 2 10:00–13:00", the lunch line, a status badge
  with icon and word); the batch that can be finished now is the page's bottom action, with
  "Batch 2 · 10:00–13:00" in `text-xl` above **Finish batch 2**. The Finish batch dialog opens as a
  bottom sheet (`max-sm:bottom-0`, no bottom radius, safe-area padding) with `h-12` numeric fields
  (`inputMode="numeric"`) and the buttons stacked `h-11`. On desktop each card's action column is one width, so
  every Finish batch and Correct button is the same size and lines up; the quota card's top lines up
  with the first batch card. The dialog is `size="lg"`: the two counts side by side, the rolls
  below in a bordered list: each roll shows only its code (it names the supplier) with the
  area at the right, and the item under it, cut short if long. The QI sees no tables there (today only);
  the Floor Manager's Recent days table is desktop.

## Batch notices (D-098)

For whoever finishes today's batches (the QI, or the Floor Manager covering, D-088), on every page:

- **Banner** at the top of the main column (`role="status"`, polite): the most urgent notice only.
  At 10 minutes before a batch's end, muted (`bg-muted/60`, `Hourglass`): "Batch 2 ends at 13:00.
  Get ready to count the finished pairs." At the end, info (`border-info bg-info-soft`,
  `BellRing`): "Batch 2 is due. Finish it now." with **Finish batch 2** (`size="lg"`, `h-11`).
  **Not now** hides that notice until the next one; it stays in the bell.
- **Bell** beside the logo (sidebar on a desk, the phone top bar on a phone, `size-11` there): a
  dropdown of the due batches, each linking to Finish batch; its accessible name counts them
  ("Batch notices: 2 batches due"). Hidden for anyone who can't finish.
- **Tab title** starts with "(n)" while n batches are due.
- No sound, push or browser notification; nothing animates beyond the standard fade.

**Plan today (D-114, A-37)**, for the Floor Manager on a weekday with no plan, from 00:00 until the
day is planned or marked Non-working / Holiday: the same info banner (`border-info bg-info-soft`,
`BellRing`) "Today has no plan yet, so there are no batches. Plan today." with **Plan today**
(`size="lg"`, `h-11`), a **Plan today** card first on the FM home, and a bell item. The Quality
Inspector reads "No batches yet today. The Floor Manager plans them first." on Batches.

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

| Component              | Purpose                                | Variants                                                                                                                                                                                                                         | Required states                                                                                                                                                                                                                |
| ---------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`               | Actions                                | primary, secondary, ghost, destructive, link · sm/md/lg/icon                                                                                                                                                                     | pressed (`scale .97`), focus ring, disabled + reason, pending (spinner + verb)                                                                                                                                                 |
| `VerdictBadge`         | Show a scan's verdict                  | PASS, REJECT                                                                                                                                                                                                                     | Always icon + label                                                                                                                                                                                                            |
| `ThemeToggle`          | Light/dark switch                      | —                                                                                                                                                                                                                                | Accessible name; icons swap via CSS (no hydration mismatch)                                                                                                                                                                    |
| `Input` / `Label`      | Form fields                            | —                                                                                                                                                                                                                                | focus ring, `aria-invalid` red outline, error text below with how to fix, disabled                                                                                                                                             |
| `Alert`                | Inline message                         | info, danger (role=alert), success                                                                                                                                                                                               | icon + text; danger announced to screen readers                                                                                                                                                                                |
| `Card`                 | Grouped content                        | —                                                                                                                                                                                                                                | header (title + description) + content                                                                                                                                                                                         |
| `DropdownMenu`         | User menu, row actions                 | —                                                                                                                                                                                                                                | keyboard navigable, scales from trigger                                                                                                                                                                                        |
| Sidebar                | Main navigation                        | link, active (yellow wash + ink indicator), planned ("Phase N")                                                                                                                                                                  | planned items aren't links; screen readers hear "available in Phase N"                                                                                                                                                         |
| `Table`                | Dense lists                            | `numeric` cells right-aligned                                                                                                                                                                                                    | one row height (44px); header row muted; hover wash                                                                                                                                                                            |
| `Badge`                | Status labels                          | neutral, info, success, warning, danger, brand                                                                                                                                                                                   | always icon + label                                                                                                                                                                                                            |
| `Select`               | Choices in forms and filters           | styled native `<select>`                                                                                                                                                                                                         | `aria-invalid`, disabled + hint explaining why                                                                                                                                                                                 |
| `Dialog`               | Confirm / reason prompts               | —                                                                                                                                                                                                                                | title names the item; confirm repeats the verb; Escape/close button; `size="md"` for a confirm or short form, `size="lg"` (672px) for a form with a list or fields side by side; never a sideways scroll, long lines wrap      |
| Toast (`sonner`)       | Routine success                        | —                                                                                                                                                                                                                                | bottom-right, 4s; errors stay inline instead                                                                                                                                                                                   |
| Roll list states       | Reports → Rolls (Phase 26)             | —                                                                                                                                                                                                                                | first-use empty (who starts rolls), no-match + Clear, skeleton, error + Try again                                                                                                                                              |
| `ScanImage`            | Capture with detections                | box tone = what the detection does (Not accepted solid red, Usable green, unknown dashed red, below found-at muted)                                                                                                              | label chip per box; hover dims the others; alt text names roll + shot                                                                                                                                                          |
| `LatestScansWidget`    | Live camera feed                       | —                                                                                                                                                                                                                                | skeleton, empty (link to Camera), "Updated Ns ago", error keeps stale data in grayscale; no animation on refresh                                                                                                               |
| Tables (Phase 2+)      | Lists of rolls, scans, items           | —                                                                                                                                                                                                                                | skeleton rows, empty (first-use vs filtered), error + retry, stale label                                                                                                                                                       |
| Latest scans (Phase 3) | Live CV feed                           | —                                                                                                                                                                                                                                | "Updated Ns ago", paused/offline label                                                                                                                                                                                         |
| `ScanThumb`            | Small scan image on cards              | —                                                                                                                                                                                                                                | fixed size; falls back to an icon + "No image" when the file is missing                                                                                                                                                        |
| Roll page              | One roll (Reports → Rolls)             | —                                                                                                                                                                                                                                | shots · passed · rejected (for salvage) in the header; shots table with photo, verdict, defects; Cancel roll… (FM, open only, reason required); Claim sheet; no person named                                                   |
| `StockBadge`           | Stock level of an item                 | In stock (success), Low (warning), Out of stock (danger), Deactivated                                                                                                                                                            | icon + label; next to the on-hand quantity                                                                                                                                                                                     |
| `LowStockCard`         | FM home alert                          | —                                                                                                                                                                                                                                | count + up to 5 items (on hand · reorder at), "N more" link, empty "Nothing to reorder"                                                                                                                                        |
| Update stock sheet     | Added (+) / Used (−) / Correction      | one row per item, the unit as an input suffix, After shows the result live; the Reason opens only with a correction                                                                                                              | errors under their field, a summary at 3 or more; one save for every filled row ("Save update (N items)"), toast "Stock updated: N items."                                                                                     |
| Capture page           | Capture a roll shot by shot (Phase 26) | Start a roll form; Roll dropdown + chosen roll in large text; live video, Capture (primary, fixed at the bottom on a phone, Space too); Finish roll / Cancel roll (empty only); Last scan with each defect Usable / Not accepted | no camera access (who grants it), starting, secure address needed, permission refused, no camera, busy, model missing, no roll chosen, roll closed meanwhile, open since an earlier day, checking, failed + Send again, repeat |
| `ShownOnceSecret`      | Device token / temp password           | —                                                                                                                                                                                                                                | "You won't see it again" + Copy (falls back to "copy by hand"); monospace                                                                                                                                                      |
| Reference list manager | Settings lists (`ReferenceManager`)    | table + Add/Edit dialog; Deactivate/Reactivate with undo toast                                                                                                                                                                   | locked fields read-only with the reason; inactive rows muted; empty text per list                                                                                                                                              |
| Thresholds form        | "A defect counts as found at"          | one percent input                                                                                                                                                                                                                | live Reject/Pass explanation (icon + label); save disabled until changed                                                                                                                                                       |
| Audit list             | Read-only trail                        | `<details>` rows (no JS)                                                                                                                                                                                                         | who · action · record; expands to a before/after field table, record link, "its full history"                                                                                                                                  |
| `VerdictTrendChart`    | Scans per day by verdict               | Recharts stacked columns, fixed series order                                                                                                                                                                                     | legend (swatch + icon + label), ≤24px bars, 2px gaps, tooltip, caption; the daily table is its table view                                                                                                                      |
| `BarList`              | Ranked/ordered magnitudes              | one hue; `muted`; `highlight` tag (e.g. Bottleneck)                                                                                                                                                                              | value at the bar tip; label links; `title`/sr-only detail; never colour-only emphasis                                                                                                                                          |
| `SplitBar`             | Today's verdict split                  | 100% bar                                                                                                                                                                                                                         | 2px gaps; counts + % listed beside it                                                                                                                                                                                          |
| Report home cards      | FM/QI overviews                        | split, daily summary, defects today, AI agreement                                                                                                                                                                                | empty text when nothing scanned; link to Reports                                                                                                                                                                               |

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
