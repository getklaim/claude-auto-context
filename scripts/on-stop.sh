#!/bin/bash
# Stop Hook
# Pipes raw JSON to collector, then launches worker if ≥100 pending events.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
BATCH_THRESHOLD=100

INPUT=$(cat)

echo "$INPUT" | bun "$PLUGIN_ROOT/.claude-auto-context/collector.mjs" Stop

# Launch worker only when enough events have accumulated
DB_PATH="$PROJECT_DIR/.claude-auto-context/db/claude-auto-context.db"
if [ -f "$DB_PATH" ]; then
  COUNT=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM raw_events WHERE status='pending'" 2>/dev/null || echo "0")
  if [ "$COUNT" -ge "$BATCH_THRESHOLD" ]; then
    "$PLUGIN_ROOT/scripts/worker-launcher.sh" "$PROJECT_DIR" &
  fi
fi

exit 0
