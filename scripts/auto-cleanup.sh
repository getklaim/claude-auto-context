#!/bin/bash
# Auto-cleanup stale rules and skills
# Runs silently on session start via Setup hook

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
RULES_DIR="$PROJECT_DIR/.claude/rules"
SKILLS_DIR="$PROJECT_DIR/.claude/skills"
ROOT_SKILLS_DIR="$PROJECT_DIR/skills"

# --- Rules Cleanup ---
# Delete rules without globs: frontmatter (not project-scoped)
# Delete rules with globs that match 0 files (stale references)

cleanup_rules() {
  [[ -d "$RULES_DIR" ]] || return 0

  for rule_file in "$RULES_DIR"/*.md; do
    [[ -f "$rule_file" ]] || continue

    # Extract frontmatter (between first two ---)
    frontmatter=$(awk '/^---$/{p=!p; if(!p) exit; next} p' "$rule_file")

    # Extract globs value
    globs=$(echo "$frontmatter" | grep '^globs:' | sed 's/^globs:[[:space:]]*["'"'"']\{0,1\}\([^"'"'"']*\)["'"'"']\{0,1\}/\1/' || true)

    if [[ -z "$globs" ]]; then
      # No globs = not project-scoped, delete
      rm -f "$rule_file"
      continue
    fi

    # Check if globs match any files (handle comma-separated globs)
    IFS=',' read -ra glob_patterns <<< "$globs"
    found=0
    for pattern in "${glob_patterns[@]}"; do
      pattern=$(echo "$pattern" | xargs)  # trim whitespace
      # Use find instead of compgen for better compatibility
      if find "$PROJECT_DIR" -path "$PROJECT_DIR/$pattern" -print -quit 2>/dev/null | grep -q .; then
        found=1
        break
      fi
      # Also try with shell globbing
      if ls $PROJECT_DIR/$pattern 1>/dev/null 2>&1; then
        found=1
        break
      fi
    done

    if [[ $found -eq 0 ]]; then
      # Globs match 0 files = stale reference, delete
      rm -f "$rule_file"
    fi
  done
}

# --- Skills Cleanup ---
# Delete skills without name: or description: in frontmatter

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

    if [[ $has_name -eq 0 ]] || [[ $has_desc -eq 0 ]]; then
      # Missing required frontmatter, delete skill directory
      rm -rf "$skill_dir"
    fi
  done
}

# Run cleanup
cleanup_rules
cleanup_skills_in_dir "$SKILLS_DIR"
cleanup_skills_in_dir "$ROOT_SKILLS_DIR"

exit 0
