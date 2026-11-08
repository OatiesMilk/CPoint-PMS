# UAT test cases: Floor Manager

| Field   | Value                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| Date    | 2026-11-04                                                                                                       |
| Role    | Floor Manager (`manager@cpoint.local`, password `DEMO_USER_PASSWORD` from `.env`)                                |
| Build   | Written for `main` at 9bfd10e plus Phase 30E-1; **partly out of date** on `main` at c5b1848 (see the note below) |
| Not in  | Phase 30E-2 (planning calendar, holidays): not built yet                                                         |
| Written | Claude                                                                                                           |

> **Out of date since it was written (checked 2026-11-07, Phase 31):** the batch schedule cases
> (FM-42 to FM-46) are now **Batches → Plan days**, a calendar per weekday (D-114, D-115); the
> report cases (FM-60 to FM-64) now read **Returned to supplier** and count whole rolls, with no
> "for salvage", Reject rate or Too many defects (D-116, D-117). Refresh those cases before using
> this list.

**Before you start:** run `npm run dev`, sign in as the Floor Manager. A fresh demo week
(`npm run demo:reset '--' --yes` in PowerShell, back up first) gives rolls on the shelf, a roll being
scanned and rolls with Too many defects. Some cases need another role (the QI, a constructor), noted
in the steps.

Type: **H** happy path, **N** negative (wrong input or refused), **E** edge case or limit,
**A** access. Write Pass or Fail and a note in the last column.

## 1. Sign-in, home and access

| ID    | Type | Scenario           | Steps                                                                                      | Expected result                                                                                                | Pass/Fail |
| ----- | ---- | ------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------- |
| FM-01 | H    | Sign in            | Log in as the FM                                                                           | Lands on Overview (`/floor-manager`). Sidebar: Overview, Batches, Attendance, Reports, Inventory, nothing else |           |
| FM-02 | N    | Wrong password     | Log in with a wrong password                                                               | Refused with a message; not signed in. After 5 wrong tries in 15 minutes the account is locked for a while     |           |
| FM-03 | H    | Overview cards     | Look at Overview                                                                           | Today's batches, Attendance, Rolls today, Low stock, Daily summary. No person's name or score anywhere         |           |
| FM-04 | A    | Admin pages        | Type `/admin/users`, `/admin/settings`, `/admin/tokens`, `/admin/audit` in the address bar | Each shows the 403 page; no data                                                                               |           |
| FM-05 | A    | Capture and Camera | Open `/camera/capture` and `/camera`                                                       | 403 page. The FM doesn't capture                                                                               |           |
| FM-06 | E    | Sign out           | Sign out, then press Back                                                                  | Sent to the login page; no FM page shows                                                                       |           |

## 2. Inventory: items

| ID    | Type | Scenario                      | Steps                                                                  | Expected result                                                                                                                                                 | Pass/Fail |
| ----- | ---- | ----------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FM-07 | H    | Add a normal item             | Inventory → new item: code `TK-001`, name, category, unit `box` → Save | Saved; listed with 0 on hand                                                                                                                                    |           |
| FM-08 | N    | Missing fields                | New item, leave code, name and unit empty → Save                       | Each field says what to enter ("Enter an item code of at least 2 characters, e.g. LR-001.", "Enter the item name…", "Enter the unit…"); focus goes to the first |           |
| FM-09 | N    | Bad item code                 | Code `A` and then `TK 001!`                                            | "at least 2 characters" and "can only have letters, numbers and dashes"                                                                                         |           |
| FM-10 | E    | Long values                   | Code over 20 characters, name over 80                                  | "Keep the item code under 20 characters." / "Keep the item name under 80 characters."                                                                           |           |
| FM-11 | N    | Leather item without supplier | New item, category Leather roll, no supplier → Save                    | "Choose the supplier of this leather roll."                                                                                                                     |           |
| FM-12 | H    | Leather item starts at 0      | Save a leather item with a supplier                                    | Starts at 0: "A leather roll item starts at 0. Save it, then use Add rolls…"                                                                                    |           |

## 3. Inventory: leather rolls

