# Auto Context — 플러그인 아키텍처

## 한 줄 정의

> Claude Code가 코딩할 때, 프로젝트 자체가 좋은 컨텍스트 엔지니어링이 되어 있게 만드는 플러그인.

## 핵심 설계 원칙

> 플러그인의 역할은 CLAUDE.md에 더 많은 정보를 채워넣는 것이 아니라,
> 프로젝트 자체를 Claude가 탐색하기 쉬운 구조로 만드는 것 —
> 그래서 CLAUDE.md가 최소한만 필요하게 만드는 것이다.

---

## 시스템 개요

플러그인은 두 개의 독립적 축으로 구성된다.

```
┌─── Input: 컨텍스트 전달 ───┐    ┌─── Output: 관찰 & 학습 ───┐
│                             │    │                            │
│  Rules 파일로                │    │  Hooks로 RAW 데이터 수집    │
│  Claude에게 올바른 컨텍스트   │    │  Worker가 분석 & 개선       │
│  를 효율적으로 전달           │    │                            │
└─────────────────────────────┘    └────────────────────────────┘
```

---

## Input: 컨텍스트 전달 — Rules 파일

### Hook injection을 선택하지 않는 이유

| 방식 | 관련성 판단 주체 | 문제 |
|------|----------------|------|
| UserPromptSubmit Hook | 셸 스크립트 (바보) | 자연어에서 관련성 판단 불가, 깨지기 쉬움, 레이턴시 |
| Rules 파일 | Claude (똑똑함) | 없음 — Claude가 수정할 파일을 결정하면 rules가 자동 로드 |

**Rules가 맞는 이유:**
1. 관련성 판단을 가장 잘하는 건 Claude 자신
2. 컨벤션은 "이 파일을 수정할 때" 필요한 거지 "이 프롬프트를 읽을 때" 필요한 게 아님
3. 대화 중 범위 확장(auth → db)에 자동 대응
4. Claude Code 내장 기능, 추가 비용/레이턴시 없음

### Rules 파일 구조

```
.claude/rules/
  auth.md        → glob: "src/auth/**"
  api.md         → glob: "src/api/**"
  database.md    → glob: "src/db/**"
  global.md      → glob: "**"  (금지 규칙 등)
```

### 암묵지 (Implicit Knowledge)

코드베이스를 아무리 읽어도 발견할 수 없는 프로젝트 지식을 **암묵지**라고 부른다. 코드에 있는 것은 Claude가 Read/Grep으로 찾을 수 있지만, 코드에 **없는 것**은 발견 불가능하다. 암묵지는 CLAUDE.md와 rules/에 반영구적으로 남겨야 하는 유일한 정보다.

| 유형 | 왜 발견 불가능한가 | 예시 |
|------|------------------|------|
| **컨벤션** | 코드에 "왜 이렇게 했는지"는 안 적혀 있음 | "에러 처리는 Result 타입, try-catch 아님" |
| **금지 규칙** | 코드에 "안 쓰는 것"은 존재하지 않음 | "any 타입 금지", "ORM X 사용 금지" |
| **비자명한 실행 방법** | package.json만으로 추측 불가 | "bun test --filter=unit" |
| **비자명한 관계** | import 그래프로 안 보이는 런타임 의존성 | "Service A는 반드시 Service B 초기화 후에 시작" |

Worker의 핵심 역할은 세션 관찰에서 암묵지를 자동 추출하여 rules/와 CLAUDE.md에 명문화하는 것이다.

### CLAUDE.md Static Context 자격 기준

CLAUDE.md에는 아래 4가지 기준을 **모두** 충족하는 암묵지만 들어간다:

| 기준 | 설명 |
|------|------|
| 발견 불가능 | 코드베이스를 아무리 읽어도 알 수 없는 것 (암묵지) |
| 매 세션 필요 | 거의 모든 작업에서 필요한 것 |
| 안정적 | 자주 바뀌지 않는 것 |
| 고신호 | 없으면 Claude가 실수하는 것 |

영역 한정 암묵지(특정 디렉토리에서만 필요)는 CLAUDE.md가 아닌 `.claude/rules/`에 glob 스코핑으로 들어간다.

**자격 없는 정보 (암묵지가 아닌 것):**
- 아키텍처 지도 (`ls`로 발견 가능 — 구조의 복제본은 동기화 실패 시 Context Poisoning)
- API 문서, 타입 정의, 파일별 설명 (코드 자체가 설명해야 함)

---

## Output: 관찰 & 학습

### 데이터 흐름

