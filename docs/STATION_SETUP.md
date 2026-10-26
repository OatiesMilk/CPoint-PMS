# Capture setup (before cutting)

One page for setting up where leather rolls are checked before cutting (Phase 26, D-095). The
system runs on the main PC (Docker). Each Shoe Constructor with camera access captures on their
own phone; a PC with a webcam and Floor view still works the same way.

## What a capture spot needs

| Item                     | What to use                                                         | Why                                                             |
| ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| A phone with a browser   | The constructor's own phone (Chrome on Android, Safari on iPhone)   | Shows the Capture page. The model runs on the main PC, not here |
| A stand at a fixed place | A phone stand over the table, pointing straight down                | The same angle and distance for every shot (C-24)               |
| Two bins                 | The bins you already have, taped or labelled by colour **and** word | Where each part of the roll goes                                |
| Network                  | The phone and the main PC online (Wi-Fi)                            | The phone opens the site through the tunnel                     |
| Optional: a station PC   | A PC with a USB webcam, a monitor facing the operator and Space     | Floor view: the verdict readable from about 2 m                 |

Keep the lighting even and the table plain, so the camera sees the leather the same way all day.

## Bins

| Bin colour | Label on the bin | What goes in it                           | Who takes it from there |
| ---------- | ---------------- | ----------------------------------------- | ----------------------- |
| Green      | **Pass**         | Parts with no defect, or only usable ones | On to cutting           |
| Red        | **Reject**       | Parts with a defect that isn't accepted   | Set aside for salvage   |

Every shot is Pass or Reject, and the camera's verdict is final (D-093): nobody changes it
afterwards. A shot with a defect class the system doesn't know yet is a Reject too.

Put the word on every bin as well as the colour: some people can't tell red from green.

## One-time setup

1. **Give camera access.** The System Admin opens **Users**, finds the Shoe Constructor and picks
   **More actions → Give camera access**. Only the System Admin can; the Quality Inspector and the
   Floor Manager don't capture.
2. **Open the site on the phone.** Use the site's `https://` address from the Cloudflare Tunnel
   (README, "Reach the site with Cloudflare Tunnel"). A plain `http://` address to the main PC
   won't open the camera. Add it to the home screen to open it like an app.
3. **Sign in.** A constructor lands straight on **Capture**, their only page. Allow the camera when
   the phone asks. If there are several cameras, pick the back one under **Camera**.
4. **Put the phone on the stand** at the fixed spot, the Capture button within reach.

## Each roll

Each roll is added first by the Floor Manager in **Inventory**, on its leather item, with its
area; its code is on the list, like `LR-MLT-001` (write it on the roll's label).

1. **Pick the roll.** Under **Scan a roll**, find the roll on the table (the Find box takes its
   code, tag, item or supplier) and press **Scan this roll**. No roll on the list? Ask the Floor
   Manager to add it in Inventory.
2. Check the large line above the camera: "Roll LR-MLT-001 · Black cowhide · 24.5 sq ft · 0
   shots". That is where the next shot goes. With several rolls being scanned, choose the right
   one under **Roll**; **Scan another roll** picks the next.
3. **Capture** (or Space on a keyboard). Wait for the colour, about a second: green Pass or red
   Reject, with each defect marked Usable or Not accepted. Put that part in the bin of its colour.
4. Move the roll on, edge to edge, and capture again until all of it is in.
5. **Finish roll.** The app asks "Is all of LR-MLT-001 scanned?" with the number of shots. A
   finished roll can't take more shots.

Picked the wrong roll? While it has no shots, **Put roll back** at Capture: it waits on the list
again. A roll with shots is removed only by the Floor Manager, with a reason. Nothing is deleted.

When a scanned roll is all used up, someone on the line tells the Quality Inspector, who ticks it
**Fully used** when finishing the batch. Only then does it leave the leather stock.

The Floor Manager reads every roll, its shots and its rejects in **Reports → Rolls**.

## Floor view (a station PC)

On a PC, **Floor view** fills the screen with the live camera and shows the chosen roll. Press
**Space** to capture; the frame and the band turn green or red with the shot number, and stay until
the next capture. The PC remembers Floor view (press **F11** for full screen). **Esc** leaves it;
choose or pick a roll on the normal page first.

## When something goes wrong

The page (or the band in Floor view) says what happened and what to do.

| The page says                                                   | What to do                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| "Ask the System Admin for camera access."                       | The System Admin gives access under Users → More actions            |
| "Choose the roll this shot belongs to."                         | Pick the roll under **Roll**, or **Scan another roll**              |
| "LR-… isn't being scanned any more, so this shot wasn't saved." | Choose another roll, or scan a new one                              |
| "No rolls are waiting to be scanned."                           | Ask the Floor Manager to add the rolls in Inventory                 |
| "Not sent: the server didn't answer."                           | Check the Wi-Fi, then press **Send again**. Nothing is saved twice  |
| "Another app is using this camera."                             | Close the other app, then press **Try again**                       |
| "The camera only works on a secure address."                    | Open the site through its `https://` tunnel address                 |
| "The camera model isn't installed on the server."               | Tell whoever looks after the main PC (the files go in `cv/models/`) |
