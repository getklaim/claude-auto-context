# Roadmap: claude-auto-context

## Milestones

- Shipped **v1.0 Core Pipeline** -- Phases 1-5
- Shipped **v1.1 Hook Auto-Generation** -- (alongside v1.2)
- Shipped **v1.2 Local Isolation** -- Phases 6-7
- Shipped **v1.3 Skill Agent** -- Phases 8-10 (2026-03-26)
- **v1.4 Agent Output Quality** -- Phases 11-14

<details>
<summary>v1.3 Skill Agent (Phases 8-10) -- SHIPPED 2026-03-26</summary>

- [x] Phase 8: Detection Foundation (4/4 plans) -- completed 2026-03-25
- [x] Phase 9: Prompt Composition + Worker Integration (3/3 plans) -- completed 2026-03-26
- [x] Phase 10: Delivery + UX (3/3 plans) -- completed 2026-03-26

Full archive: milestones/v1.3-ROADMAP.md

</details>

## v1.4 Agent Output Quality

### Phase 11: Infrastructure Fixes

**Goal:** Agents can actually write outputs and we can see what they did.

**Requirements:** INFRA-01, INFRA-02, INFRA-03

**Success Criteria:**
1. rules-agent successfully writes a `.claude/rules/local/*.md` file in a target project
2. Worker log shows per-agent decision summaries: patterns found, created, skipped with reasons
3. All orchestrator agents use maxTurns=20
4. No "permission denied" or "truncated mid-analysis" in worker log after a full batch

### Phase 12: Hooks Expansion

**Goal:** hooks-agent detects project-specific automation patterns beyond the original 4 types.

**Requirements:** HEXP-01, HEXP-02, HEXP-03

**Success Criteria:**
1. hooks-agent prompt includes co-edit and build-verification pattern categories
2. Generated hook scripts use `tool_input.file_path` for conditional execution
3. hooks-agent logs at least one detected pattern when processing real session data
4. Generated hook script is syntactically valid and includes CAC_HOOK_RUNNING re-entry guard

### Phase 13: Rules Quality Research

**Goal:** Research what makes a good rule, then refine RQUA requirements with evidence.

**Requirements:** RQUA-01, RQUA-02, RQUA-03 (refined during this phase)

**Success Criteria:**
1. Research doc with analysis of existing agent outputs (real dogfooding data)
2. Concrete "good rule" and "bad rule" examples from real data
3. Observation → rule promotion criteria defined with specific thresholds
4. RQUA requirements updated with research findings

### Phase 14: Rules Quality Implementation

**Goal:** Apply research findings to improve rules-agent judgment.

**Requirements:** RQUA-01, RQUA-02, RQUA-03 (finalized from Phase 13)

**Success Criteria:**
1. rules-agent prompt includes dogfooding-derived good/bad examples
2. rules-agent prompt includes explicit boundary guidance
3. Observation → rule promotion criteria are inline in the prompt
4. Re-run against real session data produces at least 1 useful rule (manual verification)

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-5 | v1.0 | -- | Complete | -- |
| 6-7 | v1.2 | -- | Complete | -- |
| 8. Detection Foundation | v1.3 | 4/4 | Complete | 2026-03-25 |
| 9. Prompt Composition | v1.3 | 3/3 | Complete | 2026-03-26 |
| 10. Delivery + UX | v1.3 | 3/3 | Complete | 2026-03-26 |
| 11. Infrastructure Fixes | 0/2 | Complete    | 2026-03-27 | -- |
| 12. Hooks Expansion | v1.4 | 0/? | Pending | -- |
| 13. Rules Quality Research | v1.4 | 0/? | Pending | -- |
| 14. Rules Quality Implementation | v1.4 | 0/? | Pending | -- |

---
*Last updated: 2026-03-27 after v1.4 milestone start*
