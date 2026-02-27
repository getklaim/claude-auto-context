# Hook Collection + SQL Storage

## Hook의 역할 — 바보 수집기

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

## Hook → Collector → SQLite 경로

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

### collector.mjs 중계 레이어

- Hook은 셸 스크립트 → JSON payload의 따옴표, 특수문자를 sqlite3 CLI로 넘기면 이스케이핑 지옥
- collector.mjs가 parameterized query (`?` 바인딩)로 안전하게 INSERT
- Claude Code가 이미 Node.js 환경이므로 추가 의존성 없음

## 구현 예시

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

## SQLite 스키마

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
    category    TEXT NOT NULL,  -- 'convention' | 'structure' | 'implicit_knowledge'
    description TEXT NOT NULL,
    evidence    TEXT NOT NULL,  -- JSON, 근거가 된 세션들
    action      TEXT,           -- 'auto_rule' | 'suggest_structure' | 'update_claudemd'
    action_detail TEXT,         -- 구체적 조치 내용
    applied     INTEGER DEFAULT 0
);
```

## UserPromptSubmit Hook — 프롬프트 수집

### 프롬프트 저장 흐름

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

### 저장 데이터

| 필드 | 값 | 설명 |
|------|---|------|
| session_id | `$CLAUDE_SESSION_ID` | 현재 세션 식별자 |
| hook_type | `'UserPromptSubmit'` | 이벤트 유형 |
| tool_name | `NULL` | 도구 사용이 아님 |
| payload | RAW JSON 원본 | 프롬프트 내용 포함 |

**기존 collector.mjs를 그대로 사용한다** — collector는 이미 hook_type을 인자로 받아 범용적으로 INSERT하므로 변경 불필요. UserPromptSubmit이라는 새 hook_type 값만 들어올 뿐이다.
