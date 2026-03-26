#!/bin/bash
# Setup Hook — ensure dependencies and clean stale context files
# Runs once when plugin is first loaded

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check/install bun
if ! command -v bun &> /dev/null; then
  curl -fsSL https://bun.sh/install | bash 2>/dev/null
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

# Warn if jq is missing (needed for bump-version.sh)
if ! command -v jq &> /dev/null; then
  echo "[auto-context] Warning: jq not found. Version auto-bump disabled."
  echo "  Install: brew install jq (macOS) or apt install jq (Linux)"
fi

# Auto-cleanup stale rules and skills
"$SCRIPT_DIR/auto-cleanup.sh" 2>/dev/null || true

exit 0
