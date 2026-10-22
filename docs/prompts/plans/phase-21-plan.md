# Phase 21 plan: Repair Station, Floor view, constructor capture, no mkcert

Status: **approved by Dylan on 2026-10-20 ("go ahead"): A, B and C as recommended.**

Asked by Dylan on 2026-10-20 in the Phase 20 QA thread. Phase 20 passed QA (Codex run 4) and
the test data was cleaned up. This phase changes the camera station around how CPoint's floor
will actually work:

- A shoe constructor at Preparation places each leather piece under a **fixed camera** and has no
  computer of their own to read.
- The main PC with the system may be somewhere else in the factory.
- Later, the site is reached through a **Cloudflare Tunnel** (D-076 below), so it already has real
  HTTPS and mkcert isn't needed.

Four steps, then one QA handoff for all of them. Decisions D-073 to D-076.

---

## Step 1. "Cut around or clean" becomes **Repair Station** (D-073)

Repair Station is what CPoint's factory already calls the station. The page still says what really
happens, with no "nothing is repaired" line.

- Nav label, page title and `<h1>`: **Repair Station**.
- Page description: **"Clean the section or cut around the defect."** Then, as now, "Done
  sections count as usable in their batch."
- The cards keep **Clean before cutting** / **Cut around the marked area**, and the Done labels keep
  **Cleaned, usable** / **Cut around, usable**. The columns keep To handle / Being handled /
  Done, usable.
- Everywhere else the board is named:
  - the Operations card ("Repair Station" plus the same description);
  - the FM home card and the Operations KPI ("At the Repair Station");
  - the verdict hint in Override ("Goes to the Repair Station");
  - the Override sentence ("onto or off the Repair Station board");
  - the batch "Being handled" tag tooltip, the error page, `stage-machine`, `rework.service`
    messages, and the scan page link.
    About 20 places (`git grep "Cut around or clean"`).
- Settings → Defect types keeps the "When Fixable" column (Clean before cutting / Cut around the
  marked area).
- The URL stays `/rework`, and internal names stay as they are.
- Tests: `auth.spec.ts` nav lists, `rework-columns.spec.ts`, `cut-around-or-clean.spec.ts` (the file
  name stays), and the unit tests `permissions.test.ts` and `stage-machine.test.ts`.

## Step 2. Floor view on the Capture page (D-074)

A full-screen mode of the Capture page, for a monitor that faces the operator. It shows the same
live camera preview that's on the Capture page now (no live boxes, D-066) and no sounds.

- **Entry:** a **Floor view** button next to Capture. It opens the browser's full screen, and
  **Esc** leaves. The choice is remembered on that browser, so a station PC opens straight into it.
  The page is still `/camera/capture`, so it reuses the camera, the Space key and the batch rule.
- **Layout:**
  - The live video fills the screen.
  - A slim top bar shows "Next scan goes to **B-2026-0012** · roll … · section **#14**" in large
    text, or "No batch is at Preparation, so Capture is off."
  - Capture still works with Space, so a **USB foot pedal or big button set to Space** captures
    without hands.
- **After each capture:**
  - The verdict shows as a thick coloured frame round the video, plus a large band with the word
    and section number:
    - **Pass** (green), "Goes on to cutting"
    - **Fixable** (orange), "To the Repair Station"
    - **Reject** (red), "To salvage"
    - **Needs review** (blue), "Set aside for the Quality Inspector"
  - Each has its icon too, so colour never carries the meaning alone.
  - It stays until the next capture (an operator may look up late), with "Checking…" while the
    model runs.
- **Problems** (no model, camera denied or busy, send failed, batch moved) fill the band in a
  neutral style with the same specific messages as now. Send again stays reachable.
- **Not in Floor view:** the Last scan photo with boxes, and the camera picker. The Repair
  Station worker sees the photo with the marked area on the board card. Leaving Floor view shows
  the normal page.
- **Colours:** existing tokens only (`pass`, `rework`, `reject`, `review`). Large text sized to be
  read from about 2 m.

## Step 3. Capture for the constructors the Admin or Floor Manager allows (D-075)

Today only the QI and the FM can capture. The station operator is a shoe constructor, and
sharing a QI login would put every scan under that QI's name.

- A per-person **"Can capture at the camera"** switch, like the leather-roll switch (D-031). The
  migration `user_can_capture` adds `User.canCapture`, default off.
- The **Admin** sets it in Users (More actions), and the **FM** in a small "Camera operators" panel
  on the Camera page. Both write audit (`user.capture_access`).
