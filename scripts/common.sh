#!/usr/bin/env bash
# Common utilities for hooks
# Source this file: source "$(dirname "$0")/common.sh"

# Paths
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
LOG_FILE="$PROJECT_DIR/.claude-auto-context/hooks.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null

# Logging
log() {
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $*" >> "$LOG_FILE"
}

log_error() {
  log "ERROR: $*"
}

# Dependency checks
has_bun() {
  command -v bun &>/dev/null
}

has_jq() {
  command -v jq &>/dev/null
}

check_deps() {
  local missing=()
  has_bun || missing+=("bun")
  has_jq || missing+=("jq")

  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing dependencies: ${missing[*]}"
    return 1
  fi
  return 0
}

# Run collector safely
run_collector() {
  local event="$1"
  if has_bun; then
    bun "$PLUGIN_ROOT/.claude-auto-context/collector.mjs" "$event" 2>/dev/null || true
  else
    log_error "bun not found, skipping collector for $event"
  fi
}
