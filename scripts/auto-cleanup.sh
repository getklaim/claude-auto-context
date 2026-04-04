#!/bin/bash
# Auto-cleanup stale rules and skills
# Runs on session start via Setup hook
# 1. Convention decay: force-deletes rules with last_validated older than 60 days
# 2. Stale glob cleanup: deletes rules whose globs match 0 files
# 3. Skills cleanup: warns about missing frontmatter, deletes only if stale: true

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
RULES_DIR="$PROJECT_DIR/.claude/rules"
SKILLS_DIR="$PROJECT_DIR/.claude/skills"
ROOT_SKILLS_DIR="$PROJECT_DIR/skills"
FORCE_DAYS=60

# --- Convention Decay ---
# Force-delete rules with last_validated older than FORCE_DAYS

cleanup_decay() {
  [[ -d "$RULES_DIR" ]] || return 0

  today_epoch=$(date +%s)

  for rule_file in "$RULES_DIR"/*.md "$RULES_DIR"/local/*.md; do
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
}

# --- Skills Cleanup ---
# Warn about skills missing name: or description: in frontmatter
# Only delete if stale: true is explicitly set

cleanup_skills_in_dir() {
  local skills_dir="$1"
  [[ -d "$skills_dir" ]] || return 0

  for skill_dir in "$skills_dir"/*/; do
    [[ -d "$skill_dir" ]] || continue

    skill_file="$skill_dir/SKILL.md"
    [[ -f "$skill_file" ]] || continue

    # Extract frontmatter
    frontmatter=$(awk '/^---$/{p=!p; if(!p) exit; next} p' "$skill_file")

    has_name=$(echo "$frontmatter" | grep -c '^name:' || true)
    has_desc=$(echo "$frontmatter" | grep -c '^description:' || true)
    is_stale=$(echo "$frontmatter" | grep -c '^stale:[[:space:]]*true' || true)

    if [[ $is_stale -gt 0 ]]; then
      rm -rf "$skill_dir"
    elif [[ $has_name -eq 0 ]] || [[ $has_desc -eq 0 ]]; then
      echo "[auto-cleanup] WARNING: $(basename "$skill_dir") is missing name/description in SKILL.md frontmatter"
    fi
  done
}

# Run all cleanup
cleanup_decay
cleanup_skills_in_dir "$SKILLS_DIR"
cleanup_skills_in_dir "$ROOT_SKILLS_DIR"

exit 0
