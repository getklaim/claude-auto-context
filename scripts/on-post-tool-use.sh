#!/usr/bin/env bash
# PostToolUse Hook
# Pipes raw JSON from stdin to collector.

source "$(dirname "$0")/common.sh"

cat | run_collector PostToolUse

exit 0
