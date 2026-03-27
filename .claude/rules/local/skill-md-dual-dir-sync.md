---
globs:
  - ".claude/skills/**"
  - "skills/**"
---

# SKILL.md Dual-Directory Sync Requirement

Every SKILL.md file exists in two mirrored locations that must be kept in sync:

- `.claude/skills/{skill-name}/SKILL.md` — the active copy loaded by Claude Code
- `skills/{skill-name}/SKILL.md` — the distribution/source copy committed to the repo

**Rule**: When editing any SKILL.md, ALWAYS update both copies in the same operation. Never update one without the other.

## Current skills with dual copies

- `create-suggestion`
- `context-hygiene`
- `extract-rules`

(Note: `cac-apply` and `cac-create-skill` exist only in `.claude/skills/`, not in `skills/`.)

## Verification

After any SKILL.md edit, confirm both paths are modified:
```
git status | grep SKILL.md
```
Both `.claude/skills/{name}/SKILL.md` and `skills/{name}/SKILL.md` must appear.

Evidence: git status in session 615e4373 showed parallel `M` entries across both trees. Confirmed pattern across multiple sessions.
