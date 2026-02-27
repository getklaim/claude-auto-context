# Background Worker

## SQL Polling 아키텍처

### Worker의 역할

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

---

## Claude Code 백그라운드 프로세스

### Agent SDK

Worker의 AI 분석에는 `@anthropic-ai/claude-agent-sdk`를 사용한다. SDK의 `query()` 함수에 `agents` 파라미터로 3개의 서브 에이전트를 정의하고, **단일 호출**로 실행한다. Claude가 각 에이전트의 `description`을 보고 적절한 시점에 위임한다.

### 단일 query() + agents 구조

```
Worker polling → 미처리 이벤트 수집
      │
      ├── 1. SQLite에서 raw_events, sessions, insights 전부 읽기
      ├── 2. 벌크 프롬프트 구성 (모든 데이터를 한 번에)
      │
      └── 3. query() 단일 호출 (agents 파라미터로 3개 정의)
              │
              │  Claude가 description 기반으로 위임 판단
              │
              ├─► Rules Agent (서브에이전트)
              │     도구: Read, Write, Edit, Glob
              │     산출물: .claude/rules/{domain}.md
              │
              ├─► Offer Agent (서브에이전트)
              │     도구: Read, Write, Glob
              │     산출물: .claude-auto-context/offers/{NNN}-{slug}.md
              │
              ├─► CLAUDE.md Agent (서브에이전트)
              │     도구: Read, Edit
              │     산출물: CLAUDE.md 최소 수정
              │
              └── 완료 → 처리된 이벤트 status → 'done'
```

Claude는 데이터를 분석한 뒤 필요한 에이전트만 호출한다. 3개 모두 호출할 수도 있고, convention만 발견되면 Rules Agent만 호출할 수도 있다. 이는 의도된 동작이다 — 불필요한 에이전트 실행을 자동으로 스킵한다.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const bulkData = buildBulkPrompt(rawEvents, sessions, insights);

for await (const message of query({
  prompt: `${bulkData}\n\n위 데이터를 분석하여 convention, 구조적 문제, 프로젝트 전역 암묵지를 각각 적절한 에이전트에 위임하라.`,
  options: {
    model: 'sonnet',
    cwd: projectRoot,
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Task'],
    abortController,
    agents: {
      "rules-agent": {
        description: "Convention과 암묵지를 추출하여 .claude/rules/ 에 rules 파일을 생성/갱신한다. 반복 패턴이 발견될 때 사용.",
        prompt: `프로젝트의 세션 데이터를 분석하여 convention과 암묵지를 추출하고,
.claude/rules/ 에 glob 스코핑된 rules 파일을 생성/갱신하라.
기존 rules와 중복되지 않게 확인 후 작성.`,
        tools: ['Read', 'Write', 'Edit', 'Glob'],
      },
      "offer-agent": {
        description: "구조적 문제를 감지하여 .claude-auto-context/offers/ 에 제안 파일을 생성한다. 파일 분할, 디렉토리 재구성 등 구조 변경이 필요할 때 사용.",
        prompt: `프로젝트의 세션 데이터를 분석하여 구조적 문제를 감지하고,
.claude-auto-context/offers/ 에 제안 파일을 생성하라.
근거 세션과 수치를 반드시 포함.`,
        tools: ['Read', 'Write', 'Glob'],
      },
      "claudemd-agent": {
        description: "비자명한 실행 방법과 프로젝트 전역 암묵지를 CLAUDE.md에 갱신한다. 매 세션 필요한 정보가 누락되었을 때 사용.",
        prompt: `프로젝트의 세션 데이터를 분석하여 비자명한 실행 방법과
프로젝트 전역 암묵지를 CLAUDE.md에 최소한만 추가/수정하라.
코드에서 발견 가능한 정보는 추가하지 않는다.`,
        tools: ['Read', 'Edit'],
      },
    },
  }
})) {
  if ("result" in message) {
    // 분석 완료 — 처리된 이벤트 status 갱신
    markEventsAsDone(claimedEventIds);
  }
}
```

### 3 서브 에이전트

| 에이전트 | 역할 | 도구 | 산출물 |
|---------|------|------|--------|
| Rules Agent | convention + 암묵지 추출 | Read, Write, Edit, Glob | `.claude/rules/{domain}.md` |
| Offer Agent | 구조적 문제 감지 → 제안 | Read, Write, Glob | `.claude-auto-context/offers/{NNN}-{slug}.md` |
| CLAUDE.md Agent | 전역 암묵지 → CLAUDE.md 갱신 | Read, Edit | `CLAUDE.md` 최소 수정 |

각 에이전트는 산출물에 필요한 **최소한의 도구만** 허용된다. Write/Edit 외의 위험한 도구(Bash, WebFetch 등)는 허용하지 않아 의도치 않은 부작용을 원천 차단한다.

서브에이전트는 개별 컨텍스트에서 실행되므로 서로의 중간 결과에 영향을 주지 않는다. Claude가 병렬 위임을 판단하면 동시에 실행될 수도 있다.

### 프로세스 관리

`query()` 단일 호출이 하나의 서브프로세스를 생성한다. 서브에이전트들은 이 프로세스 안에서 Task 도구를 통해 실행되므로, 별도 프로세스 관리가 필요 없다.

```
query() 호출 → 서브프로세스 1개 생성
                 │
                 ├─► Task("rules-agent") → 컨텍스트 격리 실행
                 ├─► Task("offer-agent") → 컨텍스트 격리 실행
                 ├─► Task("claudemd-agent") → 컨텍스트 격리 실행
                 │
                 └─► 완료 → 프로세스 종료
```

장시간 실행을 방지하기 위해 `abortController`로 타임아웃을 설정한다. 각 에이전트는 **한 번 실행하고 끝나는** 구조이므로 좀비 프로세스 관리가 불필요하다.
