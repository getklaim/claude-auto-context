# Claude-Mem Hooks 분석

claude-mem 플러그인의 각 hook이 실제로 무엇을 하는지, 소스 코드 기반으로 정리.

---

## 아키텍처 개요

모든 hook은 동일한 패턴을 따른다:

```
Claude Code 이벤트
  → bun-runner.js (Bun 런타임 찾기 + 실행)
    → worker-service.cjs (CLI 명령 해석)
      → HTTP 요청 → Worker 서버 (localhost:37777)
        → SQLite DB (~/.claude-mem/claude-mem.db)
```

Worker 서버는 Express 기반 데몬으로 포트 37777에서 상시 동작하며, 모든 hook은 이 서버에 HTTP 요청을 보내는 **thin client** 역할만 한다.

---

## Hook 1: Setup

**트리거**: `Setup` (플러그인 최초 로드 시)
**스크립트**: `setup.sh`
**하는 일**:

| 단계 | 동작 |
|------|------|
| 1 | **Bun 런타임 존재 확인** — PATH + 일반 설치 경로(`~/.bun/bin/bun`, `/opt/homebrew/bin/bun` 등) 탐색 |
| 2 | **uv (Python 패키지 매니저) 확인** — Chroma 벡터 검색용, 선택적 |
| 3 | **의존성 설치 필요 여부 판단** — `node_modules` 존재 여부, `package.json` 버전 vs `.install-version` 마커 비교, Bun 버전 변경 감지 |
| 4 | 필요 시 `bun install` 실행 후 `.install-version` 마커 기록 |

**핵심**: 순수 환경 세팅. 런타임과 의존성이 준비되었는지만 확인.

---

## Hook 2: SessionStart (2개 훅이 순차 실행)

### 2-1. smart-install.js

**트리거**: `SessionStart` (세션 시작, clear, compact 시)
**하는 일**:

| 단계 | 동작 |
|------|------|
| 1 | 플러그인이 Claude Code 설정에서 비활성화되었는지 확인 → 비활성이면 즉시 종료 |
| 2 | **Bun 없으면 자동 설치** (`curl bun.sh/install`) |
| 3 | **Bun 버전 체크** — 최소 v1.1.14 필요, 미만이면 `bun upgrade` 실행 |
| 4 | **uv 없으면 자동 설치** (`curl astral.sh/uv/install.sh`) |
| 5 | 의존성 변경 시 `bun install` + 모듈 검증 + npm fallback |
| 6 | 업데이트 발생 시 기존 Worker를 `POST /api/admin/shutdown`으로 graceful 종료 |
| 7 | **CLI alias 설치** — `.bashrc`/`.zshrc`에 `alias claude-mem='bun worker-service.cjs'` 추가 |

**핵심**: Setup의 강화판. 없는 도구를 자동 설치하고, 플러그인 업데이트 시 Worker를 재시작.

### 2-2. worker-service.cjs `start` + `hook claude-code context`

**두 개의 커맨드가 순차 실행된다:**

#### `start` — Worker 데몬 기동

Worker 서버(Express, 포트 37777)가 실행 중이 아니면 백그라운드로 시작. 이미 실행 중이면 skip.

#### `hook claude-code context` — 컨텍스트 주입

**소스**: `src/cli/handlers/context.ts`
**하는 일**:

| 단계 | 동작 |
|------|------|
| 1 | Worker 서버가 살아있는지 확인 |
| 2 | 현재 프로젝트 경로에서 프로젝트 이름 추출 (worktree 포함) |
| 3 | `GET /api/context/inject?projects=...` 호출 |
| 4 | Worker가 **최근 활동 타임라인**(observations, sessions, prompts)을 마크다운으로 생성하여 반환 |
| 5 | 이 마크다운을 `hookSpecificOutput.additionalContext`로 반환 → **Claude의 컨텍스트에 주입** |

**핵심**: 세션 시작 시 과거 작업 기억을 Claude에게 주입. "최근에 뭘 했는지" 알려주는 역할. CLAUDE.md에 `<claude-mem-context>` 블록으로 나타나는 것이 이 hook의 결과물.

---

## Hook 3: UserPromptSubmit

**트리거**: 사용자가 프롬프트를 제출할 때마다
**커맨드**: `hook claude-code session-init`
**소스**: `src/cli/handlers/session-init.ts`
**하는 일**:

