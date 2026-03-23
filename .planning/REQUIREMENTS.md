# Requirements: Claude Auto Context

**Defined:** 2026-03-23
**Core Value:** 실제 사용 패턴을 추출하여 Claude Code의 프로젝트 이해도를 지속적으로 개선

## v1.1 요구사항

Hook 자동 생성 마일스톤. 각 요구사항은 로드맵 페이즈에 매핑됨.

### 패턴 감지

- [ ] **DET-01**: worker가 매 배치 처리 시 hook_patterns 테이블에 패턴을 누적 저장 (pattern_key, count, distinct session_ids)
- [ ] **DET-02**: worker가 임계값 도달한 패턴 목록을 hooks-agent에게 전달 (포맷터/린터: 3+ 세션, 위험명령/시크릿: 즉시)
- [ ] **DET-03**: 포맷터/린터 명령(eslint, prettier, black, gofmt) 패턴을 배치 경계와 무관하게 세션 간 누적 감지
- [ ] **DET-04**: 위험 명령 패턴(rm -rf, git push --force, git reset --hard) 무조건 감지 (빈도 임계값 없음)
- [ ] **DET-05**: 민감 파일(.env, .pem, .key) Write/Edit 감지 — zero-tolerance (첫 발생 즉시)
- [ ] **DET-06**: Stop 이벤트 이후 테스트 실행 패턴을 3개 이상 세션에 걸쳐 누적 감지
- [ ] **DET-07**: 플러그인 내부 이벤트(.claude-auto-context/ 경로)를 패턴 집계에서 필터링

### Hook 생성

- [ ] **GEN-01**: 위험 명령 차단용 PreToolUse:Bash hook 생성 (exit 2로 거부)
- [ ] **GEN-02**: 자동 포맷용 PostToolUse:Edit|Write hook 생성
- [ ] **GEN-03**: 민감 파일 보호용 PreToolUse:Edit|Write hook 생성
- [ ] **GEN-04**: 테스트 게이트용 Stop hook 생성 (stop_hook_active 가드 포함)
- [ ] **GEN-05**: 생성된 hook 스크립트는 정적 명령 문자열만 사용 (세션 데이터 동적 삽입 금지)
- [ ] **GEN-06**: 모든 PostToolUse/Stop hook 스크립트에 CAC_HOOK_RUNNING 재진입 가드 포함

### 통합

- [ ] **INT-01**: hooks-agent가 기존 3개 에이전트와 병렬로 오케스트레이터에서 실행
- [ ] **INT-02**: hooks-agent가 다른 에이전트와 동일한 buildBulkPrompt() 출력을 읽음
- [ ] **INT-03**: hooks-agent가 대상 프로젝트의 .claude/settings.json에 기록 (플러그인의 hooks/hooks.json에는 절대 기록하지 않음)
- [ ] **INT-04**: 생성된 셸 스크립트를 대상 프로젝트의 .claude/hooks/ 디렉토리에 배치
- [ ] **INT-05**: settings.json 수정 시 원자적 쓰기 사용 (임시 파일 + rename)
- [ ] **INT-06**: settings.json 수정 시 기존 hook과 병합 (read → parse → 중복제거 → write)

### 롤백

