#!/bin/bash
# Setup Hook — ensure Bun runtime is available
# Runs once when plugin is first loaded

# Check if bun is installed
if ! command -v bun &> /dev/null; then
  # Auto-install Bun
  curl -fsSL https://bun.sh/install | bash 2>/dev/null
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

exit 0
