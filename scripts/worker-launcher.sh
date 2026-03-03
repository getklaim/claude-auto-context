#!/bin/bash
# worker-launcher.sh — Start polling worker if not already running.
# Uses lock file to guarantee single instance.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT_DIR="${1:-$PLUGIN_ROOT}"
LOCK_FILE="$PROJECT_DIR/.claude-auto-context/worker.lock"
LOG_DIR="$PROJECT_DIR/.claude-auto-context/db"
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
# Unset CLAUDECODE to allow Agent SDK to spawn Claude Code subprocess
# (otherwise it errors: "cannot be launched inside another Claude Code session")
export CLAUDE_PROJECT_DIR="$PROJECT_DIR"
export HOME="${HOME:-$(eval echo ~$(whoami))}"
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$HOME/.bun/bin:$PATH"
unset CLAUDECODE
nohup bun "$PLUGIN_ROOT/.claude-auto-context/worker.mjs" >> "$LOG_FILE" 2>&1 &

exit 0
