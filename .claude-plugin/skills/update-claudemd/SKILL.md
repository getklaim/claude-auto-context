---
name: update-claudemd
description: Update CLAUDE.md with non-obvious execution methods and project-wide tacit knowledge. USE WHEN essential information is missing that every session needs.
---

# Update CLAUDE.md

Analyze session data to identify non-obvious project knowledge that should be added to CLAUDE.md. Minimal, high-value additions only.

## Qualification Criteria (ALL must be true)

1. **Project-specific trap** -- a concrete fact about THIS project that causes mistakes if unknown (wrong path, wrong command, hidden dependency, non-obvious convention)
2. **Not discoverable from code** -- cannot be found by reading source files, configs, constants, or package.json
3. **Needed every session** -- relevant to nearly all tasks, not just specific domains
4. **Stable** -- does not change frequently (no in-progress status, no temporary state)
5. **High signal** -- without it, Claude makes mistakes

### Decision Tree: Where does it go?

- **Coding principles, workflow preferences, behavioral rules** → `.claude/rules/` (NOT CLAUDE.md)
- **Project progress, temporary status, what's done/not done** → `tasks/todo.md` or conversation (NOT CLAUDE.md)
- **Code constants, config values, architecture** → discoverable from code (NOT CLAUDE.md)
- **Non-obvious project traps that cause repeated mistakes** → CLAUDE.md ✓

### Good Additions
- Non-obvious build/test commands: "Run tests: `bun test --filter=unit` (not `bun test`)"
- Dangerous naming traps: "DB is `claude-auto-context.db` (NOT `auto-context.db`)"
- Hidden dependencies: "Version must match in 3 files: X, Y, Z"
- Counter-intuitive URLs/paths: "Docs at `code.claude.com` (NOT `docs.anthropic.com`)"

### Bad Additions (DO NOT add)
- Architecture maps (discoverable via ls/Glob)
- API documentation (discoverable from code)
- File descriptions (code is the documentation)
- Anything already in `.claude/rules/` files
- **Work style/principles** (e.g., "simplicity first", "plan before coding") → `.claude/rules/`
- **Workflow orchestration** (e.g., "use subagents", "enter plan mode") → `.claude/rules/`
- **Project progress/status** (e.g., "feature X is not yet validated") → `tasks/`
- **Runtime constants readable from code** (e.g., poll intervals, timeout values)

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
