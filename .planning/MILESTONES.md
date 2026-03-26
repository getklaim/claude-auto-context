# Milestones

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
