# Roadmap: claude-auto-context

## Milestones

- Shipped **v1.0 Core Pipeline** -- Phases 1-5
- Shipped **v1.1 Hook Auto-Generation** -- (alongside v1.2)
- Shipped **v1.2 Local Isolation** -- Phases 6-7
- Shipped **v1.3 Skill Agent** -- Phases 8-10 (2026-03-26)
- Partially shipped **v1.4 Agent Output Quality** -- Phase 11 only (Phases 12-14 superseded by v2.0)
- **v2.0 Unified Architecture** -- Phases 15-18

<details>
<summary>v1.3 Skill Agent (Phases 8-10) -- SHIPPED 2026-03-26</summary>

- [x] Phase 8: Detection Foundation (4/4 plans) -- completed 2026-03-25
- [x] Phase 9: Prompt Composition + Worker Integration (3/3 plans) -- completed 2026-03-26
- [x] Phase 10: Delivery + UX (3/3 plans) -- completed 2026-03-26

Full archive: milestones/v1.3-ROADMAP.md

</details>

<details>
<summary>v1.4 Agent Output Quality -- PARTIAL (Phase 11 only)</summary>

- [x] Phase 11: Infrastructure Fixes -- completed 2026-03-27
- [ ] Phase 12: Hooks Expansion -- superseded by v2.0
- [ ] Phase 13: Rules Quality Research -- superseded by v2.0
- [ ] Phase 14: Rules Quality Implementation -- superseded by v2.0

</details>

---

## v2.0 Unified Architecture

### Phase 0: Pre-completed Cleanup (CLEN-01, CLEN-02)

**Status:** Complete (done during v2.0 planning session, 2026-03-30)

- CLEN-01: `skill-detector.mjs`, `skill-cap.mjs` deleted
- CLEN-02: `skills-registry.json` references removed, standalone skill-agent block removed

---

### Phase 15: Unified Architecture (merged 15-18)

**Goal:** Remove all dead code, unify the orchestrator to run 5 agents in one query, rewrite suggestion-agent and skill-agent prompts, fold hygiene inside, and add batch threshold.

**Requirements:** WORK-01, WORK-02, WORK-03, CLEN-03, CLEN-04, ORCH-01, ORCH-02, ORCH-03, HYGI-01, HYGI-02, SUGG-01, SUGG-02, SUGG-03, SKIL-01, SKIL-02, SKIL-03, SKIL-04

**Success Criteria:**
1. Worker only starts a batch cycle when `pending raw_events >= 100`; smaller queues are skipped and logged
2. `observations` table creation SQL, `collectObservations()`, `buildObservationsContext()`, `pending-observations.json`, `batchCount` are all absent from the codebase
3. `bun --check worker.mjs` passes with no errors
4. Worker log shows a single orchestrator invocation producing output from all 5 agents (rules, suggestions, hooks, skill, hygiene) in one cycle
5. Each agent's prompt includes a preamble listing current rules, hooks, skills, and open suggestions
6. Worker log shows conservative dedup behavior ("skipped — already exists" or "no change needed")
7. suggestions-agent targets AI-unfriendly code patterns from session data, includes related files
8. skill-agent runs every cycle, analyzes raw_events directly, writes to both skill directories, deduplicates

---

## Progress

| Phase | Milestone | Requirements | Status | Completed |
|-------|-----------|-------------|--------|-----------|
| 1-5 | v1.0 | HOOK-01..04, RULE-01..02, SUG-01..02, QA-01, SYS-01..02 | Complete | -- |
| 6-7 | v1.2 | LOCAL-01 | Complete | -- |
| 8. Detection Foundation | v1.3 | SDET-01..06 | Complete | 2026-03-25 |
| 9. Prompt Composition | v1.3 | SPROM-01..04 | Complete | 2026-03-26 |
| 10. Delivery + UX | v1.3 | SINT-01..05, SDEL-01..04 | Complete | 2026-03-26 |
| 11. Infrastructure Fixes | v1.4 | INFRA-01..03 | Complete | 2026-03-27 |
| 0. Pre-completed Cleanup | v2.0 | CLEN-01, CLEN-02 | Complete | 2026-03-30 |
| 15. Unified Architecture | 2/2 | Complete   | 2026-03-30 | -- |

---
*Last updated: 2026-03-30 — merged phases 15-18 into single phase*
