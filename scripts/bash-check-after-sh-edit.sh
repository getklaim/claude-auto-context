#!/bin/bash
# PostToolUse hook: bash-check-after-sh-edit
# After Write or Edit on a .sh file, runs bash -n to catch syntax errors.

if [ "${CAC_HOOK_RUNNING}" = "1" ]; then
  exit 0
fi
export CAC_HOOK_RUNNING=1

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '
  if .tool_name == "Write" then .tool_input.file_path
  elif .tool_name == "Edit" then .tool_input.file_path
  else empty
  end' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [ "${FILE_PATH:0:1}" != "/" ]; then
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
  if [ -n "$CWD" ]; then
    FILE_PATH="${CWD}/${FILE_PATH}"
  fi
fi

case "$FILE_PATH" in
  *.sh) ;;
  *) exit 0 ;;
esac

BASH_OUTPUT=$(bash -n "$FILE_PATH" 2>&1)
BASH_EXIT=$?

if [ "$BASH_EXIT" -ne 0 ]; then
  echo "[bash-check] SYNTAX ERROR in $FILE_PATH" >&2
  echo "$BASH_OUTPUT" >&2
  echo "[bash-check] Fix syntax errors before proceeding." >&2
fi

exit 0
