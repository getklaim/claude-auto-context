#!/usr/bin/env bash
# Hook: chmod-after-sh-write
# PostToolUse:Write — auto-runs chmod +x on any .sh file written by the Write tool.

if [ "${CAC_HOOK_RUNNING:-}" = "1" ]; then exit 0; fi
export CAC_HOOK_RUNNING=1

# Read tool input from stdin (Claude Code passes JSON on stdin for PostToolUse hooks)
HOOK_INPUT=$(cat 2>/dev/null)

TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)
if [ "$TOOL_NAME" != "Write" ]; then exit 0; fi

FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
if [ -z "$FILE_PATH" ]; then exit 0; fi

# Only act on .sh files
case "$FILE_PATH" in
  *.sh) ;;
  *) exit 0 ;;
esac

# Resolve to absolute path relative to project root if needed
if [ ! -f "$FILE_PATH" ]; then
  PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
  FILE_PATH="${PROJECT_ROOT}/${FILE_PATH}"
fi

if [ -f "$FILE_PATH" ]; then
  chmod +x "$FILE_PATH"
fi

exit 0
