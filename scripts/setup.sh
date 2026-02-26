#!/bin/bash
# Setup Hook — install dependencies
# Runs once when plugin is first loaded

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

# Install dependencies if node_modules missing or package.json changed
if [ ! -d "$PLUGIN_ROOT/node_modules" ] || [ "$PLUGIN_ROOT/package.json" -nt "$PLUGIN_ROOT/node_modules/.package-lock.json" ]; then
  cd "$PLUGIN_ROOT" && npm install --production --silent 2>/dev/null
fi

exit 0
