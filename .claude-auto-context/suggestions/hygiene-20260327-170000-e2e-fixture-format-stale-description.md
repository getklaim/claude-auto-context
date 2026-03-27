# Suggestion: e2e-fixture-create-suggestion-format.md describes outdated "new format"

## Status
pending

## Created
2026-03-27T17:00:00Z

## Category
hygiene-contradiction

## Problem
Two local rules files give conflicting descriptions of the production suggestion filename format:

**`e2e-fixture-create-suggestion-format.md`** (line 8):
> "The production SKILL.md at `.claude/skills/create-suggestion/SKILL.md` uses the **new** format `YYYYMMDD-HHMMSS-{slug}.md`."

**`suggestion-filename-type-prefix.md`** (Do NOT use section):
> "`YYYYMMDD-HHMMSS-{slug}.md` (no type prefix) — old format, replaced"

The format `YYYYMMDD-HHMMSS-{slug}.md` is simultaneously called the "new format" and an "old format, replaced". A reader would receive contradictory guidance about whether `YYYYMMDD-HHMMSS-{slug}.md` is the correct production format.

Root cause: `e2e-fixture-create-suggestion-format.md` was written in session 2787571a when `YYYYMMDD-HHMMSS-{slug}.md` was the current format, but `suggestion-filename-type-prefix.md` was also written in session 2787571a to add type prefixes. The e2e fixture rule's description of the production format was not updated after the type-prefix convention was established.

## Proposal
Update the "new format" description in `e2e-fixture-create-suggestion-format.md` to match the current production format. Change:

```
The production SKILL.md at `.claude/skills/create-suggestion/SKILL.md` uses the **new** format `YYYYMMDD-HHMMSS-{slug}.md`.
```

to:

```
The production SKILL.md at `.claude/skills/create-suggestion/SKILL.md` uses the current format `suggestion-YYYYMMDD-HHMMSS-{slug}.md` (with type prefix).
```

Note: `.claude/rules/local/e2e-fixture-create-suggestion-format.md` is a local auto-generated rule, so it is writable.

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: `.claude/rules/local/e2e-fixture-create-suggestion-format.md`, `.claude/rules/local/suggestion-filename-type-prefix.md`
- Check: H-02

## Metrics
- Contradiction: 2 rules describe `YYYYMMDD-HHMMSS-{slug}.md` with opposite labels ("new" vs "old, replaced")
