---
name: create-suggestion
description: Detect structural issues and create proposal files in .claude-auto-context/suggestions/. USE WHEN file splits, directory reorganization, or pattern unification is needed.
---

# Create Suggestion

Analyze session data to detect structural issues and create proposal files requiring user approval before applying.

## Qualification Criteria

Structural problems evidenced by session data:
- **File bloat**: A file is read frequently but only small portions used per session (low signal ratio)
- **Pattern fragmentation**: Multiple files doing the same thing differently
- **Directory misorganization**: Logically related files scattered across directories
- **Missing abstractions**: Same code pattern repeated in 3+ places without extraction

## Evidence Requirements

Every suggestion MUST include:
- Quantitative metrics (signal ratio, read count vs edit count, etc.)
- Specific session IDs as evidence

## Output Format

Create files in `.claude-auto-context/suggestions/` as `suggestion-YYYYMMDD-HHMMSS-{slug}.md`:

```markdown
# Suggestion: {title}

## Status
pending

## Created
{ISO 8601 UTC timestamp, e.g. 2026-03-27T14:30:52Z}

## Category
structure | pattern | organization

## Problem
{Description with quantitative evidence}

## Proposal
{Specific changes to make}

## Evidence Sessions
- session_{id} ({date}): {what was observed}
- session_{id} ({date}): {what was observed}

## Metrics
- Signal ratio: {X}%
- Sessions affected: {N}/{total}
- Estimated impact: {description}
```

## Procedure

1. Read existing suggestions in `.claude-auto-context/suggestions/` to avoid duplicates
2. Generate timestamp for filename: `suggestion-YYYYMMDD-HHMMSS` format using current UTC time (e.g., `suggestion-20260323-143052-my-slug.md`)
3. Analyze session data for structural patterns
4. For each candidate:
   a. Compute quantitative metrics
   c. Formulate specific, actionable proposal
5. Write the suggestion file as `suggestion-YYYYMMDD-HHMMSS-{slug}.md`

## Anti-Patterns

- Do NOT propose changes without quantitative evidence
- Do NOT propose trivial restructuring (moving one function)
- Do NOT create duplicate suggestions
- Do NOT apply changes directly -- suggestions are proposals only
