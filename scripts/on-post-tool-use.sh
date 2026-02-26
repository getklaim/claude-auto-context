#!/bin/bash
# PostToolUse Hook
# Pipes raw JSON from stdin to collector. No filtering or analysis.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

cat | node "$PLUGIN_ROOT/.claude-auto-context/collector.mjs" PostToolUse

exit 0
