# Phase 41 plan: Find roll moves from the menu to a button on Inventory (planning thread, 2026-11-26)

Request (Dylan, 2026-11-26): take Find roll out of the navigation bar and make it a button on the Inventory page.
One session, Sonnet (high), after Dylan's go. No code or git has been touched by this planning thread. The number 41
assumes Phase 40 (Preparation's count unit) is built first; renumber if not.

## What I found

**Who sees and uses Find roll today** (`navigation.ts`, `permissions.ts`, `guard.ts`):

| Role                                   | In the menu?                     | Can open `/find`?     | Can reach Inventory?                                           |
| -------------------------------------- | -------------------------------- | --------------------- | -------------------------------------------------------------- |
| Floor Manager                          | Yes, last item (after Inventory) | Yes (`location:read`) | Yes (`inventory:read`)                                         |
| Shoe Constructor with camera access    | Yes, second item (after Capture) | Yes (`canFindRolls`)  | **No** (`inventory:read` is FM only; `/inventory` answers 403) |
| Shoe Constructor without camera access | No                               | No (403)              | No                                                             |
| Quality Inspector, System Admin        | No                               | No                    | QI no, Admin no                                                |

**The flag Dylan asked for:** a constructor with camera access uses Find roll but cannot reach Inventory. A button on
Inventory alone would take Find roll away from constructors, and their phone is where it is used most (it is a phone
page, D-128, A-71). They also should not get Inventory just for this: it shows stock levels and is the Floor
Manager's module (D-100). So the constructors need a decision (below).

**Everything that touches Find roll** (checked by search; nothing else links `/find` except the Storage locations page):

- Menu: `src/server/policies/navigation.ts` (`FIND_ROLL`, listed under `SHOE_CONSTRUCTOR` and `FLOOR_MANAGER`).
- Page and guard: `src/app/(app)/find/page.tsx`, `find-roll-client.tsx`; `requireFindRoll` in `guard.ts`;
  `canFindRolls` in `permissions.ts`. The API `GET /api/v1/rolls/find` uses the same rule.
- Existing link in: `src/app/(app)/inventory/locations/locations-manager.tsx:258` (`/find?q=LOC:<code>`), which stays.
- Sidebar: `app-shell/sidebar.tsx` marks the active item by URL and the phone bar takes its title from it. With no
  Find roll item, the Floor Manager on `/find` would have nothing marked and the phone bar would say "CPoint".
- Tests: `tests/unit/permissions.test.ts` (FM list ends with `/find`, line ~154), `tests/e2e/auth.spec.ts`
  (`EXPECTED_NAV.manager` ends with "Find roll", line 19), `tests/e2e/capture.spec.ts:338` (constructor's Pages menu).
- Docs: master spec (`system-rebuild.md` lines 164, 343-344, 352), README (lines 15-19, 184), USER_MANUAL (4.7, 6.5, 6.5a,
  section 8 line ~747), DESIGN.md (Phone layout, lines 111-117 and 143). `docs/DEMO_SCRIPT.md` (Dylan's file, not in git)
  has no Find roll step, so it needs nothing. API.md, STATION_SETUP and CLAUDE.md need nothing (route and rule unchanged).

## Decision for Dylan: what do constructors do? (DECIDED 2026-11-26: option 1)

1. **Constructors keep Find roll in their own menu; only the Floor Manager changes** (recommended). Smallest change, no
   new access, the phone Pages menu for constructors stays as it is. The Floor Manager reaches it from Inventory.
2. **Find roll leaves the menu for everyone; constructors get a Find roll button on Capture.** One rule for all, but
   Capture's phone screen is tight (the live picture must stay on the first screen, 30F-3), so it needs a layout check,
   and `capture.spec.ts` (Pages menu) and `auth.spec.ts` (constructor nav) change too.

The rest of this plan is option 1. If Dylan picks option 2, the delta is: also remove `FIND_ROLL` from
`SHOE_CONSTRUCTOR`, add a `size="lg"` "Find roll" link button in Capture's `PageHeader` actions (with-camera view only),
make the phone bar show no Pages menu, and update the two e2e specs and the DESIGN.md phone-shell paragraph.

## What to change (option 1)

**Code**

1. `src/server/policies/navigation.ts`: remove `FIND_ROLL` from `FLOOR_MANAGER`. Keep it for `SHOE_CONSTRUCTOR`
   (`needsCapture` stays). Give the Floor Manager's Inventory item an `alsoActive: ["/find"]` (new optional field on
   the item and on what `navigationFor` returns) so `/find` marks Inventory in the sidebar and titles the phone bar
   "Inventory", as `/inventory/locations` already does.
2. `src/components/features/app-shell/sidebar.tsx`: `activeHref` also matches an item's `alsoActive` paths (and the
   sidebar's section type gets the field). The longest-match rule stays, so a constructor on `/find` still marks Find roll.
3. `src/app/(app)/inventory/page.tsx`: a **Find roll** button (`ScanSearch` icon, `variant="secondary"`) in the header
   actions, after Storage locations, linking to `/find`. Shown when `can(user.role, "location:read")` (the Floor Manager,
   who is the only one on this page). It stays visible when the list is empty or filtered. On a phone-sized window it
   comes first and is `h-11` (`max-sm:order-first`), because the Floor Manager used Find roll standing in the store
   with a phone and Inventory is a desktop page (D-034): the button must be on the first screen at 390 px with no
   sideways scroll.
4. `src/app/(app)/find/page.tsx`: when the person is the Floor Manager, `back={{ href: "/inventory", label: "Inventory" }}`
   on the `PageHeader` (constructors get no back link; they came from their menu). Everything else on the page stays.
5. No change to `guard.ts`, `permissions.ts`, the API route, the controller, the services or the database. No migration.
   Find roll stays at `/find`: moving it under `/inventory` would break the constructors' access and the QR/label flow.

**Tests (Claude runs `npm run check` only; Codex runs the e2e)**

6. `tests/unit/permissions.test.ts`: the Floor Manager's menu list loses `/find`; add an assertion that the
   Floor Manager's items never include "Find roll" and that the constructor's still do with camera access
   (existing test covers it); add one for `alsoActive` (Inventory carries `/find` for the Floor Manager only).
7. `tests/e2e/auth.spec.ts`: `EXPECTED_NAV.manager` loses "Find roll"; add `/inventory` to `REFUSED.constructor`
   (pins the flag above: constructors still cannot reach Inventory).
8. A new e2e check (in the existing inventory or locations spec): the Floor Manager opens Inventory, taps **Find roll**,
   lands on `/find` with "Inventory" marked in the sidebar and a back link to Inventory, finds a roll by code, and the
   back link returns; at 390 px the button is visible and the page does not scroll sideways.
9. `capture.spec.ts` stays as is under option 1.

**Docs (D-134: the feature's own session updates the docs it touches)**

10. Master spec `docs/prompts/system-rebuild.md`: sidebars paragraph (line ~343): Floor Manager is now **Overview, Batches,
    Attendance, Reports, Inventory** and says Inventory has the Find roll button; the module table row for Find roll
    (line ~352) says "button on Inventory (FM)"; the `(app)/find/` comment (line ~164) says reached from Inventory or the
    constructor's menu; the Phase 32 paragraph (line ~222) one clause.
11. README: features bullet (lines 15-19, "Find roll is a button on Inventory for the Floor Manager, in the menu for
    constructors"); demo script step 4 (line ~184): "Then **Inventory → Find roll**, on a phone-sized window"; the role list
    at line ~148 already omits it for the Floor Manager, so only the constructor mention stays.
12. `docs/USER_MANUAL.md`: 6.5a "Find roll is in your menu" becomes "On **Inventory**, tap **Find roll** (top of the page)";
    section 6.5 line ~534 and ~544 say **Inventory → Find roll**; line ~747 likewise; 4.7 stays (constructors).
    Add a one-line note in 6.5a that on a phone the button is at the top. Retake nothing unless screenshot 08 (Inventory)
    shows the header buttons; if it does, retake it (headless Chromium, 1366 px at 2x, demo data) and rebuild
    `USER_MANUAL.pdf` (Chromium print; the manual's text changed either way, so rebuild the PDF).
13. `DESIGN.md` Phone layout: the Find roll bullet gets "the Floor Manager reaches it from the Inventory page's Find roll
    button (first on a phone-sized window), constructors from their menu".
14. `docs/DECISIONS.md`: a new entry (next free D-number, D-137 unless Phase 40 took it) amending D-128: Find roll is a
    button on Inventory for the Floor Manager and stays in the constructors' menu because they cannot reach Inventory.
    New ASSUMPTION (next free A-number) in STATUS: constructors keep it in their menu rather than gaining Inventory;
    **to tell CPoint**, not to ask.
15. Wrap-up: STATUS, SESSION_LOG, ROADMAP (Phase 41 section), the vault's Daily note and phase summary, the QA handoff
    `qa/handoffs/2026-11-26-find-roll-in-inventory.md` and `qa/CODEX_PROMPT_PHASE_41.md`. Docs left out: API.md and
    STATION_SETUP (route and rule unchanged), CLAUDE.md, `docs/DEMO_SCRIPT.md` (Dylan's file, no Find roll step).

## Checks and QA

- Claude: `npm run check` (lint, typecheck, unit tests, build). No browser or e2e from Claude.
- Codex (from the handoff): e2e `auth.spec.ts` and the new Inventory check; by hand as the Floor Manager at 1366 px and
  390 px (button visible, `/find` works, sidebar marks Inventory, back link); as a constructor with camera access
  (menu still Capture, Find roll; `/inventory` is 403); a constructor without camera access (no Find roll); the QI and
  the Admin (no Find roll, `/find` is 403).

## Risks

- The Floor Manager on a phone now takes two taps (Pages menu → Inventory → Find roll) instead of one. The first-on-phone
  button keeps it to that; a faster path is a bookmark of `/find`, which still works.
- Phone bar title on `/find` reads "Inventory" while the page title says "Find roll"; same as Storage locations today.
- If Phase 40 is built first, the D- and A-numbers and the Phase number shift by one; use the next free ones.
