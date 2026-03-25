---
phase: 09-prompt-composition-worker-integration
plan: "01"
subsystem: skill-agent
tags: [sanitization, prompt-composition, skill-detection, observations, bun]

# Dependency graph
requires:
  - phase: 08-detection-foundation
    provides: observations table with skill:* pattern_key rows, skill-detector.mjs with evidence JSON schema
provides:
  - skill-prompt-builder.mjs with 5 named exports: sanitizeSecrets, generalizeExample, buildSkillAgentPrompt, loadExistingSkills, getGenerateCandidates
  - SPROM-01/02/03/04 requirements fully implemented as deterministic JS (no LLM calls)
affects:
  - 09-02 (unit tests for this module)
  - 09-03 (worker integration imports this module)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - regex.lastIndex reset pattern for global regexes reused across calls
    - sanitizeSecrets applied first before any generalization or LLM-bound text
    - directory-based skill discovery (.claude/skills/*/SKILL.md) via readdirSync withFileTypes

key-files:
  created:
    - .claude-auto-context/skill-prompt-builder.mjs
  modified: []

key-decisions:
  - "sanitizeSecrets() runs before generalizeExample() — secrets stripped at source, not in agent instructions (SPROM-03)"
  - "getGenerateCandidates() filters decision=generate AND sessions >= 3 — only high-confidence patterns reach skill-agent"
  - "buildSkillAgentPrompt() limits to top 3 candidates per call — context window protection"
  - "loadExistingSkills() uses directory scan not file glob — mirrors actual plugin structure where skills live in subdirectories"

patterns-established:
  - "Secret sanitization: apply sanitizeSecrets() to ALL text before prompt inclusion (patternKey, toolSeq, descriptions, bulkPrompt)"
  - "Global regex safety: reset lastIndex = 0 before each replace() call on reused regex instances"
  - "Prompt structure: What/When/Why/When-NOT-to-Use with negative examples from DB discard/non-skill rows"

requirements-completed: [SPROM-01, SPROM-02, SPROM-03, SPROM-04, SINT-04]

# Metrics
duration: 25min
completed: 2026-03-26
---

# Phase 09 Plan 01: Prompt Composition Module Summary

**Pure-JS skill-prompt-builder.mjs with 8-pattern secret sanitization, path/CLI generalization, DB candidate query, skill directory scan, and 4-section prompt assembly — no LLM calls**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-26T00:00:00Z
- **Completed:** 2026-03-26T00:25:00Z
- **Tasks:** 4
- **Files modified:** 1 (created)

## Accomplishments
- Created `.claude-auto-context/skill-prompt-builder.mjs` with 5 named exports, passes `bun --check`
- SPROM-03: 8-pattern sanitization (sk-ant-*, Bearer, AKIA AWS keys, IPv4, password=, gh[ps]_, npm_, 40+ char hex)
- SPROM-02: PATH_PATTERNS (test/source/config/bare files) + CLI_PATTERNS (npm/git/flag commands) generalization
- SPROM-01/04: buildSkillAgentPrompt() produces all 4 sections with negative examples sourced from discard rows in observations DB
- SINT-04: loadExistingSkills() scans .claude/skills/*/SKILL.md for name+description context injection

## Task Commits

Each task was committed atomically:

1. **Task 09-01-01: sanitizeSecrets()** - `2c1ae8c` (feat)
2. **Task 09-01-02: generalizeExample()** - `14b4e64` (feat)
3. **Task 09-01-03: getGenerateCandidates() + loadExistingSkills()** - `f03d366` (feat)
4. **Task 09-01-04: buildSkillAgentPrompt()** - `8bfbe14` (feat)

## Files Created/Modified
- `.claude-auto-context/skill-prompt-builder.mjs` - prompt composition module, 232 lines, 5 named exports

## Decisions Made
- sanitizeSecrets() called before generalizeExample() — ensures secrets are stripped at the source boundary, not in LLM instructions
- getGenerateCandidates() applies sessions >= 3 threshold in JS (not SQL) to allow flexible threshold changes
- buildNegativeExamples() is a private helper (not exported) — only called from buildSkillAgentPrompt()
- Top 3 candidates hard-capped in buildSkillAgentPrompt() — matches plan spec for context window safety

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- skill-prompt-builder.mjs ready for unit tests (Plan 09-02)
- All 5 exports ready for worker integration (Plan 09-03)
- No blockers — module is pure JS with only node:path and node:fs imports (Bun-compatible)

---
*Phase: 09-prompt-composition-worker-integration*
*Completed: 2026-03-26*
