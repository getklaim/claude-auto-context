#!/bin/bash
# UserPromptSubmit Hook
# 1. Pipes raw user prompt JSON from stdin to collector for DB storage.
# 2. Scans .claude-auto-context/suggestions/ for pending suggestions and outputs notification.
# 3. Scans .claude-auto-context/skill-prompts/ for pending skill-prompts and outputs notification.

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

    # Extract timestamp ID from filename (e.g., 20260323-143052-slug.md → 20260323-143052)
    ID=$(basename "$f" .md | grep -oE '^[0-9]{8}-[0-9]{6}')
    [ -z "$ID" ] && continue

    PENDING_TITLES+=("[$ID] $TITLE")
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

exit 0