```
Main Claude Session
│
├─► Glob("**/auth*")
│     └─► PostToolUse Hook
│           └─► RAW {tool:"Glob", pattern:"**/auth*", results:[...]}
│                    │
├─► Read("src/auth/controller.ts")
│     └─► PostToolUse Hook
│           └─► RAW {tool:"Read", path:"...", lines:245}
│                    │
├─► Edit(...)
│     └─► PostToolUse Hook
│           └─► RAW {tool:"Edit", path:"...", diff:"..."}
│                    │
├─► Bash("bun test")
│     └─► PostToolUse Hook
│           └─► RAW {tool:"Bash", cmd:"bun test", exit:0}
│                    │
└─► Stop
      └─► Stop Hook
            └─► RAW {전체 대화 내역 그대로}
                     │
                     │  전부 RAW, 가공 없음
                     ▼
              ┌─────────────┐
              │   SQLite     │
              │  (raw_events)│
              └──────┬───────┘
                     │  Worker가 polling
                     ▼
              ┌──────────────┐
              │  Background  │
              │   Worker     │
              │  (Claude)    │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │   Output     │
              │ rules / 제안  │
              └──────────────┘
```

### Hook의 역할 — 바보 수집기

Hook은 **받아서 던지기만** 한다. 판단, 분석, 요약 없음.

| Hook | 수집하는 RAW 데이터 |
|------|-------------------|
| UserPromptSubmit | 사용자 입력 프롬프트 원문, 세션 ID |
| PostToolUse: Glob | 검색 패턴, 결과 파일 목록, 결과 수 |
| PostToolUse: Grep | 검색어, 매칭 파일 목록, 매칭 수 |
| PostToolUse: Read | 파일 경로, 총 줄 수 |
| PostToolUse: Edit | 파일 경로, diff 내용 |
| PostToolUse: Bash | 실행 명령어, exit code, stdout/stderr |
| Stop | 전체 대화 내역 (가공 없이 그대로) |

### Hook → Collector → SQLite 경로

Hook에서 SQLite까지 3개 레이어를 거친다:

```
Hook (셸 스크립트)          바보. RAW를 pipe할 뿐.
  │
  │  stdin으로 받은 RAW를 그대로 pipe
  │
  ▼
collector.mjs (Node.js)     유일한 중계 지점. JSON 파싱 + INSERT.
  │
  │  1. stdin에서 JSON 읽기
  │  2. session_id, timestamp 부여
  │  3. parameterized query로 INSERT (이스케이핑 안전)
  │
  ▼
SQLite                      raw_events 테이블, processed=0
```

**왜 Hook이 SQLite에 직접 쓰지 않는가:**
- Hook은 셸 스크립트 → JSON payload의 따옴표, 특수문자를 sqlite3 CLI로 넘기면 이스케이핑 지옥
- collector.mjs가 parameterized query (`?` 바인딩)로 안전하게 INSERT
- Claude Code가 이미 Node.js 환경이므로 추가 의존성 없음

**구현 예시:**

```bash
# hooks/post-tool-use.sh — Hook (바보)
#!/bin/bash
echo "$CLAUDE_POST_TOOL_USE" | node .claude-auto-context/collector.mjs PostToolUse
```

```bash
# hooks/stop.sh — Hook (바보)
#!/bin/bash
echo "$CLAUDE_STOP_DATA" | node .claude-auto-context/collector.mjs Stop
```

```javascript
// .claude-auto-context/collector.mjs — 중계자
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const [,, hookType] = process.argv;
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString();
  const payload = JSON.parse(raw);

  const db = new Database('.claude-auto-context/db/claude-auto-context.db');
  db.prepare(`
    INSERT INTO raw_events (session_id, timestamp, hook_type, tool_name, payload)
    VALUES (?, datetime('now'), ?, ?, ?)
  `).run(
    payload.session_id ?? 'unknown',
    hookType,
    payload.tool_name ?? null,
    JSON.stringify(payload)
  );
  db.close();
});
```

### SQLite 스키마

```sql
-- Hook에서 던진 RAW 이벤트
CREATE TABLE raw_events (
    id          INTEGER PRIMARY KEY,
    session_id  TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    hook_type   TEXT NOT NULL,  -- 'PostToolUse' | 'Stop' | 'UserPromptSubmit'
    tool_name   TEXT,           -- 'Glob' | 'Read' | 'Edit' | 'Bash' | NULL(Stop)
    payload     TEXT NOT NULL,  -- JSON, 가공 없는 원본
    status      TEXT DEFAULT 'pending',  -- 'pending' | 'processing' | 'done'
    claimed_at  TEXT,           -- Worker가 claim한 시점 (self-healing 타임아웃 기준)
    retry_count INTEGER DEFAULT 0  -- 최대 3회, 초과 시 'dead' 상태로 전환
);

-- Worker가 분석한 세션 요약
CREATE TABLE sessions (
    id              INTEGER PRIMARY KEY,
    session_id      TEXT UNIQUE NOT NULL,
    timestamp       TEXT NOT NULL,
    summary         TEXT,           -- Worker가 대화 전체를 요약
    task_type       TEXT,           -- Worker가 분류
    files_read      TEXT,           -- JSON array
    files_modified  TEXT,           -- JSON array
    search_attempts INTEGER,
    patterns_found  TEXT,           -- JSON array
    conventions_violated TEXT       -- JSON array
);

-- Worker가 누적 분석에서 발견한 인사이트
CREATE TABLE insights (
    id          INTEGER PRIMARY KEY,
    timestamp   TEXT NOT NULL,
    category    TEXT NOT NULL,  -- 'navigability' | 'readability' | 'predictability' | 'convention' | 'structure'
    description TEXT NOT NULL,
    evidence    TEXT NOT NULL,  -- JSON, 근거가 된 세션들
    action      TEXT,           -- 'auto_rule' | 'suggest_structure' | 'update_claudemd'
    action_detail TEXT,         -- 구체적 조치 내용
    applied     INTEGER DEFAULT 0
);
```

