# Phase 30F-1 plan — The foundation

Brief: `docs/prompts/premium-ui.md`, part 30F-1. Baseline: `qa/reports/2026-11-06-phase-30f-baseline.md`
(150 screenshots on main 120205b). Status: **waiting for Dylan's go**.

## 1. Intent (ui-craft step 1)

- **Who:** the FM and QI at a desk all shift, the Admin now and then, constructors on a phone.
- **Job of this part:** make the shared layer (tokens, `ui/`, shell, page header, states, sign-in)
  look finished, so 30F-2 and 30F-3 mostly apply it.
- **Worst case:** a polish change breaks a test (a changed role, name or word) or hides meaning
  (contrast, colour-only). So: words and roles stay, contrast is re-measured.

## 2. Audit of the baseline (most-seen first)

Read from the screenshots at 1280 px in light and dark, then the code.

| #   | What reads as unfinished                                                                                                                                                                                                                           | Where                                                                               | Part                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| 1   | **Three lines stacked** under each page title: the header's `border-b`, then the tabs' line, then the card border. It looks busy and boxed in                                                                                                      | `page-header.tsx` on 19 pages; Reports tabs                                         | 30F-1                            |
| 2   | **Page headers differ:** Reports puts CSV buttons under the description; the roll and item pages build their own header with a back link and an action at the right; login, 403 and password have none                                             | `reports/page.tsx`, `rolls/[id]`, `inventory/[id]`, `forbidden`, `account/password` | 30F-1 (component), 30F-2 (pages) |
| 3   | **Card header links** ("Open →", "Edit →", "Rolls →", "Inventory →") are bold black text at the same weight as the title, so they compete with it; some cards put their links at the bottom instead (Daily summary, Admin cards)                   | FM and Admin homes, Reports cards                                                   | 30F-1 (pattern), 30F-2           |
| 4   | **Key figures have no shared look:** Operations tiles are cramped, with three muted lines under each number ("No earlier data / vs previous 14 days / …") and uneven heights; Rolls today uses plain numbers; the Audit log card uses a third size | Operations, FM home, Admin home                                                     | 30F-1 (`KpiTile`), 30F-2         |
| 5   | **Tables scroll sideways at 1280 px**, against DESIGN.md: Reports → Rolls (Rejected cut off) and Operations → Production (Constructors present cut off). Production rows are uneven in height                                                      | `reports/rolls/page.tsx`, `ops-sections.tsx`                                        | 30F-2                            |
| 6   | **Card surfaces feel flat:** border plus `shadow-1` on a background only a little lighter or darker than the card; in dark mode the cards nearly merge with the page                                                                               | `tokens.css`                                                                        | 30F-1                            |
| 7   | **Type scale is close together:** card title, KPI label and body all read alike; the 32 px page title is the only clear step                                                                                                                       | `tokens.css`, `card.tsx`                                                            | 30F-1                            |
| 8   | **Empty states differ:** Reports → Rolls with no match is a short line in a table; others are a card with text, or nothing                                                                                                                         | `rolls`, `inventory`, `users`, …                                                    | 30F-1 (component), 30F-2         |
| 9   | **Sign-in looks plain:** the card, the demo panel (dashed) and the reset button float on the background with no rhythm                                                                                                                             | `(auth)/login/page.tsx`                                                             | 30F-1                            |
| 10  | Capture on a phone: the hint "Choose the roll this shot belongs to" appears three times (dropdown, line below, under the button)                                                                                                                   | `capture-client.tsx`                                                                | 30F-3 (copy, opt-in)             |

Not faults: the "N" button is the Next.js dev indicator (dev only). The sidebar ends mid-page only
in full-page screenshots; it is `sticky h-screen` on screen.

## 3. Token changes (`src/styles/tokens.css`, `globals.css`)

Direction, not final numbers. The exact values come in the build, each colour pair measured in
both themes and recorded in SESSION_LOG and D-122. DESIGN.md's AA ratios are the floor.

