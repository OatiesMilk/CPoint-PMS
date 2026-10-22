# Camera station setup (Preparation)

One page for setting up the fixed camera where leather pieces are checked before cutting. The
system itself runs on the main PC (Docker). The station only needs a browser that reaches it.

## What the station needs

| Item                          | What to use                                                         | Why                                                             |
| ----------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| A computer with a browser     | An old laptop or a mini PC (Chrome or Edge)                         | Shows the Capture page. The model runs on the main PC, not here |
| A fixed camera                | A USB webcam on a stand, pointing straight down at the table        | The same angle and distance for every piece                     |
| A monitor facing the operator | Any screen, readable from about 2 m                                 | The operator glances up to see the verdict                      |
| A keyboard                    | The station's own keyboard, within reach of the operator            | **Space** captures                                              |
| Four bins                     | The bins you already have, taped or labelled by colour **and** word | Where each piece goes                                           |
| Network                       | The station and the main PC online (Wi-Fi or cable)                 | The station opens the site through the tunnel                   |

Keep the lighting even and the table plain, so the camera sees the leather the same way all day.

## Bins

| Bin colour | Label on the bin | What goes in it                          | Who takes it from there                                |
| ---------- | ---------------- | ---------------------------------------- | ------------------------------------------------------ |
| Green      | **Pass**         | Good pieces                              | On to cutting                                          |
| Orange     | **Fixable**      | Pieces to clean or cut around            | The Repair Station                                     |
| Red        | **Reject**       | Pieces that can't be used for this batch | Salvage                                                |
| Blue       | **Needs review** | Pieces the camera wasn't sure about      | The Quality Inspector, who decides in the Review queue |

Put the word on every bin as well as the colour: some people can't tell orange from red or green.

## One-time setup

1. **Allow the operator.** The Floor Manager opens **Camera → Camera operators** and clicks
   **Allow capturing** for the Shoe Constructor who runs the station. (The System Admin can do the
   same under Users → More actions.) The Quality Inspector and the Floor Manager can always capture.
2. **Open the site on the station.** Use the site's `https://` address from the Cloudflare Tunnel
   (README, "Reach the site with Cloudflare Tunnel"). A plain `http://` address to the main PC
   won't open the camera.
3. **Sign in** as the operator and open **Capture** (`…/camera/capture`). Allow the camera when the
   browser asks. If there are several cameras, pick the fixed one under **Camera**.
4. **Press Floor view.** The page fills the screen with the live camera. The station remembers it:
   next time Capture opens straight in Floor view (press **F11** for full screen).
5. **Test capturing:** with Floor view open, press **Space** once. You should see "Checking…", then a
   verdict.

Use the station PC only for this, so the Capture page keeps the keyboard focus for Space.

## Each piece

1. Place the piece flat under the camera.
2. Press **Space**.
3. Wait for the colour (about a second): the frame and the band at the bottom turn green, orange,
   red or blue, with the word and the section number.
4. Put the piece in the bin of that colour.

The verdict stays on screen until the next capture, so a late glance still shows the right bin.

## When something goes wrong

The band at the bottom says what happened and what to do.

| The band says                                     | What to do                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| "Capture is off. No batch is at Preparation."     | Ask the Floor Manager to start the batch; the screen picks it up within 20 seconds |
| "Not sent: the server didn't answer."             | Check the network, then press **Send again**. Nothing is saved twice               |
| "Another app is using this camera."               | Close the other app, then press **Try again**                                      |
| "The camera only works on a secure address."      | Open the site through its `https://` tunnel address                                |
| "The camera model isn't installed on the server." | Tell whoever looks after the main PC (the model files go in `cv/models/`)          |

Esc leaves Floor view and shows the normal Capture page.
