# Milestones

## v2.0 Unified Architecture (Shipped: 2026-03-31)

**Phases completed:** 2 phases (0, 15), 2 plans, 15 tasks
**Requirements:** 18/18 complete (WORK-01..03, ORCH-01..03, SUGG-01..03, SKIL-01..04, HYGI-01..02, CLEN-01..04)
**Timeline:** 2026-03-30 (single day)

**Key accomplishments:**

- 500+ lines dead code removed: observations table, skill-detector.mjs, skill-cap.mjs, skills-registry.json
- Batch threshold: worker skips cycles when < 100 pending events (WORK-01)
- 5-agent unified orchestrator in single query() call: rules, suggestion, hooks, skill, hygiene (ORCH-01)
- buildExistingContextSummary() for context-aware deduplication across all agents (ORCH-02, ORCH-03)
- Suggestion-agent rewritten: AI-unfriendly code detection with Channel.io-inspired patterns (SUGG-01..03)
- Skill-agent with Necessity Gate: 3-criterion filter, runs every cycle, dual-dir sync (SKIL-01..04)
- Hygiene-agent folded into orchestrator (no separate query() call) (HYGI-01..02)

---

## v1.4 — Agent Output Quality (Partial)

**Status:** Partially shipped, superseded by v2.0
**Phases:** 11 (of planned 11-14)

### What Shipped

- Phase 11 (infrastructure-fixes): settings.json auto-creation, structured agent logging with session IDs, maxTurns increased for all sub-agents

### What Was Superseded

- Phases 12-14 (hooks silent failures, ghost agent, judgment prompts, quality measurement) — folded into v2.0 architecture rewrite
- skill-detector.mjs, skill-cap.mjs, skills-registry.json removed during v2.0 planning session
- Standalone skill-agent block removed, skill-agent moved into orchestrator

---

## v1.3 — Skill Agent

**Status:** Shipped 2026-03-26
**Phases:** 8-10 (3 phases, 10 plans)

### What Shipped

- `skill-detector.mjs` (618 LOC): cross-session pattern matching (Jaccard/LCS), scoring formula, classification decision tree, 5 negative heuristic filters, self-referential filter
- `skill-prompt-builder.mjs` (233 LOC): what/when/why/when-NOT prompt composition, 8-pattern secret sanitization, example generalization
- `skill-cap.mjs` (51 LOC): 5-skill hard cap enforcement with suggestion fallback
- Skill-agent integrated into worker as independent `query()` ($0.50, maxTurns:8) running every 3rd batch
- `/cac-create-skill` skill for human-in-the-loop skill creation via skill-creator delegation
- `skills-registry.json` for tracking auto-generated skills with full provenance

### Key Metrics

- 19/19 requirements satisfied (SDET-01..06, SPROM-01..04, SINT-01..05, SDEL-01..04)
- 90 unit tests, 100% pass rate
- 22 files changed, +3,214 lines
- Git range: 22fd757..17f3b58

### Known Gaps (tech debt accepted)

- SDEL-01: Prompt file naming is LLM instruction only, no code enforcement
- `param_count` hardcoded to 0 in scoring formula (future enhancement)
- `capResult.atCap` dead field in worker.mjs
- Phase 08 SUMMARYs missing `requirements-completed` frontmatter

---

## v1.0 — Core Auto-Context Pipeline

**Status:** Shipped
**Phases:** 1-5 (inferred from existing codebase)

### What Shipped

- Event capture pipeline (hooks -> collector -> SQLite)
- Background worker with Claim-Confirm queue pattern
- 3-agent orchestrator (rules, suggestion, claudemd)
- Hygiene auditor for context quality
- Suggestion system with /cac-apply
- Crash recovery (self-heal on startup)
- Plugin distribution via Claude Code marketplace

### Key Metrics

- 12 validated requirements (HOOK-01..02, RULE-01..02, CMD-01, SUG-01..02, QA-01, SYS-01..02)
- Last phase: 5

## v1.1 — Hook Auto-Generation

**Status:** Shipped
**Phases:** (implemented alongside v1.2)

### What Shipped

- hooks-agent added as 3rd agent in orchestrator (replaces claudemd-agent)
- Pattern detection for formatter/linter, dangerous commands, secrets
- Hook configuration generation (PreToolUse, PostToolUse)
- Integrated into same batch pipeline as rules-agent and suggestion-agent

### Key Metrics

- hooks-agent operational in worker.mjs orchestrator
- 3-agent pipeline: rules-agent, suggestion-agent, hooks-agent

## v1.2 — Local Isolation

**Status:** Shipped
**Phases:** 6-7

### What Shipped

- rules-agent writes to `.claude/rules/local/` (gitignored)
- claudemd-agent removed from orchestrator
- Timestamp-based suggestion filenames (YYYYMMDD-HHMMSS-slug.md)
- Existing sequential suggestion detection preserved

### Key Metrics

- Zero merge conflicts from auto-generated files
- Commit: 5a63f8d "refactor: v1.2 local isolation, replace claudemd-agent with hooks-agent"
- Last phase: 7

---
*Last updated: 2026-03-26 after v1.3 milestone*
