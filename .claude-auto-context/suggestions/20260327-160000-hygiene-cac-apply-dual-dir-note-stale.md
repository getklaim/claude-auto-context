# Suggestion: skill-md-dual-dir-sync.md note incorrectly excludes cac-apply from dual-dir list

## Status
pending

## Created
2026-03-27T16:00:00Z

## Category
hygiene-stale

## Problem

`skill-md-dual-dir-sync.md` contains a note:

> (Note: `cac-apply` and `cac-create-skill` exist only in `.claude/skills/`, not in `skills/`.)

This is factually wrong for `cac-apply`. The file `skills/cac-apply/SKILL.md` exists on disk (verified by Glob). The note's claim that cac-apply has no copy in `skills/` is stale — cac-apply was added to the `skills/` directory after the rule was written.

Practical consequence: when Claude edits `.claude/skills/cac-apply/SKILL.md`, the rule's note implies no sync is required (because "cac-apply exists only in `.claude/skills/`"). In reality both copies must be synced, but the rule exempts cac-apply from the sync requirement. This silently breaks the dual-dir invariant for cac-apply.

The note is correct for `cac-create-skill` — `skills/cac-create-skill/SKILL.md` does not exist.

## Proposal

Update `skill-md-dual-dir-sync.md` to:

1. Add `cac-apply` to the "Current skills with dual copies" list.
2. Fix the Note to remove cac-apply from the single-copy exception:

```markdown
## Current skills with dual copies

- `create-suggestion`
- `context-hygiene`
- `extract-rules`
- `cac-apply`

(Note: `cac-create-skill` exists only in `.claude/skills/`, not in `skills/`.)
```

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: `.claude/rules/local/skill-md-dual-dir-sync.md`
- Glob verified: `skills/cac-apply/SKILL.md` → 1 match; `skills/cac-create-skill/SKILL.md` → 0 matches
- Check: H-03

## Metrics
- Stale claims in rule: 1 (cac-apply incorrectly listed as single-copy)
- Correct claims in rule: 1 (cac-create-skill correctly listed as single-copy)
- Risk: silent sync omission for cac-apply edits
