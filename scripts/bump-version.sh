#!/bin/bash
# bump-version.sh — PreToolUse hook for Bash
# Auto-bumps plugin.json patch version before git commit.
# Reads hook input from stdin, only acts on git commit commands.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only intercept git commit commands
if ! echo "$COMMAND" | grep -qE '^git\s+commit|&&\s*git\s+commit'; then
  exit 0
fi

# Find plugin.json relative to project dir
PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
PLUGIN_JSON="${PROJECT_DIR:-.}/.claude-plugin/plugin.json"

if [ ! -f "$PLUGIN_JSON" ]; then
  exit 0
fi

# Check if there are staged changes beyond plugin.json
STAGED=$(cd "$PROJECT_DIR" && git diff --cached --name-only 2>/dev/null | grep -v '.claude-plugin/plugin.json')
if [ -z "$STAGED" ]; then
  exit 0
fi

# Bump patch version
CURRENT=$(jq -r '.version' "$PLUGIN_JSON" 2>/dev/null)
if [ -z "$CURRENT" ] || [ "$CURRENT" = "null" ]; then
  exit 0
fi

NEW_VERSION=$(echo "$CURRENT" | awk -F. '{print $1"."$2"."$3+1}')
jq --arg v "$NEW_VERSION" '.version = $v' "$PLUGIN_JSON" > "${PLUGIN_JSON}.tmp" && mv "${PLUGIN_JSON}.tmp" "$PLUGIN_JSON"

# Stage the updated plugin.json
(cd "$PROJECT_DIR" && git add .claude-plugin/plugin.json)

echo "[bump-version] $CURRENT → $NEW_VERSION"
exit 0
