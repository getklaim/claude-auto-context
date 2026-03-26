#!/bin/bash
# Stop Hook
# Pipes raw JSON from stdin to collector and launches worker.

source "$(dirname "$0")/common.sh"

INPUT=$(cat)

echo "$INPUT" | run_collector Stop

# Launch polling worker in background (non-blocking)
"$PLUGIN_ROOT/scripts/worker-launcher.sh" "$PROJECT_DIR" &

log "Session stopped, worker launched"

exit 0