- A new `canCaptureFor(user)` in `permissions.ts`: the QI and FM always; a Shoe Constructor only
  with the switch on. The Capture page, the capture API and the nav all ask this one function, and
  the flag is read fresh on every request, the same way the leather-roll flag is.
- An allowed constructor sees **Capture** in their nav and a "Capture sections" card on their home.
  They still don't see Scans, the Review queue or Reports. Last scan shows them the verdict and
  section, and the Floor view the same.
- Their scans are audited under their own name (`origin: "website"`), as for the QI today.
- `demo:reset` leaves the switch off for the demo constructor. The demo week doesn't change.

## Step 4. Remove mkcert and the HTTPS listener; add the station and tunnel guide (D-076)

D-076 supersedes D-065.

- **Remove:**
  - `docker/https.mjs`, and the HTTPS branch in `docker/entrypoint.sh`;
  - from the `Dockerfile`: `HTTPS_PORT`, `EXPOSE 3443` and the copy;
  - from `docker-compose.yml`: the `certs` mount and the `3443` port;
  - `HTTPS_PORT` from `.env.example`;
  - the `/certs` lines in `.gitignore`, and the `certs/.gitkeep` folder;
  - `npm run dev:https`;
  - the README's mkcert, iPhone certificate and "https://…:3443" steps.
- **The camera on an insecure address:** `secureAddress()` (which builds `:3443`) is removed. The
  message becomes "The camera only works on a secure address. Open this site through its https://
  link (the Cloudflare Tunnel), or on the server PC at localhost."
- **New `docs/STATION_SETUP.md`** (a one-page guide for the factory):
  - the station device (an old laptop or mini PC);
  - the fixed USB webcam, the monitor facing the operator, and the foot pedal set to Space;
  - Floor view;
  - the four bins taped green, orange, red and blue, each with its word (Pass, Fixable, Reject,
    Needs review);
  - who works which bin.
- **New README section "Reach the site with Cloudflare Tunnel":**
  - quick tunnel for staging (`cloudflared tunnel --url http://localhost:3000`, run on the host,
    not as a third container);
  - a named tunnel for the real setup (a free account plus a domain);
  - before sharing a link: revoke pasted tokens and use strong passwords;
  - if the internet drops, capture stops; on the LAN, `localhost` on the server PC still works.
- **Your local `certs/` files** (`cert.pem`, `key.pem`): I won't delete them. They're git-ignored
  and you can delete them yourself. `mkcert -uninstall` removes its root from your PC if you want.

---

## Decisions for you

| #   | Question                                     | Options                                                             | Recommended                                     |
| --- | -------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| A   | How long the verdict shows in Floor view     | **Until the next capture** / for 5 s, then back to plain live video | Until the next capture                          |
| B   | Who turns on "Can capture" for a constructor | **Admin and Floor Manager** / Admin only                            | Admin and Floor Manager (same as leather rolls) |
| C   | Where an allowed constructor captures        | **Capture page (and its Floor view)** / Floor view only             | Capture page and its Floor view                 |

## Files (expected)

- **Rename:** `navigation.ts`, `rework/page.tsx`, `rework/error.tsx`, `ops-sections.tsx`,
  `reports/page.tsx`, `open-reworks-card.tsx`, `scans/[id]/page.tsx`, `decision-panel.tsx`,
  `stage-machine.ts`, `rework.service.ts`, and the tests above.
- **Floor view:** `camera/capture/capture-client.tsx`, a new `camera/capture/floor-view.tsx`, and
  `capture-rules.ts` (verdict → band text), with unit tests.
- **Capture access:** `prisma/schema.prisma` and the migration, `permissions.ts`, `guard.ts`
  (`requireCapture`), `navigation.ts` (nav per user), `scan.controller.ts`, `user-admin.service.ts`
  and the Users dialogs, the Camera page panel, `constructor/page.tsx`, a validator, an API route,
  and unit tests.
- **mkcert:** the files listed in step 4, `capture-rules.ts`, `.env.example`, `package.json`,
  README, `docs/STATION_SETUP.md`, and `DECISIONS.md` (D-073 to D-076).
- **Docs:** STATUS, SESSION_LOG, ROADMAP (Phase 21), API.md (the new route).

## Checks and handoff

- Lint, typecheck, unit tests, build. E2E specs are updated, but Codex runs them.
- QA handoff `qa/handoffs/2026-10-2x-phase-21-…md`, plus a Codex prompt covering:
  - the rename on every page;
  - Floor view in each state (pass, Fixable, reject, needs review, each problem);
  - a constructor with and without the switch (page, API 403, nav);
  - Docker without certificates.
- A real station check for you: a second laptop on a quick tunnel, the webcam and a pedal.
