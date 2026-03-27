#!/bin/bash
# PostToolUse hook: skill-md-dual-dir-sync-warn
# Fires after Write or Edit tool use.
# If the modified file is a SKILL.md in either .claude/skills/ or skills/,
# checks whether the mirror counterpart has been updated within the same
# 60-second window. Warns on stderr if the counterpart appears stale.

# Re-entry guard — prevents infinite recursion if this hook triggers itself
if [ "${CAC_HOOK_RUNNING}" = "1" ]; then
  exit 0
fi
export CAC_HOOK_RUNNING=1

INPUT=$(cat)

# Extract the file path from the tool input
FILE_PATH=$(echo "$INPUT" | jq -r '
  if .tool_name == "Write" then .tool_input.file_path
  elif .tool_name == "Edit" then .tool_input.file_path
  else empty
  end' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize to absolute path if needed
if [ "${FILE_PATH:0:1}" != "/" ]; then
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
  if [ -n "$CWD" ]; then
    FILE_PATH="${CWD}/${FILE_PATH}"
  fi
fi

# Only act on SKILL.md files
BASENAME=$(basename "$FILE_PATH")
if [ "$BASENAME" != "SKILL.md" ]; then
  exit 0
fi

# Determine which mirror the file belongs to and compute the counterpart path
# Mirror A: .claude/skills/<skill>/SKILL.md
# Mirror B: skills/<skill>/SKILL.md

COUNTERPART=""

if echo "$FILE_PATH" | grep -q '\.claude/skills/'; then
  # File is in .claude/skills/ — counterpart is in skills/
  COUNTERPART=$(echo "$FILE_PATH" | sed 's|\.claude/skills/|skills/|')
elif echo "$FILE_PATH" | grep -q '/skills/' && ! echo "$FILE_PATH" | grep -q '\.claude/skills/'; then
  # File is in skills/ — counterpart is in .claude/skills/
  COUNTERPART=$(echo "$FILE_PATH" | sed 's|/skills/|/.claude/skills/|')
fi

if [ -z "$COUNTERPART" ]; then
  exit 0
fi

# If the counterpart does not exist at all, warn — it is missing entirely
if [ ! -f "$COUNTERPART" ]; then
  echo "[skill-md-sync] WARNING: Mirror counterpart does not exist: $COUNTERPART" >&2
  echo "[skill-md-sync] Modified: $FILE_PATH" >&2
  echo "[skill-md-sync] Action required: create the counterpart to keep both directories in sync." >&2
  exit 0
fi

# Compare modification times. If the counterpart's mtime is more than 60 seconds
# older than the modified file, the counterpart is likely stale.
MTIME_MODIFIED=$(stat -f "%m" "$FILE_PATH" 2>/dev/null)
MTIME_COUNTERPART=$(stat -f "%m" "$COUNTERPART" 2>/dev/null)

if [ -z "$MTIME_MODIFIED" ] || [ -z "$MTIME_COUNTERPART" ]; then
  exit 0
fi

DELTA=$((MTIME_MODIFIED - MTIME_COUNTERPART))

if [ "$DELTA" -gt 60 ]; then
  echo "[skill-md-sync] WARNING: Mirror counterpart appears stale (${DELTA}s older):" >&2
  echo "[skill-md-sync] Modified:    $FILE_PATH" >&2
  echo "[skill-md-sync] Not updated: $COUNTERPART" >&2
  echo "[skill-md-sync] Action required: apply the same changes to the counterpart file." >&2
fi

exit 0