---

## Background Worker

### 아키텍처 결정: Polling Worker vs HTTP Server

Worker 아키텍처로 **SQLite Polling**을 선택했다. 대안인 HTTP Server (claude-mem 방식)와의 비교 근거를 아래에 기록한다.

#### 비교 대상

| | Polling Worker (채택) | HTTP Server (기각) |
|--|---|---|
| **구조** | Hook → collector.mjs → SQLite ← Worker polls | Hook → HTTP POST → Server → SQLite |
| **통신** | 공유 SQLite 파일 | localhost TCP (port 37777 등) |
| **레퍼런스** | 본 프로젝트 설계 원안 | claude-mem 플러그인 |

#### 선택 근거

**1. Hook 오버헤드 최소화 (가장 중요)**

Hook은 Claude Code 세션을 블로킹한다. Polling 방식은 Hook이 SQLite INSERT 후 즉시 exit하므로 ~60-120ms로 끝난다. HTTP 방식은 서버 가용성 확인(헬스체크)이 추가되어 서버 미기동 시 수 초가 걸릴 수 있다.

**2. 설계상 이벤트 유실 제로**

Polling에서는 이벤트가 먼저 SQLite에 영속되므로, Worker가 죽어도 `processed=0`으로 남아있다. 재시작하면 이어서 처리한다. HTTP 방식은 서버 다운 시 이벤트가 유실되며, claude-mem은 이 문제를 해결하려고 `pending_messages` 테이블(내구성 큐)을 만들었다 — 결국 Polling 패턴의 재발명이다.

**3. 복잡도 차이 (10배 이상)**

| | Polling | HTTP Server |
|--|---|---|
| 신규 코드 | ~150줄 (worker.mjs) | ~2,000줄+ (인프라 코드) |
| 프로세스 관리 | `bun worker.mjs &` + SIGTERM | PID 파일, 헬스체크, 오펀 리퍼, 그레이스풀 셧다운 |
| 포트 충돌 | 불가능 (네트워크 안 씀) | 실제 문제 |
| 디버깅 | `SELECT * FROM raw_events WHERE processed=0` | HTTP 상태 + DB 상태 + 프로세스 상태 동시 확인 |

claude-mem은 HTTP 서버를 선택한 결과 ProcessManager(809줄), GracefulShutdown(131줄), HealthMonitor(175줄), 17+ 마이그레이션, Windows 전용 우회 등 데몬 관리 코드가 비즈니스 로직을 압도하게 되었다.

**4. 배치 분석에 자연스러운 핏**

Worker의 목적은 "도구 사용 패턴 분석 → 컨벤션 추출"이다. 이는 여러 이벤트를 세션별로 묶어서 보는 배치 처리에 적합하다. Polling은 깨어날 때마다 미처리 건을 배치로 가져오므로 자연스럽다. HTTP 방식은 이벤트 단위 처리가 기본이라 배치 분석을 위해 내부 버퍼링을 별도 구현해야 한다.

**5. HTTP Server가 이기는 유일한 시나리오**

Hook이 Worker의 동기 응답을 현재 세션에 즉시 주입해야 할 때. 하지만 본 프로젝트는 rules 파일과 offers를 비동기로 생성하여 다음 세션에 반영하는 구조이므로 해당하지 않는다.

#### AI 백엔드: Claude Agent SDK 서브프로세스

Worker의 AI 분석에는 `@anthropic-ai/claude-code` (Claude Agent SDK)를 사용한다. SDK의 `query()` 함수가 **Claude Code를 서브프로세스로 실행**하고, Worker는 관찰자(Observer) 역할로 사용자의 도구 사용을 분석한다.

**왜 Agent SDK인가:**

| | Anthropic API SDK (`@anthropic-ai/sdk`) | Agent SDK (`@anthropic-ai/claude-code`) |
|--|---|---|
| 도구 실행 | 직접 구현 | 내장 루프 |
| 비대화형 실행 | 불가 | `bypassPermissions` |
| 세션 연속성 | 불가 | `resume` 파라미터 |
| 프롬프트 입력 | string | string \| **AsyncIterableIterator** |

**전체 구조:**

```
SDKAgent.startSession()
      │
      ├── 1. Claude 실행 파일 찾기 (findClaudeExecutable)
      ├── 2. 모델 ID 로드 (claude-sonnet-4-5)
      ├── 3. 동시 실행 슬롯 대기 (기본 2개)
      ├── 4. query() 호출 → Claude 서브프로세스 생성
      │         ├── messageGenerator (AsyncIterableIterator)가 메시지를 공급
      │         └── Claude가 XML 응답 반환
      ├── 5. 응답 파싱 + DB 저장 + Chroma 동기화
      └── 6. 서브프로세스 정리
```

