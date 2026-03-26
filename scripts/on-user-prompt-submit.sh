#!/bin/bash
# UserPromptSubmit Hook
# 1. Pipes raw user prompt JSON from stdin to collector for DB storage.
# 2. Scans .claude-auto-context/suggestions/ for pending suggestions (cached).

source "$(dirname "$0")/common.sh"

SUGGESTIONS_DIR="$PROJECT_DIR/.claude-auto-context/suggestions"
CACHE_FILE="$PROJECT_DIR/.claude-auto-context/.suggestions-cache"

# stdin is consumed once — capture it first, then pipe to collector
INPUT=$(cat)
echo "$INPUT" | run_collector UserPromptSubmit

# Check if cache needs refresh (suggestions dir modified after cache)
needs_refresh() {
  [ ! -f "$CACHE_FILE" ] && return 0
  [ ! -d "$SUGGESTIONS_DIR" ] && return 1

  # Compare modification times
  if [ "$(stat -f %m "$SUGGESTIONS_DIR" 2>/dev/null || stat -c %Y "$SUGGESTIONS_DIR" 2>/dev/null)" -gt \
       "$(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE" 2>/dev/null)" ]; then
    return 0
  fi
  return 1
}

# Build suggestions cache
build_cache() {
  [ ! -d "$SUGGESTIONS_DIR" ] && echo "0" > "$CACHE_FILE" && return

  local count=0
  local output=""

  for f in "$SUGGESTIONS_DIR"/*.md; do
    [ -f "$f" ] || continue

    # Skip applied/rejected/failed suggestions
    grep -q "^applied$" "$f" 2>/dev/null && continue
    grep -q "^rejected$" "$f" 2>/dev/null && continue
    grep -q "^failed$" "$f" 2>/dev/null && continue

    # Extract title from first H1 line
    TITLE=$(grep -m1 "^# " "$f" | sed 's/^# //')
    [ -z "$TITLE" ] && continue

    # Extract numeric ID from filename
    ID=$(basename "$f" .md | grep -o '^[0-9]*')

    output+="  $ID. $TITLE\n"
    ((count++))
  done

  echo "$count" > "$CACHE_FILE"
  [ -n "$output" ] && echo -e "$output" >> "$CACHE_FILE"
}

# Refresh cache if needed
if needs_refresh; then
  build_cache
fi

# Display cached suggestions
if [ -f "$CACHE_FILE" ]; then
  COUNT=$(head -1 "$CACHE_FILE")

  if [ "$COUNT" -gt 0 ] 2>/dev/null; then
    echo "─────────────────────────────────────────────────"
    echo "Auto Context — ${COUNT}건의 Suggestion 대기 중"
    echo "─────────────────────────────────────────────────"
    tail -n +2 "$CACHE_FILE"
    echo "/cac-apply 로 적용"
    echo "─────────────────────────────────────────────────"
  fi
fi

exit 0
