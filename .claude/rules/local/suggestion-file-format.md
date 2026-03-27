---
globs:
  - ".claude-auto-context/suggestions/**"
  - ".claude-auto-context/skill-cap.mjs"
  - ".claude-auto-context/worker.mjs"
  - ".claude/skills/create-suggestion/SKILL.md"
  - "skills/create-suggestion/SKILL.md"
---

# Suggestion File Format — Required `## Created` Field

Suggestion files in `.claude-auto-context/suggestions/` MUST include a `## Created` section in the file body with an ISO 8601 UTC timestamp. The filename prefix (YYYYMMDD-HHMMSS) alone is not sufficient — the creation date must also appear inside the file.

## Required section order

```markdown
## Status
pending

## Created
{ISO 8601 UTC timestamp, e.g. 2026-03-27T14:30:52Z}

## Category
...
```

The `## Created` section goes between `## Status` and `## Category`.

## Applies to all creation paths

- `create-suggestion` skill: insert `## Created\n{timestamp}` between `## Status\npending` and `## Category` in the template
- `context-hygiene` skill hygiene suggestion format: same field required
- `worker.mjs` inline hygiene prompt template: same field required
- `skill-cap.mjs` programmatic suggestion creation: insert `\n\n## Created\n${now.toISOString()}` between `pending` and `## Category`

Evidence: user-explicit convention established in session 615e4373 ("suggestions에 언제 생성된건지 명시해야겠다"). Plan written in session 615e4373 targeting all 6 creation paths.
