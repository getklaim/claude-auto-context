#!/usr/bin/env bash
# SessionStart Hook
# Outputs JSON with additionalContext for Claude's session context.
# Includes dashboard stats and file creation notifications from worker.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DB_PATH="$PROJECT_DIR/.claude-auto-context/db/claude-auto-context.db"
RULES_DIR="$PROJECT_DIR/.claude/rules/local"
SUGGESTIONS_DIR="$PROJECT_DIR/.claude-auto-context/suggestions"
HYGIENE_DIR="$PROJECT_DIR/.claude-auto-context/hygiene"
HOOKS_DIR="$PROJECT_DIR/.claude/hooks"
NOTIF_PATH="$PROJECT_DIR/.claude-auto-context/notifications.json"

# Count active rules
RULES_COUNT=0
if [ -d "$RULES_DIR" ]; then
  RULES_COUNT=$(find "$RULES_DIR" -name "*.md" -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')
fi

# Count active hooks (project-generated, not plugin hooks)
HOOKS_COUNT=0
if [ -d "$HOOKS_DIR" ]; then
  HOOKS_COUNT=$(find "$HOOKS_DIR" -name "*.sh" -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')
fi

# Count pending suggestions
SUGGESTIONS_COUNT=0
if [ -d "$SUGGESTIONS_DIR" ]; then
  for f in "$SUGGESTIONS_DIR"/*.md; do
    [ -f "$f" ] || continue
    grep -q "^applied$" "$f" 2>/dev/null && continue
    grep -q "^rejected$" "$f" 2>/dev/null && continue
    grep -q "^failed$" "$f" 2>/dev/null && continue
    SUGGESTIONS_COUNT=$((SUGGESTIONS_COUNT + 1))
  done
fi

# Count pending hygiene issues
HYGIENE_COUNT=0
if [ -d "$HYGIENE_DIR" ]; then
  for f in "$HYGIENE_DIR"/*.md; do
    [ -f "$f" ] || continue
    grep -q "^applied$" "$f" 2>/dev/null && continue
    grep -q "^rejected$" "$f" 2>/dev/null && continue
    grep -q "^failed$" "$f" 2>/dev/null && continue
    HYGIENE_COUNT=$((HYGIENE_COUNT + 1))
  done
fi

# DB stats
TOTAL_ANALYZED=0
LAST_WORKER=""
if [ -f "$DB_PATH" ]; then
  TOTAL_ANALYZED=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM raw_events WHERE status='done'" 2>/dev/null || echo "0")
  LOG_PATH="$PROJECT_DIR/.claude-auto-context/db/worker.log"
  if [ -f "$LOG_PATH" ]; then
    LAST_WORKER=$(grep "worker started" "$LOG_PATH" 2>/dev/null | tail -1 | grep -oE '\[.*\]' | tr -d '[]')
  fi
fi

# Build dashboard text
DASHBOARD="Auto Context: Rules ${RULES_COUNT} | Hooks ${HOOKS_COUNT} | Suggestions ${SUGGESTIONS_COUNT} pending | Hygiene ${HYGIENE_COUNT} pending"
if [ "$TOTAL_ANALYZED" -gt 0 ]; then
  DASHBOARD="${DASHBOARD} | Events analyzed: ${TOTAL_ANALYZED}"
fi
if [ -n "$LAST_WORKER" ]; then
  DASHBOARD="${DASHBOARD} | Last worker: ${LAST_WORKER}"
fi

# Check for agent activity notifications (new object-array schema)
NOTIF_TEXT=""
if [ -f "$NOTIF_PATH" ]; then
  # Atomic read+delete: mv first to prevent duplicate display
  NOTIF_TMP="${NOTIF_PATH}.reading"
  if mv "$NOTIF_PATH" "$NOTIF_TMP" 2>/dev/null; then
    if command -v jq >/dev/null 2>&1; then
      CREATED=$(jq -r '.created[]? | "\(.agent)가 \(.file | split("/") | last)를 추가했습니다"' "$NOTIF_TMP" 2>/dev/null)
    elif command -v python3 >/dev/null 2>&1; then
      CREATED=$(python3 -c "
import json,sys,os
d=json.load(open(sys.argv[1]))
for c in d.get('created',[]):
    print(f\"{c['agent']}가 {os.path.basename(c['file'])}를 추가했습니다\")
" "$NOTIF_TMP" 2>/dev/null)
    else
      # grep fallback — works with compact JSON (no spaces), tab-aware sed
      CREATED=$(grep -oE '"agent":"[^"]*"|"file":"[^"]*"' "$NOTIF_TMP" 2>/dev/null | \
        paste - - | sed $'s/"agent":"//;s/"\t"file":".*\\//가 /;s/"$/를 추가했습니다/')
    fi
    if [ -n "$CREATED" ]; then
      NOTIF_TEXT="\n\nAuto Context agent activity (previous session):"
      while IFS= read -r line; do
        [ -n "$line" ] || continue
        NOTIF_TEXT="${NOTIF_TEXT}\n- ${line}"
      done <<< "$CREATED"
    fi
    rm -f "$NOTIF_TMP"
  fi
fi

# Only output if there's something to report
if [ "$RULES_COUNT" -gt 0 ] || [ "$SUGGESTIONS_COUNT" -gt 0 ] || [ "$HYGIENE_COUNT" -gt 0 ] || [ "$TOTAL_ANALYZED" -gt 0 ] || [ -n "$NOTIF_TEXT" ]; then
  CONTEXT="${DASHBOARD}${NOTIF_TEXT}"
  # Escape for JSON string: backslashes, quotes, newlines
  CONTEXT_ESCAPED=$(printf '%s' "$CONTEXT" | sed 's/\\/\\\\/g; s/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$CONTEXT_ESCAPED"
fi

exit 0
