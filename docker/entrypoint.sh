#!/bin/sh
# Apply pending database migrations, then start the Next.js server.
set -e

echo "[entrypoint] Applying database migrations..."
(cd /app/migrate && node node_modules/prisma/build/index.js migrate deploy)

echo "[entrypoint] Starting CPoint PMS on port ${PORT}..."
exec node server.js
