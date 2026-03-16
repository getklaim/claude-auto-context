---
globs: ".claude/rules/**"
---

# Rules Authoring Conventions

## Frontmatter

Use `globs:` as the scoping key — NOT `paths:`. Using `paths:` is silently ignored by Claude Code and causes the rule to apply to every file in the project.

Correct:
```yaml
---
globs: "src/payments/**"
---
```

Wrong (do not use):
```yaml
---
paths: "src/payments/**"
---
```

## Content: Tacit Knowledge Only

Rules files must contain only information that is NOT readable from source code. If Claude can find the answer by reading a file, it does not belong in a rules file.

Do NOT put in rules:
- Type definitions or data model field lists (readable from source)
- API endpoint URLs or HTTP methods (readable from source)
- Component names or file lists (discoverable via Glob)
- Configuration values already in config files

DO put in rules:
- Non-obvious pitfalls (e.g. "field X in the API means Y, not Z")
- Sequencing requirements not enforced by types (e.g. "check quota before creating")
- Implicit conventions the team follows that aren't written anywhere
- Traps that have caused bugs before

## Length

Target 30-50 lines per rules file. A rules file that reaches 150+ lines is almost certainly including information that belongs in source code comments or documentation, not in Claude's context window. Long rules files waste context and dilute the signal.

## Scope

Use the narrowest glob that covers the relevant files. Prefer `src/auth/**` over `src/**` over `**`. An overly broad glob causes the rule to load into every conversation, burning context budget unnecessarily.
