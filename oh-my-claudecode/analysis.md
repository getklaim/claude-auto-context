# oh-my-claudecode — AI 최적화 분석

> **GitHub**: https://github.com/Yeachan-Heo/oh-my-claudecode  
> **Stars**: ~7.4k  
> **License**: MIT  
> **분류**: 🏆 최고 수준 (AI 코딩 도구 그 자체)

---

## 프로젝트 개요

oh-my-claudecode는 Claude Code CLI를 강화하는 멀티 에이전트 오케스트레이션 시스템입니다.
oh-my-zsh에서 영감을 받아 만들어진 이 도구는 Claude Code를 "전문 AI 에이전트들의 지휘자(Conductor)"로 변환합니다.

**버전**: 4.0.0  
**목적**: Claude Code를 전문화된 AI 에이전트의 지휘자로 변환  
**영감**: oh-my-zsh / oh-my-opencode

---

## AI 최적화 구성 요소

### 1. 에이전트 시스템 (28개 에이전트)

3단계 모델 라우팅 시스템:

#### Base Agents (12개)

| 에이전트 | 모델 | 목적 |
|---------|------|------|
| architect | Opus | 아키텍처, 디버깅, 근본 원인 분석 |
| document-specialist | Sonnet | 문서화, 외부 API 리서치 |
| explore | Haiku | 빠른 코드베이스 패턴 검색 |
| executor | Sonnet | 집중적 작업 구현 |
| designer | Sonnet | UI/UX, 컴포넌트 디자인 |
| writer | Haiku | 기술 문서화 |
| vision | Sonnet | 이미지/스크린샷 분석 |
| critic | Opus | 비판적 계획 검토 |
| analyst | Opus | 사전 계획 요구사항 분석 |
| planner | Opus | 인터뷰와 함께 전략적 계획 수립 |
| qa-tester | Sonnet | 대화형 CLI/서비스 테스팅 |
| scientist | Sonnet | 데이터 분석, 가설 검증 |

#### Specialized Agents (4개)

| 에이전트 | 모델 | 목적 |
|---------|------|------|
| security-reviewer | Opus | 보안 취약점 감지 및 감사 |
| build-fixer | Sonnet | 빌드/타입 에러 해결 (다중 언어) |
| test-engineer | Sonnet | TDD 워크플로우 |
| code-reviewer | Opus | 전문가 코드 리뷰 |

#### Tiered Variants (12개)

| 티어 | 에이전트 |
|-----|---------|
| LOW (Haiku) | architect-low, executor-low, designer-low, security-reviewer-low, test-engineer-low (5개) |
| MEDIUM (Sonnet) | architect-medium (1개) |
| HIGH (Opus) | executor-high, designer-high, explore-high, scientist-high, deep-executor (5개) |

**모델 티어링 원칙:**
- **Haiku (LOW)**: 단순 조회, 사소한 수정, 빠른 검색
- **Sonnet (MEDIUM)**: 표준 구현, 보통 수준의 추론
- **Opus (HIGH)**: 복잡한 추론, 아키텍처, 디버깅

---

### 2. Skills 시스템 (37개 스킬)

`skills/` 디렉토리에 위치한 워크플로우 자동화 정의들:

**주요 스킬 목록:**
- `autopilot` - 완전 자율 실행
- `ultrawork` - 최대 병렬 에이전트 실행
- `ralph` - 완료 확인까지 반복 실행 (persistence)
- `ultrapilot` - 파일 소유권이 있는 병렬 autopilot
- `plan` - 전략적 계획 수립
- `ralplan` - ralph + plan 복합
- `deepsearch` - 심층 리서치
- `deepinit` - 심층 초기화
- `frontend-ui-ux` - 프론트엔드 UI/UX 전문
- `git-master` - Git 작업 전문
- `tdd` - 테스트 주도 개발
- `security-review` - 보안 검토
- `code-review` - 코드 리뷰
- `sciomc` - OMC 자기 참조
- `external-context` - 외부 컨텍스트 로딩
- `analyze` - 분석
- `swarm` - N개 에이전트 SQLite 작업 클레임
- `pipeline` - 데이터 전달하는 순차 에이전트 체이닝
- `cancel` - 취소
- `learner` - 스킬 추출 및 학습
- `note` - 메모 관리
- `hud` - HUD 표시
- `doctor` - 진단
- `omc-setup` - OMC 설정
- `mcp-setup` - MCP 설정
- `build-fix` - 빌드 수정
- `ultraqa` - Ultra QA

