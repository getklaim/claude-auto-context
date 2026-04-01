# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.3 -- Skill Agent

**Shipped:** 2026-03-26
**Phases:** 3 | **Plans:** 10

### What Was Built
- `skill-detector.mjs` -- cross-session pattern detection with similarity algorithms, scoring, classification, and filtering (618 LOC)
- `skill-prompt-builder.mjs` -- prompt composition with secret sanitization and example generalization (233 LOC)
- `skill-cap.mjs` -- hard cap enforcement with suggestion fallback (51 LOC)
- `/cac-create-skill` skill -- human-in-the-loop skill creation via skill-creator delegation
- 90 unit tests across all 3 modules, 100% pass rate

### What Worked
- **Module extraction pattern**: Side-effectful helpers (skill-cap.mjs) extracted to separate modules for unit testability without `bun:sqlite` dependency
- **Phased decomposition**: Detection (phase 8) -> Composition (phase 9) -> Delivery (phase 10) kept each phase focused and independently verifiable
- **Research-first planning**: Dedicated research on skill quality (Anthropic blog, skill-creator internals) before writing requirements prevented rework
- **Human-in-the-loop design**: Delegating actual SKILL.md creation to skill-creator preserved quality while automating discovery

### What Was Inefficient
- **REQUIREMENTS.md traceability stale**: 17/19 rows still "Pending" at milestone end despite all requirements shipped -- traceability table updates should happen at phase verification, not deferred
- **Phase 08 SUMMARYs missing `requirements-completed`**: Frontmatter field was added starting Phase 09 but not backfilled to Phase 08
- **SDEL-01 naming enforcement**: File naming convention relies on LLM instruction text rather than code validation -- accepted as tech debt

### Patterns Established
- **Independent skill-agent**: skill-agent runs as sibling `query()` call, not nested in orchestrator -- independent budget/timeout control
- **Defense-in-depth for startup state**: skills-registry.json bootstrapped at worker startup AND checked by skill-cap.mjs (double-guard)
- **Every-3rd-batch cadence**: `batchCount % 3 === 0` for slow-changing pattern types -- reusable cadence pattern for future agents
- **Regex safety**: `lastIndex = 0` reset before each `replace()` on reused global regex instances

### Key Lessons
1. **Extract side-effects for testability**: skill-cap.mjs isolation enabled 6 unit tests without mocking bun:sqlite; apply this pattern to future worker helpers
2. **Sanitize before LLM**: Secret patterns must be applied to ALL text fields before any LLM exposure -- applied to patternKey, toolSeq, descriptions, bulkPrompt
3. **Traceability hygiene**: Update REQUIREMENTS.md traceability table during phase verification, not as afterthought at milestone completion

### Cost Observations
- Model mix: Primarily sonnet for implementation, opus for planning/verification
- Notable: 3-phase, 10-plan milestone completed in 2 days (planning + implementation)

---

## Milestone: v2.0 -- Unified Architecture

**Shipped:** 2026-03-31
**Phases:** 2 (0, 15) | **Plans:** 2

### What Was Built
- 5-agent unified orchestrator: rules, suggestion, hooks, skill, hygiene in single query() call
- buildExistingContextSummary() for context-aware deduplication across all agents
- Suggestion-agent rewritten with AI-unfriendly code detection patterns
- Skill-agent with Necessity Gate (3-criterion filter), running every cycle
- 500+ LOC dead code removed: observations table, skill-detector.mjs, skill-cap.mjs, skills-registry.json

### What Worked
- **Merge-then-execute**: Phases 15-18 merged into a single phase 15 with 2 plans -- eliminated phase overhead for tightly coupled changes
- **Single-day execution**: All v2.0 work completed in ~45 minutes across 2 plans -- the merge decision enabled this speed
- **Conservative preamble pattern**: All 5 agents receive "check before creating" context -- reduced duplicate output in initial testing
- **Dead code first**: Plan 01 (removal) before Plan 02 (rewrite) ensured clean baseline

### What Was Inefficient
- **REQUIREMENTS.md traceability coverage stale again**: Bottom of file said "Complete: 2 (CLEN-01, CLEN-02), Pending: 16" despite all 18 being checked -- same pattern as v1.3
- **STATE.md jumped to v3.0 before v2.0 archived**: v3.0 planning started immediately after v2.0 shipped without formally archiving v2.0 first

### Patterns Established
- **Phase merging**: When multiple planned phases are tightly coupled, merge into one phase with multiple plans
- **Context summary preamble**: Every agent prompt opens with a summary of existing artifacts for deduplication
- **Necessity Gate**: 3-criterion filter before creating new artifacts (repeated workflow? >2 sessions? not already exists?)

### Key Lessons
1. **Archive before starting next milestone**: v2.0 was shipped 2026-03-30 but never archived; v3.0 planning started immediately causing state confusion
2. **Traceability table auto-update still needed**: 2nd milestone in a row with stale coverage stats at bottom of REQUIREMENTS.md
3. **Phase merge saves significant overhead**: 4 phases → 1 phase meant ~3x less planning/verification cycles

### Cost Observations
- Model mix: opus for planning, sonnet for execution
- Notable: 2 plans completed in 45 minutes total
- Sessions: 1 (single session for entire milestone)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | -- | Core pipeline established (inferred) |
| v1.2 | 2 | -- | Local isolation, agent removal |
| v1.3 | 3 | 10 | Full GSD workflow: requirements -> roadmap -> phases -> verify -> audit |
| v2.0 | 2 | 2 | Phase merging, 5-agent orchestrator, dead code cleanup |

### Cumulative Quality

| Milestone | Tests | Key Modules |
|-----------|-------|-------------|
| v1.0 | -- | worker.mjs, collector.sh |
| v1.3 | 90 | skill-detector (59), skill-prompt-builder (25), skill-cap (6) |
| v2.0 | 90 | worker.mjs rewritten (5 agents), quality-gate.mjs, skill-prompt-builder.mjs (utility) |

### Top Lessons (Verified Across Milestones)

1. Module extraction for testability pays off immediately (skill-cap.mjs pattern)
2. Human-in-the-loop preserves quality while automating discovery (suggestions in v1.0, skills in v1.3)
3. Archive milestones before starting next one -- state confusion if skipped (confirmed v2.0→v3.0 transition)
4. Traceability table needs automation -- stale stats at milestone end is a recurring pattern (v1.3, v2.0)
