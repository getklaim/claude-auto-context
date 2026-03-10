#!/bin/bash
# bump-version.sh — PreToolUse hook for Bash
# Auto-bumps plugin version before git commit.
# Syncs version across plugin.json, marketplace.json, and package.json.

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

# Check if there are staged changes beyond version-managed files
VERSION_FILES='.claude-plugin/plugin.json\|.claude-plugin/marketplace.json\|package.json'
STAGED=$(cd "$PROJECT_DIR" && git diff --cached --name-only 2>/dev/null | grep -v "$VERSION_FILES")
if [ -z "$STAGED" ]; then
  exit 0
fi

# Bump patch version
CURRENT=$(jq -r '.version' "$PLUGIN_JSON" 2>/dev/null)
if [ -z "$CURRENT" ] || [ "$CURRENT" = "null" ]; then
  exit 0
fi

NEW_VERSION=$(echo "$CURRENT" | awk -F. '{print $1"."$2"."$3+1}')

# 1. Update plugin.json
jq --arg v "$NEW_VERSION" '.version = $v' "$PLUGIN_JSON" > "${PLUGIN_JSON}.tmp" && mv "${PLUGIN_JSON}.tmp" "$PLUGIN_JSON"

# 2. Update marketplace.json (top-level metadata.version + plugins[].version)
MARKETPLACE_JSON="${PROJECT_DIR:-.}/.claude-plugin/marketplace.json"
if [ -f "$MARKETPLACE_JSON" ]; then
  jq --arg v "$NEW_VERSION" '
    .metadata.version = $v |
    .plugins = [.plugins[] | .version = $v]
  ' "$MARKETPLACE_JSON" > "${MARKETPLACE_JSON}.tmp" && mv "${MARKETPLACE_JSON}.tmp" "$MARKETPLACE_JSON"
fi

# 3. Update package.json
PACKAGE_JSON="${PROJECT_DIR:-.}/package.json"
if [ -f "$PACKAGE_JSON" ]; then
  jq --arg v "$NEW_VERSION" '.version = $v' "$PACKAGE_JSON" > "${PACKAGE_JSON}.tmp" && mv "${PACKAGE_JSON}.tmp" "$PACKAGE_JSON"
fi

# Stage all updated version files
(cd "$PROJECT_DIR" && git add .claude-plugin/plugin.json .claude-plugin/marketplace.json package.json 2>/dev/null)

echo "[bump-version] $CURRENT → $NEW_VERSION (synced plugin.json, marketplace.json, package.json)"
exit 0
