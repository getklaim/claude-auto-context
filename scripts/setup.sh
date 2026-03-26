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

# Check if skill-creator is installed (SDEL-03)
# Silent when present; shows guidance when missing
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

exit 0
