# Suggestion: skill-md-dual-dir-sync.md has incorrect note about cac-apply

## Status
pending

## Created
2026-03-27T14:00:00Z

## Category
hygiene-contradiction

## Problem

`skill-md-dual-dir-sync.md` contains this note:

> (Note: `cac-apply` and `cac-create-skill` exist only in `.claude/skills/`, not in `skills/`.)

However, `skills/cac-apply/SKILL.md` **does exist** in the repository (confirmed via Glob). The note is factually wrong for `cac-apply`.

This causes two concrete problems:
1. Claude will skip syncing `skills/cac-apply/SKILL.md` when editing `.claude/skills/cac-apply/SKILL.md`, silently breaking the sync rule for that skill.
2. The "Current skills with dual copies" list omits `cac-apply` — so the dual-sync rule will not be applied to it, even though it should be.

Current reality from Glob:
| Path | Exists |
|---|---|
| `.claude/skills/cac-apply/SKILL.md` | ✓ |
| `skills/cac-apply/SKILL.md` | ✓ (rule says ✗) |
| `.claude/skills/cac-create-skill/SKILL.md` | ✓ |
| `skills/cac-create-skill/SKILL.md` | ✗ (rule is correct here) |

## Proposal

Update the note in `.claude/rules/local/skill-md-dual-dir-sync.md`:

```
(Note: `cac-create-skill` exists only in `.claude/skills/`, not in `skills/`.)
```

And add `cac-apply` to the "Current skills with dual copies" list.

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: `.claude/rules/local/skill-md-dual-dir-sync.md`, `skills/cac-apply/SKILL.md`
- Check: H-02

## Metrics
- Incorrect claims: 1 of 2 skills named in the note are wrong (50% error rate in the note)
- Affected sync obligations silently skipped: 1 (cac-apply edits won't prompt dual-sync)
