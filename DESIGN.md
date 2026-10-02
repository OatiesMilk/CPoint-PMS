# Design

Source of truth for how CPoint PMS looks and behaves. Tokens live in `src/styles/tokens.css` and
are mapped to Tailwind utilities in `src/app/globals.css`. **Components use tokens only:** no raw
hex, oklch, or arbitrary pixel values. This file overrides the defaults in `.claude/skills/ui-craft`.

## Intent

- **Who:** Floor Manager and Quality Inspector, at a desktop in the factory office, all shift long.
  The System Admin is occasional. The Shoe Constructor is a placeholder for now.
- **Core job:** see what the line and the camera are doing right now, and act on exceptions:
  overrides, rework, low stock.
- **Worst case:** a wrong verdict goes unnoticed (good leather discarded, or bad leather cut), or
  the UI shows data as current when it's stale. Verdicts are always labelled, overrides need a
  reason, and every list shows when it was last updated.
- **Density:** compact. These are expert users who come back often. Body text is 14px, tables 13px.
- **Tone:** plain, factual English. Say what happened and what to do next. No exclamation marks.

## Character

| Axis      | Decision                                                                                                                                                                                            | Why                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Type      | **Figtree** (self-hosted via `@fontsource-variable/figtree`), weights 400/500/600. Tabular numbers on by default. `ui-monospace` for codes (batch, roll, token).                                    | Kept from the legacy system; friendly but clear. Self-hosted so the factory LAN works offline.   |
| Color     | Warm neutral ramp tinted toward the logo yellow. **Ink** (near-black) is the primary in light mode; **CPoint yellow** is the primary in dark mode. Yellow otherwise marks the brand and highlights. | Comes straight from the logo (yellow field, black lettering).                                    |
| Brand red | **Logo only.** Never used for buttons, links, or chrome.                                                                                                                                            | On a QC screen, red means Reject. A red brand accent would make every button look like an alarm. |
| Verdicts  | Pass = green, Rework = **orange**, Reject = red, Needs review = blue. Always icon + label + color.                                                                                                  | Fixed meaning everywhere. Rework is orange, not yellow, so it never reads as "brand".            |
| Space     | 4px base. Scale 4/8/12/16/24/32/48. Tight inside groups, loose between sections.                                                                                                                    | Dense tables, readable page rhythm.                                                              |
| Finish    | Radius 6px everywhere (`rounded-md`); 4px for badges (`rounded-sm`). 1px borders for structure; `shadow-1` for cards, `shadow-2` for popovers/dialogs only. No gradients.                           | Soft-industrial: crisp, not bubbly.                                                              |
| Icons     | Lucide, 16px in controls, 14px in badges, stroke 2.                                                                                                                                                 | Matches Figtree's weight.                                                                        |

## Tokens

Names match the code (`--name` in CSS → `bg-name` / `text-name` in Tailwind).

| Group   | Tokens                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| Surface | `background`, `card`, `popover`, `muted`, `sidebar`, `sidebar-active`, `sidebar-indicator`                 |
| Text    | `foreground`, `muted-foreground` (≥ 6:1 on every surface), `*-foreground` pairs                            |
| Action  | `primary`, `secondary`, `accent` (yellow wash for hover/selected), `destructive`, `ring`                   |
| Lines   | `border` (dividers, 1.3:1), `input` (field outlines, ≥ 3:1 per WCAG 1.4.11)                                |
| Brand   | `brand-yellow`, `brand-ink`, `brand-red` (logo only)                                                       |
| Verdict | `pass`, `rework`, `reject`, `review`, each with `-soft` background. Text-on-soft ≥ 4.7:1 in both themes.   |
| Type    | `text-xs` 12 · `text-sm` 13 · `text-base` 14 · `text-lg` 16 · `text-xl` 20 · `text-2xl` 24 · `text-3xl` 32 |
| Finish  | `--radius` 6px → `rounded-sm/md/lg`; `shadow-1`, `shadow-2`                                                |
| Motion  | `--ease-out`, `--ease-in-out`, `--dur-press` 120ms, `--dur-fast` 150ms, `--dur-base` 220ms                 |

**Dark mode** values are chosen, not inverted: ink surfaces with a slight warm tint, primary
flips to yellow with ink text, and verdict colors are lightened to keep ≥ 6.7:1 on cards. The
theme is set on `<html data-theme>` by an inline script before first paint. The saved choice
wins; otherwise the OS setting applies.

Contrast was measured for every text/surface pair (see `docs/SESSION_LOG.md`, Phase 0).
Re-measure whenever a color token changes.

## Hierarchy rules