| ID    | Type | Scenario                       | Steps                                                                                       | Expected result                                                                                               | Pass/Fail |
| ----- | ---- | ------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------- |
| FM-13 | H    | Add rolls                      | Leather item → Add rolls: arrived today, 2 rolls, areas 24.5 and 31.75, a tag on one → Save | On hand +2; two rows `LR-<supplier code>-…`, Not scanned, with their areas                                    |           |
| FM-14 | H    | New rolls reach Capture        | As a constructor, Capture → Start a roll → pick that leather                                | Both new rolls are listed under it                                                                            |           |
| FM-15 | N    | Area empty or not a number     | Add rolls with an empty area, then `abc`                                                    | "Roll 1: enter its area in square feet, like 24.5." / "…as a number of square feet…"                          |           |
| FM-16 | E    | Area limits                    | Areas `0.05`, `200.5`, `0.1`, `200`, `24.755`                                               | 0.05 and 200.5 refused ("between 0.1 and 200 sq ft"); 0.1 and 200 accepted; 24.755 "use at most two decimals" |           |
| FM-17 | N    | Arrival date in the future     | Arrived = tomorrow                                                                          | "The day the rolls arrived can't be after today."                                                             |           |
| FM-18 | E    | Too many at once               | Try to add 51 rolls                                                                         | "Add at most 50 rolls at a time."                                                                             |           |
| FM-19 | E    | Long tag                       | A tag over 40 characters                                                                    | "Roll N: The supplier's tag can be up to 40 characters."                                                      |           |
| FM-20 | N    | No rolls                       | Remove every row, then Save                                                                 | "Add at least one roll."                                                                                      |           |
| FM-21 | H    | Remove a shelf roll            | A Not scanned roll → Remove, reason "Water damage"                                          | Reads Removed; on hand −1                                                                                     |           |
| FM-22 | N    | Remove with no reason          | Remove, leave the reason empty                                                              | "Write why this roll is removed." Nothing changes                                                             |           |
| FM-23 | E    | Scanned roll can't be removed  | Open a Scanned roll                                                                         | No Remove; "Scanned and taken off stock."                                                                     |           |
| FM-24 | E    | Leather row on the stock sheet | Update stock, find a leather item                                                           | Read-only, "Counted from its rolls"                                                                           |           |

## 4. Inventory: Update stock

| ID    | Type | Scenario                     | Steps                                                                           | Expected result                                                                           | Pass/Fail |
| ----- | ---- | ---------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------- |
| FM-25 | H    | Save an update               | Update stock: one item Added 6, another Used 2 → Save                           | "Save update (2 items)"; both change; After matches; Last updated shows today             |           |
| FM-26 | N    | Empty sheet                  | Save with every row blank                                                       | "Enter a change for at least one item."                                                   |           |
| FM-27 | N    | Use more than on hand        | Used = on hand + 1                                                              | "Only N … in stock. Enter a smaller amount." under that row                               |           |
| FM-28 | N    | Correction with no reason    | Correction −1, no reason                                                        | "Enter a reason for the <item> correction, like "Recounted the shelf.""                   |           |
| FM-29 | E    | Correction below zero        | Correction larger than what's on hand                                           | "The correction would take <item> below zero. Enter at most −N."                          |           |
| FM-30 | N    | Not a number                 | Added `abc`, Added `-3`                                                         | Message names the item and asks for a plus number, like 6                                 |           |
| FM-31 | E    | Leaving with unsaved entries | Type in a row, click another page                                               | Asked before leaving                                                                      |           |
| FM-32 | E    | Someone else saved first     | Open the sheet in two tabs, save in tab 1, then save the same item in tab 2     | Tab 2 refused: "<item> changed while you were updating (now N). Check it and save again." |           |
| FM-33 | H    | Reminder day                 | On a reminder day (Wed or Fri by default) open Overview before saving an update | "Stock update today" first, and in the bell; gone after a save                            |           |
| FM-34 | N    | Reminder days                | Untick every reminder day → save                                                | "Pick at least one reminder day." Only Monday to Friday can be picked                     |           |

## 5. Attendance

| ID    | Type | Scenario                | Steps                                                  | Expected result                                                        | Pass/Fail |
| ----- | ---- | ----------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- | --------- |
| FM-35 | H    | Take today's attendance | Attendance → tick a few → Save attendance (N changes)  | Saved; Overview's Attendance card updates                              |           |
| FM-36 | H    | Mark everyone present   | Mark everyone present → Save                           | Everyone ticked and saved                                              |           |
| FM-37 | E    | 7 days back             | Pick a day 7 days ago, change one, save                | Saves                                                                  |           |
| FM-38 | E    | 8 days back             | Pick a day 8 days ago                                  | Locked: "Days more than 7 days ago are locked."                        |           |
| FM-39 | N    | Future day              | Try tomorrow                                           | Refused: "Attendance can't be taken for a future day."                 |           |
| FM-40 | E    | Saved in another tab    | Two tabs on the same day, save both                    | Second: "Someone else saved this day's attendance. Refresh to see it." |           |
| FM-41 | A    | No per-person history   | Look for a person's attendance record, count or streak | None anywhere                                                          |           |

## 6. Batches: plan and quota

| ID    | Type | Scenario                           | Steps                                                                | Expected result                                                                                       | Pass/Fail |
| ----- | ---- | ---------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------- |
| FM-42 | H    | Change how often                   | Batches → Plan batches and quota → every 2 hours → Save              | Preview shows tomorrow's batches (with lunch); applies from tomorrow, not today                       |           |
| FM-43 | N    | Shift outside factory hours        | Shift start 07:00, then end 18:00                                    | "Shift start must be 08:00 or later." / "Shift end must be 17:00 or earlier."                         |           |
| FM-44 | N    | End before start                   | Start 15:00, end 09:00                                               | "Shift end must be after shift start."                                                                |           |
| FM-45 | N    | No working day                     | Untick every day                                                     | "Pick at least one working day." Saturday and Sunday can't be picked                                  |           |
| FM-46 | E    | Save the same schedule twice       | Save without changing anything                                       | "Nothing changed: this schedule already applies from …, so nothing was saved."                        |           |
| FM-47 | H    | Set the daily quota                | Quota 128 → Save                                                     | Saved; Batches shows today against the quota                                                          |           |
| FM-48 | N    | Bad quota                          | `0`, `12.5`, `abc`                                                   | "Enter the daily quota as a whole number of pairs, at least 1."                                       |           |
| FM-49 | E    | Very big quota                     | `50001`                                                              | "The daily quota can't be more than 50,000 pairs. Check the number."                                  |           |
| FM-50 | E    | Suggestion with too little history | On a database with under 3 full working days, look at the suggestion | Says a suggestion needs at least 3 working days with every batch finished; you can still type a quota |           |

