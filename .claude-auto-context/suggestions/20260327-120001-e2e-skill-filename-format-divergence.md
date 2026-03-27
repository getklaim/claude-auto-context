# Suggestion: e2e Test Skill Uses Obsolete Suggestion Filename Format

## Status
pending

## Category
pattern

## Problem
Two copies of `create-suggestion/SKILL.md` prescribe different filename formats for suggestion files:

| Location | Format specified |
|---|---|
| `.claude/skills/create-suggestion/SKILL.md` | `YYYYMMDD-HHMMSS-{slug}.md` |
| `skills/create-suggestion/SKILL.md` | `YYYYMMDD-HHMMSS-{slug}.md` |
| `test/e2e-project/.claude/skills/create-suggestion/SKILL.md` | `{NNN}-{slug}.md` |

The e2e fixture retains the old sequential-number format (`{NNN}-{slug}.md`) that was replaced by the timestamp format in the main skill. It also still requires "at least 3 sessions showing the problem" (removed from the main skill's evidence requirements) and describes the procedure as "get next sequence number" — both stale.

If the e2e test suite validates suggestion filenames or content against this fixture, tests will either pass against the wrong format or diverge silently from production behavior.

## Proposal

Update `test/e2e-project/.claude/skills/create-suggestion/SKILL.md` to match the canonical version at `.claude/skills/create-suggestion/SKILL.md` exactly (minus the frontmatter if the e2e fixture intentionally omits it). Specifically:

1. Change `{NNN}-{slug}.md` → `YYYYMMDD-HHMMSS-{slug}.md` in the Output Format section.
2. Remove the "at least 3 sessions" requirement from Evidence Requirements (or align it with the main skill's wording).
3. Update the Procedure section: replace "get next sequence number" with "generate timestamp for filename."

Consider adding a CI assertion (e.g., `diff` or checksum comparison) to detect future drift between the e2e fixture and the canonical skill file.

## Evidence Sessions
- session_615e4373 (2026-03-27): Structural analysis of suggestion-emitting code paths revealed `test/e2e-project/.claude/skills/create-suggestion/SKILL.md` at line 27 specifies `{NNN}-{slug}.md` while all three production copies use `YYYYMMDD-HHMMSS-{slug}.md`.

## Metrics
- Format divergence: 1 of 3 copies (33%) uses the obsolete format
- Stale requirements: 2 additional fields differ (3-session minimum, sequence-number procedure)
- Sessions affected: 1/1 (identified during structural analysis)
- Estimated impact: e2e tests that rely on this fixture may validate against the wrong filename format, masking regressions in the timestamp-based naming introduced in the main skill
