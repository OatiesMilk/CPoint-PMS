# CPoint Product Monitoring System

Product Monitoring System for **CPoint Shoe Store Corporation**'s leather-shoe production line
(school shoes and topsiders). It tracks batches (one leather roll each) through four stages:
**Preparation → Upper Making → Sole-ing → Finishing**. It has one computer-vision checkpoint at
Preparation, before cutting, that sorts leather sections into **Pass / Rework / Reject**.

> BS-IT capstone project. The rebuild is in progress on the `system-rebuild` branch. Progress is
> in [`docs/STATUS.md`](docs/STATUS.md), and the plan is in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Tech stack

Next.js 16 (App Router, TypeScript strict) · PostgreSQL 18 · Prisma 7 · Tailwind CSS 4 +
shadcn/ui (Radix) · Zod · Vitest + Playwright · Docker (one compose file, two services) · GitHub Actions CI.
The reasons behind each choice are in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Prerequisites

- **Node.js 22.12+** (24 LTS recommended) and npm
- **Docker Desktop** (or Docker Engine + Compose v2)

## Quick start: development

Runs PostgreSQL in Docker and Next.js on your machine, with hot reload.

```bash
cp .env.example .env        # then fill in the three blanks (see "Environment" below)
npm install                 # also generates the Prisma client
npm run db:up               # starts PostgreSQL in Docker (port 5432, localhost only)
npm run db:deploy           # applies database migrations
npm run dev                 # http://localhost:3000. Seeds reference data + demo users on start
```

Stop the database with `npm run db:down`. Data persists in the `pgdata` Docker volume.

## Environment

`.env.example` lists every variable. Three must be filled in before the first start:

| Variable                   | What to put                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `AUTH_SECRET`              | A random secret that signs sessions: `openssl rand -base64 32`. One per machine.   |
| `BOOTSTRAP_ADMIN_PASSWORD` | 12+ characters. Creates the first System Admin if none exists.                     |
| `DEMO_USER_PASSWORD`       | 8+ characters. Password for the demo accounts below (when `SEED_DEMO_USERS=true`). |

**Demo accounts** (created on startup when `SEED_DEMO_USERS=true`; turn it off for real use):

| Role              | Email                      | Lands on             |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

On every start the app also makes sure the reference data exists (shoe types, defect types, CV
thresholds 90% / 60%, a sample supplier). It never overwrites values an admin has changed.
With demo users on, it also adds five demo inventory items (two leather rolls, one of them low,
plus nails, adhesive and thread) the first time, without touching stock afterwards.
`npm run db:seed` runs the same steps by hand.

**Sign-in rules:** 5 wrong passwords lock an account for 15 minutes; sessions last 12 hours (one
shift); a deactivated user is signed out on their next click. Every sign-in, failure and sign-out
is written to the audit log.

**Accounts:** the System Admin adds people under **Users**. Each new account (and each password
reset) gets a temporary password that's shown once; the person chooses their own at first
sign-in. A reset signs the person out everywhere. Anyone can change their password from the user
menu (**Change password**).

## Quick start: demo / factory machine

Runs the whole system in Docker with one command. No Node.js needed on the machine.

```bash
cp .env.example .env        # fill in the blanks; change POSTGRES_PASSWORD for real use
docker compose up --build -d
```

Open <http://localhost:3000> (or `http://<this-machine's-LAN-IP>:3000` from another PC). On startup
the app container applies pending migrations, seeds reference data, then starts the server.
`docker compose up` refuses to start without `AUTH_SECRET`. Check status with `docker compose ps` (both services should say `healthy`) and logs with
`docker compose logs -f app`. To stop: `docker compose down` (add `-v` to **delete all data**).

| Container | What it is                                 | Data volume             |
| --------- | ------------------------------------------ | ----------------------- |
| `app`     | Next.js server (non-root), runs migrations | `uploads` (scan images) |
| `db`      | PostgreSQL 18                              | `pgdata`                |

## Camera and simulator

The Preparation camera (later the YOLO service on a phone, webcam or dedicated camera) sends each
capture to `POST /api/v1/scans` with a **device token** (contract in [`docs/API.md`](docs/API.md)).
Without a camera, the simulator sends realistic scans through the same API:

```bash
npm run cv:token -- --name "Simulator"   # prints a token once; put it in .env as CV_DEVICE_TOKEN
# start a batch (Batches → New batch → Start production), then:
npm run cv:simulate -- --count 20 --interval 3
```

Scans go to the batch chosen on the **Camera** page, or to the batch that has been at Preparation
the longest. Watch them arrive on the Floor Manager and Quality Inspector homes.

## Scripts

| Command                     | What it does                                                               |
| --------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`               | Dev server with hot reload                                                 |
| `npm run check`             | lint + typecheck + unit tests + build (run before pushing)                 |
| `npm run lint`              | ESLint, including the MVC layer import rules                               |
| `npm run typecheck`         | Generate route types, then `tsc --noEmit`                                  |
| `npm run test`              | Unit tests (Vitest)                                                        |
| `npm run test:e2e`          | Browser tests (Playwright). Needs `npm run build` and the database running |
| `npm run format`            | Prettier                                                                   |
| `npm run db:up` / `db:down` | Start/stop PostgreSQL in Docker                                            |
| `npm run db:migrate`        | Create + apply a migration after editing `prisma/schema.prisma`            |
| `npm run db:deploy`         | Apply pending migrations                                                   |
| `npm run db:seed`           | Seed reference data, demo users and the bootstrap admin (idempotent)       |
| `npm run cv:token`          | Create a camera device token (printed once)                                |
| `npm run cv:simulate`       | Send simulated camera scans (`--count`, `--interval`, `--batch`)           |
| `npm run db:studio`         | Browse the database in Prisma Studio                                       |

First time running e2e: `npx playwright install chromium`. If Chromium is already installed
elsewhere, set `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome` instead.

## Project structure (MVC)

```
src/
  app/                 VIEW: pages and layouts (one folder per role from Phase 1)
    api/**/route.ts    ROUTES: one-line files that hand off to a controller
  server/
    controllers/       CONTROLLER: parse/validate request → call service → shape response
    services/          business rules (decision engine, batch counts, stage flow)
    models/            MODEL: data access; the only layer that imports Prisma
    validators/        Zod schemas shared by API and forms
    policies/          who can do what (role permissions)
    lib/               env, Prisma client, logger, errors, HTTP helpers
  components/ui/       shadcn-style primitives, styled with design tokens
  components/features/ feature components (VerdictBadge, ...)
  styles/tokens.css    design tokens (see DESIGN.md)
prisma/                schema, migrations, seed
tests/unit, tests/e2e  Vitest and Playwright tests
docker/                container entrypoint
docs/                  status, roadmap, decisions, API, client survey, master prompt
```

ESLint enforces the layers. For example, a page that imports a model, or a component that imports
server code, fails `npm run lint`.

## API

All endpoints are documented in [`docs/API.md`](docs/API.md). Errors always use one shape:
`{ "error": { "code", "message", "details?" } }`.

## Working with Claude Code

This project is built with Claude Code, one roadmap phase per session. Start with `/resume` and
finish with `/wrap-up`. See [`docs/AGENTIC_WORKFLOW.md`](docs/AGENTIC_WORKFLOW.md).

## Design

Visual language, tokens and UI rules are in [`DESIGN.md`](DESIGN.md).
