---
globs:
  - ".claude-auto-context/skill-detector.mjs"
  - ".claude-auto-context/worker.mjs"
  - ".claude-auto-context/skill-cap.mjs"
  - ".claude-auto-context/skill-prompt-builder.mjs"
---

# Skill Detection: LLM Judgment Replaces Hard-Coded Thresholds

The skill detection pipeline deliberately avoids hard-coded numeric thresholds for promotion decisions. The pattern `score >= 10.0`, `step_count < 5`, `registryCount >= 5` has been removed in favor of passing all candidates (score > 0) directly to the LLM for quality judgment.

## Current design (post-refactor)

- `scoreDecision()` returns `'generate'` for any score > 0 — no numeric floor
- `classifyPattern()` does NOT apply step_count < 5 or < 8 filters
- The skill-cap (5-skill registry limit) check has been removed from `worker.mjs`
- `loadExistingSkills()` supplies existing skills to the LLM prompt so the LLM judges duplicates

## Do NOT reintroduce

- Hard-coded `score >= N` thresholds in `scoreDecision()`
- Hard-coded `step_count < N` early-exit in `classifyPattern()`
- Registry count cap checks before LLM invocation

If quality control is needed, encode the criteria in the LLM prompt, not as numeric gate conditions in the JavaScript.

Evidence: 5 sessions (threshold-counts-replaced-by-prompt-judgment cross-cycle pattern: c475f03f, 7f1201f6, fb9f05d6, rules-agent-2026-03-27-cycle5, rules-agent-2026-03-27-cycle6). Session fb9f05d6 confirmed `scoreDecision()` now returns `'generate'` for score > 0.
