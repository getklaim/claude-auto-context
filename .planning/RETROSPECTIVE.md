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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 5 | -- | Core pipeline established (inferred) |
| v1.2 | 2 | -- | Local isolation, agent removal |
| v1.3 | 3 | 10 | Full GSD workflow: requirements -> roadmap -> phases -> verify -> audit |

### Cumulative Quality

| Milestone | Tests | Key Modules |
|-----------|-------|-------------|
| v1.0 | -- | worker.mjs, collector.sh |
| v1.3 | 90 | skill-detector (59), skill-prompt-builder (25), skill-cap (6) |

### Top Lessons (Verified Across Milestones)

1. Module extraction for testability pays off immediately (skill-cap.mjs pattern)
2. Human-in-the-loop preserves quality while automating discovery (suggestions in v1.0, skills in v1.3)