##### 1. query() — Agent SDK의 핵심 함수

`@anthropic-ai/claude-code`에서 import한 `query()` 함수가 Claude Code를 서브프로세스로 실행한다:

```typescript
import { query } from "@anthropic-ai/claude-code";

const queryResult = query({
  prompt: messageGenerator,        // AsyncIterator — 메시지를 하나씩 공급
  options: {
    model: modelId,                // 'claude-sonnet-4-5' (설정에서 변경 가능)
    cwd: OBSERVER_SESSIONS_DIR,    // 관찰자 전용 디렉토리 (사용자 세션과 격리)
    resume: session.memorySessionId, // 세션 재개 (2번째 프롬프트부터)
    disallowedTools: [모든 도구],    // 관찰자 = 도구 사용 불가
    abortController,               // 중단 제어
    pathToClaudeCodeExecutable,    // claude 바이너리 경로
    spawnClaudeCodeProcess,        // 커스텀 spawn (PID 추적용)
    env: isolatedEnv               // 격리된 환경변수
  }
});
```

이벤트 드리븐 방식으로, 폴링이 아니라 `for await` 루프로 SDK 응답을 순차 처리한다:

```typescript
for await (const message of queryResult) {
  // message.type === 'assistant' → AI 응답 처리
  // message.type === 'result'    → 완료 신호
}
```

##### 2. 메시지 제너레이터 — AI에게 무엇을 보내는가

`createMessageGenerator()`는 AsyncIterableIterator로, 도구 사용이 발생할 때마다 AI에게 메시지를 공급한다:

| 프롬프트 | 함수 | 내용 |
|---------|------|------|
| #1 (초기화) | `buildInitPrompt()` | 시스템 정체성 + 관찰자 역할 + XML 출력 형식 정의 |
| #2+ (계속) | `buildContinuationPrompt()` | 세션 컨텍스트 유지하면서 계속 관찰 |
| 도구 관찰 | `buildObservationPrompt()` | `<what_happened>`, `<parameters>`, `<outcome>` |
| 세션 종료 | `buildSummaryPrompt()` | request, investigated, learned, completed, next_steps 추출 |

```typescript
// createMessageGenerator() — 비동기 이터레이터
async function* createMessageGenerator(session: Session) {
  // 프롬프트 #1: 초기화
  yield buildInitPrompt();

  // 도구 관찰 메시지: 큐에 쌓인 이벤트를 하나씩 yield
  while (session.isActive) {
    const event = await session.queue.dequeue();
    if (event) {
      yield buildObservationPrompt(event);
      // 예: <what_happened>Read</what_happened>
      //     <parameters>{파일경로}</parameters>
      //     <outcome>{파일 내용 요약}</outcome>
    }
  }

  // 세션 종료 시 요약 요청
  yield buildSummaryPrompt();
}
```

##### 3. 관찰자 전용 제한 — 모든 도구 비활성화

```typescript
const disallowedTools = [
  'Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob',
  'WebFetch', 'WebSearch', 'Task', 'NotebookEdit',
  'AskUserQuestion', 'TodoWrite'
];
```

Worker의 Claude 서브프로세스는 **순수 관찰자**다. 사용자의 작업을 관찰하고 구조화된 분석을 생성하는 것이 유일한 역할이므로, 모든 도구가 비활성화되어 있다. 무한 루프나 의도치 않은 파일 변경을 원천 차단한다.

##### 4. 세션 재개 로직 (Resume)

```typescript
const shouldResume = hasRealMemorySessionId       // memorySessionId 존재
                   && session.lastPromptNumber > 1  // 첫 프롬프트가 아님
                   && !session.forceInit;           // 강제 초기화 아님
```

| 상황 | 동작 |
|------|------|
| 프롬프트 #1 | 항상 새 SDK 세션 시작 (`memorySessionId` 캡처) |
| 프롬프트 #2+ | 기존 세션 재개 (`resume: memorySessionId`) |
| Worker 재시작 | `forceInit=true`로 새 세션 강제 시작 (이전 SDK 컨텍스트 소실) |

SDK가 `message.session_id`를 반환하면 즉시 DB에 기록한다.

##### 5. 응답 처리 파이프라인 (ResponseProcessor)

AI가 XML 응답을 반환하면 `processAgentResponse()`가 통합 처리한다:

```
AI 응답 텍스트
  │
  ├── parseObservations() → <observation> XML 블록 추출
  ├── parseSummary()      → <summary> XML 블록 추출
  │
  ├── [DB] 원자적 트랜잭션으로 observations + summary 저장
  ├── [Queue] CLAIM-CONFIRM 패턴으로 처리된 메시지 확인
  │
  ├── [Chroma] 벡터 임베딩 동기화 (fire-and-forget)
  ├── [SSE] 실시간 브로드캐스트 (선택적)
  └── [Rules/CLAUDE.md] 컨텍스트 파일 업데이트
```

**Worker 응답 포맷 — XML 스키마:**

