---
name: extract-rules
description: Extract conventions and implicit knowledge from session data into .claude/rules/local/ files. USE WHEN repeated patterns are found across sessions.
---

# Extract Rules

Analyze session data to find implicit conventions, then create glob-scoped rules in `.claude/rules/local/`.

Rules = "institutional memory" (Boris Cherny). When Claude makes a mistake, the correction becomes a permanent rule so it never repeats.

## The Boris Test

For every candidate rule, ask: **"Would removing this cause Claude to make mistakes?"**
If no → don't create it. If yes → create it.

## What Belongs in Rules (extract these)

Rules capture what Claude CANNOT discover by reading code, configs, or package.json:

| Category | Example | Why it's a rule |
|----------|---------|-----------------|
| Past mistake prevention | "Never use enum, always literal unions" | Correction from user, not in any config |
| Non-obvious commands | "Run `bun run test:file -- 'glob'`" | Can't guess the flag syntax |
| Prohibitions | "Never touch prod DB directly" | Safety rail, not in code |
| Hidden sequencing | "Refresh auth token before API calls" | Order dependency not obvious from code |
| Convention divergence | "Error handling: Result type, not try-catch" | Project chose non-default pattern |
| Gotchas | "File X re-exports from Y — edit Y, not X" | Non-obvious indirection |

## What Does NOT Belong (never create these)

| Bad Rule | Why | What to do instead |
|----------|-----|-------------------|
| "This project uses TypeScript" | tsconfig.json exists | Nothing — Claude reads it |
| "Tests are in __tests__/" | Discoverable from directory structure | Nothing |
| "Use ES modules" | package.json type:module | Nothing |
| "Write clean code" | Self-evident, every project wants this | Nothing |
| "The API returns JSON" | Discoverable from reading route handlers | Nothing |
| Code style already enforced by linter | ESLint/Prettier handles it deterministically | Hook, not rule |
| Anything in CLAUDE.md already | Duplication wastes tokens | Reference CLAUDE.md |
| Frequently changing information | Goes stale, causes wrong behavior | Keep in code comments |

**Key principle (Anthropic official):** "Never send an LLM to do a linter's job." If something can be enforced deterministically (format, lint, type-check), it should be a hook, not a rule.

## Source Priority for Rule Extraction

Focus on "User Prompts" section of session data. This is where corrections live:

1. **Explicit corrections** (highest value): "don't do X", "use Y instead", "never Z"
2. **Repeated frustration patterns**: user corrects same behavior 2+ times across sessions
3. **Non-obvious commands**: user types specific build/test/deploy commands that Claude gets wrong
4. **Architecture decisions not in code**: "we use X pattern because Y" where Y isn't documented

Session "Tool Activity" is secondary — use it to verify patterns, not as primary extraction source.

## Output Format

```markdown
---
description: "One-line summary — used for dedup and context display"
paths:
  - "src/auth/**"
created: "2026-03-30"
last_validated: "2026-03-30"
---

[Rule in 1-3 sentences. Specific trigger → specific action.]
```

- `created`: ISO date when the rule was first written
- `last_validated`: ISO date when the rule was last confirmed still relevant (set to today on create/update)

**Size:** Each rule file should be under 200 characters body. One rule per file. If you need more detail, you're writing documentation, not a rule.

**Bad:** 500 chars explaining the history and rationale of why Result type is used.
**Good:** "Error handling: use Result<T, E>, not try-catch. Functions return {ok, error} shape."

## Procedure

1. Review "Existing Rules" topic index — if your candidate covers the same topic, UPDATE don't duplicate
2. Scan "User Prompts" for corrections, prohibitions, non-obvious instructions
3. For each candidate:
   a. Apply the Boris Test: "Would removing this cause Claude to make mistakes?"
   b. Verify NOT discoverable from code (use Glob/Read to check configs, package.json, tsconfig)
   c. Verify not already a hook or in CLAUDE.md
4. Write to `.claude/rules/local/` with required `description:` in frontmatter
5. Scope narrowly: prefer `src/auth/**` over `**`
6. Project-wide knowledge: omit `paths:` — applies globally

## Global vs Scoped Rules

- **Scoped** (`paths:` present): file/directory-specific conventions
- **Global** (no `paths:`): project-wide prohibitions, non-obvious commands, safety rails
- Global rules replace CLAUDE.md additions for tacit knowledge
- When in doubt, scope narrowly — a rule that fires for irrelevant files is noise

## Cross-Cycle Observations

If a pattern is not yet strong enough (seen only once), write to `.claude-auto-context/pending-observations.json`:
```json
[{"pattern_key": "descriptive-key", "session_id": "...", "evidence": "brief desc", "agent_source": "rules-agent"}]
```
Read existing file first, append entries. Rules require 2+ session evidence.
