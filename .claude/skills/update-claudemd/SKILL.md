---
name: update-claudemd
description: Update CLAUDE.md with non-obvious execution methods and project-wide tacit knowledge. USE WHEN essential information is missing that every session needs.
---

# Update CLAUDE.md

Analyze session data to identify non-obvious project knowledge that should be added to CLAUDE.md. Minimal, high-value additions only.

## Qualification Criteria (ALL must be true)

1. **Not discoverable from code** -- cannot be found by reading source files, configs, or package.json
2. **Needed every session** -- relevant to nearly all tasks, not just specific domains
3. **Stable** -- does not change frequently
4. **High signal** -- without it, Claude makes mistakes

Domain-specific info belongs in `.claude/rules/` instead.

### Good Additions
- Non-obvious build/test commands: "Run tests: `bun test --filter=unit` (not `bun test`)"
- Runtime ordering: "Service A must start before Service B"
- Prohibition: "Never use library X, use Y instead"

### Bad Additions (DO NOT add)
- Architecture maps (discoverable via ls/Glob)
- API documentation (discoverable from code)
- File descriptions (code is the documentation)
- Anything already in `.claude/rules/` files

## Constraints

- **Maximum 3 lines** per single update
- Use **Edit tool only** (never Write -- preserve existing content)
- Append to end of file, do not restructure existing sections
- Terse and actionable, no verbose explanations

## Procedure

1. Read current CLAUDE.md to understand what is already documented
2. Read existing `.claude/rules/` to avoid duplication
3. Analyze session data for patterns indicating missing knowledge:
   - Repeated trial-and-error for build/test commands
   - Same mistake made across multiple sessions
   - Information manually provided by user each session
4. Add ONLY the minimal necessary information

## Anti-Patterns

- Do NOT rewrite or restructure existing CLAUDE.md content
- Do NOT add domain-specific information (use rules/ instead)
- Do NOT add information discoverable from code
- Do NOT exceed 3 lines per update
