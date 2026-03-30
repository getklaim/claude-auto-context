# Requirements: Claude Auto Context

**Defined:** 2026-03-30
**Core Value:** 세션 패턴에서 자동으로 actionable context를 추출하여 AI 코딩 품질을 지속 개선

## v2.0 Requirements

### 워커 인프라

- [x] **WORK-01**: pending raw_events가 100개 이상일 때만 배치 처리
- [x] **WORK-02**: observations 테이블과 pending-observations.json 로직 제거
- [x] **WORK-03**: batchCount 변수 제거

### 오케스트레이터

- [x] **ORCH-01**: 5개 agent 동시 실행하는 단일 오케스트레이터 (rules, suggestions, hooks, skill, hygiene)
- [x] **ORCH-02**: 모든 agent에게 기존 컨텍스트 요약 전달 (현재 rules, hooks, skills, suggestions 목록)
- [x] **ORCH-03**: 모든 agent가 보수적으로 작동 — 생성 전 기존 것과 중복/겹침 확인

### Suggestions Agent

- [x] **SUGG-01**: 세션 패턴 분석으로 AI 비친화적 코드 식별
- [x] **SUGG-02**: 코드베이스 최적화 제안 (파일 분리, 네이밍, CLAUDE.md, 디렉토리 구조)
- [x] **SUGG-03**: 제안에 의존성 있는 관련 파일 수정도 포함

### Skill Agent

- [x] **SKIL-01**: 매 사이클마다 실행
- [x] **SKIL-02**: 세션 데이터에서 반복 multi-step 워크플로우 직접 분석
- [x] **SKIL-03**: .claude/skills/ + skills/에 SKILL.md 직접 생성 (dual-dir sync)
- [x] **SKIL-04**: 기존 스킬 목록으로 중복 방지

### Hygiene Agent

- [x] **HYGI-01**: 오케스트레이터 안에서 실행 (별도 query() 아님)
- [x] **HYGI-02**: rules, hooks, suggestions 중복/모순/stale 참조 정리

### 정리

- [x] **CLEN-01**: skill-detector.mjs, skill-cap.mjs 삭제
- [x] **CLEN-02**: skills-registry.json 참조 제거
- [x] **CLEN-03**: observations 테이블 생성 및 collectObservations() 제거
- [x] **CLEN-04**: buildObservationsContext() 및 pending-observations.json 처리 제거

## Future Requirements

### 피드백 루프 (v1.4에서 이관)

- **FDBK-01**: 사용자가 agent 출력물에 유용/불유용 표시
- **FDBK-02**: 피드백 데이터가 agent 프롬프트에 캘리브레이션 예시로 반영

### 라이프사이클 (v1.4에서 이관)

- **SLCM-01**: 트리거되지 않는 rules 자동 비활성화
- **SLCM-02**: Skill 사용 추적 및 자동 deprecation

## Out of Scope

| Feature | Reason |
|---------|--------|
| 프로젝트 초기 스캔 | 세션 패턴 분석만 — one-time scan 아님 |
| 크로스 프로젝트 스킬 이식 | 프로젝트 로컬 생성만 |
| 임베딩 기반 유사도 | Jaccard/LLM 판단으로 충분 |
| 실시간 분석 | 배치 처리만 |
| Suggestion 자동 적용 | human-in-the-loop 유지 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WORK-01 | Phase 15: Cleanup and Infrastructure | Complete |
| WORK-02 | Phase 15: Cleanup and Infrastructure | Complete |
| WORK-03 | Phase 15: Cleanup and Infrastructure | Complete |
| ORCH-01 | Phase 16: Orchestrator Unification | Complete |
| ORCH-02 | Phase 16: Orchestrator Unification | Complete |
| ORCH-03 | Phase 16: Orchestrator Unification | Complete |
| SUGG-01 | Phase 17: Suggestions Agent Rewrite | Complete |
| SUGG-02 | Phase 17: Suggestions Agent Rewrite | Complete |
| SUGG-03 | Phase 17: Suggestions Agent Rewrite | Complete |
| SKIL-01 | Phase 18: Skill Agent Rewrite | Complete |
| SKIL-02 | Phase 18: Skill Agent Rewrite | Complete |
| SKIL-03 | Phase 18: Skill Agent Rewrite | Complete |
| SKIL-04 | Phase 18: Skill Agent Rewrite | Complete |
| HYGI-01 | Phase 16: Orchestrator Unification | Complete |
| HYGI-02 | Phase 16: Orchestrator Unification | Complete |
| CLEN-01 | Phase 0: Pre-completed Cleanup | Complete |
| CLEN-02 | Phase 0: Pre-completed Cleanup | Complete |
| CLEN-03 | Phase 15: Cleanup and Infrastructure | Complete |
| CLEN-04 | Phase 15: Cleanup and Infrastructure | Complete |

**Coverage:**
- v2.0 requirements: 18 total
- Complete: 2 (CLEN-01, CLEN-02)
- Pending: 16
- Unmapped: 0 (100% mapped)

---
*Requirements defined: 2026-03-30*
