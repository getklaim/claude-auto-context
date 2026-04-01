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

# Check if skill-creator is installed (SDEL-03)
if ! command -v skill-creator &> /dev/null; then
  echo "Auto Context: skill-creator not found — /cac-create-skill will not function."
  echo "  Install: https://github.com/anthropics/skills (sparse checkout skill-creator)"
fi

# Ensure local rules directory exists (auto-generated rules go here)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
mkdir -p "$PROJECT_DIR/.claude/rules/local"

# Add .claude/rules/local/ to .gitignore (idempotent)
GITIGNORE="$PROJECT_DIR/.gitignore"
ENTRY=".claude/rules/local/"
if [ -f "$GITIGNORE" ]; then
  grep -qxF "$ENTRY" "$GITIGNORE" || echo "$ENTRY" >> "$GITIGNORE"
else
  echo "$ENTRY" > "$GITIGNORE"
fi

# Convention decay: force-delete rules older than 60 days
"$SCRIPT_DIR/auto-cleanup.sh" 2>/dev/null || true

exit 0
