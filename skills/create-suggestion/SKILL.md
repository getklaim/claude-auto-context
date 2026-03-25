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
- At least 2 sessions showing the problem (1 session OK if the structural issue is severe and obvious)
- Quantitative metrics (signal ratio, read count vs edit count, etc.)
- Specific session IDs as evidence

## Output Format

Create files in `.claude-auto-context/suggestions/` as `YYYYMMDD-HHMMSS-{slug}.md`:

```markdown
# Suggestion: {title}

## Status
pending

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

1. Review the existing suggestions summary provided in your prompt (if any) to avoid duplicates
2. Generate timestamp for filename: `YYYYMMDD-HHMMSS` format using current UTC time (e.g., `20260323-143052`)
3. Analyze session data for structural patterns
4. For each candidate:
   a. Verify 2+ sessions (1 session OK if the structural issue is severe and obvious)
   b. Compute quantitative metrics
   c. Formulate specific, actionable proposal
5. Write the suggestion file as `YYYYMMDD-HHMMSS-{slug}.md`

## Anti-Patterns

- Do NOT propose changes without quantitative evidence
- Do NOT propose trivial restructuring (moving one function)
- Do NOT create duplicate suggestions
- Do NOT apply changes directly -- suggestions are proposals only