| 단계 | 동작 |
|------|------|
| 1 | Worker 서버 alive 확인 |
| 2 | 프로젝트 제외 목록(`CLAUDE_MEM_EXCLUDED_PROJECTS`) 확인 |
| 3 | `POST /api/sessions/init` — 세션 생성/업데이트 + 사용자 프롬프트를 DB에 저장 |
| 4 | `<private>` 태그가 포함된 프롬프트는 저장 skip |
| 5 | 이미 컨텍스트가 주입된 세션이면 SDK agent 재초기화 skip |
| 6 | **SDK Agent 시작** — `POST /sessions/{sessionDbId}/init` — Claude Agent SDK를 통해 AI가 관찰(observation)을 압축/분류하는 백그라운드 에이전트 기동 |

**핵심**: 매 프롬프트마다 세션을 추적하고, AI 압축 에이전트를 시작. 사용자의 질문/요청을 DB에 기록.

---

## Hook 4: PostToolUse

**트리거**: Claude가 도구를 사용할 때마다 (Read, Write, Bash, Edit 등)
**커맨드**: `hook claude-code observation`
**소스**: `src/cli/handlers/observation.ts`
**하는 일**:

| 단계 | 동작 |
|------|------|
| 1 | Worker 서버 alive 확인 |
| 2 | `toolName`이 없으면 skip |
| 3 | 프로젝트 제외 목록 확인 |
| 4 | `POST /api/sessions/observations` — tool_name, tool_input, tool_response, cwd를 Worker에 전송 |
| 5 | Worker가 DB에 저장 + SDK Agent가 비동기로 관찰을 압축/요약 |

**핵심**: **claude-mem의 핵심 데이터 수집 지점**. 모든 도구 사용(파일 읽기, 편집, 명령 실행 등)을 관찰(observation)로 기록. 이것이 나중에 "최근 활동" 타임라인의 재료가 된다.

---

## Hook 5: Stop (2개 훅이 순차 실행)

### 5-1. `hook claude-code summarize`

**소스**: `src/cli/handlers/summarize.ts`
**하는 일**:

| 단계 | 동작 |
|------|------|
| 1 | Worker 서버 alive 확인 |
| 2 | `transcriptPath`에서 **마지막 assistant 메시지** 추출 (Claude가 최종적으로 한 말) |
| 3 | `POST /api/sessions/summarize` — contentSessionId + last_assistant_message 전송 |
| 4 | Worker가 AI를 사용해 세션 요약 생성 → DB 저장 |

**핵심**: 세션 종료 시 "이번 세션에서 뭘 했는가"를 AI가 요약해서 저장.

### 5-2. `hook claude-code session-complete`

**소스**: `src/cli/handlers/session-complete.ts`
**하는 일**:

| 단계 | 동작 |
|------|------|
| 1 | Worker 서버 alive 확인 |
| 2 | `POST /api/sessions/complete` — active sessions map에서 세션 제거 |
| 3 | orphan reaper가 남은 subprocess를 정리할 수 있게 함 |

**핵심**: 세션 정리(cleanup). summarize 후 세션을 공식적으로 종료 처리.

---

## 공통 설계 원칙

1. **Graceful Degradation** — Worker가 죽어도 모든 hook은 exit 0으로 종료. Claude Code 세션을 절대 차단하지 않음.
2. **Thin Client** — hook 자체는 로직이 거의 없고, HTTP 요청만 보냄. 모든 무거운 처리는 Worker 서버에서.
3. **bun-runner.js** — 모든 hook의 진입점. Bun이 PATH에 없을 때도 찾아서 실행하는 shim 역할.
4. **Privacy First** — `<private>` 태그로 감싼 내용은 저장하지 않음.

---

## 데이터 흐름 요약

```
세션 시작
  │
  ├─ [Setup]          런타임/의존성 확인
  ├─ [SessionStart]   Worker 기동 + 과거 기억 주입
  │
  ├─ [UserPromptSubmit] 프롬프트 저장 + AI Agent 시작
  │     │
  │     ├─ [PostToolUse] 도구 사용 관찰 기록 ──┐
  │     ├─ [PostToolUse] 도구 사용 관찰 기록    │ 반복
  │     ├─ [PostToolUse] 도구 사용 관찰 기록 ──┘
  │     │
  │     └─ (다음 프롬프트 → UserPromptSubmit 반복)
  │
  └─ [Stop]           세션 요약 생성 + 세션 종료
                            │
                            ▼
                      SQLite DB 저장
                            │
                            ▼
                    다음 세션 시작 시
                    SessionStart에서 주입
```