---

### 3. Hook 시스템 (31개 훅)

`src/hooks/` 디렉토리에 위치한 이벤트 기반 실행 시스템:

```
훅 디렉토리 구조:
src/hooks/
├── autopilot/        완전 자율 실행 모드
├── ralph/            완료 확인까지 반복
├── ultrawork/        병렬 에이전트 최대 실행
├── ultrapilot/       파일 소유권 있는 병렬 autopilot
├── swarm/            N개 조율된 에이전트
├── learner/          스킬 추출
├── recovery/         에러 복구
├── rules-injector/   규칙 파일 자동 주입
└── think-mode/       강화된 추론 모드
```

**실행 모드 트리거 키워드:**

| 모드 | 트리거 | 목적 |
|-----|--------|------|
| autopilot | "autopilot", "build me", "I want a" | 완전 자율 실행 |
| ultrawork | "ulw", "ultrawork" | 최대 병렬 에이전트 실행 |
| ralph | "ralph", "don't stop until" | 완료까지 지속 실행 |
| ultrapilot | "ultrapilot", "parallel build" | 파일 소유권 병렬 autopilot |
| swarm | "swarm N agents" | SQLite 작업 클레임 N 에이전트 |
| pipeline | "pipeline" | 데이터 전달 순차 체이닝 |

---

### 4. LSP/AST 도구 (15개)

IDE 수준의 코드 인텔리전스 도구들:

#### LSP 도구 (12개)
```
lsp_hover              - 위치의 타입 정보
lsp_goto_definition    - 정의로 이동
lsp_find_references    - 모든 사용처 찾기
lsp_document_symbols   - 파일 개요
lsp_workspace_symbols  - 작업공간 전체 심볼 검색
lsp_diagnostics        - 단일 파일 에러/경고
lsp_diagnostics_directory - 프로젝트 전체 타입 검사
lsp_servers            - 사용 가능한 언어 서버 목록
lsp_prepare_rename     - 이름 변경 유효성 확인
lsp_rename             - 다중 파일 이름 변경 미리보기
lsp_code_actions       - 사용 가능한 리팩토링/수정
lsp_code_action_resolve - 액션 세부 정보
```

**지원 언어**: TypeScript, Python, Rust, Go, C/C++, Java, JSON, HTML, CSS, YAML

#### AST 도구 (2개)
```
ast_grep_search   - 메타변수로 패턴 매칭 ($NAME, $$$ARGS)
ast_grep_replace  - AST 인식 코드 변환 (기본값: dry-run)
```

**지원 언어**: JavaScript, TypeScript, TSX, Python, Ruby, Go, Rust, Java, Kotlin, Swift, C, C++, C#, HTML, CSS, JSON, YAML

#### Python REPL (1개)
```
python_repl - 데이터 분석을 위한 Python 코드 실행
```

---

### 5. AGENTS.md 구조

전체 프로젝트에 걸쳐 계층적 AGENTS.md 시스템:

```
/AGENTS.md                    - 루트 개요 (에이전트 위임 프로토콜)
/src/AGENTS.md                - TypeScript 소스 코드 패턴
/agents/AGENTS.md             - 에이전트 구현 세부사항
/skills/AGENTS.md             - 스킬 정의 가이드
/src/hooks/AGENTS.md          - 훅 시스템 가이드
/src/tools/AGENTS.md          - 도구 정의
/src/tools/lsp/AGENTS.md      - LSP 도구 가이드
/src/tools/diagnostics/AGENTS.md - 진단 도구
/docs/AGENTS.md               - 문서 작성 가이드
```

**AGENTS.md 업데이트 트리거 매트릭스:**

| 변경 내용 | 업데이트할 AGENTS.md |
|---------|-------------------|
| 루트 프로젝트 구조, 새 기능 | `/AGENTS.md` |
| `src/**/*.ts` 구조 | `src/AGENTS.md` |
| `agents/*.md` 파일 | `src/agents/AGENTS.md` |
| `skills/*/` 디렉토리 | `skills/AGENTS.md` |
| `src/hooks/*/` 디렉토리 | `src/hooks/AGENTS.md` |

---

### 6. 상태 관리 시스템

```
.omc/state/*.json     - 실행 모드 상태 (autopilot, swarm 등)
.omc/notepads/        - 계획 범위 지혜 (학습, 결정, 이슈)
~/.omc/state/         - 전역 상태
~/.claude/.omc/       - 레거시 상태 (자동 마이그레이션)
```

