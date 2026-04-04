#!/usr/bin/env bash
# PreToolUse hook: block-conflict-markers-on-stage
# Description: Blocks git add and git commit when conflict markers (<<<<<<, ======, >>>>>>) are found in files being staged — prevents committing unresolved merge conflicts.

if [ "${CAC_HOOK_RUNNING}" = "1" ]; then
  exit 0
fi
export CAC_HOOK_RUNNING=1

INPUT=$(cat)

# Only act on Bash tool calls
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only act on git add or git commit commands
if ! echo "$COMMAND" | grep -qE '^\s*git (add|commit)'; then
  exit 0
fi

CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
if [ -z "$CWD" ]; then
  CWD="$(pwd)"
fi

CHECK_FILES=""

if echo "$COMMAND" | grep -qE '^\s*git add\s+(-A|--all|\.)'; then
  # Broad stage: check all modified tracked files
  CHECK_FILES=$(git -C "$CWD" diff --name-only 2>/dev/null)
  CHECK_FILES="$CHECK_FILES
$(git -C "$CWD" diff --cached --name-only 2>/dev/null)"
elif echo "$COMMAND" | grep -qE '^\s*git add\s+'; then
  # Specific files listed — strip flags then iterate
  FILE_ARGS=$(echo "$COMMAND" | sed 's/^\s*git add\s*//' | sed 's/^\s*-[^ ]*\s*//')
  for f in $FILE_ARGS; do
    FULL="$CWD/$f"
    if [ -f "$FULL" ]; then
      CHECK_FILES="$CHECK_FILES
$FULL"
    fi
  done
elif echo "$COMMAND" | grep -qE '^\s*git commit'; then
  # Check all currently staged files
  CHECK_FILES=$(git -C "$CWD" diff --cached --name-only 2>/dev/null)
fi

FILES_WITH_MARKERS=""

while IFS= read -r rel_file; do
  [ -z "$rel_file" ] && continue
  if [ "${rel_file:0:1}" = "/" ]; then
    abs_file="$rel_file"
  else
    abs_file="$CWD/$rel_file"
  fi
  [ ! -f "$abs_file" ] && continue
  if grep -qE '^(<{7}|={7}|>{7})' "$abs_file" 2>/dev/null; then
    FILES_WITH_MARKERS="$FILES_WITH_MARKERS
$rel_file"
  fi
done <<< "$CHECK_FILES"

FILES_WITH_MARKERS=$(echo "$FILES_WITH_MARKERS" | sed '/^$/d')

if [ -n "$FILES_WITH_MARKERS" ]; then
  echo "[conflict-markers] BLOCKED: unresolved conflict markers found in:" >&2
  echo "$FILES_WITH_MARKERS" | while IFS= read -r f; do
    echo "  $f" >&2
  done
  echo "[conflict-markers] Resolve all <<<<<<, ======, >>>>>> markers before staging." >&2
  exit 2
fi

exit 0
