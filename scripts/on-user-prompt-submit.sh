#!/bin/bash
# UserPromptSubmit Hook
# Fires: before Claude processes user input
# Input (stdin): { hook_event_name, prompt, model, session_id }
# Output (stdout): { context?: string, decision?: "block", reason?: string }
# Exit 0 = allow, Exit 2 = block

INPUT=$(cat)

exit 0
