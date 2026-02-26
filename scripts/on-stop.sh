#!/bin/bash
# Stop Hook
# Pipes raw JSON from stdin to collector. No filtering or analysis.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

INPUT=$(cat)

echo "$INPUT" | node "$PLUGIN_ROOT/.claude-auto-context/collector.mjs" Stop

exit 0
