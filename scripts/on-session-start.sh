#!/bin/bash
# SessionStart Hook
# Fires: session start (startup), resume, clear, compact
# Input (stdin): { hook_event_name, source, model, session_id }
# Output (stdout): { context?: string, decision?: "block" }
# Exit 0 = allow, Exit 2 = block

INPUT=$(cat)

exit 0
