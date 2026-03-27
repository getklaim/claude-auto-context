# Suggestion: skill-detector-llm-judgment-over-thresholds.md is verbose — two mirrored sections

## Status
pending

## Created
2026-03-27T15:30:02Z

## Category
hygiene-verbose

## Problem

`.claude/rules/local/skill-detector-llm-judgment-over-thresholds.md` is ~1 100 chars.
Its "## Current design" and "## Do NOT reintroduce" sections are mirror images:

| Current design | Do NOT reintroduce |
|---|---|
| `scoreDecision()` returns `'generate'` for score > 0 | Hard-coded `score >= N` in `scoreDecision()` |
| `classifyPattern()` does NOT apply step_count < N filter | Hard-coded `step_count < N` in `classifyPattern()` |
| skill-cap check removed from `worker.mjs` | Registry count cap before LLM invocation |

Stating the same constraint twice (as "what IS" and as "do NOT") consumes tokens without adding meaning.

## Proposal

Merge into a single section (~480 chars, 56% reduction):

```markdown
# Skill Detection: LLM Judgment, No Hard-Coded Thresholds

Do NOT add numeric gates — encode quality criteria in the LLM prompt instead.

Specifically, do NOT reintroduce:
- `score >= N` threshold in `scoreDecision()` (currently returns `'generate'` for score > 0)
- `step_count < N` early-exit in `classifyPattern()`
- Registry count cap check before LLM invocation

`loadExistingSkills()` supplies existing skills so the LLM judges duplicates.

Evidence: sessions c475f03f, 7f1201f6, fb9f05d6.
```

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: `.claude/rules/local/skill-detector-llm-judgment-over-thresholds.md`
- Check: H-04

## Metrics
- Current size: ~1 100 chars
- Proposed size: ~480 chars
- Reduction: ~56%
