# Claude Auto Context

## What This Is

A Claude Code plugin that captures session events (prompts, tool calls, session lifecycle) and auto-generates context files — rules, hooks, skills, and structural suggestions — using a background worker with multi-agent orchestration. The plugin continuously improves AI coding quality without manual effort.

## Core Value

Continuously improve Claude Code's project understanding by extracting patterns from real usage and turning them into actionable context, automatically.

## Requirements

### Validated

- ✓ **v1.0**: Event pipeline, worker, 3-agent orchestrator, self-heal, suggestion system
- ✓ **v1.1**: hooks-agent (pattern detection, hook config generation)
- ✓ **v1.2**: Local isolation (rules/local/, claudemd-agent removed)
- ✓ **v1.3**: Skill agent (detection, prompt composition, delivery, 19/19 reqs)
- ✓ **v2.0**: 5-agent unified orchestrator, dead code removal, 100-event threshold, context-aware dedup (18/18 reqs)
- ✓ **v3.0 Phase 16**: /cac-init skill — MAP.md codebase map generator (MAP-01..04)

### Active

- [ ] Worker rewrite: bulkPrompt → extractSessionHints() + git diff + MAP.md paths
- [ ] Haiku + --bare, $0.30 budget (from $2.00)
- [ ] Boris Test-based quality filter: skip if no actionable hints
- [ ] rules-agent: Boris Cherny institutional memory pattern

## Current Milestone: v3.0 Codebase-Aware Context Engine

**Goal:** 이벤트 로그(유저 프롬프트)를 1차 신호로 유지하되, 에이전트가 코드베이스를 직접 읽어 참고할 수 있게 MAP.md 기반 컨텍스트 보강. Usage ~50-100x 절감.

**Target features:**
- `/cac-init` → MAP.md (파일별 한 줄 설명 지도) 생성
- 워커 리팩터링: bulkPrompt 삭제 → extractSessionHints() + git diff + MAP.md 경로
- Haiku + --bare, $0.30 budget (from $2.00)
- 힌트 없으면 스킵 ($0) — Boris Test 기반 규칙 품질 필터
- rules-agent 프롬프트: Boris Cherny institutional memory 패턴 적용

### Out of Scope

- MCP 서버 — 파일 기반으로 해결
- Vector embeddings — MAP.md + Read/Glob/Grep으로 충분
- tree-sitter — 에이전트가 직접 코드 읽음
- Cross-project portability — project-local only
- Real-time analysis — batch processing only

## Context

- Plugin uses Bun runtime with built-in SQLite (`bun:sqlite`)
- Agent orchestration via `@anthropic-ai/claude-agent-sdk`
- v1.x had: 3-agent orchestrator + standalone skill-agent + separate hygiene query()
- v2.0 goal: single orchestrator with all 5 agents
- Channel.io AI Native approach as inspiration for suggestions-agent
- This session already removed: skill-detector.mjs, skill-cap.mjs, skills-registry.json, standalone skill-agent block

## Constraints

- **Runtime**: Bun-only (worker.mjs uses `bun:sqlite`; cannot run on Node.js)
- **Budget**: Agent SDK cost stays within $2.0 per orchestrator cycle
- **Latency**: Hook scripts must complete <100ms (non-blocking)
- **Compatibility**: Generated hooks/skills must be valid Claude Code format
- **Safety**: Agents must not generate artifacts that break existing workflow
- **Conservative**: All agents must check existing context before creating new artifacts

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Remove observations table | raw_events already has all data; observations was a redundant summary layer | ✓ Good — eliminated ~300 LOC |
| Remove skill-detector | LLM judges skill worthiness directly from session data; deterministic scoring was over-engineering | ✓ Good — 618 LOC removed |
| Remove skills-registry.json | Dedup via loadExistingSkills() reading .claude/skills/ directory directly | ✓ Good — single source of truth |
| 5 agents in 1 orchestrator | Simpler architecture, parallel execution, single budget control | ✓ Good — single query() call |
| Batch trigger >= 100 events | Prevents wasteful cycles on tiny batches; accumulates enough signal | ✓ Good — saves cost |
| skill-agent every cycle | 100-batch cadence was unreachable; LLM judgment is cheap enough to run always | ✓ Good — consistent behavior |
| MAP.md = file-per-line codebase map | path-only passing to agents; never inject content into prompts | ✓ Good — ~2KB reference |
| Boris Test for rule creation | "이 규칙 지우면 Claude가 실수하나?" — No means don't create | — Pending (v3.0 worker rewrite) |

## Current State

- v2.0 shipped: 5-agent unified orchestrator with context-aware dedup
- v3.0 phase 16 shipped: /cac-init skill for MAP.md generation
- Remaining v3.0 work: worker rewrite (extractSessionHints, Haiku/$0.30 budget, Boris Test filter)
- Plugin version: 1.4.x (6 skills, 18 hooks, 5 agents)

---
*Last updated: 2026-03-31 after v2.0 milestone completion + v3.0 Phase 16*