```xml
<observation>
  <what_happened>Edit</what_happened>
  <parameters>{"file": "src/auth/ctrl.ts"}</parameters>
  <outcome>try-catch를 Result 타입으로 변환</outcome>
  <pattern confidence="0.85">Result type error handling</pattern>
</observation>

<summary>
  <request>auth 버그 수정 — JWT 만료 처리</request>
  <investigated>src/auth/ctrl.ts, src/auth/types.ts</investigated>
  <learned>auth/ 디렉토리에서 try-catch 대신 Result 타입 사용 컨벤션</learned>
  <completed>JWT 만료 시 자동 갱신 로직 추가</completed>
  <next_steps>refresh token rotation 구현 필요</next_steps>
</summary>
```

##### 6. 프로세스 관리 (ProcessRegistry)

좀비 프로세스 방지를 위한 3중 안전장치:

| 계층 | 메커니즘 | 설명 |
|------|---------|------|
| PID 추적 | `createPidCapturingSpawn()` | 커스텀 spawn으로 서브프로세스 PID 캡처 |
| 종료 보장 | `ensureProcessExit()` | 5초 대기 후 SIGKILL 에스컬레이션 |
| 고아 리퍼 | `startOrphanReaper()` | 5분마다 유휴/고아 프로세스 정리 |

동시 실행은 기본 2개로 제한되며 (`MAX_CONCURRENT_AGENTS`), 풀이 가득 차면 프로미스 기반으로 슬롯이 빌 때까지 대기한다.

##### 7. 토큰 추적

```typescript
session.cumulativeInputTokens += usage.input_tokens;
session.cumulativeOutputTokens += usage.output_tokens;
if (usage.cache_creation_input_tokens) {
  session.cumulativeInputTokens += usage.cache_creation_input_tokens;
}
```

각 응답마다 누적 토큰을 추적하고, `discoveryTokens` (이번 응답의 토큰 비용)를 계산해 메모리 압축 효율(ROI)을 측정한다.

**단일 세션 유지의 이점:**
- 세션이 살아있는 동안 이전 분석 컨텍스트가 유지됨 (누적 패턴 인식)
- 이벤트마다 새 세션을 만드는 것보다 API 비용 절감
- `resume` 파라미터로 Worker 재시작 시 이전 세션 이어받기 가능

---

### 역할

Worker는 Claude Code의 별도 프로세스로, SQLite를 polling하며 RAW 데이터를 분석한다.

### Polling 전략

```
Worker (AsyncGenerator polling loop)
│
├─► Self-healing: stale processing (>60s) → pending 복귀
├─► Claim: pending 이벤트 1건을 processing으로 원자적 전환
│     ├─ 있으면 → yield (Claude에게 분석 프롬프트 전달)
│     │           └─► Claude 응답 → processResult → Confirm (done)
│     └─ 없으면 → sleep 30초
├─► Idle 5분 초과 → Generator 종료 → Worker exit
└─► 반복
```

Worker는 Main Session과 완전히 독립적이다. Main Session이 끝나도 Worker는 계속 돌면서 미처리 이벤트를 소화한다.

### Claim-Confirm 큐 패턴

단순한 `processed=0/1` 플래그 대신 Claim-Confirm 패턴을 사용한다. claude-mem의 큐 설계에서 가져온 패턴이되, HTTP 서버 없이 SQLite polling에 맞게 적용한다.

```
상태 전이:

pending ──claim──► processing ──confirm──► done
   ▲                   │
   └───self-heal───────┘  (60초 초과 시 자동 복구)
                        │
                        └──3회 초과──► dead (영구 실패)
```

**Claim (원자적 상태 전환):**

```sql
-- Worker가 미처리 이벤트를 가져갈 때
UPDATE raw_events
SET status = 'processing', claimed_at = datetime('now')
WHERE id = (
  SELECT id FROM raw_events
  WHERE status = 'pending'
  ORDER BY id ASC
  LIMIT 1
)
RETURNING *;
```

**Confirm (성공 후):**

```sql
UPDATE raw_events SET status = 'done' WHERE id = ?;
```

**Self-healing (크래시 복구):**

```sql
-- claim 전에 매번 실행: 60초 이상 processing인 이벤트를 자동 복구
UPDATE raw_events
SET status = 'pending',
    claimed_at = NULL,
    retry_count = retry_count + 1
WHERE status = 'processing'
  AND claimed_at < datetime('now', '-60 seconds');

-- 3회 초과 실패는 dead로 전환 (무한 루프 방지)
UPDATE raw_events
SET status = 'dead'
WHERE retry_count > 3 AND status = 'pending';
```

별도 타이머 없이 Worker가 다음 메시지를 claim할 때마다 stale 메시지를 자동 복구한다. Worker가 크래시하더라도 다음 기동 시 미처리 이벤트를 이어서 소화한다.

### Worker 생명주기

