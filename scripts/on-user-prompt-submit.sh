#!/usr/bin/env bash
# UserPromptSubmit Hook
# 1. Pipes raw user prompt JSON from stdin to collector for DB storage.
# 2. Scans .claude-auto-context/suggestions/ for pending suggestions (cached).
# 3. Scans .claude-auto-context/skill-prompts/ for pending skill-prompts and outputs notification.

source "$(dirname "$0")/common.sh"

SUGGESTIONS_DIR="$PROJECT_DIR/.claude-auto-context/suggestions"
CACHE_FILE="$PROJECT_DIR/.claude-auto-context/.suggestions-cache"
HYGIENE_DIR="$PROJECT_DIR/.claude-auto-context/hygiene"
HYGIENE_CACHE="$PROJECT_DIR/.claude-auto-context/.hygiene-cache"

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

    # Extract ID from filename (supports both NNN and YYYYMMDD-HHMMSS formats)
    ID=$(basename "$f" .md | grep -oE '^[0-9]{8}-[0-9]{6}' || basename "$f" .md | grep -o '^[0-9]*')
    [ -z "$ID" ] && continue

    output+="  [$ID] $TITLE\n"
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

# Check if hygiene cache needs refresh
needs_hygiene_refresh() {
  [ ! -f "$HYGIENE_CACHE" ] && return 0
  [ ! -d "$HYGIENE_DIR" ] && return 1
  if [ "$(stat -f %m "$HYGIENE_DIR" 2>/dev/null || stat -c %Y "$HYGIENE_DIR" 2>/dev/null)" -gt \
       "$(stat -f %m "$HYGIENE_CACHE" 2>/dev/null || stat -c %Y "$HYGIENE_CACHE" 2>/dev/null)" ]; then
    return 0
  fi
  return 1
}

build_hygiene_cache() {
  [ ! -d "$HYGIENE_DIR" ] && echo "0" > "$HYGIENE_CACHE" && return
  local count=0
  local output=""
  for f in "$HYGIENE_DIR"/*.md; do
    [ -f "$f" ] || continue
    grep -q "^applied$" "$f" 2>/dev/null && continue
    grep -q "^rejected$" "$f" 2>/dev/null && continue
    grep -q "^failed$" "$f" 2>/dev/null && continue
    TITLE=$(grep -m1 "^# " "$f" | sed 's/^# //')
    [ -z "$TITLE" ] && continue
    ID=$(basename "$f" .md | grep -oE '^[0-9]{8}-[0-9]{6}' || basename "$f" .md | grep -oE 'hygiene-[0-9]{8}-[0-9]{6}' || basename "$f" .md)
    output+="  [$ID] $TITLE\n"
    ((count++))
  done
  echo "$count" > "$HYGIENE_CACHE"
  [ -n "$output" ] && echo -e "$output" >> "$HYGIENE_CACHE"
}

if needs_hygiene_refresh; then
  build_hygiene_cache
fi

if [ -f "$HYGIENE_CACHE" ]; then
  HCOUNT=$(head -1 "$HYGIENE_CACHE")
  if [ "$HCOUNT" -gt 0 ] 2>/dev/null; then
    echo "─────────────────────────────────────────────────"
    echo "Auto Context — ${HCOUNT}건의 Hygiene Issue 대기 중"
    echo "─────────────────────────────────────────────────"
    tail -n +2 "$HYGIENE_CACHE"
    echo "/cac-apply 로 적용"
    echo "─────────────────────────────────────────────────"
  fi
fi

# Scan for pending skill-prompt files
SKILL_PROMPTS_DIR="$PROJECT_DIR/.claude-auto-context/skill-prompts"
if [ -d "$SKILL_PROMPTS_DIR" ]; then
  PENDING_PROMPTS=()

  for f in "$SKILL_PROMPTS_DIR"/*.md; do
    [ -f "$f" ] || continue

    # Skip applied/rejected/failed prompt files
    grep -q "^applied$" "$f" 2>/dev/null && continue
    grep -q "^rejected$" "$f" 2>/dev/null && continue
    grep -q "^failed$" "$f" 2>/dev/null && continue

    # Extract slug from filename (e.g., 20260326-143052-edit-test-commit.md -> edit-test-commit)
    SLUG=$(basename "$f" .md | sed 's/^[0-9]*-[0-9]*-//')
    [ -z "$SLUG" ] && continue

    # Extract timestamp ID from filename
    ID=$(basename "$f" .md | grep -oE '^[0-9]{8}-[0-9]{6}')
    [ -z "$ID" ] && continue

    PENDING_PROMPTS+=("[$ID] $SLUG")
  done

  PROMPT_COUNT=${#PENDING_PROMPTS[@]}

  if [ "$PROMPT_COUNT" -gt 0 ]; then
    echo "─────────────────────────────────────────────────"
    echo "Auto Context — ${PROMPT_COUNT}건의 Skill Prompt 대기 중"
    echo "─────────────────────────────────────────────────"
    for t in "${PENDING_PROMPTS[@]}"; do
      echo "  $t"
    done
    echo "/cac-create-skill 로 스킬 생성"
    echo "─────────────────────────────────────────────────"
  fi
fi

# Agent activity notifications (one-shot)
NOTIF_PATH="$PROJECT_DIR/.claude-auto-context/notifications.json"
if [ -f "$NOTIF_PATH" ]; then
  # Atomic read+delete: mv first to prevent duplicate display
  NOTIF_TMP="${NOTIF_PATH}.reading"
  if mv "$NOTIF_PATH" "$NOTIF_TMP" 2>/dev/null; then
    echo "─────────────────────────────────────────────────"
    echo "Auto Context — Agent Activity"
    echo "─────────────────────────────────────────────────"
    if command -v jq >/dev/null 2>&1; then
      jq -r '.created[]? | "  \(.agent)가 \(.file | split("/") | last)를 추가했습니다"' "$NOTIF_TMP" 2>/dev/null
    elif command -v python3 >/dev/null 2>&1; then
      python3 -c "
import json,sys,os
d=json.load(open(sys.argv[1]))
for c in d.get('created',[]):
    print(f\"  {c['agent']}가 {os.path.basename(c['file'])}를 추가했습니다\")
" "$NOTIF_TMP" 2>/dev/null
    else
      # grep fallback — works with compact JSON (no spaces), tab-aware sed
      grep -oE '"agent":"[^"]*"|"file":"[^"]*"' "$NOTIF_TMP" 2>/dev/null | \
        paste - - | sed $'s/"agent":"//;s/"\t"file":".*\\//가 /;s/"$/를 추가했습니다/;s/^/  /'
    fi
    echo "─────────────────────────────────────────────────"
    rm -f "$NOTIF_TMP"
  fi
fi

exit 0
