---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Codebase-Aware Context Engine
status: between_milestones
last_updated: "2026-03-31T03:40:00.000Z"
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
---

## Current Position

v2.0 archived. v3.0 Phase 16 (cac-init) shipped. Remaining v3.0 phases TBD.

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core value:** Continuously improve Claude Code's project understanding by extracting patterns from real usage
**Current focus:** v3.0 remaining phases — worker rewrite, Haiku budget, Boris Test

## Accumulated Context

- v1.0 shipped: core pipeline (events, worker, 3-agent orchestrator)
- v1.1 shipped: hooks-agent (pattern detection, hook generation)
- v1.2 shipped: local isolation (rules/local, claudemd-agent removed)
- v1.3 shipped: skill-agent (detection, prompt composition, delivery)
- v1.4 partial: Phase 11 only (infrastructure fixes)
- v2.0 shipped: 5-agent unified orchestrator, observations/registry removed, 100-event threshold
- v3.0 Phase 16 shipped: /cac-init skill — MAP.md codebase map generator
- **Key insight:** event logs (user prompts) = primary signal, codebase reading = reference context
- **Key insight:** Boris Test — "이 규칙 지우면 Claude가 실수하나?" No면 안 만듦
- **Key insight:** MAP.md = 파일별 한 줄 설명 지도, ~2KB, 프롬프트에 내용 삽입 X → 경로만 전달
