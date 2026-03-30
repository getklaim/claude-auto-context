---
description: "Plugin-shipped skills need dual-dir sync; runtime-generated skills go to .claude/skills/ only"
globs:
  - ".claude/skills/**"
  - "skills/**"
---

# SKILL.md Directory Rules

Two different types of skills, two different rules:

## 1. Plugin-shipped skills (manual, checked into repo)

These exist in two mirrored locations:

- `skills/{skill-name}/SKILL.md` — distribution copy shipped with the plugin
- `.claude/skills/{skill-name}/SKILL.md` — active copy loaded by Claude Code

When editing these, update both copies. Current plugin-shipped skills:
- `create-suggestion`
- `context-hygiene`
- `extract-rules`
- `cac-apply`
- `cac-create-skill`

## 2. Runtime-generated skills (created by skill-agent in target projects)

These go to `.claude/skills/{skill-name}/SKILL.md` **only** in the target project.

Do NOT write to `skills/` — that is the plugin distribution directory, not the target project's concern.
