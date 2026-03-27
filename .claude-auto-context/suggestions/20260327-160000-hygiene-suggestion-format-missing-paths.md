# Suggestion: suggestion-file-format.md documents 4 creation paths but claims 6

## Status
pending

## Created
2026-03-27T16:00:00Z

## Category
hygiene-contradiction

## Problem

`suggestion-file-format.md` contains an internal contradiction between its body and its evidence section:

**Body ("Applies to all creation paths") — 4 paths listed:**
- `create-suggestion` skill
- `context-hygiene` skill hygiene suggestion format
- `worker.mjs` inline hygiene prompt template
- `skill-cap.mjs` programmatic suggestion creation

**Evidence section — claims 6 paths:**
> "Plan written in session 615e4373 targeting all 6 creation paths."

Two creation paths are not documented in the rule. This means Claude will not know to enforce the `## Created` field requirement for those 2 unknown paths. If any code adds a new suggestion creation path, or if the missing 2 paths already exist, they will silently omit the required field.

## Proposal

Either:

1. **Find and add the 2 missing paths** — search session 615e4373 notes or the codebase for any other locations that create suggestion files (e.g. other scripts, CLI tools, or skill files not listed), then add them to the "Applies to all creation paths" section.

2. **Correct the evidence claim** — if only 4 paths were actually identified, change "all 6 creation paths" to "all 4 creation paths" so the rule is internally consistent.

To verify current suggestion-creation entry points:

```sh
grep -r "suggestions/" .claude-auto-context/ --include="*.mjs" -l
grep -r "suggestions/" scripts/ -l
```

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: `.claude/rules/local/suggestion-file-format.md`
- Check: H-02

## Metrics
- Documented paths: 4
- Claimed paths: 6
- Gap: 2 undocumented creation paths (33% of claimed total)
