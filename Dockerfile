# syntax=docker/dockerfile:1
# CPoint PMS — single app image. Stages: deps → build → migrator → runner.

# Debian slim, not Alpine: ONNX Runtime (the Capture page's model, D-064) ships glibc builds only.
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
# Prisma's schema engine needs OpenSSL 3, which the slim image leaves out.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# onnxruntime-node would download its CUDA build on Linux; the app runs the model on the CPU.
ENV NEXT_TELEMETRY_DISABLED=1 \
    ONNXRUNTIME_NODE_INSTALL=skip

# ---- deps: install once, cached until the lockfile changes ----
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm HUSKY=0 npm ci

# ---- build: compile the standalone Next.js server ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next's server trace brings sharp's musl (Alpine) build as well; this image is Debian (glibc).
RUN npx prisma generate && npm run build \
 && rm -rf .next/standalone/node_modules/@img/*linuxmusl*

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
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --no-create-home nextjs
WORKDIR /app
# The camera model is mounted at /app/models (docker-compose.yml), never built in (D-049, D-064).
# A certificate mounted at /app/certs turns on HTTPS on HTTPS_PORT (D-065).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    HTTPS_PORT=3443 \
    UPLOADS_DIR=/app/storage/uploads \
    CV_MODEL_PATH=/app/models/yolo-v1.onnx

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=migrator --chown=nextjs:nodejs /migrate ./migrate
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
COPY --chown=nextjs:nodejs docker/https.mjs ./https.mjs
RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage && chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000 3443
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
