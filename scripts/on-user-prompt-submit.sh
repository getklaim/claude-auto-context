#!/bin/bash
# UserPromptSubmit Hook
# 1. Pipes raw user prompt JSON from stdin to collector for DB storage.
# 2. Scans .claude-auto-context/suggestions/ for pending suggestions and outputs notification.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SUGGESTIONS_DIR="$PROJECT_DIR/.claude-auto-context/suggestions"

# stdin is consumed once — capture it first, then pipe to collector
INPUT=$(cat)
echo "$INPUT" | bun "$PLUGIN_ROOT/.claude-auto-context/collector.mjs" UserPromptSubmit

# Scan for pending suggestions
if [ -d "$SUGGESTIONS_DIR" ]; then
  PENDING_TITLES=()

  for f in "$SUGGESTIONS_DIR"/*.md; do
    [ -f "$f" ] || continue

    # Skip applied/rejected/failed suggestions
    grep -q "^applied$" "$f" 2>/dev/null && continue
    grep -q "^rejected$" "$f" 2>/dev/null && continue
    grep -q "^failed$" "$f" 2>/dev/null && continue

    # Extract title from first H1 line
    TITLE=$(grep -m1 "^# " "$f" | sed 's/^# //')
    [ -z "$TITLE" ] && continue

    # Extract numeric ID from filename (e.g., 001-slug.md → 001)
    ID=$(basename "$f" .md | grep -o '^[0-9]*')

    PENDING_TITLES+=("$ID. $TITLE")
  done

  COUNT=${#PENDING_TITLES[@]}

  if [ "$COUNT" -gt 0 ]; then
    echo "─────────────────────────────────────────────────"
    echo "Auto Context — ${COUNT}건의 Suggestion 대기 중"
    echo "─────────────────────────────────────────────────"
    for t in "${PENDING_TITLES[@]}"; do
      echo "  $t"
    done
    echo "/cac-apply 로 적용"
    echo "─────────────────────────────────────────────────"
  fi
fi

exit 0
