#!/usr/bin/env bash
# worker-launcher.sh — Start polling worker if not already running.
# Uses lock file to guarantee single instance.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT_DIR="${1:-$PLUGIN_ROOT}"
LOCK_DIR="$PROJECT_DIR/.claude-auto-context/worker.lock.d"
LOCK_PID_FILE="$LOCK_DIR/pid"
LOG_DIR="$PROJECT_DIR/.claude-auto-context/db"
LOG_FILE="$LOG_DIR/worker.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Atomic lock acquisition via mkdir (POSIX-atomic, prevents TOCTOU race)
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  # Lock exists — check if the owning process is still alive
  PID=$(cat "$LOCK_PID_FILE" 2>/dev/null)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    # Worker already running
    exit 0
  fi
  # Stale lock — remove it and log for post-mortem analysis
  echo "[$(date -u +%FT%TZ)] stale lock removed (pid=$PID)" >> "$LOG_FILE"
  rm -rf "$LOCK_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    # Another launcher won the race — exit gracefully
    exit 0
  fi
fi

# Write launcher PID immediately to close the gap before worker starts
echo $$ > "$LOCK_PID_FILE"

# Launch worker in background
# Unset CLAUDECODE to allow Agent SDK to spawn Claude Code subprocess
# (otherwise it errors: "cannot be launched inside another Claude Code session")
export CLAUDE_PROJECT_DIR="$PROJECT_DIR"
export HOME="${HOME:-$(eval echo ~$(whoami))}"
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$HOME/.bun/bin:$PATH"
unset CLAUDECODE

# Resolve bun: native if available, npx fallback otherwise
if command -v bun &>/dev/null; then
  BUN_CMD="bun"
else
  BUN_CMD="npx -y bun"
fi
nohup $BUN_CMD "$PLUGIN_ROOT/.claude-auto-context/worker.mjs" >> "$LOG_FILE" 2>&1 &

exit 0
