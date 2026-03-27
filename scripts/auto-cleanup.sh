#!/usr/bin/env zsh
# Auto-cleanup stale rules and skills
# Runs silently on session start via Setup hook

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
RULES_DIR="$PROJECT_DIR/.claude/rules"
SKILLS_DIR="$PROJECT_DIR/.claude/skills"
ROOT_SKILLS_DIR="$PROJECT_DIR/skills"

# --- Rules Cleanup ---
# Delete rules with globs that match 0 files (stale references)
# Rules without globs are project-wide rules — keep them

cleanup_rules() {
  [[ -d "$RULES_DIR" ]] || return 0

  for rule_file in "$RULES_DIR"/*.md; do
    [[ -f "$rule_file" ]] || continue

    # Extract frontmatter (between first two ---)
    frontmatter=$(awk '/^---$/{p=!p; if(!p) exit; next} p' "$rule_file")

    # Extract globs value
    globs=$(echo "$frontmatter" | grep '^globs:' | sed 's/^globs:[[:space:]]*["'"'"']\{0,1\}\([^"'"'"']*\)["'"'"']\{0,1\}/\1/' || true)

    if [[ -z "$globs" ]]; then
      # No globs = project-wide rule, keep it
      continue
    fi

    # Check if globs match any files (handle comma-separated globs)
    IFS=',' read -rA glob_patterns <<< "$globs"
    found=0

    # Enable recursive globbing and empty-match safety (zsh built-in)
    setopt EXTENDED_GLOB NULL_GLOB 2>/dev/null

    for pattern in "${glob_patterns[@]}"; do
      pattern=$(echo "$pattern" | xargs)  # trim whitespace
      files=( $PROJECT_DIR/$pattern )
      if [[ ${#files[@]} -gt 0 ]]; then
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
      # Explicitly marked as stale, delete
      rm -rf "$skill_dir"
    elif [[ $has_name -eq 0 ]] || [[ $has_desc -eq 0 ]]; then
      # Missing frontmatter, warn but don't delete
      echo "[auto-cleanup] WARNING: $(basename "$skill_dir") is missing name/description in SKILL.md frontmatter"
    fi
  done
}

# Run cleanup
cleanup_rules
cleanup_skills_in_dir "$SKILLS_DIR"
cleanup_skills_in_dir "$ROOT_SKILLS_DIR"

exit 0
