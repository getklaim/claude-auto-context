#!/bin/bash
# Stop Hook
# Pipes raw JSON from stdin to collector. No filtering or analysis.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

INPUT=$(cat)

echo "$INPUT" | bun "$PLUGIN_ROOT/.claude-auto-context/collector.mjs" Stop

# Launch polling worker in background (non-blocking)
"$PLUGIN_ROOT/scripts/worker-launcher.sh" &

exit 0
