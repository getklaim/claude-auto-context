# Suggestion: Dual SKILL.md Directory Doubles Every Skill Edit

## Status
pending

## Created
2026-03-27T13:00:00Z

## Category
organization

## Problem

Every change to a skill requires editing two files in two directories:

| Skill | `.claude/skills/` | `skills/` |
|---|---|---|
| create-suggestion | `.claude/skills/create-suggestion/SKILL.md` | `skills/create-suggestion/SKILL.md` |
| context-hygiene | `.claude/skills/context-hygiene/SKILL.md` | `skills/context-hygiene/SKILL.md` |
| extract-rules | `.claude/skills/extract-rules/SKILL.md` | `skills/extract-rules/SKILL.md` |

All three checked pairs are currently byte-for-byte identical (verified by reading both copies of `create-suggestion`, `context-hygiene`, and `extract-rules` SKILL.md files during this session). This means the second directory carries zero unique content — it is purely a sync obligation.

The session plan for "Add `## Created` timestamp to suggestion files" (session 615e4373) lists 6 file changes across 4 categories. Items 1-2 are the same change to `create-suggestion/SKILL.md` in both directories; items 3-4 are the same change to `context-hygiene/SKILL.md` in both directories. Half of the plan's file count exists solely because of the dual-directory structure.

The stated purpose of `skills/` (from CLAUDE.md) is as a manual distribution source: "skills in `.claude/skills/` must be manually copied to the target project's `.claude/skills/` directory." However, the copy is currently manual and unsynchronized — a prior session already found `cac-create-skill` missing from `skills/` (suggestion `20260326-000000-skills-dir-inconsistency.md`). Each skill edit creates a new opportunity for the two directories to diverge again.

## Proposal

Eliminate the dual-directory maintenance burden by one of two approaches (in preference order):

**Option A — Single source of truth with a copy script (preferred)**
Remove `skills/` as a hand-maintained mirror. Add a `scripts/sync-skills.sh` that copies `.claude/skills/*/SKILL.md` → `skills/*/SKILL.md` on demand (or as a pre-commit hook). Authors edit only `.claude/skills/`; `skills/` is generated output. A CI assertion (`diff -r .claude/skills/ skills/`) would catch drift.

**Option B — Delete `skills/` entirely and update distribution instructions**
If `skills/` serves only as a copy source for plugin users, document that users should copy from `.claude/skills/` directly (same path after install). Remove the `skills/` directory and update CLAUDE.md to point to `.claude/skills/` as the distribution directory.

Either option reduces every per-skill edit from 2 file writes to 1.

## Evidence Sessions

- session_615e4373 (2026-03-27): Plan "Add `## Created` timestamp to suggestion files" listed 6 file changes; items 1-2 and 3-4 were identical edits to the same skill in both directories. Without the dual-directory structure the plan would require 3 file changes (50% reduction).
- session (2026-03-26): Drift between the two directories already occurred — `cac-create-skill` existed in `.claude/skills/` but was absent from `skills/`, filed as suggestion `20260326-000000-skills-dir-inconsistency.md`.

## Metrics

- Duplicate file pairs: 3 of 3 checked (100% identical content across directories)
- Edit overhead per skill change: 2x (every edit must be made in both locations)
- Plan bloat from dual directories: 2 of 4 plan items in session 615e4373 were redundant copies (50% of plan entries)
- Drift events observed: 1 (missing `cac-create-skill` in `skills/`) — drift is already happening despite manual sync requirement
- Estimated impact: eliminating the mirror removes the structural source of the drift; all future skill edits touch 1 file instead of 2
