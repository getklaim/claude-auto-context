---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Unified Architecture
status: Defining requirements
last_updated: "2026-03-31T03:29:47.355Z"
last_activity: 2026-03-31 — Milestone v3.0 started
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-31 — Milestone v3.0 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core value:** Continuously improve Claude Code's project understanding by extracting patterns from real usage
**Current focus:** v3.0 — MAP.md + lightweight worker rewrite

## Accumulated Context

- v1.0 shipped: core pipeline (events, worker, 3-agent orchestrator)
- v1.1 shipped: hooks-agent (pattern detection, hook generation)
- v1.2 shipped: local isolation (rules/local, claudemd-agent removed)
- v1.3 shipped: skill-agent (detection, prompt composition, delivery)
- v1.4 partial: Phase 11 only (infrastructure fixes)
- v2.0 shipped: 5-agent unified orchestrator, observations/registry removed, 100-event threshold
- **v3.0 planning:** Deep research done (16 competitors, GSD analysis, ETH Zurich study, Boris Cherny practices)
- **Key insight:** event logs (user prompts) = primary signal, codebase reading = reference context
- **Key insight:** Boris Test — "이 규칙 지우면 Claude가 실수하나?" No면 안 만듦
- **Key insight:** MAP.md = 파일별 한 줄 설명 지도, ~2KB, 프롬프트에 내용 삽입 X → 경로만 전달
