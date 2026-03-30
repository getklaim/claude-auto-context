#!/bin/bash
# Auto-cleanup stale rules (convention decay safety net)
# Runs on session start via Setup hook
# Force-deletes rules with last_validated older than 60 days

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
RULES_DIR="$PROJECT_DIR/.claude/rules"
FORCE_DAYS=60

[[ -d "$RULES_DIR" ]] || exit 0

today_epoch=$(date +%s)

for rule_file in "$RULES_DIR"/*.md; do
  [[ -f "$rule_file" ]] || continue

  # Extract last_validated from frontmatter
  lv=$(awk '/^---$/{p=!p; if(!p) exit; next} p && /^last_validated:/' "$rule_file" \
    | sed 's/^last_validated:[[:space:]]*["]*\([0-9-]*\)["]*$/\1/' || true)

  # Skip rules without last_validated (legacy or project-wide)
  [[ -z "$lv" ]] && continue

  # Calculate days since last validation
  lv_epoch=$(date -j -f "%Y-%m-%d" "$lv" +%s 2>/dev/null || date -d "$lv" +%s 2>/dev/null || echo "0")
  [[ "$lv_epoch" -eq 0 ]] && continue

  days_since=$(( (today_epoch - lv_epoch) / 86400 ))

  if [[ $days_since -ge $FORCE_DAYS ]]; then
    rm -f "$rule_file"
    echo "[auto-cleanup] Removed stale rule: $(basename "$rule_file") (${days_since}d since last validation)"
  fi
done

exit 0
