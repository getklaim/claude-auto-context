#!/bin/bash
# Setup Hook — ensure Bun runtime is available and clean stale context files
# Runs once when plugin is first loaded

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
  # Auto-install Bun
  curl -fsSL https://bun.sh/install | bash 2>/dev/null
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

# Auto-cleanup stale rules and skills
"$SCRIPT_DIR/auto-cleanup.sh" 2>/dev/null || true

exit 0
