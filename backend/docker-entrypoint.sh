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

# ---- Apply manual SQL scripts (NOT part of Prisma migration history) ----
# These are idempotent-guarded. If a script already applied, we skip via a marker table.
apply_manual_sql() {
  file="$1"
  name=$(basename "$file")
  npx prisma db execute --url "$DATABASE_URL" --stdin <<'SQL' >/dev/null 2>&1 || true
CREATE TABLE IF NOT EXISTS _manual_sql_applied (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now());
SQL
  already=$(npx prisma db execute --url "$DATABASE_URL" --stdin <<SQL 2>/dev/null || echo ""
SELECT name FROM _manual_sql_applied WHERE name = '$name';
SQL
)
  if echo "$already" | grep -q "$name"; then
    echo "[entrypoint] manual SQL '$name' already applied, skipping."
    return 0
  fi
  echo "[entrypoint] applying manual SQL '$name'..."
  if npx prisma db execute --url "$DATABASE_URL" --file "$file"; then
    npx prisma db execute --url "$DATABASE_URL" --stdin <<SQL >/dev/null 2>&1 || true
INSERT INTO _manual_sql_applied (name) VALUES ('$name') ON CONFLICT DO NOTHING;
SQL
    echo "[entrypoint] manual SQL '$name' applied."
  else
    echo "[entrypoint] WARNING: manual SQL '$name' failed (may already be applied). Continuing."
  fi
}

for sql in prisma/migrations/manual_*.sql; do
  [ -f "$sql" ] && apply_manual_sql "$sql"
done

echo "[entrypoint] Starting app: $*"
exec "$@"
