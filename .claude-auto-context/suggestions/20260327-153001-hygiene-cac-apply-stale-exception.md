# Suggestion: skill-md-dual-dir-sync.md exception note is stale — cac-apply now has a skills/ copy

## Status
pending

## Created
2026-03-27T15:30:01Z

## Category
hygiene-stale

## Problem

`.claude/rules/local/skill-md-dual-dir-sync.md` contains this note:

> (Note: `cac-apply` and `cac-create-skill` exist only in `.claude/skills/`, not in `skills/`.)

Glob check result:
```
skills/cac-apply/SKILL.md   ← EXISTS
```

`cac-apply` now has a copy in `skills/`, so the exception note is wrong for it.
Only `cac-create-skill` remains a true exception (no file found at `skills/cac-create-skill/SKILL.md`).

The stale claim means the "Current skills with dual copies" section also under-lists; `cac-apply` should now be in that list alongside `create-suggestion`, `context-hygiene`, and `extract-rules`.

## Proposal

Update `.claude/rules/local/skill-md-dual-dir-sync.md` (this file is in `local/`, so it is writable):

1. Add `cac-apply` to the "Current skills with dual copies" list.
2. Update the exception note to reference only `cac-create-skill`:

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
- Glob used: `skills/cac-*/**` → returned `skills/cac-apply/SKILL.md`
- Check: H-03

## Metrics
- Stale exception claims: 1 of 2 (`cac-apply` claim is wrong; `cac-create-skill` claim is still correct)
