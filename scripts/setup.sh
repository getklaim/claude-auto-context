#!/usr/bin/env bash
# Setup Hook — ensure dependencies and clean stale context files
# Runs once when plugin is first loaded

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check bun availability (native or via npx)
if ! command -v bun &> /dev/null; then
  if command -v npx &> /dev/null; then
    echo "[auto-context] Bun not found. Using npx bun as fallback (first run may take a moment)."
    echo "  For faster performance, install Bun directly: curl -fsSL https://bun.sh/install | bash"
    # Pre-warm npx cache so subsequent calls are instant
    npx -y bun --version > /dev/null 2>&1 || true
  else
    echo "[auto-context] Warning: Neither bun nor npx found. Background worker will not function."
    echo "  Install Bun: curl -fsSL https://bun.sh/install | bash"
  fi
fi

# Warn if jq is missing (needed for bump-version.sh)
if ! command -v jq &> /dev/null; then
  echo "[auto-context] Warning: jq not found. Version auto-bump disabled."
  echo "  Install: brew install jq (macOS) or apt install jq (Linux)"
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

# Auto-cleanup: convention decay + stale rules/skills
"$SCRIPT_DIR/auto-cleanup.sh" 2>/dev/null || true

exit 0