```
Stop Hook 실행
│
├─► collector.mjs: Stop 이벤트 SQLite INSERT (기존)
│
└─► worker-launcher.sh: Worker 기동 시도
      │
      ├─► Lock 파일 확인 (.claude-auto-context/worker.lock)
      │     ├─ 없음 → Worker 시작, Lock 생성
      │     └─ 있음 → PID 살아있는지 확인
      │              ├─ 살아있음 → 아무것도 안 함 (이미 돌고 있음)
      │              └─ 죽어있음 → Lock 제거 후 Worker 시작
      │
      └─► Worker (bun worker.mjs &)
            ├─ 백그라운드 실행 (nohup)
            ├─ Lock 파일에 PID 기록
            ├─ polling loop 진입
            └─ 미처리 이벤트 0건 + idle 5분 → 자동 종료 (Lock 제거)
```

**시작 조건**: Stop hook이 매 세션 종료 시 Worker 기동을 시도. 이미 돌고 있으면 무시.
**종료 조건**: 미처리 이벤트 0건 상태가 5분 지속되면 자동 종료. 다음 세션 종료 시 다시 기동.
**다중 세션**: Lock 파일로 단일 인스턴스 보장. 여러 세션이 동시에 Stop해도 Worker는 하나만 뜬다.

### 처리 단계

```
Worker 실행
│
├─► 1. Tool Events 분석 (PostToolUse RAW)
│
│   RAW Glob events
│     → "auth 관련 검색이 평균 4.2번 만에 목표 도달"
│     → Navigability 점수 산출
│
│   RAW Read events
│     → "utils.ts 245줄 읽었는데 Edit은 10줄"
│     → Readability 점수 산출 (신호 비율 = 10/245)
│
│   RAW Edit events
│     → "try-catch → Result 변환 패턴 3회 반복"
│     → Convention 후보 추출
│
│   RAW Bash events
│     → "bun test 실패 후 bun test --filter 성공"
│     → 비자명한 실행 방법 추출
│
├─► 2. 대화 요약 (Stop RAW)
│
│   RAW 전체 대화 → Worker가 요약:
│     {
│       task: "auth 버그 수정",
│       files_read: ["src/auth/ctrl.ts", "src/auth/types.ts"],
│       files_modified: ["src/auth/ctrl.ts"],
│       search_attempts: 4,
│       patterns_found: ["Result type error handling"],
│       conventions_violated: ["used try-catch in auth/"]
│     }
│     → sessions 테이블에 저장
│
└─► 3. 누적 분석 (N세션 축적 후)

    sessions DB 전체 분석:
      - "utils.ts가 8/10 세션에서 읽힘 → 분할 권장"
      - "try-catch→Result 변환 5회 반복 → convention 추출"
      - "bun test --filter 매번 사용 → CLAUDE.md 추가"
      → insights 테이블에 저장
```

### Worker의 분석 차원 — 5가지 측정

| 차원 | 측정 방법 | 데이터 소스 |
|------|----------|-----------|
| **Navigability** | 목표 파일까지의 평균 검색 횟수 | Glob, Grep events |
| **Readability** | Read 줄 수 대비 Edit 줄 수 비율 | Read, Edit events |
| **Predictability** | 같은 패턴 파일에 대한 추가 확인 읽기 수 | Read events 패턴 |
| **Self-documentation** | 반복되는 탐색 패턴 존재 여부 | 세션 간 Glob/Grep 패턴 비교 |
| **Isolation** | 하나의 태스크에서 읽는 디렉토리 수 | Read events의 경로 분산 |

---

## Output: Worker의 산출물

### 자동 생성 (사용자 승인 불필요)

```
.claude/rules/{domain}.md
```

Worker가 반복 패턴에서 convention을 추출하여 rules 파일을 자동 생성/갱신한다.

예: 5세션 연속 try-catch → Result 변환이 관찰되면:
```markdown
<!-- .claude/rules/error-handling.md -->
<!-- glob: "src/**/*.ts" -->

에러 처리는 try-catch가 아닌 Result 타입을 사용한다.
```

### CLAUDE.md 갱신 (자동 또는 제안)

Worker가 발견한 비자명한 실행 방법을 CLAUDE.md에 추가한다.

예: `bun test --filter=unit`이 매 세션 실패 후 재시도로 발견되면:
```
CLAUDE.md에 추가: "테스트 실행: bun test --filter=unit"
```

### 구조 변경 제안 — Offers 시스템

Worker가 Navigability/Readability 문제를 감지하면 **구조 변경을 직접 하지 않고**, `.claude-auto-context/offers/`에 제안 파일을 생성한다.

#### Offers 디렉토리 구조

```
.claude-auto-context/
  offers/
    001-split-utils.md          ← 대기 중
    002-unify-route-patterns.md ← 대기 중
    003-add-build-cmd.md        ← 적용됨 (applied)
  db/
    claude-auto-context.db             ← SQLite
```

#### Offer 파일 형식

