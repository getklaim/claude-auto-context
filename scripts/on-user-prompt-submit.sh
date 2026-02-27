#!/bin/bash
# UserPromptSubmit Hook
# Pipes raw user prompt JSON from stdin to collector for DB storage.
# No filtering, no analysis — just store the raw prompt.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

cat | bun "$PLUGIN_ROOT/.claude-auto-context/collector.mjs" UserPromptSubmit

exit 0
