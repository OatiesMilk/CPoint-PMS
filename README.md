# CPoint Product Monitoring System

Product Monitoring System for **CPoint Shoe Store Corporation**'s leather-shoe production line
(school shoes and topsiders). It replaces paper tally sheets with one shared view of the line:

- **Batches:** each one is a leather roll. A batch moves through **Preparation → Upper Making →
  Sole-ing → Finishing**, and the system records who moved it and when.
- **Camera checkpoint:** a computer-vision camera at Preparation checks each leather section
  before it is cut and calls it **Pass / Rework / Reject**. Unknown defects go to the Quality
  Inspector to decide. A person can override the camera's automatic calls.
- **Rework and salvage:** reworked sections go to the repair station board. Rejected leather is
  kept as salvage for another batch rather than thrown away.
- **Inventory:** leather rolls and supplies are tracked through an audited ledger, with low-stock
  alerts.
- **Procurement:** Shoe Constructors request materials when they run low. Leather rolls only by
  the constructor the Floor Manager or Admin allows (usually the one who orders leather). The
  Floor Manager approves or rejects each item of a request, guided by the stock on hand, records
  the order with a supplier and an expected date, then records each delivery with a photo or PDF
  of the receipt. Only what actually arrived is added to inventory, and a late order is flagged.
- **Reports:** daily totals, defects by type, how often people kept the camera's call, and time
  per stage (the bottleneck), with CSV for Excel. Nothing is ranked per person.

![Floor Manager home with a demo week loaded](docs/screenshots/floor-manager-home.png)