```markdown
<!-- .claude-auto-context/offers/001-split-utils.md -->

# Offer: src/utils.ts 분할

## 상태
pending

## 카테고리
readability

## 문제
src/utils.ts (245줄)가 10세션 중 8세션에서 읽혔으나,
실제 사용된 함수는 세션당 평균 1.2개.
Read 대비 신호 비율: 4%.

## 제안
src/utils.ts를 다음으로 분할:
- src/utils/date.ts  (formatDate, parseDate, diffDays)
- src/utils/string.ts (capitalize, slugify, truncate)
- src/utils/index.ts  (re-export)

## 근거 세션
- session_abc123 (2026-02-20): Read 245줄, Edit 8줄 (formatDate)
- session_def456 (2026-02-22): Read 245줄, Edit 12줄 (slugify)
- ...총 8세션

## 점수 영향 (예상)
Readability: 4.1 → 4.6 (+0.5)
```

### UserPromptSubmit Hook — 사용자 프롬프트 수집

UserPromptSubmit hook은 사용자가 프롬프트를 입력할 때마다 호출된다. 두 가지 역할을 수행한다:

1. **프롬프트 DB 저장**: 사용자 입력 프롬프트 원문을 SQLite `raw_events` 테이블에 저장
2. **Offer 알림 주입**: pending offer가 있으면 알림을 응답에 주입 (기존 설계)

#### 프롬프트 저장 흐름

```
사용자 프롬프트 입력
  │
  ▼
UserPromptSubmit Hook (scripts/on-user-prompt-submit.sh)
  │
  ├─► stdin으로 받은 RAW JSON → collector.mjs UserPromptSubmit
  │     └─► SQLite raw_events INSERT
  │           ├─ hook_type: 'UserPromptSubmit'
  │           ├─ tool_name: NULL
  │           ├─ payload: { session_id, prompt, ... } (원본 그대로)
  │           └─ status: 'pending'
  │
  └─► pending offers 확인 → 알림 주입 (별도 로직)
```

**왜 프롬프트를 저장하는가:**
- Worker가 세션 분석 시 "사용자가 무엇을 요청했는가"를 알아야 패턴 추출이 정확해짐
- Stop hook의 전체 대화 내역에도 프롬프트가 포함되지만, 개별 프롬프트를 실시간으로 저장하면 Worker가 세션 진행 중에도 부분 분석 가능
- 프롬프트 빈도/패턴 분석으로 반복 요청 자동 탐지 (예: "테스트 돌려줘"가 매 세션 첫 프롬프트 → CLAUDE.md에 자동 명령 추가 제안)

**저장되는 데이터:**

| 필드 | 값 | 설명 |
|------|---|------|
| session_id | `$CLAUDE_SESSION_ID` | 현재 세션 식별자 |
| hook_type | `'UserPromptSubmit'` | 이벤트 유형 |
| tool_name | `NULL` | 도구 사용이 아님 |
| payload | RAW JSON 원본 | 프롬프트 내용 포함 |

**기존 collector.mjs를 그대로 사용한다** — collector는 이미 hook_type을 인자로 받아 범용적으로 INSERT하므로 변경 불필요. UserPromptSubmit이라는 새 hook_type 값만 들어올 뿐이다.

#### Offer 알림

Worker가 새 offer를 생성하면, 다음 세션에서 Claude가 사용자에게 알려야 한다. UserPromptSubmit hook이 pending offer 유무를 확인하고, 있으면 알림을 주입한다.

**알림 주입 흐름:**

```
사용자 프롬프트 입력
  │
  ▼
UserPromptSubmit Hook
  │
  ├─► .claude-auto-context/offers/ 에서 pending 파일 확인
  ├─► 있으면 → 알림 텍스트를 응답에 주입하도록 context 추가
  └─► 없으면 → 패스
```

**알림 포맷 (Claude 응답 끝에 포함):**

```
─────────────────────────────────────────────────
🔔 Auto Context
─────────────────────────────────────────────────
src/utils.ts의 신호 비율이 4%입니다 (10세션 중 8세션에서 Read, 평균 Edit 4%).
→ 파일 분할을 제안하는 Offer를 작성했습니다.
💡 /cac-apply 를 사용하세요
─────────────────────────────────────────────────
```

**복수 offer 시:**

```
─────────────────────────────────────────────────
🔔 Auto Context — 2건의 Offer 대기 중
─────────────────────────────────────────────────
1. src/utils.ts 분할 (Readability +0.5)
2. routes/ 패턴 통일 (Predictability +0.8)
💡 /cac-apply 로 적용 · /cac-status 로 상세 확인
─────────────────────────────────────────────────
```

이 알림은 UserPromptSubmit hook이 pending offer가 있을 때만 주입하므로, offer가 없으면 아무 오버헤드도 없다.

#### Skills로 Offer 적용

사용자가 `/cac-apply` 스킬을 실행하면, 대기 중인 offer를 선택하고 Claude가 자동으로 구조 변경을 수행한다.

| Skill | 동작 |
|-------|------|
| `/cac-status` | 현재 5차원 점수 + 대기 중인 offers 목록 표시 |
| `/cac-apply` | 대기 중인 offer 선택 → Claude가 자동 리팩토링 |
| `/cac-apply-all` | 대기 중인 모든 offers 순차 적용 |
| `/cac-dismiss` | offer 기각 (이유 기록 → Worker 학습) |
| `/cac-report` | N세션 누적 분석 리포트 생성 |