## 7. Batches: finishing a batch (FM covers only when no QI is present)

| ID    | Type | Scenario                    | Steps                                                           | Expected result                                                                                          | Pass/Fail |
| ----- | ---- | --------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| FM-51 | A    | QI present                  | Mark the QI present today, then try Finish batch on a due batch | Refused: "A Quality Inspector is present today, so they finish the batches."                             |           |
| FM-52 | A    | Attendance not taken        | Before today's attendance is taken, try Finish batch            | "Take today's attendance first. You can finish batches only when it shows no Quality Inspector present." |           |
| FM-53 | H    | QI absent                   | Mark the QI absent, Finish batch: 24 finished, 2 failed         | "Batch N finished."; only pairs and notes are asked (no roll list)                                       |           |
| FM-54 | N    | Failed more than finished   | 10 finished, 12 failed                                          | "Failed inspection can't be more than the pairs finished (10)…"                                          |           |
| FM-55 | N    | Not a whole number          | Finished `abc` or `2.5`                                         | "Enter the pairs finished in Batch N as a whole number, like 24. Enter 0 if none."                       |           |
| FM-56 | E    | Too early                   | Try a batch more than 10 minutes before its end                 | Not open yet: "Batch N can be finished from HH:MM."                                                      |           |
| FM-57 | E    | Correct with a short reason | Correct a finished batch, reason "abc"                          | "Say why you're correcting this batch, at least 5 characters."                                           |           |
| FM-58 | E    | Correct a past day          | Try to correct yesterday's batch                                | "A batch can only be corrected on the same day…"                                                         |           |
| FM-59 | E    | Notices                     | Wait until 10 minutes before a batch ends (QI absent)           | Banner "Batch N ends at HH:MM…", then "Batch N is due. Finish it now."; bell and "(n)" in the tab title  |           |

## 8. Reports

| ID    | Type | Scenario                        | Steps                                           | Expected result                                                                                                                                       | Pass/Fail |
| ----- | ---- | ------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FM-60 | H    | Operations                      | Reports → Operations                            | KPI tiles (Pairs finished, Failed inspection, Of quota on passed pairs, Reject rate), Supplier quality with **Too many defects** column (no Returned) |           |
| FM-61 | H    | Quality                         | Reports → Quality                               | Scanned, Pass, Reject (for salvage), defects by type                                                                                                  |           |
| FM-62 | H    | CSV downloads                   | Download Operations, Production, Suppliers CSVs | Files open; Suppliers CSV has "Rolls with too many defects", no "Rolls returned"                                                                      |           |
| FM-63 | H    | Rolls list                      | Reports → Rolls; filter by status               | Each roll with supplier, shots, Defect %; filter works                                                                                                |           |
| FM-64 | H    | Too many defects is information | Open a demo roll over 10%                       | "This roll has too many defects (…, over 10%)."; "Scanned and taken off stock."; no Send back, Keep or Remove                                         |           |
| FM-65 | H    | Claim sheet                     | On that roll → Claim sheet → print              | Printable sheet with findings; no person named                                                                                                        |           |
| FM-66 | H    | Materials                       | Reports → Materials                             | Per item this week and last week, change, trend, days left; weeks read like "Week 1: Nov. 2"                                                          |           |
| FM-67 | E    | Empty range                     | Pick a range with no data                       | Empty states, no errors or blank page                                                                                                                 |           |
| FM-68 | A    | No per-person data              | Check every report and CSV                      | No constructor named, ranked or scored                                                                                                                |           |

## 9. Rolls end to end (with a constructor)

| ID    | Type | Scenario                         | Steps                                                                                   | Expected result                                                                              | Pass/Fail |
| ----- | ---- | -------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------- |
| FM-69 | H    | Roll leaves stock at Finish roll | Note a leather's on hand. Constructor starts one of its rolls, takes shots, Finish roll | Inventory: on hand −1; the roll reads Scanned; it shows in Reports → Rolls with its Defect % |           |
| FM-70 | E    | Roll put back                    | Constructor starts a roll and puts it back with no shots                                | Back to Not scanned; on hand unchanged                                                       |           |
| FM-71 | E    | Remove a roll being scanned      | FM removes a roll a constructor has open, with a reason                                 | Removed, −1; the constructor's next shot to it is refused (the roll is closed)               |           |
