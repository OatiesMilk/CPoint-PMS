# UAT test cases: System Admin

| Field   | Value                                                                              |
| ------- | ---------------------------------------------------------------------------------- |
| Date    | 2026-11-07                                                                         |
| Role    | System Admin (`admin@cpoint.local`, password `DEMO_USER_PASSWORD` from `.env`)     |
| Build   | `main` at c5b1848 (D-119 merged #41: the Admin has no Camera page; Phase 30F look) |
| Written | Claude                                                                             |

**Before you start:** run `npm run dev` and sign in as the System Admin. Use test accounts and test
defect types you create here, so the demo accounts stay as they are. A few cases need a second
browser (or a private window) signed in as another role.

Type: **H** happy path, **N** negative (wrong input or refused), **E** edge case or limit,
**A** access. Write Pass or Fail and a note in the last column.

## 1. Sign-in, home and access

| ID    | Type | Scenario                      | Steps                                                                                        | Expected result                                                                                                   | Pass/Fail |
| ----- | ---- | ----------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| SA-01 | H    | Sign in                       | Log in as the Admin                                                                          | Lands on Overview (`/admin`). Sidebar: Overview, Users, Settings, API tokens, Audit log, nothing else             |           |
| SA-02 | N    | Wrong password                | Log in with a wrong password                                                                 | "Email or password is incorrect. Check both and try again. After 5 wrong tries the account locks for 15 minutes." |           |
| SA-03 | H    | Overview                      | Look at Overview                                                                             | System health, Users (active accounts by role), Lunch break, Audit log, Camera API tokens. No Camera card         |           |
| SA-04 | A    | Production pages              | Open `/batches`, `/attendance`, `/reports`, `/inventory`, `/floor-manager`                   | Each shows the 403 page                                                                                           |           |
| SA-05 | A    | Camera pages                  | Open `/camera` and `/camera/capture`                                                         | `/camera` is 404 (removed, D-119); Capture is refused                                                             |           |
| SA-06 | A    | Other roles can't reach admin | Signed in as the FM, open `/admin/users`, `/admin/settings`, `/admin/tokens`, `/admin/audit` | 403 page for each                                                                                                 |           |

## 2. Users

| ID    | Type | Scenario                            | Steps                                                                                                                   | Expected result                                                                                                                                                      | Pass/Fail |
| ----- | ---- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| SA-07 | H    | Add a user                          | Users → Add user: name, email `test.qi@cpoint.local`, role Quality Inspector → Save                                     | Listed as Active; a temporary password is shown once                                                                                                                 |           |
| SA-08 | H    | First sign-in                       | Sign in as the new user with the temporary password                                                                     | Sent to choose a new password before any page opens                                                                                                                  |           |
| SA-09 | N    | Missing fields                      | Add user with name, email and role empty                                                                                | Each field says what to enter ("Enter the person's name as colleagues know it.", "Enter the email this person will sign in with.", "Choose a role for this person.") |           |
| SA-10 | N    | Bad email                           | Email `test.qi`                                                                                                         | "Enter the email in full, like name@cpoint.local."                                                                                                                   |           |
| SA-11 | N    | Email already used                  | Add a user with an existing email                                                                                       | "<email> already has an account. Use a different email, or edit that account."                                                                                       |           |
| SA-12 | E    | Short and long values               | Name `A`; name over 80 characters; email over 120 characters                                                            | "at least 2 characters"; "Keep the name under 80 characters."; "Keep the email under 120 characters."                                                                |           |
| SA-13 | H    | Edit a user                         | More actions → Edit: change name and role → Save                                                                        | Saved; new role's sidebar on that user's next page load                                                                                                              |           |
| SA-14 | H    | Reset password                      | More actions → Reset password… on the test user                                                                         | New temporary password shown once; the user must change it at next sign-in                                                                                           |           |
| SA-15 | H    | Unlock                              | Lock the test user (5 wrong passwords), then More actions → Unlock                                                      | They can sign in again right away                                                                                                                                    |           |
| SA-16 | H    | Deactivate and reactivate           | Deactivate… the test user, then Reactivate                                                                              | Inactive: can't sign in, and an open session of theirs ends. Active again after Reactivate                                                                           |           |
| SA-17 | H    | Camera access                       | Add a Shoe Constructor; More actions → Give camera access; sign in as them                                              | Capture opens. After Remove camera access they get the camera-access 403                                                                                             |           |
| SA-18 | E    | Camera access only for constructors | Open More actions on a QI or FM                                                                                         | No Give camera access item                                                                                                                                           |           |
| SA-19 | N    | Own account                         | On your own row: change role, deactivate, reset password                                                                | Refused: "You can't change your own role.", "You can't deactivate your own account.", Reset password disabled ("Use Change password in your user menu…")             |           |
| SA-20 | E    | Last active Admin                   | With only one active Admin, try to deactivate or demote it (from a second Admin, then deactivate that second one first) | "This is the last active System Admin. Make another account a System Admin first."                                                                                   |           |
| SA-21 | E    | Filters and empty list              | Find box with a name that doesn't exist; role and status filters                                                        | "No accounts match these filters" with Clear filters; 15 rows a page                                                                                                 |           |

## 3. Your own password

| ID    | Type | Scenario        | Steps                                                               | Expected result                                                                 | Pass/Fail |
| ----- | ---- | --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------- |
| SA-22 | H    | Change password | User menu → Change password: current, new (10+ characters), confirm | Saved; the new password works at the next sign-in                               |           |
| SA-23 | N    | Too short       | New password of 9 characters                                        | "The new password needs at least 10 characters. A short phrase works well."     |           |
| SA-24 | N    | Don't match     | Confirm differs from new                                            | "The two new passwords don't match. Type the same password in both boxes."      |           |
| SA-25 | N    | Same as current | New = current                                                       | "The new password is the same as the current one. Choose a different password." |           |
| SA-26 | E    | Too long        | New password over 128 characters                                    | "Keep the new password under 128 characters."                                   |           |

## 4. Settings → Thresholds

| ID    | Type | Scenario            | Steps                                                                                   | Expected result                                                                                                    | Pass/Fail |
| ----- | ---- | ------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------- |
| SA-27 | H    | Change found-at     | "A defect counts as found at" 60 → Save, then put 50 back                               | "Saved. New scans use it from now on."                                                                             |           |
| SA-28 | E    | Found-at limits     | 0, 101, `abc`, then 1 and 100                                                           | First three refused: "Enter the found-at value as a percentage from 1 to 100, like 50."; 1 and 100 accepted        |           |
| SA-29 | H    | Return limit        | "Mark a roll Returned to supplier when defects cover more than" 12 → Save, then 10 back | Saved                                                                                                              |           |
| SA-30 | E    | Return limit limits | 0, 101, 10.55                                                                           | "Enter a percentage from 1 to 100, like 10 (one decimal at most)."                                                 |           |
| SA-31 | H    | Early-model notice  | Turn the notice off, then on                                                            | Toasts "The early-model notice is off." / "Capture now says the model is an early one."; Capture shows or hides it |           |

## 5. Settings → Defect types

| ID    | Type | Scenario                | Steps                                                                         | Expected result                                                                                                                                                     | Pass/Fail |
| ----- | ---- | ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| SA-32 | H    | Add a type              | Add: class key `uat-stain`, label "UAT stain", When found Not accepted → Save | Listed; Counts toward the roll shows its rule                                                                                                                       |           |
| SA-33 | N    | Missing fields          | Add with key, label and When found empty                                      | "Enter the class key exactly as the camera model sends it…", "Enter a label people will read, e.g. Scratch.", "Choose whether a found … is Usable or Not accepted." |           |
| SA-34 | N    | Bad class key           | Key `UAT Stain!`                                                              | "…up to 40 lower-case letters, numbers, - or _."                                                                                                                    |           |
| SA-35 | N    | Duplicate key           | Add another type with key `uat-stain`                                         | "That's already used. Choose another."                                                                                                                              |           |
| SA-36 | E    | Key can't change        | Edit UAT stain                                                                | Class key is read-only ("The camera sends this key, so it can't change. Add a new type instead.")                                                                   |           |
| SA-37 | H    | Length limit            | Edit cut: "Rejected from (inches long)" 3                                     | Row reads "Usable under 3 in, Not accepted from 3 in"                                                                                                               |           |
| SA-38 | E    | Length and share limits | Length 0 or 101; flat share 0 or 101                                          | "Enter the length in inches from 0.1 to 100…" / "Enter the flat share as a percentage from 0.1 to 100…"; blank is allowed for both                                  |           |
| SA-39 | E    | Sort order              | Order −1, 1000, `abc`                                                         | "can't be below 0", "can't be above 999", "Enter the sort order as a whole number, like 10."                                                                        |           |
| SA-40 | H    | Deactivate a type       | Deactivate UAT stain                                                          | "UAT stain deactivated."; it stays on old records but leaves pickers. Reactivate: "…is active again."                                                               |           |

## 6. Settings → Suppliers

| ID    | Type | Scenario          | Steps                                                                         | Expected result                                                                                          | Pass/Fail |
| ----- | ---- | ----------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| SA-41 | H    | Add a supplier    | Add: name "UAT Leather Co", code blank, contact, phone `0917 123 4567` → Save | Saved; code filled from the initials (like ULC)                                                          |           |
| SA-42 | N    | Bad name          | Name empty, `A`, over 80 characters                                           | "Enter the supplier's name.", "(at least 2 characters)", "Keep the supplier's name under 80 characters." |           |
| SA-43 | N    | Bad code          | Code `m`, `1AB`, `TOOLONG1`                                                   | "Enter a short code of 2 to 6 capital letters or digits, starting with a letter, like MLT."              |           |
| SA-44 | N    | Duplicate code    | Use an existing code (MLT)                                                    | "That's already used. Choose another."                                                                   |           |
| SA-45 | N    | Bad phone         | Phone `call me`                                                               | "The phone number can only have digits, spaces, +, - or brackets, like 0917 123 4567."                   |           |
| SA-46 | E    | Inactive supplier | Deactivate UAT Leather Co; as the FM, add a leather item                      | It isn't in the supplier list                                                                            |           |

## 7. Settings → Lunch break

| ID    | Type | Scenario                  | Steps                                                      | Expected result                                                                                                        | Pass/Fail |
| ----- | ---- | ------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------- |
| SA-47 | H    | Change lunch              | Lunch 12:00 to 13:00 → Save                                | "Lunch 12:00 to 13:00 saved. It applies from <tomorrow>."; listed in Lunch break history. Today's batches don't change |           |
| SA-48 | H    | No lunch                  | Choose No lunch break → Save; then put 11:00 to 12:00 back | "No lunch break from <tomorrow>."                                                                                      |           |
| SA-49 | N    | End before start          | 13:00 to 12:00                                             | "Lunch must end after it starts."                                                                                      |           |
| SA-50 | N    | Outside the shift         | 07:00 to 08:00                                             | "Lunch must be inside the shift (… to …)."                                                                             |           |
| SA-51 | E    | Save the same lunch again | Save without changing it                                   | "Nothing changed: this lunch break already applies from …, so nothing was saved."                                      |           |

## 8. API tokens

| ID    | Type | Scenario        | Steps                                                      | Expected result                                                                                                                  | Pass/Fail |
| ----- | ---- | --------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------- |
| SA-52 | H    | New token       | API tokens → New device token: "UAT phone camera" → Create | The full token (`cpt_…`) shows once with a copy button; the list shows only its start, Last used Never, Active                   |           |
| SA-53 | N    | Bad name        | Name empty, `ab`, over 60 characters                       | "Enter a name for the device…", "at least 3 characters…", "Keep the device name under 60 characters."                            |           |
| SA-54 | H    | Revoke          | Revoke… → Revoke token                                     | Status Revoked; a scan sent with it is refused ("This device token is invalid, revoked or expired. Ask an admin for a new one.") |           |
| SA-55 | E    | Cancel a revoke | Revoke…, then Keep it                                      | Stays Active                                                                                                                     |           |

## 9. Audit log

| ID    | Type | Scenario             | Steps                                               | Expected result                                                                                                                         | Pass/Fail |
| ----- | ---- | -------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| SA-56 | H    | Changes are recorded | After the cases above, open Audit log               | Newest first: the user, settings, supplier, lunch and token changes, and sign-ins, each with who and when; a row shows Before and After |           |
| SA-57 | H    | Filters              | Filter by person, Action, Record type and From date | Only matching rows; Clear filters resets                                                                                                |           |
| SA-58 | E    | No matches           | Record id that doesn't exist                        | "No entries match these filters"                                                                                                        |           |
| SA-59 | A    | Read-only            | Look for edit or delete on any row                  | None ("Every change and sign-in, newest first. Read-only.")                                                                             |           |
| SA-60 | A    | No secrets           | Open a password reset and a token row               | No password or full token in the log                                                                                                    |           |
