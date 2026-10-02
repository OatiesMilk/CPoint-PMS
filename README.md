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
cp .env.example .env        # defaults work as-is for local dev
npm install                 # also generates the Prisma client
npm run db:up               # starts PostgreSQL in Docker (port 5432, localhost only)
npm run db:deploy           # applies database migrations
npm run dev                 # http://localhost:3000
```

Stop the database with `npm run db:down`. Data persists in the `pgdata` Docker volume.

## Quick start: demo / factory machine

Runs the whole system in Docker with one command. No Node.js needed on the machine.

```bash
cp .env.example .env        # change POSTGRES_PASSWORD for any real deployment
docker compose up --build -d
```

Open <http://localhost:3000>. On startup the app container applies pending migrations, then starts
the server. Check status with `docker compose ps` (both services should say `healthy`) and logs with
`docker compose logs -f app`. To stop: `docker compose down` (add `-v` to **delete all data**).

| Container | What it is                                 | Data volume             |
| --------- | ------------------------------------------ | ----------------------- |
| `app`     | Next.js server (non-root), runs migrations | `uploads` (scan images) |
| `db`      | PostgreSQL 18                              | `pgdata`                |

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
| `npm run db:seed`           | Seed demo data (from Phase 1)                                              |
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
