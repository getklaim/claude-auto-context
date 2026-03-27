# Suggestion: cac-create-skill missing from skills/ distribution directory

## Status
pending

## Category
organization

## Problem

There are two skills directories in the repository with divergent contents:

- `skills/` — 4 skills: `cac-apply`, `context-hygiene`, `create-suggestion`, `extract-rules`
- `.claude/skills/` — 5 skills: all 4 above **plus** `cac-create-skill`

`cac-create-skill` exists in `.claude/skills/cac-create-skill/SKILL.md` (active, 108-line skill for generating SKILL.md files from detected workflow prompts) but has no counterpart in `skills/`. The `skills/` directory is the documented distribution copy — CLAUDE.md states "skills in `.claude/skills/` must be manually copied to the target project's `.claude/skills/` directory" and "there is no install script that auto-copies skills." This means `skills/` is the authoritative source that a plugin user would copy from, and it is currently missing one skill.

Any documentation, setup guide, or manual that tells users to copy from `skills/` will silently omit `cac-create-skill`.

## Proposal

Copy `.claude/skills/cac-create-skill/SKILL.md` to `skills/cac-create-skill/SKILL.md` to make `skills/` match `.claude/skills/` exactly.

After this change, `skills/` will contain 5 skill directories matching `.claude/skills/` 1-for-1. Consider adding a CI or pre-commit check that asserts both directories have identical subdirectory names to prevent this drift from recurring.

## Evidence Sessions

- session (2026-03-26): User explored project structure while investigating dogfooding in `/Users/dgsw67/klaim/`. Glob of `.claude/skills/` returned 5 entries; Glob of `skills/` returned 4 entries. `cac-create-skill` confirmed present in `.claude/skills/` and absent in `skills/`.

## Metrics

- Missing skill count: 1 of 5 (20% of skill inventory absent from distribution directory)
- Sessions affected: 1/1 (single session; flagged as obvious structural gap by orchestrator)
- Estimated impact: Any user following manual copy instructions from `skills/` will not receive `cac-create-skill`; the omission is silent with no error or warning
