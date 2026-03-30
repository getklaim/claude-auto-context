---
name: extract-rules
description: Extract conventions and implicit knowledge from session data into .claude/rules/ files. USE WHEN repeated patterns are found across 2+ sessions.
---

# Extract Rules

Analyze session observation data to find conventions and implicit knowledge, then create or update glob-scoped rules files in `.claude/rules/`.

## Qualification Criteria (ALL must be true)

1. **Not discoverable from code** -- if findable by reading source files, configs, or package.json, it does NOT belong in rules
2. **Repeated across 2+ sessions** -- a single occurrence is not a stable convention
3. **Actionable** -- must change Claude's behavior (conventions, prohibitions, preferred patterns)

### Good Rules (extract these)
- "Error handling uses Result type, not try-catch" (convention not written anywhere)
- "Never use ORM X -- project uses raw SQL" (prohibition not visible in code)
- "Auth tokens must be refreshed before API calls" (non-obvious sequencing)

### Bad Rules (DO NOT extract)
- "The project uses TypeScript" (discoverable from tsconfig.json)
- "Tests are in __tests__ directories" (discoverable from directory structure)
- "The API returns JSON" (discoverable from code)

## Output Format

Each rules file uses YAML frontmatter with glob scoping and decay tracking:

```markdown
---
globs: "src/auth/**"
created: "2026-03-30"
last_validated: "2026-03-30"
---

[Description of the convention or implicit knowledge.]
Evidence: observed in sessions [session_id_1, session_id_2].
```

- `created`: ISO date when the rule was first written
- `last_validated`: ISO date when the rule was last confirmed still relevant (set to today on create/update)

## Procedure

1. Read existing rules in `.claude/rules/` to avoid duplication
2. Analyze session data for repeated patterns
3. For each candidate:
   a. Verify 2+ sessions
   b. Verify NOT discoverable from code (use Glob/Read to check)
   c. Verify no duplication with existing rules
4. Write new rules files or update existing ones
5. Use narrow glob scoping (prefer `src/auth/**` over `**`)

## Anti-Patterns

- Do NOT create rules duplicating code or config files
- Do NOT create rules from a single session observation
- Do NOT use overly broad glob patterns
- Do NOT repeat information already in CLAUDE.md
- Do NOT create trivial rules ("use semicolons" in a TS project)
