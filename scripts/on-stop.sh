#!/bin/bash
# Stop Hook
# Pipes raw JSON from stdin to collector. No filtering or analysis.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

INPUT=$(cat)

echo "$INPUT" | bun "$PLUGIN_ROOT/.claude-auto-context/collector.mjs" Stop

# Launch polling worker in background (non-blocking)
"$PLUGIN_ROOT/scripts/worker-launcher.sh" "$PROJECT_DIR" &

exit 0
