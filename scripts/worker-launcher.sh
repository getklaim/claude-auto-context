#!/bin/bash
# worker-launcher.sh — Start polling worker if not already running.
# Uses lock file to guarantee single instance.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
LOCK_FILE="$PLUGIN_ROOT/.claude-auto-context/worker.lock"
LOG_DIR="$PLUGIN_ROOT/.claude-auto-context/db"
LOG_FILE="$LOG_DIR/worker.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Check lock file
if [ -f "$LOCK_FILE" ]; then
  PID=$(cat "$LOCK_FILE" 2>/dev/null)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    # Worker already running
    exit 0
  fi
  # Stale lock — remove it
  rm -f "$LOCK_FILE"
fi

# Launch worker in background
export CLAUDE_PROJECT_DIR="$PLUGIN_ROOT"
nohup bun "$PLUGIN_ROOT/.claude-auto-context/worker.mjs" >> "$LOG_FILE" 2>&1 &

exit 0
