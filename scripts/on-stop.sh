#!/bin/bash
# Stop Hook
# Fires: when Claude finishes responding
# Input (stdin): { hook_event_name, stop_hook_active, last_assistant_message, session_id }
# Output (stdout): { ok: boolean, reason?: string }
# ok=false -> prevents Claude from stopping

INPUT=$(cat)

cat <<EOF
{
  "ok": true
}
EOF

exit 0
