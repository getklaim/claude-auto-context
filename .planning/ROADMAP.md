# Roadmap: claude-auto-context v1.3

**Created:** 2026-03-24
**Milestone:** v1.3 — Skill Agent
**Phases:** 8-10 (continuing from v1.2 phase 7)

## Overview

| # | Phase | Goal | Requirements | Count |
|---|-------|------|-------------|-------|
| 8 | 4/4 | Complete   | 2026-03-25 | 7 |
| 9 | 3/3 | Complete | 2026-03-26 | 7 |
| 10 | 3/3 | Complete    | 2026-03-26 | 5 |
| | **Total** | | | **19** |

---

## Phase 8: Detection Foundation

**Goal:** Build pattern detection infrastructure -- observations storage, scoring formula, classification decision tree, and negative filters. No skill output yet; this phase only populates the observations table with scored candidates.

**Requirements:**

| ID | What | Key Detail |
|----|------|------------|
| SDET-01 | Cross-session pattern matching | Jaccard > 0.5 on normalized prompts, LCS >= 5 on tool sequences, across 3+ sessions |
| SDET-02 | Compound action parsing | Extract verb chains from multi-action prompts ("fix, commit, push") |
| SDET-03 | Negative heuristic filtering | Exclude: pure exploration, debugging spirals, single-file edits, plugin-internal paths |
| SDET-04 | Scoring formula | score >= 10 AND sessions >= 3 -> generate; 5-10 -> observe |
| SDET-05 | Classification decision tree | 5+ tool calls + NL trigger + decision points = skill; else delegate to rules/hooks agent |
| SDET-06 | Self-referential filter | Exclude skill invocation events and `.claude/` path events from pattern aggregation |
| SINT-03 | Observations table extension | Reuse existing observations table with `pattern_key LIKE 'skill:%'`, `agent_source='skill-agent'` |

**Success Criteria:**

1. `observations` table contains rows with `agent_source='skill-agent'` after processing test session data with known repeatable patterns
2. Scoring formula returns score >= 10 for a 3-session repeating workflow (e.g., "lint, test, commit") and score < 5 for a one-off debugging session
3. Classification decision tree correctly routes a simple 2-tool pattern to rules-agent and a 6-tool workflow to skill-agent
4. Self-referential filter excludes events where tool_name contains "skill" or path starts with `.claude/`
5. Negative heuristics reject a pure-exploration session (only Read/Grep, no Write) with score 0

**Dependencies:** None (builds on existing observations table from v1.0)

---

## Phase 9: Prompt Composition + Worker Integration

**Goal:** Build the skill-agent prompt template and wire it into the worker as a separate query() call. After this phase, the worker produces skill-prompt markdown from detected patterns on every 3rd batch.

**Requirements:**

| ID | What | Key Detail |
|----|------|------------|
| SPROM-01 | Prompt composition | Assemble what (skill purpose), when (trigger condition), why (automation value) from detected pattern |
| SPROM-02 | Session examples in prompt | Include actual prompt/tool sequences as examples; generalize specific filenames and commands |
| SPROM-03 | Secret sanitization | Replace `sk-ant-*`, `Bearer *`, IP addresses, passwords with `${PLACEHOLDER}` before prompt output |
| SPROM-04 | "When NOT to use" in prompt | Include negative examples -- research confirms this is critical for trigger accuracy |
| SINT-01 | Separate query() call | skill-agent runs as independent query() outside the 3-agent orchestrator; $0.50 budget, maxTurns: 8 |
| SINT-02 | Batch cadence | skill-agent runs every 3rd batch only (workflow patterns change slowly) |
| SINT-04 | Context injection | Pass buildBulkPrompt() output + existing skill names/descriptions to skill-agent |

**Success Criteria:**

1. skill-agent query() executes after the main orchestrator completes, only on batch numbers divisible by 3
2. Generated prompt contains all four sections: what, when, why, and "when NOT to use"
3. A test prompt containing `sk-ant-api03-FAKE` and `192.168.1.100` produces output with `${API_KEY}` and `${IP_ADDRESS}` instead
4. skill-agent receives existing skill names/descriptions as context (verified by prompt log inspection)
5. skill-agent stays within $0.50 budget and 8 turns (verified by Agent SDK cost output)

**Dependencies:** Phase 8 (needs scored observations to compose prompts from)

---

## Phase 10: Delivery + UX

**Goal:** User-facing delivery layer. Skill prompts are saved as files, users invoke `/cac-create-skill` to review and generate actual SKILL.md files via skill-creator, and a registry enforces the 5-skill hard cap.

**Requirements:**

| ID | What | Key Detail |
|----|------|------------|
| SDEL-01 | Prompt file output | Save prompt to `.claude-auto-context/skill-prompts/YYYYMMDD-HHMMSS-{slug}.md` |
| SDEL-02 | /cac-create-skill skill | Lists pending prompt files, user selects one, skill calls skill-creator to generate SKILL.md |
| SDEL-03 | Dependency check | Plugin setup hook checks if skill-creator is installed; shows guidance message if not |
| SDEL-04 | Registry update | After skill creation, update `skills-registry.json` with name, date, source sessions |
| SINT-05 | Hard cap enforcement | Max 5 auto-generated skills per project; at cap, generate suggestion instead of prompt |

**Success Criteria:**

1. After skill-agent runs, a `.md` file exists in `.claude-auto-context/skill-prompts/` with correct timestamp-slug naming
2. `/cac-create-skill` invocation lists pending prompt files and successfully delegates to skill-creator for the selected one
3. Setup hook outputs "skill-creator not found" message when the dependency is missing, and stays silent when present
4. `skills-registry.json` contains the new skill entry after creation, with all required fields (name, generated-date, source-sessions)
5. When 5 skills exist in the registry, the next detection produces a suggestion file (in the suggestions directory) instead of a skill prompt

**Dependencies:** Phase 9 (needs prompt composition to produce prompt files)

---

## Coverage Verification

**19 requirements, 19 mapped:**

| Category | IDs | Phase | Count |
|----------|-----|-------|-------|
| Detection | SDET-01, SDET-02, SDET-03, SDET-04, SDET-05, SDET-06 | 8 | 6 |
| Prompt | SPROM-01, SPROM-02, SPROM-03, SPROM-04 | 9 | 4 |
| Integration | SINT-03 | 8 | 1 |
| Integration | SINT-01, SINT-02, SINT-04 | 9 | 3 |
| Integration | SINT-05 | 10 | 1 |
| Delivery | SDEL-01, SDEL-02, SDEL-03, SDEL-04 | 10 | 4 |
| **Total** | | | **19** |

Unmapped: 0

---
*Roadmap created: 2026-03-24*
