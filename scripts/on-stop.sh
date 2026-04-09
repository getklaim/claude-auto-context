#!/usr/bin/env bash
# Stop Hook
# Skip Stop event storage (collector handles this).
# Launch worker if ≥100 pending events.

source "$(dirname "$0")/common.sh"

BATCH_THRESHOLD=100

# Stop events are no longer stored — collector.mjs exits early for Stop hook.
# Just check pending count and launch worker if threshold met.

DB_PATH="$PROJECT_DIR/.claude-auto-context/db/claude-auto-context.db"
if [ -f "$DB_PATH" ]; then
  # Resolve bun command: native or npx fallback
  if command -v bun &>/dev/null; then
    _BUN="bun"
  elif command -v npx &>/dev/null; then
    _BUN="npx -y bun"
  else
    COUNT=0
  fi
  if [ -z "${COUNT:-}" ]; then
    COUNT=$($_BUN -e "import{Database}from'bun:sqlite';try{const d=new Database('$DB_PATH',{readonly:true});console.log(d.prepare('SELECT count(*)as c FROM raw_events WHERE status=?').get('pending').c);d.close()}catch{console.log(0)}" 2>/dev/null || echo "0")
  fi
  if [ "$COUNT" -ge "$BATCH_THRESHOLD" ]; then
    "$PLUGIN_ROOT/scripts/worker-launcher.sh" "$PROJECT_DIR" &
  fi
fi

log "Session stopped"

exit 0