- **One primary button per view** (`variant="primary"`). Two solid buttons means neither is primary.
- Secondary = `variant="secondary"` (outline). Tertiary = `ghost` or `link`.
- **Destructive** = `variant="destructive"` (red outline, never solid), placed apart from the primary.
- Headings: page `text-3xl`/600, section `text-xl`/600, card title `text-lg`/600. Metadata uses
  `text-sm` + `muted-foreground`.
- Tables: numbers right-aligned, text left-aligned, one row height (36px), sortable headers marked
  with an icon.
- Layout: desktop only (≥ 1280px), left sidebar + content. No mobile breakpoints yet (D-008).

## Components

| Component              | Purpose                        | Variants                                                                      | Required states                                                                                            |
| ---------------------- | ------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Button`               | Actions                        | primary, secondary, ghost, destructive, link · sm/md/lg/icon                  | pressed (`scale .97`), focus ring, disabled + reason, pending (spinner + verb)                             |
| `VerdictBadge`         | Show a scan/decision outcome   | PASS, REWORK, REJECT, NEEDS_REVIEW                                            | Always icon + label                                                                                        |
| `ThemeToggle`          | Light/dark switch              | —                                                                             | Accessible name; icons swap via CSS (no hydration mismatch)                                                |
| `Input` / `Label`      | Form fields                    | —                                                                             | focus ring, `aria-invalid` red outline, error text below with how to fix, disabled                         |
| `Alert`                | Inline message                 | info, danger (role=alert), success                                            | icon + text; danger announced to screen readers                                                            |
| `Card`                 | Grouped content                | —                                                                             | header (title + description) + content                                                                     |
| `DropdownMenu`         | User menu, row actions         | —                                                                             | keyboard navigable, scales from trigger                                                                    |
| Sidebar                | Main navigation                | link, active (yellow wash + ink indicator), planned ("Phase N")               | planned items aren't links; screen readers hear "available in Phase N"                                     |
| `ComingSoonCard`       | Placeholder dashboard panel    | —                                                                             | names the phase that delivers it                                                                           |
| `Table`                | Dense lists                    | `numeric` cells right-aligned                                                 | one row height (44px); header row muted; hover wash                                                        |
| `Badge`                | Status labels                  | neutral, info, success, warning, danger, brand                                | always icon + label                                                                                        |
| `Select`               | Choices in forms and filters   | styled native `<select>`                                                      | `aria-invalid`, disabled + hint explaining why                                                             |
| `Dialog`               | Confirm / reason prompts       | —                                                                             | title names the item; confirm repeats the verb; Escape/close button                                        |
| Toast (`sonner`)       | Routine success                | —                                                                             | bottom-right, 4s; errors stay inline instead                                                               |
| `StageProgress`        | Where a batch is               | —                                                                             | done ticked (ink), current yellow, upcoming muted; time under each step                                    |
| Batch list states      | —                              | —                                                                             | first-use empty + CTA, no-match + Clear, skeleton, error + Try again                                       |
| `ScanImage`            | Capture with detections        | box tone = what the confidence means (reject/rework solid, review/low dashed) | label chip per box; hover dims the others; alt text names batch + section                                  |
| `VerdictFlow`          | Camera → final verdict         | —                                                                             | shows both when they differ, with a "person" icon for overrides                                            |
| `LatestScansWidget`    | Live camera feed               | —                                                                             | skeleton, empty (link to Camera), "Updated Ns ago", error keeps stale data dimmed; no animation on refresh |
| Tables (Phase 2+)      | Lists of batches, scans, items | —                                                                             | skeleton rows, empty (first-use vs filtered), error + retry, stale label                                   |
| Latest scans (Phase 3) | Live CV feed                   | —                                                                             | "Updated Ns ago", paused/offline label                                                                     |
| `ScanThumb`            | Small scan image on cards      | —                                                                             | fixed size; falls back to an icon + "No image" when the file is missing                                    |
| Rework board           | Repair station work            | columns Waiting / Being repaired / Repaired (7 days)                          | one primary button per card, undo toast (6s), empty text per column, batch filter in the URL, STALE alert  |
| Salvage list           | Rejected leather               | tabs Available / Reused / Discarded (`?status=`) with counts                  | FM actions in dialogs (discard needs a reason); QI read-only with an explanation line                      |
| Yield card             | Batch outcome                  | —                                                                             | usable as the hero number with "passed + repaired"; each count links to the board/list; empty before scans |

## Patterns

- **Forms:** labels above fields, `(optional)` marks the minority, validate on blur and then live
  once a field has errored, errors next to the field saying how to fix it, focus moves to the first
  error on submit, and the submit button names the outcome ("Create batch").
- **Confirm vs undo:** irreversible actions (discard salvage, revoke token, deactivate user,
  REJECT override) use a confirmation that names the item and the consequence, and the confirm
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
- Don't use a centered spinner for page content. Use skeletons that match the final layout.
