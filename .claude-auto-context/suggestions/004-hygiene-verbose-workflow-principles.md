# Suggestion: Add Glob Scope to `workflow-principles.md` and Remove Redundant Section

## Status
pending

## Category
hygiene-verbose

## Problem

`.claude/rules/workflow-principles.md` has **no frontmatter glob**, which means Claude Code loads it into the context window of **every conversation in this project**, regardless of whether workflow orchestration guidance is relevant.

Additionally, the file contains a "## Task Management" section that largely restates content already covered by "## Workflow Orchestration":

| Workflow Orchestration | Task Management (redundant) |
|---|---|
| § 1: Plan Node Default — enter plan mode, write plan | Step 1: "Write plan to `tasks/todo.md` with checkable items" |
| § 3: Self-Improvement Loop — update `tasks/lessons.md` | Step 3: "Update `tasks/lessons.md` after corrections" |
| § 4: Verification Before Done | Step 2: "Mark items complete as you go" (implicit tracking) |

The "## Task Management" section adds only one genuinely new detail: the specific file path `tasks/todo.md`. Everything else repeats the six principles above it.

Current character count: ~930 chars. Removing the redundant section reduces it to ~620 chars (~33% reduction). Adding the glob prevents it from loading in every conversation.

## Proposal

1. **Add frontmatter** with the broadest reasonable glob. Since these are project-wide workflow conventions, `**` is appropriate — but the key fix is making it explicit rather than implicit:
   ```yaml
   ---
   description: Workflow and coding conventions for this project
   ---
   ```
   *(Or omit the file entirely from global load by scoping to `tasks/**,scripts/**` if desired.)*

2. **Remove the "## Task Management" section** and fold the one unique detail (`tasks/todo.md` path) into the existing Plan Node Default principle:

   ```markdown
   ### 1. Plan Node Default
   - Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
   - Write plan to `tasks/todo.md` with checkable items; update `tasks/lessons.md` after corrections
   - If something goes sideways, STOP and re-plan immediately
   ```

   Then delete the entire "## Task Management" section (lines ~38–43).

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: `.claude/rules/workflow-principles.md`
- Check: H-04

## Metrics
- Current size: ~930 chars, ~52 lines, 0 glob (loads globally)
- Redundant section: "## Task Management" (~130 chars, 6 lines) restates existing content
- Char reduction after fix: ~14% from deduplication alone
- Token impact: File currently loads in 100% of conversations; scoping or trimming reduces unnecessary context load