| Token                                 | Change                                                                                                                                   | Why (audit #) |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `--background` (light, dark)          | A touch further from `--card` (light: warmer off-white; dark: a step darker)                                                             | 6             |
| `--shadow-1`, `--shadow-2`            | Two-layer shadows: a 1 px contact shadow plus a soft, wide, low-opacity one; dark mode leans on a lighter top border instead of a shadow | 6             |
| `--border`                            | Slightly softer for dividers; `--input` unchanged (≥ 3:1 stays)                                                                          | 1, 6          |
| New `--text-kpi`                      | 28 px / 32 px line, 600, tabular, `-0.02em`                                                                                              | 4, 7          |
| Heading tracking                      | Page title `-0.02em`, section `-0.01em`; card title 16 px 600 stays                                                                      | 7             |
| New `--space-page`, `--space-section` | 32 px page padding and section gap at `lg`, 24 px below; card padding 20 px everywhere                                                   | 1, 2          |
| `--ring`                              | Kept; focus ring offset made the same on every control                                                                                   | —             |

Radius 6/4 px, Figtree, the colour meanings, the chart tokens and the motion tokens stay (A-P2).

## 4. Components

**Changed (`src/components/ui/`):** `card.tsx` (padding, title size, a `CardAction` slot at the
top right), `button.tsx` (one focus ring, pressed and pending states checked), `badge.tsx`,
`alert.tsx`, `table.tsx` (36 px rows, a muted second line style for cells like "Tag E2E-…",
header weight), `dialog.tsx` and `dropdown-menu.tsx` (`shadow-2`, enter motion within 220 ms),
`input.tsx`, `select.tsx`, `textarea.tsx`, `toaster.tsx`. Same props, so no page needs to change
in this part.

**Added (shadcn, copied in, A-P3):**

- `skeleton.tsx`, for the shared loading states.
- `separator.tsx`, for the lines that stay.
- Not Tabs: the Reports and Settings tabs are links with `aria-current`, and the tests use them as
  links. Radix Tabs would change their role, so they get restyled and stay links.

**New shared pieces (`src/components/features/`):**

- `PageHeader`, extended: optional `back` link, `meta` line ("as of …"), actions at the right, and
  **no bottom border**. Spacing does the separating (audit 1, 2).
- `KpiTile`: label, figure (`--text-kpi`), one line of context, optional trend; one height per row
  (audit 4). Used by the pages in 30F-2.
- `EmptyState`, `ErrorState` (with Try again), `StaleLabel` and a `SkeletonRows`/`SkeletonCard`
  pair, all from one style (audit 8). Existing wording passes in as props, unchanged.
- Card header links become `variant="ghost" size="sm"` links with the arrow: the same link and the
  same words, but quieter (audit 3).

**Shell:** the sidebar (active item, hover, user block, bell alignment), the phone top bar and the
Demo mode band (a quieter, thinner band with the same words).

**First impressions:** sign-in (one column with a clear rhythm: logo, title, card, the demo panel
as a quiet secondary card, Reset demo data kept apart as destructive), 403, 404 and the password
page get `PageHeader`.

## 5. Pages touched in 30F-1

Only through shared components, plus sign-in, 403, 404 and password. Every page changes slightly
because `PageHeader`, `Card` and the tokens change. That's on purpose: 30F-2 then fixes each page's
own layout.

## 6. E2E risk (A-P1)

- No visible word, heading level, label, `aria-*` or role changes. The header links stay `<a>`
  with the same name. The tabs stay links. Dialogs keep their titles.
- `smoke.spec.ts` runs axe on every page in both themes: contrast is the main risk. Each changed
  pair is measured before it ships.
- `theme.spec.ts` reads `data-theme`, which is unchanged.
- Tests that wait for a toast fading in (axe) are unaffected, because the motion durations stay.

## 7. Files

- **Change:** `src/styles/tokens.css`, `src/app/globals.css`, the 15 files in `src/components/ui/`,
  `src/components/features/page-header.tsx`, `app-shell/sidebar.tsx`, `demo-band.tsx`,
  `table-pager.tsx`, `verdict-badge.tsx`, `(auth)/login/page.tsx` (and its client parts),
  `(app)/forbidden/page.tsx`, the not-found page, `(account)/account/password/page.tsx`.
- **Add:** `src/components/ui/skeleton.tsx`, `separator.tsx`,
  `src/components/features/kpi-tile.tsx`, `features/states.tsx` (empty, error, stale, skeletons).
- **Tests:** unit tests for the new pieces where they have logic (e.g. `StaleLabel`'s wording,
  `KpiTile`'s trend sign). No e2e test changes.
- **Docs:** DESIGN.md (Character, Tokens, Components, a new "Look" section), `docs/UI_AUDIT.md`
  ("Phase 30F" section), D-122, STATUS, SESSION_LOG, ROADMAP, the QA handoff and Codex prompt, the
  vault.

## 8. Questions (recommendation first)

1. **Tables wider than 1280 px (audit 5), in 30F-2:** (a) tighten padding and let the second line
   wrap first, and drop a column only if it still doesn't fit and the column is on the detail page
   (DESIGN.md already allows that); or (b) never drop a column, and let those two tables scroll
   inside their card. **Recommend (a).**
2. **The header line (audit 1):** remove the border under every page title and let spacing
   separate. **Recommend yes.**
3. **Capture's repeated hint (audit 10):** a copy change, so opt-in. Decide in 30F-3. **Recommend
   showing it once.**
