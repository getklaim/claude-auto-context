---
name: extract-rules
description: Extract conventions and implicit knowledge from session data into .claude/rules/local/ files. USE WHEN repeated patterns are found across sessions.
---

# Extract Rules

Analyze session observation data to find conventions and implicit knowledge, then create or update glob-scoped rules files in `.claude/rules/local/`.

## Qualification Criteria (ALL must be true)

1. **Not discoverable from code** -- if findable by reading source files, configs, or package.json, it does NOT belong in rules
2. **Actionable** -- must change Claude's behavior (conventions, prohibitions, preferred patterns)

### Good Rules (extract these)
- "Error handling uses Result type, not try-catch" (convention not written anywhere)
- "Never use ORM X -- project uses raw SQL" (prohibition not visible in code)
- "Auth tokens must be refreshed before API calls" (non-obvious sequencing)

### Bad Rules (DO NOT extract)
- "The project uses TypeScript" (discoverable from tsconfig.json)
- "Tests are in __tests__ directories" (discoverable from directory structure)
- "The API returns JSON" (discoverable from code)

## Output Format

Each rules file uses YAML frontmatter with `description:` (required) and optional path scoping:

```markdown
---
description: "One-line summary of what topic this rule covers"
globs:
  - "src/auth/**"
---

[Description of the convention or implicit knowledge.]
Evidence: observed in sessions [session_id_1, session_id_2].
```

The `description:` field is mandatory. It must be a single line summarizing the rule's topic. This description is used for topic-level deduplication across cycles.

## Procedure

1. Review the "Existing Rules" topic index injected in your prompt — each line is `filename: one-line description`. If your candidate covers the same topic as an existing rule, do NOT create a new file. Update the existing file only if the new evidence adds value.
2. Analyze session data for repeated patterns
3. For each candidate:
   a. Check topic index for overlap — same topic = same rule, even if worded differently
   b. Verify NOT discoverable from code (use Glob/Read to check)
4. Write new rules files to `.claude/rules/local/` with required `description:` in frontmatter
5. Use narrow glob scoping (prefer `src/auth/**` over `**`)
6. For project-wide knowledge (not file-scoped), omit `globs:` from frontmatter — the rule will apply globally

## Cross-Cycle Observations

You may receive a "Cross-Cycle Observations" section listing patterns seen in prior poll cycles.
- Use observations as additional context when judging whether a pattern warrants a rule
- If a pattern is not yet strong enough to warrant a rule → write it to `.claude-auto-context/pending-observations.json` for future cycles

### Writing Observations

Write a JSON array to `.claude-auto-context/pending-observations.json`:
```json
[{"pattern_key": "descriptive-key", "session_id": "the-session-id", "evidence": "brief description", "agent_source": "rules-agent"}]
```
If the file already exists, read it first and append your entries to the existing array.

## Global vs Scoped Rules

- **Scoped rules**: Include `globs:` frontmatter to target specific file patterns
- **Global rules**: Omit `globs:` entirely — Claude applies these to ALL files project-wide
- Global rules replace CLAUDE.md additions for project-wide tacit knowledge
- Use global rules for: non-obvious build commands, dangerous naming traps, hidden dependencies
- Use scoped rules for: file-type conventions, directory-specific patterns

## Anti-Patterns

- Do NOT create rules duplicating code or config files
- Do NOT create rules for patterns that are likely one-off or accidental
- Do NOT use overly broad glob patterns
- Do NOT repeat information already in CLAUDE.md
- Do NOT create trivial rules ("use semicolons" in a TS project)
