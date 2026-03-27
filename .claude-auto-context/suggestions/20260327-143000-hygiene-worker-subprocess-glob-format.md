# Suggestion: worker-subprocess.md uses comma-separated glob string instead of YAML array

## Status
pending

## Created
2026-03-27T14:30:00Z

## Category
hygiene-stale

## Problem

`.claude/rules/worker-subprocess.md` has frontmatter:

```yaml
globs: ".claude-auto-context/**,scripts/worker-launcher.sh"
```

This uses a single comma-separated string, while every local rule uses a proper YAML array:

```yaml
globs:
  - ".claude-auto-context/suggestions/**"
  - ".claude-auto-context/skill-cap.mjs"
```

If Claude Code treats the value as one glob pattern, the literal string
`".claude-auto-context/**,scripts/worker-launcher.sh"` matches 0 files
(no filesystem path contains a comma). The glob scoping for this rule is
therefore silently non-functional — the rule loads for every file instead
of only the intended scope.

CLAUDE.md already notes that the frontmatter key name matters (`globs:` not
`paths:`); the value format (string vs. array) carries the same risk.

## Proposal

The committed file is READ-ONLY, so file a report so a maintainer can update
`.claude/rules/worker-subprocess.md` frontmatter to use YAML array format:

```yaml
---
globs:
  - ".claude-auto-context/**"
  - "scripts/worker-launcher.sh"
---
```

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: `.claude/rules/worker-subprocess.md`, `.claude/rules/local/skill-md-dual-dir-sync.md`, `.claude/rules/local/suggestion-file-format.md`
- Check: H-03

## Metrics
- Glob patterns effectively matching 0 files: 1 (the combined comma-string pattern)
- Intended target paths: 2 (`.claude-auto-context/**`, `scripts/worker-launcher.sh`)
- Local rules using correct YAML array format: 2/2 (100%)
