#!/bin/sh
# Apply pending database migrations, then start the Next.js server.
set -e

echo "[entrypoint] Applying database migrations..."
(cd /app/migrate && node node_modules/prisma/build/index.js migrate deploy)

# HTTPS for other PCs and phones on the LAN, only when a certificate is mounted (D-065).
if [ -f /app/certs/cert.pem ] && [ -f /app/certs/key.pem ]; then
  node https.mjs &
else
  echo "[entrypoint] No certificate in /app/certs: HTTPS is off (the Capture page works on this PC's localhost only)."
fi

echo "[entrypoint] Starting CPoint PMS on port ${PORT}..."
exec node server.js
