---
globs:
  - ".claude-auto-context/suggestions/**"
  - ".claude-auto-context/skill-cap.mjs"
  - ".claude-auto-context/worker.mjs"
  - ".claude/skills/create-suggestion/SKILL.md"
  - ".claude/skills/context-hygiene/SKILL.md"
  - "skills/create-suggestion/SKILL.md"
  - "skills/context-hygiene/SKILL.md"
---

# Suggestion Filename Convention — Type-Prefix Required

Suggestion files in `.claude-auto-context/suggestions/` MUST be named with a type prefix that identifies their origin. The type prefix comes before the timestamp.

## Required formats by creation path

| Creation path | Filename format |
|---------------|----------------|
| `create-suggestion` skill | `suggestion-YYYYMMDD-HHMMSS-{slug}.md` |
| `context-hygiene` skill | `hygiene-YYYYMMDD-HHMMSS-{slug}.md` |
| `skill-cap.mjs` (cap reached) | `suggestion-YYYYMMDD-HHMMSS-skill-cap-reached.md` |
| `worker.mjs` inline hygiene prompt | `hygiene-YYYYMMDD-HHMMSS-{slug}.md` |

## Do NOT use the old formats

- `YYYYMMDD-HHMMSS-{slug}.md` (no type prefix) — old format, replaced
- `YYYYMMDD-HHMMSS-hygiene-{slug}.md` (type in slug position, not prefix position) — old format, replaced
- `{NNN}-{slug}.md` (sequential numbers) — old format, replaced

The type prefix is required for at-a-glance distinguishability between suggestion types in the suggestions directory. Without it, `2026`-prefixed files appeared to be year-named (session 2787571a: files named `2027-hygiene-bloat.md` were sequence numbers, not years — causing confusion).

Evidence: user-explicit convention established in session 2787571a ("hygiene 이랑 suggestions 이랑 네이밍 통일 해야함. 앞에 뭐 suggestions-YYYYMM, hygiene-YYYYMMM 이런식으로"). Production SKILL.md files updated in same session.
