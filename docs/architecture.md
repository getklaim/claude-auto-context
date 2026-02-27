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
              │(3 sub-agents)│
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │   Output     │
              │ rules / 제안  │
              └──────────────┘
```

### 상세 문서

| 문서 | 내용 |
|------|------|
| [Hook Collection + SQL Storage](hook-collection.md) | Hook 수집기, collector.mjs, SQLite 스키마, 프롬프트 수집 |
| [Background Worker](background-worker.md) | SQL Polling, Claim-Confirm 큐, Agent SDK, 3 서브 에이전트 |

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

Worker가 구조적 문제를 감지하면 **구조 변경을 직접 하지 않고**, `.claude-auto-context/offers/`에 제안 파일을 생성한다.

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
structure

## 문제
src/utils.ts (245줄)가 10세션 중 8세션에서 읽혔으나,
실제 사용된 함수는 세션당 평균 1.2개.

## 제안
src/utils.ts를 다음으로 분할:
- src/utils/date.ts  (formatDate, parseDate, diffDays)
- src/utils/string.ts (capitalize, slugify, truncate)
- src/utils/index.ts  (re-export)

## 근거 세션
- session_abc123 (2026-02-20): Read 245줄, Edit 8줄 (formatDate)
- session_def456 (2026-02-22): Read 245줄, Edit 12줄 (slugify)
- ...총 8세션
```

### UserPromptSubmit Hook — Offer 알림

UserPromptSubmit hook은 사용자가 프롬프트를 입력할 때마다 호출된다. 프롬프트 수집 역할은 [Hook Collection](hook-collection.md#userpromptsubmit-hook--프롬프트-수집)에서, 여기서는 Offer 알림 역할만 다룬다.

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
1. src/utils.ts 분할
2. routes/ 패턴 통일
💡 /cac-apply {id} 로 적용 · /cac-apply-all 로 전체 적용
─────────────────────────────────────────────────
```

이 알림은 UserPromptSubmit hook이 pending offer가 있을 때만 주입하므로, offer가 없으면 아무 오버헤드도 없다.

#### Skills로 Offer 적용

사용자가 `/cac-apply` 스킬을 실행하면, 대기 중인 offer를 선택하고 Claude가 자동으로 구조 변경을 수행한다.

| Skill | 동작 |
|-------|------|
| `/cac-apply {offer-id}` | 특정 offer 선택 → Claude가 자동 리팩토링 |
| `/cac-apply-all` | 대기 중인 모든 offers 순차 적용 |

#### 적용 흐름

```
사용자: /cac-apply

  Claude: 대기 중인 offers:
    [1] src/utils.ts 분할
    [2] routes/ 패턴 통일

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
│       claude-auto-context.db ◄───────────┼────────────────────┐      │
│                                   │                    │      │
│   User: "인증 버그 고쳐줘"         │                    │      │
│     │                             │                    │      │
│     ├─► Glob ──► PostToolUse ──► RAW ──┐              │      │
│     ├─► Read ──► PostToolUse ──► RAW ──┤              │      │
│     ├─► Edit ──► PostToolUse ──► RAW ──┤              │      │
│     ├─► Bash ──► PostToolUse ──► RAW ──┤              │      │
│     └─► Stop ──► Stop Hook ───► RAW ──┤              │      │
│                                        │              │      │
└────────────────────────────────────────┼──────────────┼──────┘
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
                                  │   Worker     │
                                  │              │
                                  │  ┌─────────┐ │
                                  │  │ Rules   │─┼──► .claude/rules/ 생성
                                  │  │ Agent   │ │
                                  │  ├─────────┤ │
                                  │  │ Offer   │─┼──► offers/ 생성
                                  │  │ Agent   │ │
                                  │  ├─────────┤ │
                                  │  │ClaudeMD │─┼──► CLAUDE.md 갱신
                                  │  │ Agent   │ │
                                  │  └─────────┘ │
                                  │ (3 sub-agents)│
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
