---
name: extract-rules
description: Extract conventions and implicit knowledge from session data into .claude/rules/local/ files. USE WHEN repeated patterns are found across 2+ sessions.
---

# Extract Rules

Analyze session observation data to find conventions and implicit knowledge, then create or update glob-scoped rules files in `.claude/rules/local/`.

## Qualification Criteria (ALL must be true)

1. **Not discoverable from code** -- if findable by reading source files, configs, or package.json, it does NOT belong in rules
2. **Observed in session data** -- even a single clear convention is worth capturing if the pattern is unambiguous. Stronger confidence when seen in 2+ sessions (check BOTH the current batch AND the "Cross-Cycle Observations" section), but do not discard obvious conventions just because they appeared only once.
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

Each rules file uses YAML frontmatter with path scoping:

```markdown
---
globs:
  - "src/auth/**"
---

[Description of the convention or implicit knowledge.]
Evidence: observed in sessions [session_id_1, session_id_2].
```

## Procedure

1. Review the existing rules summary provided in your prompt (if any) to avoid duplication with both auto-generated and committed team rules
2. Analyze session data for conventions and implicit knowledge
3. For each candidate:
   a. Verify the pattern is clear and unambiguous (stronger if 2+ sessions, but 1 session OK if obvious)
   b. Verify NOT discoverable from code (use Glob/Read to check)
   c. Verify no duplication with existing rules (local or committed)
4. Write new rules files to `.claude/rules/local/`
5. Use narrow glob scoping (prefer `src/auth/**` over `**`)
6. For project-wide knowledge (not file-scoped), omit `globs:` from frontmatter — the rule will apply globally

## Cross-Cycle Observations

You may receive a "Cross-Cycle Observations" section listing patterns seen in prior poll cycles.
- If a pattern in the current batch + observations reaches 2+ distinct sessions → create the rule
- If a pattern is new (only 1 session so far) → write it to `.claude-auto-context/pending-observations.json` for future cycles

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
- Do NOT create rules from ambiguous or unclear patterns (single session OK if the convention is obvious)
- Do NOT use overly broad glob patterns
- Do NOT repeat information already in CLAUDE.md
- Do NOT create trivial rules ("use semicolons" in a TS project)