---

### 7. MCP 통합

```json
{
  "defaultExecutionMode": "ultrawork",
  "mcpServers": {
    "context7": { "enabled": true },
    "exa": { "enabled": true, "apiKey": "..." }
  }
}
```

---

### 8. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code CLI                          │
├─────────────────────────────────────────────────────────────┤
│                  oh-my-claudecode (OMC)                     │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │   Skills    │   Agents    │    Tools    │   Hooks     │  │
│  │ (37 skills) │ (28 agents) │(LSP/AST/REPL)│ (31 hooks)  │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Features Layer                             ││
│  │ model-routing | boulder-state | verification | notepad  ││
│  │ delegation-categories | task-decomposer | state-manager ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 핵심 AI 최적화 원칙

### 위임-우선 프로토콜

AGENTS.md에 명시된 지침:

> "당신은 지휘자(CONDUCTOR)이지 연주자가 아닙니다. 실질적인 작업은 위임하세요."

| 작업 유형 | 위임 대상 | 모델 |
|---------|---------|------|
| 코드 변경 | executor / executor-low / executor-high | sonnet/haiku/opus |
| 분석 | architect / architect-medium / architect-low | opus/sonnet/haiku |
| 검색 | explore / explore-high | haiku/opus |
| UI/UX | designer / designer-low / designer-high | sonnet/haiku/opus |
| 문서 | writer | haiku |
| 보안 | security-reviewer / security-reviewer-low | opus/haiku |
| 빌드 오류 | build-fixer | sonnet |
| 테스팅 | qa-tester | sonnet |
| 코드 리뷰 | code-reviewer | opus |
| TDD | test-engineer / test-engineer-low | sonnet/haiku |
| 데이터 분석 | scientist / scientist-high | sonnet/opus |

### 교차 파일 의존성 매트릭스

| 수정 시 | 함께 확인/업데이트 |
|--------|----------------|
| `agents/*.md` | `src/agents/definitions.ts`, `src/agents/index.ts`, `docs/REFERENCE.md` |
| `skills/*/SKILL.md` | `commands/*.md` (미러), `scripts/build-skill-bridge.mjs` |
| `src/hooks/*` | `src/hooks/index.ts`, `src/hooks/bridge.ts`, 관련 skill/command |
| 에이전트 프롬프트 | 계층 변형 (-low, -medium, -high) |
| 도구 정의 | `src/tools/index.ts`, `src/mcp/omc-tools-server.ts`, `docs/REFERENCE.md` |

---

## 특이점 및 혁신

1. **3계층 모델 라우팅**: 단순 작업은 Haiku, 복잡한 작업은 Opus로 자동 라우팅하여 비용 최적화
2. **Skills ↔ Commands 대칭**: skills/와 commands/ 디렉토리가 동일 기능의 미러 — skills는 구현, commands는 슬래시 커맨드
3. **SQLite 작업 클레임**: swarm 모드에서 여러 에이전트가 same task를 중복 처리하지 않도록 SQLite로 클레임
4. **notepad 시스템**: 계획 범위 내 학습, 결정, 이슈를 지속적으로 저장
5. **세션 컨텍스트 주입**: AGENTS.md 하단에 런타임 세션 컨텍스트 자동 주입

---

## 런타임 AGENTS.md 패턴

`AGENTS.md` 파일 하단에 세션 컨텍스트를 동적 주입:

```xml
<!-- OMX:RUNTIME:START -->
<session_context>
**Session:** omx-1771026854926-3tbxcj | 2026-02-13T23:54:14.929Z

**Compaction Protocol:**
Before context compaction, preserve critical state:
1. Write progress checkpoint via state_write MCP tool
2. Save key decisions to notepad via notepad_write_working
3. If context is >80% full, proactively checkpoint state
</session_context>
<!-- OMX:RUNTIME:END -->
```

---

## 총평

oh-my-claudecode는 현재까지 발견된 가장 정교한 AI 코딩 최적화 시스템입니다.
단순히 AI에게 "어떻게 코딩하라"고 지시하는 것을 넘어, AI 에이전트 자체를 오케스트레이션하는 메타 시스템을 구현했습니다.

**배울 점:**
- 에이전트 위임 프로토콜 (지휘자 패턴)
- 3계층 모델 라우팅으로 비용 최적화
- Skills ↔ Commands 대칭 구조
- 런타임 컨텍스트를 AGENTS.md에 동적 주입하는 패턴
