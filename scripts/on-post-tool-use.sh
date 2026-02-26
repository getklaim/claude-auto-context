#!/bin/bash
# PostToolUse Hook
# Fires: after successful tool execution
# Input (stdin): { hook_event_name, tool_name, tool_input, tool_response, session_id }
# Output (stdout): { context?: string }
# Exit 0 = success

INPUT=$(cat)

exit 0
