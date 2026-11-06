# Prompt: Phase 30F — A polished, premium look that stays simple

> **How to use this file.** It holds **one phase in three parts** (30F-1, 30F-2, 30F-3), one per
> Claude Code session (CLAUDE.md: one phase per session). Open Claude Code (Opus) at
> `C:\dev\CPoint-PMS` with the vault added (`claude --add-dir C:\dev\capstone-obsidian`), switch to
> **plan mode**, and say:
> _"Read `docs/prompts/premium-ui.md` and run Phase 30F-1. Stop for my approval before writing
> code."_
> Next session, say the same with 30F-2, then 30F-3. Start each part from the latest `main` after
> the previous part is merged. Phase 31 (the docs and the paper's figures) comes **after** 30F-3,
> so the screenshots and figures show the final look.

| Part  | What it changes                                                                                 | Pages                                                   |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 30F-1 | The foundation: tokens, the shared `ui/` components, the app shell, page header, tables, states | Sign-in, 403/404, the shell on every page               |
| 30F-2 | The desktop pages                                                                               | Homes, Reports, Inventory, Attendance, Plan days, Admin |
| 30F-3 | The phone pages and Floor view                                                                  | Capture (and Floor view), Batches                       |

---

<role>
You are the senior product designer and front-end engineer who built this system's UI from Phase 0
and keeps to its conventions. CPoint's Floor Manager, Quality Inspector and System Admin use it all
shift, and an industry panel will judge it. Your job in this phase is **craft, not features**: make
every screen look calm, precise and expensive, the way a well-made tool looks, while keeping it as
simple as it is today. You know that premium comes from restraint: consistent spacing, a clear type
scale, quiet surfaces, exact alignment and complete states, not from decoration. You change how
things look; you never change what they do or what they say.
</role>

<goal>
**What:** a visual refinement of the whole app, built on the component library it already uses
(shadcn/ui on Radix), in three parts.

**Why:** the system works and has passed QA phase by phase, but the screens were built over 30
phases and it shows: spacing, headers, cards and empty states differ from page to page. The panel
and CPoint should see one coherent, confident product.

**Success looks like:** a person who knows the app finds every button, word and page where it was,
and the app feels noticeably more finished. The e2e suite passes unchanged and axe still reports 0
violations.
</goal>

<read_first>
Read these **before you plan**. The plan must cite what it reuses, by file.

1. **The vault first (D-089):** `C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, `Home.md`,
   `Inbox/CPoint commands and where to look.md`, the latest `Daily/` note and
   `Notes/Phases/Phase 30F - Premium look.md`. Read repo files through `C:\dev\CPoint-PMS`, never
   through the vault's junctions.
2. `CLAUDE.md` (auto-loaded with `docs/STATUS.md`) and `AGENTS.md`.
3. **`DESIGN.md`, all of it.** It is the source of truth for the look and overrides any skill
   default. This phase may change it, but only on purpose, in the plan, with a reason.
4. **`.claude/skills/ui-craft/SKILL.md`**: Audit mode (7) for the plan, Build mode for the work,
   and its Definition of Done. Use the **dataviz** skill for any chart change, and the **ponytail**
   skill if Claude Code lists it.
5. `src/styles/tokens.css`, `src/app/globals.css`, `components.json` and every file in
   `src/components/ui/`, then the feature components the part touches
   (`src/components/features/**`, `page-header.tsx`, `table-pager.tsx`, `verdict-badge.tsx`).
6. `docs/UI_AUDIT.md` (the Phase 8 audit and its token grep) and the newest report in
   `qa/reports/`.
7. Next.js 16 docs in `node_modules/next/dist/docs/` before any framework code (AGENTS.md).
   </read_first>

<context>
What exists today (check each in the code; if one is wrong, say so in the plan):

- **Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, **shadcn/ui, style `new-york`**
  (`components.json`) on the single `radix-ui` package, `class-variance-authority`, `clsx` +
  `tailwind-merge`, `lucide-react`, `sonner` toasts, Recharts charts, Figtree (self-hosted).
- **Tokens:** `src/styles/tokens.css`, mapped to Tailwind in `src/app/globals.css`. Light and dark
  are chosen separately; contrast was measured for every pair. Components use tokens only.
- **`src/components/ui/`:** alert, badge, button, card, dialog, dropdown-menu, field-error,
  form-error-summary, input, label, scroll-region, select (styled native), table, textarea,
  toaster.
- **Roles and pages (Phase 28, D-100, D-119):** Shoe Constructor: Capture. QI: Batches. FM:
  Overview, Batches (and Plan days), Attendance, Reports (Operations, Quality, Rolls, Materials,
  claim sheets), Inventory. System Admin: Overview, Users, Settings, API tokens, Audit log. Plus
  sign-in, password, 403/404 and the scan page.
- **Phone layouts** only on Capture and Batches (D-096); every other page is desktop first and
  adapts to narrower windows (D-034).
- **Decided by Dylan (2026-11-05):** the library stays **shadcn/ui on Radix**. Missing pieces are
added as shadcn components copied into `src/components/ui/` and restyled with the tokens. No
second component library (no Mantine, HeroUI, MUI, Chakra, Tremor), and no new runtime package
without Dylan's word.
</context>

<what_premium_means>
"Expensive but simple" for this app, in concrete terms. Every change in the plan traces to one of
these.

**Do:**

- **One rhythm.** The 4 px scale, used the same way everywhere: the same page padding, the same gap
  between sections, the same card padding, the same header height. Tight inside a group, loose
  between groups.
- **A clear type scale.** Bigger steps between page title, section title and body; headings
  slightly tighter letter-spacing; weights 400/500/600 only; tabular numbers. A key figure (a KPI)
  is large and quiet, its label small and muted.
- **Quiet surfaces in layers.** Background, card and raised (popover, dialog) read as three
  distinct levels through tone and a soft, layered shadow (two-part `shadow-1`, `shadow-2`, as
  tokens), with hairline borders only where structure needs them. Fewer lines, not more.
- **Exact alignment.** Left edges, baselines and column widths line up across cards and tables;
  numbers right-aligned; action columns one width.
- **One page header pattern** on every page: title, one plain line of description, the page's
  actions at the right, and the "Updated …" or period meta where the page has it.
- **Finished states.** Every list and card has its skeleton (matching the final layout), empty
  state (icon, why, one next step), error with Try again, and stale label, all in one shared style.
- **Precise interaction.** Focus rings, hover washes, pressed scale, disabled-with-reason, pending
  with spinner and verb, all identical across components. Motion stays inside the motion tokens.
- **Dark mode with the same care**, chosen values, not inverted.

**Don't (DESIGN.md "Don't" still applies in full):**

- No gradients, glassmorphism, glows, neon, noise textures, illustrations or decorative images.
- No new colours for meaning: Pass green and Reject red only (D-093), always icon + label + colour;
  brand red on the logo only; no yellow text on light surfaces.
- No bubbly radii (keep 6 px, 4 px for badges), no animated counters, no parallax, no motion on
  data refresh, no `transition: all`.
- No new features, pages, filters, columns or settings, and no removed ones. Removing visual noise
  (a redundant border, a duplicate label) counts as progress; removing content does not.
- No per-person rankings or scores anywhere (D-008).
  </what_premium_means>

<confirmed>
- **C-P1 (Dylan, 2026-11-05):** the library is shadcn/ui on Radix, already in the repo; add
  missing shadcn components as copies in `src/components/ui/`, restyled with tokens.
- **C-P2 (Dylan, 2026-11-05):** the phase comes after D-121 and D-119 are merged and before
  Phase 31, in three sessions: foundation, desktop pages, phone pages and Floor view.
- **C-P3:** behaviour, copy, routes, permissions, APIs, the schema and the tests stay as they are.
  This is a visual phase only.
</confirmed>

<assumptions>
Confirm or change each in Step 1 of 30F-1, then log the survivors in STATUS → Open questions.

- **A-P1:** the copy stays word for word, including headings, labels, button text and messages.
  The e2e tests find elements by role, name and text, so a changed word is a failed test. If the
  audit finds wording that hurts the look (for example a heading that wraps), list it in the plan
  as a separate, opt-in change; don't make it silently.
- **A-P2:** DESIGN.md's decisions stay (Figtree, ink primary in light, yellow primary in dark,
  6 px radius, compact density: body 14 px, tables 13 px). The token values may be tuned (shadows,
  surface tints, border strength, heading sizes), each re-measured for contrast.
- **A-P3:** shadcn components that may be added, only where a page needs them: Tabs, Tooltip,
  Skeleton, Sheet, Popover, Separator, Breadcrumb, Toggle Group. Each one's need is named in the
  plan. They use the existing `radix-ui` package, so no new dependency.
- **A-P4:** no new route (no component gallery page). The look is checked on the real pages with
  the demo week.
- **A-P5:** the claim sheet's print layout stays print first; only its screen view is polished.
</assumptions>

<parts>

## 30F-1 — The foundation

**Goal:** the shared layer every page is made of looks finished, so 30F-2 and 30F-3 are mostly
applying it.

1. **Tokens** (`tokens.css`, `globals.css`): the type scale and heading tracking, surface tints for
   the three levels, layered `shadow-1`/`shadow-2`, border and input strength, focus ring, any new
   spacing or size token the components need (e.g. a page header height, a KPI figure size). Every
   changed colour pair is re-measured in both themes and the ratios go in the plan and in
   `docs/SESSION_LOG.md` (DESIGN.md: "Re-measure whenever a color token changes").
2. **`src/components/ui/`:** button, badge, card, alert, dialog, dropdown-menu, input, select,
   textarea, label, table, toaster, field-error, form-error-summary, scroll-region: one consistent
   set of states (DESIGN.md → Components, "Required states"). Add the A-P3 components the plan
   names.
3. **Shared feature pieces:** the app shell (sidebar, phone top bar, the bell, the Demo mode band),
   `page-header.tsx` (the one header pattern), `table-pager.tsx`, `verdict-badge.tsx`, and one
   shared set of **empty, skeleton, error and stale** states that pages reuse.
4. **First impressions:** the sign-in page (with and without the demo tools), the password page,
   403 and 404.
5. **DESIGN.md:** update Character, Tokens and Components to what was built, and add a short
   "Look" section (the rhythm, the header pattern, the three surface levels) so later sessions
   follow it.

**Done when:** every `ui/` component has every required state in both themes; the shell, header,
pager and states are shared, not copied; the token grep from `docs/UI_AUDIT.md` finds no raw hex,
`oklch()`, `rgb()`, arbitrary px or `transition-all` in `src/components` and `src/app`; every
changed colour pair meets DESIGN.md's ratios; DESIGN.md matches the code; `npm run check` passes;
Codex's run passes (below).

## 30F-2 — The desktop pages

**Goal:** apply the foundation to every desktop page, page by page.

- **Homes:** the FM Overview (Plan today, Today's batches, Attendance, Rolls today, Low stock,
  Stock update today, Daily summary) and the Admin Overview. KPI tiles and cards share one design.
- **Reports:** Operations, Quality, Materials, Rolls and a roll's page, the claim sheet's screen
  view, the charts (`src/components/features/charts/**`, with the dataviz skill; the chart tokens
  and their CVD order stay).
- **Inventory:** the list, an item's page with its rolls, New and Edit, the Update stock sheet.
- **Attendance**, **Batches → Plan days** (the calendar on desktop), **the scan page**.
- **Admin:** Users, Settings (every tab), API tokens, Audit log.

**Done when:** every page uses the shared header and states; at 1440 and 1280 px no table scrolls
sideways and the page never does at any width (D-034); one primary button per view; `npm run check`
passes; Codex's run passes.

## 30F-3 — The phone pages and Floor view

**Goal:** the two pages used on the line feel as finished as the desk, at arm's length.

- **Capture** (`/camera/capture`) at 390 × 844 and on desktop: Start a roll, the roll line in large
  text, the live picture and the marker card messages (D-120, D-121), the scanning timer, the
  bottom Capture button, Last scan with its boxes (`ScanImage` tones stay), Finish roll, the roll
  counts card (D-118). **Floor view**: the full-screen frame and band keep their colours and size.
- **Batches** at 390 px and on desktop: the batch cards, the bottom action, the Finish batch
  bottom sheet, the notices banner and the bell.

**Done when:** DESIGN.md → Phone layout holds (44 px controls, the bottom action above the safe
area, no sideways scroll at 390 px); Floor view still reads at a distance; `npm run check` passes;
Codex's run passes.

</parts>

<constraints>
- The CLAUDE.md non-negotiables all apply. Pages keep calling their services and guards; nothing in
  `server/` changes except what a page's markup strictly needs (expect none).
- **Tokens only.** A new value is a token first, in `tokens.css`, with its dark-mode value.
- **Accessible names, roles, headings, labels, `aria-*` attributes and test ids don't change**
  (A-P1). Keep the heading levels. Keep `role="status"`/`aria-label` on skeletons.
- **No new dependency** beyond what the shadcn components need from packages already installed.
  When you run the shadcn CLI, read each generated file and restyle it with the tokens; never let
  it overwrite an existing `ui/` file without comparing first. If the CLI's output doesn't fit
  Tailwind 4, React 19 or the `new-york` style here, write the component by hand from shadcn's
  source.
- **Desktop first** (D-034); phone layouts only on Capture and Batches (D-096).
- `prefers-reduced-motion` still removes movement.
- One part per session. Don't start the next part unless Dylan says so.
- If this brief conflicts with DESIGN.md, a decision or the code, say so in the plan and propose
  the smallest change. Don't silently pick one.
</constraints>

<decisions_to_record>
In 30F-1, one new entry in `docs/DECISIONS.md` with the next free number (D-122 if still free):
"A polished look on the existing shadcn/ui and Radix components: the library stays, missing
components are copied in and restyled, no second library; the copy and behaviour don't change"
with the token changes and their contrast ratios. 30F-2 and 30F-3 add to that entry or add one only
if they change a DESIGN.md rule.
</decisions_to_record>

<workflow>
For **each part**:

**Step 1: Plan (plan mode; stop for approval).**

- First write `qa/CODEX_PROMPT_PHASE_30F_BASELINE.md` (30F-1 only): Codex captures **before**
  screenshots of every page the phase touches, as each role, at 1440 and 1280 px (and 390 px for
  Capture and Batches), light and dark, with the demo week, into
  `qa/reports/artifacts/<date>-phase-30f-baseline/<role>-<page>-<width>-<theme>.png`. Give Dylan that prompt and read the
  screenshots once they're there. You don't run a browser yourself.
- A ui-craft **Audit** of the part's screens from the screenshots and the code: for each screen,
  what reads as unfinished (inconsistent spacing, header, card, state, alignment, weight), ranked
  by how often a user sees it.
- The look spec: a table of token changes (old → new, light and dark, with contrast ratios); the
  components to change or add (A-P3), each with its reason; the pages and what changes on each.
- The e2e risk: every place a change could touch a role, name, text or layout a test relies on, and
  why it doesn't (A-P1).
- Questions in one batch, each with a recommended option.

**Step 2: Build** at green checkpoints: tokens first, then `ui/`, then the shared pieces, then the
pages. Typecheck and unit tests pass at each checkpoint.

**Step 3: Checks.** `npm run check`; the token grep from `docs/UI_AUDIT.md` (paste the output); the
ui-craft Definition of Done on every touched screen. You never run browser or e2e tests (Codex
does). If a check can't run, say so.

**Step 4: Docs** (`/wrap-up`, without the commit and push): `DESIGN.md`, `docs/UI_AUDIT.md` (a
"Phase 30F" section: what the audit found and what changed), `docs/STATUS.md`,
`docs/SESSION_LOG.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`.

**Step 5: Hand over.** The QA handoff `qa/handoffs/<date>-phase-30f-<part>.md` from
`qa/templates/handoff.md` and the prompt `qa/CODEX_PROMPT_PHASE_30F_<PART>.md`: **after**
screenshots with the same names as the baseline (`qa/reports/artifacts/<date>-phase-30f-<part>/`), a side-by-side check
that every button, word and page is where it was, axe 0 on every page in both themes, no sideways
scroll at 1280 and 390 px, keyboard focus visible on every control, reduced motion, and the full
e2e suite (rerun a timed-out spec alone once, as AGENTS.md says). Then the vault's Daily note and
the phase summary.

**Step 6: Report** in the master spec's `<final_report_format>`. Re-read the part's **Done when**
and mark each item with its evidence. The "Next session" line names the Codex run or the next part.
When the newest Codex report for the part is a full pass, give Dylan the git commands (project
instructions → GIT). Then stop.
</workflow>
