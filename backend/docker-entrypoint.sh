#!/bin/sh
set -e

echo "[entrypoint] Waiting for database..."
# Simple wait loop using prisma's connection (retries built into migrate)
ATTEMPTS=0
until npx prisma migrate deploy 2>/tmp/migrate.log; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge 30 ]; then
    echo "[entrypoint] Database not reachable after 30 attempts. Last error:"
    cat /tmp/migrate.log
    exit 1
  fi
  echo "[entrypoint] DB not ready (attempt $ATTEMPTS/30), retrying in 2s..."
  sleep 2
done
echo "[entrypoint] prisma migrate deploy done."

echo "[entrypoint] Starting app: $*"
exec "$@"