> BS-IT capstone project. Progress is in [`docs/STATUS.md`](docs/STATUS.md), the plan in
> [`docs/ROADMAP.md`](docs/ROADMAP.md), and every design decision with its reason in
> [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Contents

- [Quick start: demo / factory machine](#quick-start-demo--factory-machine) (Docker only)
- [Demo script](#demo-script) (10 minutes, per role)
- [Architecture](#architecture) and [data model](#data-model)
- [Quick start: development](#quick-start-development)
- [Environment](#environment), [Camera and simulator](#camera-and-simulator),
  [Capture from the website](#capture-from-the-website), [Scripts](#scripts)
- [Keeping the folder small](#keeping-the-folder-small)

## Tech stack

Next.js 16 (App Router, TypeScript strict) · PostgreSQL 18 · Prisma 7 · Tailwind CSS 4 +
shadcn/ui (Radix) · Zod · Recharts · Vitest + Playwright (+ axe) · Docker (one compose file, two
services) · GitHub Actions CI.

## Quick start: demo / factory machine

Runs the whole system in Docker. The machine needs only **Docker Desktop** (or Docker Engine +
Compose v2) and this folder. No Node.js needed.

1. Create the settings file:

   ```bash
   cp .env.example .env
   ```

   (Windows PowerShell: `Copy-Item .env.example .env`.)

2. Open `.env` in a text editor and fill in:

   | Line                        | Put                                                                                       |
   | --------------------------- | ----------------------------------------------------------------------------------------- |
   | `AUTH_SECRET=`              | A long random string. `openssl rand -base64 32` makes one, or type 40+ random characters. |
   | `BOOTSTRAP_ADMIN_PASSWORD=` | 12+ characters. Used only when no System Admin exists yet (demo off).                     |
   | `DEMO_USER_PASSWORD=`       | 8+ characters. The password for all four demo accounts.                                   |
   | `SEED_DEMO_WEEK=false`      | Change to `true` for a panel demo: a past week of production is created on first start.   |

   For real use, also change `POSTGRES_PASSWORD` and set `SEED_DEMO_USERS=false`.

3. Build and start:

   ```bash
   docker compose up --build -d
   ```

   The first build takes a few minutes. On start, the app container applies database migrations,
   seeds the reference data and accounts, then starts the server.

4. Open <http://localhost:3000> (or `http://<this-machine's-LAN-IP>:3000` from another PC on the
   network) and sign in with one of the demo accounts below.

   With `SEED_DEMO_WEEK=true`, the demo week is written in the background during the first
   minute. Refresh the home page after about 30 seconds. It runs only while the database has no
   batches, so restarts never add a second week.

The Capture page (scanning from the browser) also needs the model files in `cv/models/` and,
for phones, a certificate in `certs/`: see [Capture from the website](#capture-from-the-website).

`docker compose ps` shows both services as `healthy` once ready, and
`docker compose logs -f app` shows the logs. Stop with `docker compose down`. Add `-v` only to
**delete all data** (both volumes).

| Container | What it is                                 | Data volume             |
| --------- | ------------------------------------------ | ----------------------- |
| `app`     | Next.js server (non-root), runs migrations | `uploads` (scan images) |
| `db`      | PostgreSQL 18                              | `pgdata`                |

**Demo accounts** (created on start when `SEED_DEMO_USERS=true`). All four use
`DEMO_USER_PASSWORD`, including `admin@cpoint.local`. `BOOTSTRAP_ADMIN_PASSWORD` is used only
when there is no admin account yet, as on a real install with demo users off.

| Role              | Email                      | Lands on             | Does                                                                             |
| ----------------- | -------------------------- | -------------------- | -------------------------------------------------------------------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     | Batches, stages, rework, salvage, inventory, purchase request decisions, reports |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` | Decides flagged scans (review queue), overrides, rework, quality reports         |
| System Admin      | `admin@cpoint.local`       | `/admin`             | Users, thresholds, defect types, tokens, audit, who can request materials        |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       | Sends purchase requests (the demo one may also request leather rolls)            |

## Demo script

About twelve minutes with the demo week loaded (`SEED_DEMO_WEEK=true`). Use two browser windows
(or one normal and one private) to show two roles side by side.

### 1. Floor Manager (4 min)

1. **Home** (`manager@cpoint.local`): batches by stage, with **Upper Making** marked as the
   longest wait. Also today's inspection split, open repairs, low stock (Contact cement), the
   daily summary, and **purchase requests** waiting for a decision (one urgent).
2. **Batches → B-2026-0011:** the stage stepper and timeline (who moved it, when, and how long
   each stage took). The **Yield** card shows usable sections = passed + repaired, and how many
   went to the repair station and to salvage.

   ![Batch detail](docs/screenshots/batch-detail.png)

3. **New batch:** register a roll (it can be taken from inventory), then **Start production**.
   The batch is now at Preparation, so the camera's scans go to it.
4. **Camera:** shows which batch is receiving scans. To show live scans, run the simulator from a
   development checkout (see [Camera and simulator](#camera-and-simulator)). They appear on the
   home page within seconds.
5. **Rework board:** Waiting → Being repaired → Repaired. Each step is one click, with undo.
6. **Salvage:** rejected sections are kept. **Use in batch** assigns one to another open batch;
   **Discard** needs a reason.
7. **Inventory → Contact cement:** the ledger. Stock changes only through recorded movements
   (deliveries, use, counts), and undo is a reversal entry, never an edit.
8. **Reports:** the scans-per-day chart, defects by type, camera call vs final verdict, and time
   in each stage, where Upper Making is the **bottleneck**. Download **Daily CSV** and open it in
   Excel.

### 2. Quality Inspector (3 min)

1. **Review queue** (`inspector@cpoint.local`): two scans with an unknown defect class
   ("scratch") wait for a person. Decide one: **Pass / Rework / Reject**.

   ![Review queue](docs/screenshots/review-queue.png)

   Only the Quality Inspector decides these (D-028). The Floor Manager sees the same queue, but
   read-only: "Waiting for a Quality Inspector".

2. Open one of **today's automatic Rework and Reject** calls. The image shows the camera's box
   and confidence. **Override decision…** asks for a reason, and the scan then shows both calls
   (the camera's is struck through).

   ![Scan detail](docs/screenshots/scan-detail.png)

3. **Reports → Camera call vs final verdict:** the off-diagonal numbers are overrides. A high
   agreement (about 95% in the demo week) means the thresholds suit the line.

### 3. Shoe Constructor → Floor Manager: a material request (2 min)

1. **Constructor home** (`constructor@cpoint.local`): **My material requests**. The constructor's
   side is called **Material requests** everywhere; the Floor Manager and Admin see the same
   module as **Procurement**. **New material request**: pick **Contact cement** (the picker shows
   it's low, and that MR-… already asks for it), 2 cans, set **Needed by** to tomorrow (the form
   says the Floor Manager will see it as **High**), add a remark if it helps, and send it. Try
   sending it empty first: each field says exactly what is missing. Requests can't be edited
   afterwards: cancel and resend. Every constructor can request supplies; **leather rolls** only
   once the Floor Manager or Admin allows it (the demo constructor is allowed).
2. **Floor Manager → Procurement:** the **Pending** tab, the soonest needed-by date first, each
   with its urgency (**High** within 3 working days or overdue, **Medium** within 7, **Low**
   after that) and how long it has waited. Filter by **Urgency**. Open the request: the stock
   **when asked** sits next to the stock **now**, and the constructor's remark is the first one
   under Remarks.

   ![A pending purchase request](docs/screenshots/purchase-request.png)

3. **Decide each item.** Every item has **Approve** and **Reject**, with the stock now and when it
   was requested beside it. An item that is still well stocked (more than twice its reorder
   level) shows **Still in stock** and starts on Reject with the reason filled in; a low one
   starts on Approve. These are suggestions: change any of them, then **Save decisions**.
   **Reject whole request…** turns everything down with one reason. The constructor sees
   "1 of 2 items approved" and the reason on each rejected item.
4. **Order it.** On the approved request, **Mark as ordered…**: pick the supplier, type the
   reference number and the date they expect to deliver. Nothing is sent to the supplier; this is
   the record. The **Ordered** tab lists it with the expected date, and the contact cement order
   from Tuesday shows **Delivery late**, also on the home card.
5. **Record a delivery.** Open the **Partly received** request: two of four rolls came, with a
   photo and a PDF of the receipt under Deliveries. **Record delivery…** for the rest: each
   quantity starts at what is still to come, a proof file is required, and saving adds exactly
   that to stock (Inventory shows "Delivery for MR-…"). If the rest won't come, **Close short…**
   with a reason instead.
6. **When it goes wrong.** An ordered request can be cancelled with a reason until something
   arrives (see the cancelled soles order). On a rejected or cancelled request the requester
   gets **Copy to a new request**: the form opens prefilled, rejected items unticked with their
   reasons. The Floor Manager can also raise a request themselves, from **New purchase request**
   or **Request** on a low item in Inventory.
7. The **timeline** and **remarks** on the request show who did what and when. The **Leather roll
   requesters** tab chooses who may also request leather rolls. Stop it for the demo
   constructor: on their next try, leather rolls are greyed out in the form, without signing
   them out.

### 4. System Admin (2 min)

1. **Settings → Thresholds** (`admin@cpoint.local`): Reject at 90% or above, Rework from 60%,
   with a preview of what the camera will decide. Changes apply to new scans only. Old scans keep
   the thresholds they were decided with.

   ![Settings](docs/screenshots/admin-settings.png)

2. **Settings → Defect types:** "scratch" is listed as an **unknown class** the camera has sent.
   Adding it as a defect type is a data change, not a code change.
3. **Users:** add a person, who gets a one-time temporary password. **API tokens:** each camera
   machine has its own token, which can only send scans.
4. **Audit log:** every change above, plus every sign-in, with before/after values.

### Talking points

- **The decision rule (D-011):** the highest confidence among known defects decides. ≥ 90% →
  Reject, 60–89% → Rework, below 60% → Pass. An unknown class always goes to a person. The
  thresholds are data the admin can change.
- **People stay in charge:** the camera's calls can be overridden with a reason, and the reports
  show how often that happens. Flagged scans are the Quality Inspector's to decide (D-028).
- **Requests close the loop with stock:** an approved request, once received, posts the delivery
  into the inventory ledger. Nobody orders twice: Inventory marks items already requested.
- **No per-person rankings or scores** anywhere (from the client survey). Reports aggregate by
  day, stage and defect only.
- **Nothing is deleted:** stock moves through a ledger, rejected leather becomes salvage, and
  every change is in the audit log.

![Reports](docs/screenshots/reports.png)

## Architecture

```mermaid
flowchart LR
  subgraph Clients
    B["Browser<br/>(FM, QI, Admin, Constructor)"]
    C["Camera device<br/>(YOLO / simulator)"]
  end

  subgraph app["Docker service: app (Next.js 16)"]
    P["proxy.ts<br/>optimistic session check"]
    V["Pages + server actions<br/>(View)"]
    R["api/v1/**/route.ts<br/>(one-line routes)"]
    CT["controllers<br/>parse · validate · shape"]
    S["services<br/>business rules, guards,<br/>transactions + audit"]
    M["models<br/>(only layer that imports Prisma)"]
  end

  DB[("Docker service: db<br/>PostgreSQL 18<br/>volume: pgdata")]
  U[["volume: uploads<br/>scan images"]]

  B -->|session cookie| P --> V
  B --> R
  C -->|"POST /api/v1/scans<br/>device token"| R
  V --> S
  R --> CT --> S --> M --> DB
  S --> U
```

- **MVC layering, enforced by ESLint:** a page that imports a model, or a component that imports
  server code, fails `npm run lint`.
- **Access:**
  - Every page calls `requireRole`/`requirePermission` and every API route calls
    `requireApiPermission`. The proxy is only a fast first check.
  - Permissions are a role × permission matrix in `src/server/policies`.
- **Every mutation** runs in one database transaction and writes an audit row in that same
  transaction.

## Data model

The core tables (`prisma/schema.prisma` has all of them, with indexes). Ids are UUIDv7.

```mermaid
erDiagram
  User ||--o{ Batch : registers
  User ||--o{ BatchStageLog : moves
  User ||--o{ InventoryMovement : records
  User ||--o{ ApiToken : creates
  User ||--o{ AuditLog : "acts in"
  ShoeType ||--o{ Batch : "is made as"
  Supplier |o--o{ Batch : supplies
  Batch ||--o{ BatchStageLog : "passes through"
  Batch ||--o{ Scan : "is checked by"
  ApiToken |o--o{ Scan : sends
  Scan ||--o{ Detection : contains
  DefectType |o--o{ Detection : classifies
  Scan ||--o{ ReworkTicket : "opens (Rework)"
  Scan ||--o{ SalvageItem : "keeps (Reject)"
  Batch ||--o{ SalvageItem : "rejected from"
  Batch |o--o{ SalvageItem : "reused in"
  InventoryItem ||--o{ InventoryMovement : "ledger of"
  Batch |o--o{ InventoryMovement : "uses stock"
  Batch |o--o{ CvSettings : "camera points at"
  User ||--o{ PurchaseRequest : "requests"
  PurchaseRequest ||--|{ PurchaseRequestLine : "asks for"
  InventoryItem |o--o{ PurchaseRequestLine : "is asked for"
  PurchaseRequestLine |o--o| InventoryMovement : "received as"
  PurchaseRequest ||--o{ PurchaseRequestEvent : "timeline"
  PurchaseRequest ||--o{ PurchaseRequestRemark : "remarks"

  Batch {
    string code "B-2026-0001"
    string rollCode
    enum currentStage "PREPARATION..FINISHING"
    enum status "PLANNED, IN_PROGRESS, COMPLETED, CANCELLED"
  }
  Scan {
    int sequence "section number in the batch"
    enum aiVerdict "PASS, REWORK, REJECT, NEEDS_REVIEW"
    enum finalVerdict "null while pending review"
    bool isOverride
    json thresholdsSnapshot "thresholds used"
  }
  Detection {
    string rawClassKey "what the model sent"
    bool isUnknownClass
    float confidence
    float x_y_width_height "box, 0-1"
  }
  InventoryItem {
    string sku
    decimal quantityOnHand "changes only via movements"
    decimal reorderLevel
  }
  PurchaseRequest {
    string code "MR-2026-0001"
    enum status "PENDING, APPROVED, REJECTED, CANCELLED, RECEIVED"
    date neededBy "required; urgency is worked out from it"
    string rejectionReason
  }
  PurchaseRequestLine {
    string itemName
    enum category "leather rolls need the OK"
    decimal quantity
    decimal onHandAtRequest "snapshot"
  }
  InventoryMovement {
    enum type "IN, OUT, ADJUST"
    decimal quantityDelta
    string reason
  }
  CvSettings {
    float rejectAtOrAbove "0.9"
    float reworkAtOrAbove "0.6"
  }
```

## Quick start: development

Use this setup when working on the code: Next.js runs on your machine with hot reload, and
PostgreSQL runs in Docker. Run commands one at a time and continue only when each succeeds.

### 1. Check the prerequisites

Install Node.js **22.12 or newer** (24 LTS recommended) and Docker Desktop. Open Docker Desktop
and wait until its engine is running. In a terminal, check:

```cmd
node --version
npm --version
docker --version
docker compose version
```

If a command is not recognized, install the corresponding tool or check its PATH, then reopen
the terminal. Use the same Node.js LTS version across the team where possible.

### 2. Open the repository folder

If you have not cloned the repository yet:

```cmd
cd /d C:\dev
git clone https://github.com/OatiesMilk/CPoint-PMS.git
cd CPoint-PMS
```

Clone it into a folder that OneDrive, Dropbox or Google Drive doesn't sync, such as `C:\dev`
(make it first with `mkdir C:\dev`). The installed tools add about 90,000 files; see [Keeping the
folder small](#keeping-the-folder-small).

If you already have it, open a terminal in that folder. For example, in Windows Command Prompt
(replace the path with your own):

```cmd
cd /d C:\path\to\CPoint-PMS
```

### 3. Create and configure `.env`

On a new checkout, copy the settings template. In **Windows Command Prompt**:

```cmd
copy .env.example .env
notepad .env
```

In **PowerShell**, use `Copy-Item .env.example .env`; on **macOS/Linux**, use
`cp .env.example .env`. If `.env` already exists, edit it instead of overwriting it.

Generate a secret with Node.js (works in Command Prompt, PowerShell and macOS/Linux terminals):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the generated value after `AUTH_SECRET=` in `.env`. Fill in these settings before starting
Docker or the app:

| Setting                    | Value for local development                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| `AUTH_SECRET`              | The generated random secret; at least 32 characters.                           |
| `BOOTSTRAP_ADMIN_PASSWORD` | Your chosen password, at least 12 characters.                                  |
| `DEMO_USER_PASSWORD`       | Your chosen password, at least 8 characters; used by all four demo accounts.   |
| `SEED_DEMO_USERS`          | `true` to create the demo accounts.                                            |
| `SEED_DEMO_WEEK`           | `true` for sample production data, or `false` for an empty production dataset. |

Use actual values, not placeholder text, and save the file. Keep the database values from
`.env.example` for the default local setup. Each teammate should create their own `.env`; keep
secrets out of Git and shared terminal output.

### 4. Install dependencies and start the database

Run these from the repository root:

```bash
npm ci
npm run db:up
npm run db:deploy
```

`npm ci` installs the versions in `package-lock.json` and generates the Prisma client.
`db:up` starts PostgreSQL; `db:deploy` applies the committed database migrations. If the database
is still starting when migration fails, check `docker compose ps`, wait for `db` to be healthy,
and retry `npm run db:deploy`.

### 5. Start the app and sign in

```bash
npm run dev
```

Leave this terminal running and open <http://localhost:3000>. The app seeds reference data and
demo accounts during startup. Sign in with `manager@cpoint.local` and the `DEMO_USER_PASSWORD`
you saved in `.env`. The other accounts are `inspector@cpoint.local`, `admin@cpoint.local`, and
`constructor@cpoint.local`; all use that same demo password.

With `SEED_DEMO_WEEK=true`, sample production data loads in the background on first startup.
Refresh after about a minute. It only seeds when there are no batches. Alternatively, run
`npm run demo:seed` in a second terminal after startup.

### 6. The camera (optional)

To scan leather from the browser, follow [Capture from the website](#capture-from-the-website):
the model files, the defect types, and (to use a phone) an HTTPS certificate. Without them the
rest of the system works, and `npm run cv:simulate` sends test scans ([Camera and
simulator](#camera-and-simulator)).

### Troubleshooting and stopping

- **`Invalid environment variables ... AUTH_SECRET`:** `.env` must contain a real secret of at
  least 32 characters. Generate it with the Node.js command above, replace the `AUTH_SECRET=`
  value, and save. Stop the app with **Ctrl+C**, then run `npm run dev` again. A `Ready` message
  or a working login page does not mean startup seeding succeeded; check for bootstrap errors.
- **Other invalid environment variables:** check the named setting against `.env.example` and
  the minimum password lengths above, save, and restart the app.
- **Docker connection error:** open Docker Desktop and wait for the engine, then retry
  `npm run db:up`.
- **Database connection error:** check `docker compose ps` and `docker compose logs db`, confirm
  the database is healthy, and check that `DATABASE_URL` matches the PostgreSQL settings.
- **Port 5432 is already occupied:** change `DB_PORT` in `.env` and the port in `DATABASE_URL`
  to the same free port, then run `npm run db:up` again.

Stop the app with **Ctrl+C**. Stop the database with `npm run db:down`; its data stays in the
Docker volume. On later runs, use `npm run db:up` followed by `npm run dev`. After pulling new
changes, run `npm ci` if dependencies changed and `npm run db:deploy` for new migrations before
starting the app.

## Environment

`.env.example` lists every variable with a comment. These need a value:

| Variable                   | What to put                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_SECRET`              | A random secret that signs sessions: `openssl rand -base64 32`. One per machine.                                                                                                           |
| `BOOTSTRAP_ADMIN_PASSWORD` | 12+ characters. Creates the first System Admin (`BOOTSTRAP_ADMIN_EMAIL`) if no active admin exists. With demo users on, `admin@cpoint.local` already exists and uses `DEMO_USER_PASSWORD`. |
| `DEMO_USER_PASSWORD`       | 8+ characters. Password for the demo accounts (when `SEED_DEMO_USERS=true`).                                                                                                               |
| `SEED_DEMO_WEEK`           | `true` to create a past week of production on first start (panel demo). Default off.                                                                                                       |

On every start the app makes sure the reference data exists: shoe types, defect types, CV
thresholds 90% / 60%, and a sample supplier. It never overwrites values an admin has changed.
With demo users on, it also adds five demo inventory items the first time.
`npm run db:seed` runs the same steps by hand.

**The demo week** (`SEED_DEMO_WEEK=true` or `npm run demo:seed`) replays the last six working
days through the real services:

- 14 batches across all stages, with realistic stage times (Upper Making is the slowest);
- about 290 scans with images;
- overrides, repairs, salvage, deliveries and stock use, plus two scans left for review.

It uses a fixed random seed, so it shows the same shape every time. It never runs on a database
that already has batches.

**Sign-in rules:**

- 5 wrong passwords lock an account for 15 minutes.
- Sessions last 12 hours (one shift).
- A deactivated user is signed out on their next click.
- Signing out ends the session on the server.
- Every sign-in, failure and sign-out is in the audit log.

**Accounts:** the System Admin adds people under **Users**. Each new account and each password
reset gets a temporary password that is shown once, and the person chooses their own at first
sign-in.

## Camera and simulator

The Preparation camera (later the YOLO service on a phone, webcam or dedicated camera) sends each
capture to `POST /api/v1/scans` with a **device token** (contract in [`docs/API.md`](docs/API.md)).
Without a camera, the simulator sends realistic scans through the same API from a development
checkout:

```bash
npm run cv:token -- --name "Simulator"   # prints a token once; put it in .env as CV_DEVICE_TOKEN
# start a batch (Batches → New batch → Start production), then:
npm run cv:simulate -- --count 20 --interval 3
```

The simulator can also point at the Docker stack (`CV_BASE_URL=http://localhost:3000`). Create the
token there under **Admin → API tokens**.

Scans go to the batch chosen on the **Camera** page, or to the batch that has been at Preparation
the longest. They show up live on the Floor Manager and Quality Inspector homes.

The real model runs in the **camera station**, a Python process in [`cv/`](cv/README.md) on the
camera machine (outside Docker, D-048). With a device token in `cv/.env`, `python -m cpoint_cv
run webcam` captures one section per Space press, runs the YOLO model and sends the scan;
`run folder <dir>` replays photos for a demo without a camera, and `doctor` checks the setup.
Scans that can't be sent wait on disk and go out later, in order (D-050, D-051). For yolo-v1, add
the `crease` and `scratch` defect types in Settings first (D-052, [`cv/README.md`](cv/README.md)).
The model file lives in `cv/models/` and is never committed (D-049); see
[`cv/MODEL_CARD.md`](cv/MODEL_CARD.md).

## Capture from the website

The **Capture** page (Quality → Capture, for the Quality Inspector and the Floor Manager) does the
camera station's job in the browser: it shows the live camera, **Capture** (or Space) sends the
frame on screen, and the app runs the model itself and shows its verdict. No second application
(Phase 18, D-064 to D-067). The Python station stays as the option for a dedicated camera.

Every teammate does steps 1–2 once on their own machine. Steps 3–5 are only for opening the page
from **another device** (a phone or a second PC); the machine that runs the app can skip them and
use `http://localhost:3000/camera/capture`.

### 1. Get the model files

The model is never in Git (D-049). The app needs two files in `cv/models/`:
`yolo-v1.onnx` and `yolo-v1.json`. Either:

- **ask Dylan for both files** (shared privately, not through GitHub) and copy them into
  `cv/models/`; or
- **make them yourself** from `yolo-v1.pt`, once the station is set up ([`cv/README.md`](cv/README.md),
  "Set up"):

  ```bash
  cd cv
  .venv/Scripts/python -m pip install -r requirements-export.txt
  .venv/Scripts/python -m cpoint_cv export-onnx
  ```

Restart the app after the files change. Without them the Capture page says "The camera model
isn't installed on the server" and Capture stays off; everything else works.

### 2. Set the defect types for the model

The model reports `crease`, `cut`, `hole` and `scratch`. A fresh database knows `cut`, `hole`,
`abrasion` and `dirt`, so `crease` and `scratch` would go to the review queue as unknown. Either
run `npm run demo:reset -- --yes` (**it deletes test data**: batches, scans and requests; the
accounts stay) or add the two types by hand under Admin → Settings → Defect types
([`cv/README.md`](cv/README.md), "Defect types for yolo-v1").

Now the page works on this machine: start a batch (Batches → New batch → Start production), sign
in as `inspector@cpoint.local` and open `http://localhost:3000/camera/capture`.

### 3. Make an HTTPS certificate for your machine (other devices only)

Browsers only open the camera on `localhost` or a **trusted HTTPS** address.
[mkcert](https://github.com/FiloSottile/mkcert) makes a small certificate authority on your
machine and a certificate for its address. Each teammate makes their own; never share them.

1. Install mkcert, then **open a new terminal** so it's found:
   - Windows: `winget install FiloSottile.mkcert`
   - macOS: `brew install mkcert`
   - Linux: see the mkcert page (`libnss3-tools` first)
2. Create the authority and trust it on this machine (Windows asks once; click **Yes**):

   ```bash
   mkcert -install
   ```

3. Find this machine's LAN address: `ipconfig` on Windows (the Wi-Fi adapter's IPv4 address,
   e.g. `192.168.254.104`), `ipconfig getifaddr en0` on macOS. On an iPhone's hotspot it's a
   `172.20.10.x` address.
4. In the repository folder, make the certificate for that address:

   ```bash
   mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 <your IP>
   ```

`certs/` is git-ignored and never enters the Docker image. If your address changes (another
network), run step 4 again with the new address and restart the app.

### 4. Trust it on the phone (once per phone)

`mkcert -CAROOT` prints the folder with **`rootCA.pem`**. Send only that file to the phone. Never
send `rootCA-key.pem`.

**iPhone:**

1. AirDrop or email `rootCA.pem` to the iPhone. If it lands in the Files app, long-press it →
   **Rename** to `rootCA.crt` (Files only previews a `.pem`), then tap it. iOS says
   "Profile Downloaded".
2. Settings → General → **VPN & Device Management** → the mkcert profile → **Install** (passcode).
3. Settings → General → About → **Certificate Trust Settings** → turn on the mkcert root. This
   step is easy to miss, and Safari still refuses without it.

**Android:** copy `rootCA.pem` to the phone, rename it `rootCA.crt`, then Settings → Security →
Encryption & credentials → Install a certificate → **CA certificate**. Menu names vary by maker.

**Another PC:** double-click `rootCA.pem` (rename to `.crt` if Windows won't open it) → Install
Certificate → Local Machine → **Trusted Root Certification Authorities**.

### 5. Start the app with HTTPS and open the page

The phone must be on the **same Wi-Fi** as the machine. If Windows Firewall asks about Node.js or
Docker, allow **Private networks**.

- **Development:** stop `npm run dev` first (Ctrl+C), add `DEV_ORIGINS=<your IP>` to `.env`, then:

  ```bash
  npm run dev:https
  ```

  Open `https://<your IP>:3000/camera/capture` on the phone (HTTPS on the same port 3000).

- **Docker:** `docker compose up --build -d`, then `https://<your IP>:3443/camera/capture`.
  `http://...:3000` keeps working for everything except the camera.

Sign in as `inspector@cpoint.local` (or the Floor Manager) and tap **Allow** for the camera. On a
phone the page uses the back camera; pick another under **Camera**. Scans from the page are
recorded as `PHONE` or `WEBCAM` and name no person (D-008); the audit log records who captured.

### If it doesn't work

| What you see                                              | What to do                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| "The camera only works on a secure address."              | You opened `http://` on another device. Use the `https://` address from step 5                                |
| Safari says the connection isn't private                  | Step 4.3 (Certificate Trust Settings) isn't on, or your IP changed since step 3.4: make the certificate again |
| The page loads on the phone but nothing reacts (dev only) | `DEV_ORIGINS` in `.env` is missing or isn't your current IP. Fix it and restart `npm run dev:https`           |
| "The camera model isn't installed on the server."         | Step 1: both files in `cv/models/`, then restart the app                                                      |
| "This browser isn't allowed to use the camera."           | Follow the steps on the page (iPhone: Settings → Apps → Safari → Camera → Allow), then Try again              |
| "Another app is using this camera."                       | Close DroidCam, the camera station window or a video call, then Try again                                     |
| The phone can't reach the address at all                  | Same Wi-Fi? Firewall allowed? Try `http://<your IP>:3000` first to check the network                          |
| Capture is off: "until a batch is at Preparation"         | Start a batch as the Floor Manager                                                                            |

## Scripts

| Command                     | What it does                                                                    |
| --------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`               | Dev server with hot reload                                                      |
| `npm run check`             | lint + typecheck + unit tests + build (run before pushing)                      |
| `npm run clean`             | Delete `.next` and `tsconfig.tsbuildinfo` (the next build makes them again)     |
| `npm run lint`              | ESLint, including the MVC layer import rules                                    |
| `npm run typecheck`         | Generate route types, then `tsc --noEmit`                                       |
| `npm run test`              | Unit tests (Vitest)                                                             |
| `npm run test:e2e`          | Browser tests (Playwright + axe). Needs `npm run build` and the database        |
| `npm run format`            | Prettier                                                                        |
| `npm run db:up` / `db:down` | Start/stop PostgreSQL in Docker                                                 |
| `npm run db:migrate`        | Create + apply a migration after editing `prisma/schema.prisma`                 |
| `npm run db:deploy`         | Apply pending migrations                                                        |
| `npm run db:seed`           | Seed reference data, demo users and the bootstrap admin (idempotent)            |
| `npm run demo:seed`         | Seed a past week of production (only when there are no batches)                 |
| `npm run cv:token`          | Create a camera device token (printed once)                                     |
| `npm run cv:simulate`       | Send simulated camera scans (`--count`, `--interval`, `--batch`)                |
| `npm run cv:parity`         | Run the app's ONNX model on photos; `--compare` checks it against the station   |
| `npm run dev:https`         | Dev server over HTTPS on the LAN (needs `certs/`, see Capture from the website) |
| `npm run db:studio`         | Browse the database in Prisma Studio                                            |

First time running e2e: `npx playwright install chromium`. If Chromium is already installed
elsewhere, set `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome` instead. To test the Docker stack, set
`E2E_BASE_URL=http://localhost:3000`.

## Keeping the folder small

The repository itself is about 35 MB. A working copy grows to 7–9 GB because of what gets
installed and built, all of it git-ignored and safe to re-create:

| Folder         | Size       | What it is                                       | To get it back                   |
| -------------- | ---------- | ------------------------------------------------ | -------------------------------- |
| `cv/.venv`     | about 5 GB | the camera station's Python (torch is 4.5 GB)    | `cv/README.md`, "Set up"         |
| `.next`        | 0.5–2.5 GB | build output; `.next/dev` grows while `dev` runs | `npm run build` or `npm run dev` |
| `node_modules` | about 1 GB | npm packages                                     | `npm ci`                         |

- **Keep it out of OneDrive, Dropbox or Google Drive.** Syncing 90,000 generated files slows
  installs and builds and fills cloud storage. Use a plain folder such as `C:\dev\CPoint-PMS`.
- **`npm run clean`** when `.next` passes a gigabyte or a build acts stale. Stop `npm run dev`
  first.
- Only the camera PC needs `cv/.venv`. The website's Capture page runs the model in the app and
  needs only the files in `cv/models` (D-064). A PC without a GPU can install the CPU build of
  torch instead of the CUDA one (smaller, about 3× slower per scan).
- `onnxruntime-node` in `node_modules` carries Windows, macOS and Linux builds (about 290 MB). npm
  can't skip them; the Docker image keeps only the Linux one (`next.config.ts`).
- Also safe to delete: `test-results/`, `playwright-report/`, `cv/out/` (except `cv/out/spool/`
  and `cv/out/failed/`, which hold scans not yet sent) and `qa/reports/artifacts/`. Never delete
  `storage/` by hand: its files belong to scans and deliveries in the database (`npm run
demo:reset` cleans both together).
- **Moving a working copy:** copy it without the generated folders, then re-install. A venv can't
  be moved (its scripts hold the old path), so make a new one, and run
  `python -m cpoint_cv shortcut` again for the desktop shortcut:

  ```cmd
  robocopy "C:\old\path\CPoint-PMS" "C:\dev\CPoint-PMS" /E /XD node_modules .next .venv
  ```

  `.env`, `certs/`, `cv/models/` and `cv/config.toml` are git-ignored, so copy rather than
  re-clone. The database is in Docker's `cpoint-pms_pgdata` volume, which the new folder reuses.

- **Docker** keeps old images and build cache outside the folder (`docker system df`).
  `docker builder prune -f` clears the build cache; `docker image prune -a -f` removes every image
  no container uses, including other projects'. **Never** run `docker volume prune` or
  `docker compose down -v`: they delete the database.

## Project structure (MVC)

```
src/
  app/                 VIEW: pages and layouts, one folder per area
    api/v1/**/route.ts ROUTES: one-line files that hand off to a controller
  server/
    controllers/       CONTROLLER: parse/validate request → call service → shape response
    services/          business rules (decision engine, stage flow, ledger, reports, demo seed)
    models/            MODEL: data access; the only layer that imports Prisma
    validators/        Zod schemas shared by API and forms
    policies/          who can do what (role × permission), page and API guards
    lib/               env, Prisma client, logger, errors, HTTP helpers
  components/ui/       shadcn-style primitives, styled with design tokens
  components/features/ feature components (VerdictBadge, charts, app shell, ...)
  styles/tokens.css    design tokens (see DESIGN.md)
prisma/                schema, migrations, seed
tests/unit, tests/e2e  Vitest and Playwright tests (including a smoke test per role)
docker/                container entrypoint
docs/                  status, roadmap, decisions, API, UI audit, client survey, screenshots
```

## Quality checks

- **CI** (GitHub Actions) runs lint, typecheck, unit tests, the build and the e2e suite. It also
  builds the Docker stack, checks the demo week seeds once, and checks the stock ledger adds up.
- **Accessibility:** the e2e smoke test runs axe (WCAG 2.1 A/AA) on every page of every role.
- **UI audit:** the findings and their fixes are in [`docs/UI_AUDIT.md`](docs/UI_AUDIT.md).

## API

All endpoints are documented in [`docs/API.md`](docs/API.md). Errors always use one shape:
`{ "error": { "code", "message", "details?" } }`.

## Working with Claude Code

This project is built with Claude Code, one roadmap phase per session. Start with `/resume` and
finish with `/wrap-up`. See [`docs/AGENTIC_WORKFLOW.md`](docs/AGENTIC_WORKFLOW.md). Each
phase's brief is in [`docs/prompts/`](docs/prompts/), and its approved plan in
`docs/prompts/plans/`.

## Design

Visual language, tokens and UI rules are in [`DESIGN.md`](DESIGN.md).
