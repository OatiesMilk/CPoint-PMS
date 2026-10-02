# syntax=docker/dockerfile:1
# CPoint PMS — single app image. Stages: deps → build → migrator → runner.

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
# No apk packages needed: Alpine ships the OpenSSL 3 libraries Prisma's schema engine uses.
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: install once, cached until the lockfile changes ----
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm HUSKY=0 npm ci

# ---- build: compile the standalone Next.js server ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---- migrator: just the Prisma CLI, pinned to the project's versions ----
FROM base AS migrator
WORKDIR /migrate
COPY package.json /tmp/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund \
      "prisma@$(node -p "require('/tmp/package.json').devDependencies.prisma")" \
      "dotenv@$(node -p "require('/tmp/package.json').dependencies.dotenv")"
COPY prisma.config.ts ./
COPY prisma ./prisma

# ---- runner: minimal, non-root ----
FROM ${NODE_IMAGE} AS runner
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    UPLOADS_DIR=/app/storage/uploads

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=migrator --chown=nextjs:nodejs /migrate ./migrate
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage && chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

ENTRYPOINT ["./entrypoint.sh"]
