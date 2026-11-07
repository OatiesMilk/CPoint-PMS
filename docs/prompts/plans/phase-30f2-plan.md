# Phase 30F-2 plan — The desktop pages

Brief: `docs/prompts/premium-ui.md`, part 30F-2. Foundation: 30F-1 (D-122, merged #42). Audit from
the baseline screenshots (`qa/reports/2026-11-06-phase-30f-baseline.md`, 1280 px light and dark)
and the code on main da3d792. Status: **approved** (Dylan's go, 2026-11-07, both recommendations).

## 1. Intent

- **Who:** the FM at a desk all shift (homes, Reports, Inventory, Attendance, Plan days), the
  Admin now and then (Overview, Users, Settings, API tokens, Audit log).
- **Job of this part:** apply 30F-1's pieces (`PageHeader`, `CardLink`, `KpiTile`, the shared
  states, the tokens) page by page, so every desktop page has the same header, the same key-figure
  look and no sideways scroll at 1280 px.
- **Worst case:** a moved button or a reworded line breaks an e2e test or confuses the FM. So:
  same words, same names and roles, same order of sections; only placement inside a header or card
  and the styling change.

## 2. Audit (most-seen first)

| #   | What reads as unfinished                                                                                                                                                                                                                                                                                                             | Where                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Key figures in five sizes**: Operations and Quality tiles use a 30 px `CardTitle` with three stacked muted lines and uneven heights; Rolls today, Materials at risk, Checkpoint before cutting and Today's production use 24 px; the Admin's Audit log 30 px                                                                       | `ops-parts.tsx`, `quality-view.tsx`, `operations-view.tsx`, `ops-sections.tsx`, `production-parts.tsx`, `home-cards.tsx`, `admin/page.tsx` |
| 2   | **Header actions in three places**: Reports puts its CSV buttons under the description; Inventory puts Update stock and Add item there too; Users and API tokens put them at the right. The item and roll pages build their own header (badge beside the title, On hand at the far right, Edit and Deactivate on a loose line below) | `reports/page.tsx`, `inventory/page.tsx`, `inventory/[id]/page.tsx`, `reports/rolls/[id]/page.tsx`                                         |
| 3   | **Tables wider than 1280 px**: Reports → Rolls (Rejected cut off), Operations → Production (Constructors present cut off, rows of uneven height), Materials → Used per material (the "May run out…" badge cut off), Settings → Defect types (Order cut off)                                                                          | those four tables                                                                                                                          |
| 4   | **Card links at the bottom** on some cards ("Reports →" on Daily summary; "Manage users →", "Lunch break →", "Open the audit log →", "Camera API tokens →" on the Admin home), in the header on others                                                                                                                               | `home-cards.tsx`, `admin/page.tsx`                                                                                                         |
| 5   | **The roll's page and the scan's page are bare sections** (an `h2` and text on the page background) while the item page uses cards; the facts read as loose text                                                                                                                                                                     | `reports/rolls/[id]/page.tsx`, `scans/[id]/page.tsx`                                                                                       |
| 6   | **FM home rows are uneven**: Rolls today has a large empty area under three figures; Attendance is a short card beside a tall one                                                                                                                                                                                                    | `floor-manager/page.tsx`, `home-cards.tsx`                                                                                                 |
| 7   | **Materials' warning lists every material** (50 names in one orange block above the table) and pushes the report below the fold                                                                                                                                                                                                      | `reports/materials`                                                                                                                        |
| 8   | **Plan days**: past cells pack four lines of 12 px text; Today is a bright yellow chip; planned, not planned and weekend cells differ only slightly                                                                                                                                                                                  | `batches/plan` calendar                                                                                                                    |
| 9   | **API tokens**: a red outlined Revoke… button on every row is the loudest thing on the page                                                                                                                                                                                                                                          | `admin/tokens`                                                                                                                             |
| 10  | **Empty results** (a filter with no match) are a short line in the table on Rolls, Inventory, Users and Audit log                                                                                                                                                                                                                    | those lists                                                                                                                                |
| 11  | Charts: heavy gridlines and axis text at full strength; the tooltip differs from the cards                                                                                                                                                                                                                                           | `components/features/charts/**`                                                                                                            |

## 3. Changes per page

Words, labels, `data-testid`s, link and button names stay. "Moves" below means within the same
page, into the header or card the item already belongs to.

- **Shared:** every key figure becomes a `KpiTile` (label, `text-kpi` figure, the existing context
  lines joined into one or two lines with the same words). One row of tiles uses an auto-fit grid
  of equal heights. Inline figures inside a card (Rolls today, Materials at risk, Checkpoint) use a
  small `Stat` (label, `text-kpi` figure, one muted line), added to `kpi-tile.tsx`.
- **FM home:** card links use `CardLink` in the header everywhere; Daily summary keeps its two
  links in a footer row of `CardLink`s ("Reports", "Download 14-day CSV"). Rolls today's three
  figures as `Stat`s in a two-column grid so the card's height matches its row; the row aligns its
  cards to the top instead of stretching empty space.
- **Admin home:** the Users, Lunch break and Audit log links become `CardLink`s in each card's
  header; the Audit log keeps "Camera API tokens" as a footer `CardLink`. The 1,079 figure as a
  `Stat`.
- **Reports (all tabs):** the CSV buttons move to the `PageHeader` actions at the right. Period
  picker and "as of" line stay where they are.
  - **Operations:** KPI row as `KpiTile`s; What needs attention rows with one alignment (badge,
    text, Open); Production table tightened (below); Supplier quality and Rolls with the most
    defects keep their columns.
  - **Quality:** tiles as `KpiTile`s; Top defects bars use the chart tokens.
  - **Materials:** see question 1 for the warning. Used per material tightened so the status badge
    fits.
  - **Rolls:** tightened (below); the average scanning-time line and Download CSV on one row.
- **A roll's page:** `PageHeader` with the back link, the status badge as `titleAddon`, Claim
  sheet in actions, the "2 shots · 1 passed · 1 rejected" line as the description. Facts in a
  card (`dl` grid, label muted above value); "How damaged is this roll?" and Shots as cards.
- **A scan's page:** the same pattern (back link, verdict badge, facts card, the photo card).
- **Inventory list:** Update stock and Add item move to the header actions.
- **An item's page:** `PageHeader` with the back link, the stock badge, the item line as the
  description, and Edit and Deactivate in the actions; On hand as a `Stat` in the header's right
  column, so nothing floats on its own line. Rolls and Stock history cards unchanged apart from the
  table spacing.
- **New, Edit and Update stock:** `PageHeader` with back link; the form card at one width (the
  existing `max-w`); the sheet's sticky Save bar with `shadow-2`.
- **Attendance:** header actions for Mark everyone present and Save; the day picker in the
  header's meta line.
- **Plan days:** calendar cells with the day number at the top left, two compact lines (plan,
  then "2 of 3 rolls scanned · 1 returned"), equal heights; Today as a `ring` in the primary
  colour with the same "Today" label as a small badge; weekends and past days in `muted`; hover
  and focus on plannable days only.
- **Users, Settings, Audit log:** filters on one baseline; Settings tabs as in Reports; Defect
  types tightened (below). Audit log's expanded row in a muted inset.
- **API tokens:** Revoke… as a quiet destructive button (`ghost`, destructive text), same name.
- **Empty results:** `EmptyState` inside the table card with the same sentence it shows today.
- **Charts (dataviz skill):** gridlines at `border`, axis text `muted-foreground` 12 px, bars with
  a 2 px top radius, one shared tooltip on `popover` with `shadow-2`. Chart tokens and their CVD
  order stay.

### Tables at 1280 px (answer 1 of the 30F-1 plan: tighten first)

1. Cell padding from 12 to 10 px at the sides, numeric headers right-aligned and short.
2. The second line under a code (item, tag) wraps and is truncated with a tooltip at one line.
3. **Reports → Rolls:** if it still doesn't fit, the item line under the roll code goes (it is on
   the roll's page as Leather item). The Tag line stays (the FM searches by it).
4. **Operations → Production:** the Constructors present column stays; rows get one height (the
   tall rows come from a wrapping cell, which gets `whitespace-nowrap`).
5. **Materials:** the status badge shortens to its icon plus text without wrapping, the item's
   third line ("Rolls that left stock: …") stays.
6. **Defect types:** Description truncates at one line with a tooltip.

Each is checked at 1280 and 1440 px, light and dark, for no sideways scroll.

## 4. E2E risk

- No visible word, heading level, label, role or `data-testid` changes. Buttons and links keep
  their names; moving one into a header doesn't change its role.
- The roll list's item line (if dropped) is checked against `rolls.spec.ts` and `supplier-quality`
  before it goes; a test reading it keeps it.
- `smoke.spec.ts` runs axe on every page: the new muted calendar cells and quiet Revoke text are
  measured (DESIGN.md ratios) before they ship.
- The materials disclosure (question 1, if yes) is a new button: no test reads the warning's full
  text today (to be checked).

## 5. Files

- **Change:** `src/components/features/kpi-tile.tsx` (`Stat`), `features/reports/home-cards.tsx`,
  `features/production/production-parts.tsx`, `features/charts/**`, `(app)/floor-manager/page.tsx`,
  `(app)/admin/page.tsx`, `(app)/admin/{users,settings,tokens,audit}/**`, `(app)/reports/page.tsx`
  and `_components/*`, `(app)/reports/{rolls,materials}/**`, `(app)/inventory/**`,
  `(app)/attendance/**`, `(app)/batches/plan/**`, `(app)/scans/[id]/page.tsx`.
- **No change:** routes, services, models, API, tests, migrations, dependencies.
- **Docs:** DESIGN.md "Look" (the `Stat`, tables at 1280), `docs/UI_AUDIT.md`, STATUS,
  SESSION_LOG, ROADMAP, the handoff and Codex prompt (with after screenshots of every page in the
  baseline list), the vault.

## 6. Questions (recommendation first)

1. **Materials' warning (audit 7):** (a) keep the sentence and show the first five names, with a
   "Show all 50" button that opens the rest in place (one new button; every name still there); or
   (b) leave the full list as it is. **Recommend (a).**
2. **The roll's and scan's pages in cards (audit 5):** same content, inside cards like the item
   page. **Recommend yes.**