#### 적용 흐름

```
사용자: /cac-apply

  Claude: 대기 중인 offers:
    [1] src/utils.ts 분할 (Readability +0.5)
    [2] routes/ 패턴 통일 (Predictability +0.8)

  사용자: 1번

  Claude:
    ├─► Read src/utils.ts
    ├─► Write src/utils/date.ts
    ├─► Write src/utils/string.ts
    ├─► Write src/utils/index.ts
    ├─► Grep import → 모든 import 경로 수정
    ├─► Bash bun test → 테스트 통과 확인
    └─► offer 상태: pending → applied
```

---

## 전체 아키텍처 다이어그램

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Main Claude Session                           │
│                                                                      │
│   .claude/rules/ ◄── 자동 로드 ──┐                                   │
│     auth.md (src/auth/**)         │                                   │
│     api.md (src/api/**)           │                                   │
│     error-handling.md (src/**) ◄──┼── Worker가 생성/갱신              │
│                                   │                                   │
│   CLAUDE.md ◄─────────────────────┼── Worker가 갱신 (최소한만)        │
│     - 금지 규칙                    │                                   │
│     - 비자명한 실행 방법            │                                   │
│                                   │                                   │
│   ┌──────────────────────┐        │                                   │
│   │ /cac-apply 스킬 실행  │        │                                   │
│   │   ├─ offer 파일 읽기  │        │                                   │
│   │   ├─ 자동 리팩토링    │        │                                   │
│   │   └─ offer → applied │        │                                   │
│   └──────────┬───────────┘        │                                   │
│              │                    │                                   │
│              ▼                    │                                   │
│   .claude-auto-context/           │                                   │
│     offers/ ◄─────────────────────┼── Worker가 생성                   │
│       001-split-utils.md          │                                   │
│       002-unify-routes.md         │                                   │
│     db/                           │                                   │
│       claude-auto-context.db ◄───────────┼────────────────────┐             │
│                                   │                    │             │
│   User: "인증 버그 고쳐줘"         │                    │             │
│     │                             │                    │             │
│     ├─► Glob ──► PostToolUse ──► RAW ──┐              │             │
│     ├─► Read ──► PostToolUse ──► RAW ──┤              │             │
│     ├─► Edit ──► PostToolUse ──► RAW ──┤              │             │
│     ├─► Bash ──► PostToolUse ──► RAW ──┤              │             │
│     └─► Stop ──► Stop Hook ───► RAW ──┤              │             │
│                                        │              │             │
└────────────────────────────────────────┼──────────────┼─────────────┘
                                         │              │
                            RAW (가공 없음)              │
                                         │              │
                                         ▼              │
                                  ┌─────────────┐       │
                                  │   SQLite     │───────┘
                                  │ raw_events   │  (같은 DB)
                                  │ sessions     │
                                  │ insights     │
                                  └──────┬───────┘
                                         │
                                    polling
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  Background  │
                                  │   Worker     │──► .claude/rules/ 생성
                                  │  (Claude)    │──► CLAUDE.md 갱신
                                  │   polling    │──► offers/ 생성
                                  └──────────────┘
```

### 파일 시스템 레이아웃

```
project/
├── .claude/
│   └── rules/                   ← Worker가 자동 생성/갱신
│       ├── auth.md
│       ├── api.md
│       └── error-handling.md
├── .claude-auto-context/
│   ├── offers/                  ← Worker가 구조 제안 생성
│   │   ├── 001-split-utils.md       (pending)
│   │   └── 002-unify-routes.md      (pending)
│   └── db/
│       └── claude-auto-context.db      ← SQLite (raw_events, sessions, insights)
├── CLAUDE.md                    ← Worker가 최소한만 갱신
└── src/
    └── ...
```

---

## 설계 근거

이 아키텍처의 모든 결정은 context engineering 원리에서 도출된다:

| 결정 | 근거 원리 |
|------|----------|
| Rules 파일 (Hook injection 아님) | Claude가 관련성 판단 = Progressive Disclosure |
| CLAUDE.md 최소화 | Informativity over Exhaustiveness |
| Hook은 RAW만 수집 | Hook에서 분석하면 레이턴시 + 단일 실패점 |
| Worker가 모든 분석 | Context Isolation — 분석은 별도 컨텍스트에서 |
| Worker는 polling (HTTP Server 기각) | Main Session과 완전 독립 — 이벤트 유실 제로, 포트 충돌 없음, 인프라 코드 10배 절감. 상세 비교는 "아키텍처 결정" 섹션 참고 |
| 구조 변경은 offers로 | 자동 적용 아님 — 사용자가 /cac-apply로 명시적 승인 후 실행 |
| /cac-* 스킬로 적용 | Claude가 offer 읽고 자동 리팩토링 — 사람이 수동으로 안 해도 됨 |
| 자동 convention 추출 | 코드에서 발견 불가능한 것만 rules로 명문화 |
| 반창고가 아닌 치료 | 문서 추가가 아니라 구조 변경 — Navigability 근본 해결 |
