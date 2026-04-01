#!/bin/bash
# SessionStart Hook
# Shows dashboard: active rules, pending suggestions, worker stats.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DB_PATH="$PROJECT_DIR/.claude-auto-context/db/claude-auto-context.db"
RULES_DIR="$PROJECT_DIR/.claude/rules/local"
SUGGESTIONS_DIR="$PROJECT_DIR/.claude-auto-context/suggestions"
HOOKS_DIR="$PROJECT_DIR/.claude/hooks"

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

# DB stats
TOTAL_ANALYZED=0
LAST_WORKER=""
if [ -f "$DB_PATH" ]; then
  TOTAL_ANALYZED=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM raw_events WHERE status='done'" 2>/dev/null || echo "0")
  # Get last worker run from log
  LOG_PATH="$PROJECT_DIR/.claude-auto-context/db/worker.log"
  if [ -f "$LOG_PATH" ]; then
    LAST_WORKER=$(grep "worker started" "$LOG_PATH" 2>/dev/null | tail -1 | grep -oE '\[.*\]' | tr -d '[]')
  fi
fi

# Only show if there's something to report
if [ "$RULES_COUNT" -gt 0 ] || [ "$SUGGESTIONS_COUNT" -gt 0 ] || [ "$TOTAL_ANALYZED" -gt 0 ]; then
  echo "─────────────────────────────────────────────────"
  echo "Auto Context"
  echo "  Rules: ${RULES_COUNT} active | Hooks: ${HOOKS_COUNT} | Suggestions: ${SUGGESTIONS_COUNT} pending"
  if [ "$TOTAL_ANALYZED" -gt 0 ]; then
    echo "  Events analyzed: ${TOTAL_ANALYZED} total"
  fi
  if [ -n "$LAST_WORKER" ]; then
    echo "  Last worker: ${LAST_WORKER}"
  fi
  echo "─────────────────────────────────────────────────"
fi

exit 0