- [ ] **RBK-01**: hook 생성 전 settings.json과 .claude/hooks/*.sh 스크립트를 .claude-auto-context/hook-backups/에 함께 백업
- [ ] **RBK-02**: hooks-registry.json이 생성된 모든 hook의 타임스탬프, 소스 세션, 연결된 스크립트 파일 경로를 추적
- [ ] **RBK-03**: /cac-undo-hook 스킬로 마지막 백업에서 settings.json과 연결 스크립트를 함께 복원/삭제

### 품질 보증

- [ ] **QA-01**: quality-gate.mjs가 takeContentSnapshot()에서 .claude/settings.json을 스냅샷
- [ ] **QA-02**: Q-12 검사로 생성된 hook의 JSON 형식 유효성 검증
- [ ] **QA-03**: Q-13 검사로 중복 hook 감지 (동일 matcher + command)
- [ ] **QA-04**: settings.json 변경을 hygiene-agent 트리거에서 제외 (hook 전용 변경은 hygiene 감사 미실행)

### 알림

- [ ] **NTF-01**: 새 hook 추가 시 사용자에게 알림 (applied 상태의 suggestion 파일)
- [ ] **NTF-02**: 알림에 hook 설명과 수동 제거 방법 포함

## v1.2 요구사항

팀 머지 컨플릭트 제거 마일스톤. 자동 생성 파일을 로컬 전용으로 분리하여 git 충돌 원천 차단.

### 로컬 격리 (LOCAL)

- [ ] **LOCAL-01**: rules-agent가 자동 생성 규칙을 `.claude/rules/local/`에 작성 (`.claude/rules/` 대신)
- [ ] **LOCAL-02**: claudemd-agent 삭제 — rules-agent가 전역 규칙도 담당 (`globs:` 없는 규칙 = 전역 적용)
- [ ] **LOCAL-03**: 플러그인 setup hook이 `.gitignore`에 `.claude/rules/local/` 추가
- [ ] **LOCAL-04**: hygiene-agent가 `.claude/rules/local/` 내 파일만 수정 (커밋된 rules와 CLAUDE.md는 절대 건드리지 않음)
- [ ] **LOCAL-05**: worker.mjs 오케스트레이터에서 claudemd-agent 제거 (3→2 에이전트)
- [ ] **LOCAL-06**: quality-gate에서 CLAUDE.md 관련 체크(Q-07~Q-09) 제거

### 제안 네이밍 (SUG)

- [ ] **SUG-03**: 제안 파일이 순차 번호(`NNN-slug.md`) 대신 타임스탬프 기반 네이밍(`YYYYMMDD-HHMMSS-{slug}.md`) 사용
- [ ] **SUG-04**: 기존 순차 번호 제안도 프롬프트 hook에서 감지 및 표시

### 승격 (PROMO)

- [ ] **PROMO-01**: `/cac-promote` 스킬로 로컬 규칙을 팀 공유 rules로 승격
- [ ] **PROMO-02**: 승격 시 `.claude/rules/local/`에서 `.claude/rules/`로 파일 복사 후 로컬 삭제
- [ ] **PROMO-03**: 승격 스킬이 이동 전 diff/미리보기 표시

### 마이그레이션 (MIG)

- [ ] **MIG-01**: 업그레이드 후 첫 실행 시 `.claude/rules/`의 기존 자동 생성 규칙을 `.claude/rules/local/`로 이동
- [ ] **MIG-02**: 마이그레이션 시 이동된 파일 목록을 로그에 기록

### 고급 감지 (v1.3 이후)

- **ADT-01**: 프로젝트 초기 스캔 (package.json, tsconfig 분석)으로 일회성 hook 생성
- **ADT-02**: 프롬프트에서 사용자 수정 언어 감지

### 생명주기 관리 (v1.3 이후)

- **LCM-01**: 30일간 트리거되지 않은 hook 자동 비활성화
- **LCM-02**: Hook 효과 추적 (각 hook의 발동 빈도)

## 범위 밖

| 기능 | 이유 |
|------|------|
| `type: "agent"` hook | 매 tool call마다 서브에이전트 생성 — 비용 과다, 느림 |
| `type: "http"` hook | 로컬 서버 필요 — 안정적으로 사용 불가 |
| ~/.claude/settings.json에 쓰기 | 모든 프로젝트에 영향 — 잘못된 범위 |
| `claude -p` 생성하는 hook | Claude Code 세션 내에서 행(hang) 발생 |
| 점진적 신뢰/자동적용 시스템 | 직접 수정 방식 선택됨; 신뢰 단계 상승은 연기 |
| 배치당 1개 초과 hook 생성 | Hook 누적이 UX 저하; 향후 반복 개선 |
| Custom git merge driver | 높은 복잡도, clone마다 설정 필요, GitHub 웹 UI 미작동 |
| CLAUDE.md 분할 (CLAUDE.d/) | Claude Code가 assembly 미지원; `.claude/rules/`로 해결 |
| 중앙 조율 서버 | 플러그인은 로컬 전용 설계 |
| AGENTS.md 호환 | 다른 에코시스템; 이번 마일스톤 범위 밖 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DET-01 | — | Pending |
| DET-02 | — | Pending |
| DET-03 | — | Pending |
| DET-04 | — | Pending |
| DET-05 | — | Pending |
| DET-06 | — | Pending |
| DET-07 | — | Pending |
| GEN-01 | — | Pending |
| GEN-02 | — | Pending |
| GEN-03 | — | Pending |
| GEN-04 | — | Pending |
| GEN-05 | — | Pending |
| GEN-06 | — | Pending |
| INT-01 | — | Pending |
| INT-02 | — | Pending |
| INT-03 | — | Pending |
| INT-04 | — | Pending |
| INT-05 | — | Pending |
| INT-06 | — | Pending |
| RBK-01 | — | Pending |
| RBK-02 | — | Pending |
| RBK-03 | — | Pending |
| QA-01 | — | Pending |
| QA-02 | — | Pending |
| QA-03 | — | Pending |
| QA-04 | — | Pending |
| NTF-01 | — | Pending |
| NTF-02 | — | Pending |

**Coverage:**
- v1.1 requirements: 28 total
- v1.2 requirements: 13 total (LOCAL: 6, SUG: 2, PROMO: 3, MIG: 2)
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 38

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after v1.2 merge conflict requirements*
