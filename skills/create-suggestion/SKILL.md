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

## Description
{one-line summary — used for deduplication and context display}

## Status
pending

## Created
{ISO 8601 UTC timestamp, e.g. 2026-03-27T14:30:52Z}

## Category
{ai-unfriendly-large-file | ai-unfriendly-naming | ai-unfriendly-missing-docs | ai-unfriendly-structure | ai-unfriendly-fragile}

## Problem
{Description with quantitative evidence and specific file names}

## Related Files
- {file1.ext} — {why this file is involved}
- {file2.ext} — {why this file is involved}

## Proposal

### Read first
- {file1.ext} — {why executor must read this before changes, e.g. "contains function to extract"}
- {file2.ext} — {dependency or convention reference}

### Files to modify
- {file1.ext} — {what changes in this file}
- {file2.ext (new file)} — {what this new file will contain}

### Changes
1. In {file1.ext}, function `{functionName}` (lines ~{N}-{M}):
   - {specific operation: extract, rename, move, delete, modify}
   - {import/export updates needed after the change}
2. In {file2.ext (new file)}:
   - Create with exports: {exportName1}, {exportName2}
   - Import dependencies: {dep1} from {source}

### Impact
- {other-file.ext} — imports from {file1.ext}, import path may need update
- {test-file.ext} — test assertions may reference moved functions

### Acceptance criteria
- [ ] `grep -q '{exportName}' {new-file.ext}` — export exists in new location
- [ ] `grep -q 'from.*{new-file}' {file1.ext}` — import path updated
- [ ] No TypeScript/syntax errors in modified files
- [ ] Existing tests pass without modification (or test updates documented)

## Evidence Sessions
- session_{id} ({date}): {what was observed}

## Metrics
- Signal ratio: {X}%
- Sessions affected: {N}/{total}
- Estimated impact: {description}
```

**IMPORTANT**: The `## Proposal` section MUST contain all five subsections (`### Read first`, `### Files to modify`, `### Changes`, `### Impact`, `### Acceptance criteria`). Proposals without these subsections are incomplete and will be rejected.

**Changes section rules**:
- Each change MUST name the target function, class, or section (not just the file)
- Include approximate line numbers when the target file exists
- Describe the operation: extract, rename, move, delete, split, merge
- Specify import/export updates needed after the change

**Acceptance criteria rules**:
- Each criterion MUST be verifiable by a CLI command (grep, test -f, tsc --noEmit, npm test)
- Write the verification command inline: `grep -q 'pattern' file`
- Do NOT use subjective criteria ("code is cleaner", "better organized")

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
