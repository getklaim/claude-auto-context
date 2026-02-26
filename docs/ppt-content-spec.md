# Auto Context — PPT 콘텐츠 설계서

디자인 시스템: Mission Control for Context Engineering (별도 정의)
총 11장. 컨텍스트 윈도우 개념 → 문제 → 인사이트 → 솔루션 아키텍처 → UX 순.

---

## Slide 1 — Title Hero (M1)

**목적:** 프로젝트의 정체성과 한 줄 가치를 각인

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Title | 160,300,1600,140 | **Auto Context** |
| Subtitle | 160,460,1600,70 | Claude Code가 코딩할 때, 프로젝트가 스스로 좋은 컨텍스트를 만들게 하는 플러그인 |
| Footer tag | 160,980,400,40 | Claude Code Plugin · 2026 |

**배경:** 다크 그라디언트(#0A0F1C → #121A2B) + 미세 그리드 12컬럼 라인(#26324A 10% opacity)

**연출:** Title Fade 0.35s → Subtitle Wipe Up 0.25s (0.12s delay)

---

## Slide 2 — Pain: 컨텍스트 윈도우의 현실 (M2 Problem Cards)

**목적:** 청중이 "컨텍스트 윈도우가 뭔데?" 부터 "왜 문제인데?" 까지 도달

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Header | 96,72,1728,100 | **Context Window — AI가 한 번에 볼 수 있는 전부** |
| Quote | 96,190,1728,90 | "n개 토큰은 n²개의 관계를 계산해야 한다. 토큰이 2배면 연산은 4배. 주의력 자체가 희석된다." |
| Card 1 | 96,330,544,280 | |
| Card 2 | 688,330,544,280 | |
| Card 3 | 1280,330,544,280 | |
| Bottom key message | 96,670,1728,120 | |

**Card 1 — state/decay (#F43F5E)**
```
제목: Tool Output이 83.9%
본문: 에이전트 작업 중 도구 출력이
컨텍스트의 83.9%를 차지.
대부분은 이미 쓸모를 다한 잡음.
아이콘: 원형 차트 (83.9% 채움)
```

**Card 2 — state/decay (#F43F5E)**
```
제목: 무관 문서 1개 = 성능 급락
본문: 관련 없는 문서 하나만 넣어도
step function으로 성능 하락.
모델은 어떤 것도 "건너뛸" 수 없다.
아이콘: 계단식 하락 그래프
```

**Card 3 — state/decay (#F43F5E)**
```
제목: 32K+ 주장 중 50%만 실제 유지
본문: RULER 벤치마크 — 장문 context를
주장하는 모델 중 절반만
실제 해당 길이에서 성능 유지.
아이콘: 경고 삼각형
```

**Bottom key message:**
```
Context Window가 크다고 좋은 게 아니다.
올바른 정보만 들어 있을 때 좋은 것이다.
```

---

## Slide 3 — Benchmark: 모델별 열화 지점 (M3 Split Compare)

**목적:** "더 넣으면 더 좋다"는 직관을 데이터로 깨뜨림

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Header | 96,72,1728,90 | **더 넣으면 더 나빠진다 — 모델별 열화 지점** |
| Left timeline | 96,210,860,660 | 열화 타임라인 (아래 참조) |
| Right evidence cards | 1000,210,824,660 | 근거 카드 3장 (아래 참조) |
| Bottom takeaway | 96,900,1728,100 | Window가 200K라도 200K를 채우면 안 된다. 열화 시작점 이전이 실질적 유효 범위다. |

**Left — 열화 타임라인 (세로 바 차트)**
```
Claude Opus 4.5    ████████████░░░░  열화시작 ~100K  심각 ~180K
GPT-5.2            ██████░░░░░░░░░░  열화시작 ~64K   심각 ~200K
Gemini 3 Pro       ████████████████████████░░░░  열화시작 ~500K  심각 ~800K
```
색상: 안전 구간 state/convention(#22C55E), 열화 구간 state/decay(#F43F5E)

**Right — 근거 카드 3장 (세로 스택)**

카드 R1 (border state/observe):
```
제목: Attention Budget
본문: n² 연산. 토큰이 늘수록 각 토큰에 배분되는
주의력이 희석된다. 비용이 아니라 품질의 문제.
```

카드 R2 (border state/decay):
```
제목: Lost-in-Middle
본문: U자형 어텐션 곡선.
중간 정보의 recall이 10-40% 하락.
시작과 끝만 잘 기억한다.
```

카드 R3 (border state/approval):
```
제목: 압축의 교훈
본문: 가장 많이 줄인 Opaque(99.3%)가
가장 낮은 품질(3.35).
올바른 것을 유지하는 게 중요하다.
```

---

## Slide 4 — Insight: 문서가 아니라 구조를 고쳐야 한다 (M4 Diagram Focus)

**목적:** "CLAUDE.md에 다 적으면 되지 않나?" → "아니다" 전환점

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Header | 96,72,1728,90 | **반창고가 아니라 상처를 치료해야 한다** |
| Left loop box | 120,250,700,500 | 나쁜 순환 (아래) |
| Arrow center | 860,430,200,140 | VS |
| Right loop box | 1100,250,700,500 | 좋은 순환 (아래) |
| One-line thesis | 96,820,1728,120 | (아래) |

**Left loop — state/decay (#F43F5E) border**
```
제목: 나쁜 구조 + 문서 보상

    나쁜 파일 구조
         │
    Claude가 못 찾음
         │
    CLAUDE.md에 지도 추가
         │
    리팩토링 후 지도 미갱신
         │
    Context Poisoning
         │
    ──→ (다시 처음으로)
```

**Right loop — state/convention (#22C55E) border**
```
제목: 좋은 구조 + 최소 문서

    자명한 파일 구조
         │
    Claude가 ls로 발견
         │
    CLAUDE.md에는 암묵지만
         │
    구조 = 문서 (동기화 불필요)
         │
    Poisoning 없음
         │
    ──→ (안정 유지)
```

**One-line thesis:**
```
플러그인의 역할은 CLAUDE.md에 더 많은 정보를 채워넣는 것이 아니라,
프로젝트 자체를 Claude가 탐색하기 쉬운 구조로 만드는 것이다.
```

---

## Slide 5 — Core Loop: Observe → Analyze → Act → Measure (M4 Diagram Focus)

**목적:** 플러그인의 동작 원리를 한 눈에

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Header | 96,72,1728,90 | **Auto Context — 자동 컨텍스트 최적화 루프** |
| Central cycle diagram | 510,180,900,620 | 4단계 순환 (아래) |
| C1 | 96,840,420,160 | Observe 설명 |
| C2 | 546,840,420,160 | Analyze 설명 |
| C3 | 996,840,420,160 | Act 설명 |
| C4 | 1446,840,378,160 | Measure 설명 |

**Central cycle — 원형 4단계 다이어그램**
```
            ┌─ Observe ─┐
            │  (수집)     │
   Measure ─┤            ├─ Analyze
   (측정)    │            │  (분석)
            └─── Act ────┘
                (적용)
```

색상: Observe=#38BDF8, Analyze=#22D3EE, Act=#22C55E, Measure=#F59E0B

**C1 — Observe (state/observe #38BDF8)**
```
Hooks가 매 도구 사용마다
RAW 데이터를 수집
→ SQLite에 저장
```

**C2 — Analyze (state/candidate #22D3EE)**
```
Worker가 polling하며
패턴 분석, 대화 요약
→ 5차원 점수 산출
```

**C3 — Act (state/convention #22C55E)**
```
암묵지 → rules/ 자동 생성
구조 문제 → offers/ 제안
CLAUDE.md 최소 갱신
```

**C4 — Measure (state/approval #F59E0B)**
```
Navigability, Readability
Predictability, Self-doc
Isolation — 5차원 추적
```

**연출:** 중앙 순환 화살표가 시계방향으로 순차 등장 (0.12s 간격)

---

## Slide 6 — Feedback Loop: 어떤 신호를 수집하는가 (M2 Problem Cards)

**목적:** Hook이 수집하는 구체적 데이터와 그것이 밝히는 것

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Header | 96,72,1728,90 | **세션에서 배운다 — 4가지 신호** |
| S1 | 96,220,840,170 | Glob/Grep 신호 |
| S2 | 984,220,840,170 | Read 신호 |
| S3 | 96,430,840,170 | Edit 신호 |
| S4 | 984,430,840,170 | Bash 신호 |
| Reward summary bar | 96,650,1728,180 | 종합 (아래) |

**S1 — state/observe (#38BDF8) border**
```
아이콘: 돋보기
제목: 검색 신호 (Glob · Grep)
측정: 목표 파일까지 평균 검색 횟수
밝히는 것: Navigability
예: "auth 관련 파일을 찾는 데 평균 4.2회 시도"
```

**S2 — state/observe (#38BDF8) border**
```
아이콘: 파일 열기
제목: 읽기 신호 (Read)
측정: Read 줄 수 vs Edit 줄 수 비율
밝히는 것: Readability
예: "utils.ts 245줄 Read, 10줄 Edit → 신호 4%"
```

**S3 — state/convention (#22C55E) border**
```
아이콘: 연필
제목: 수정 신호 (Edit)
측정: 반복되는 변환 패턴
밝히는 것: 미명문화된 컨벤션
예: "try-catch → Result 변환 5세션 연속"
```

**S4 — state/approval (#F59E0B) border**
```
아이콘: 터미널
제목: 실행 신호 (Bash)
측정: 실패 후 성공한 명령어 패턴
밝히는 것: 비자명한 실행 방법
예: "bun test 실패 → bun test --filter 성공"
```

**Reward summary bar (bg/surface-2, border state/candidate):**
```
Hook은 바보 수집기 — 받아서 던지기만.   |   모든 분석은 Background Worker에서.   |   Main Session에 레이턴시 0.
```

---

## Slide 7 — Safety: 자동 vs 승인 경계 (M5 Data Table)

**목적:** "자동으로 코드 고치는 거 무섭지 않아?" 에 대한 신뢰 확보

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Header | 96,72,1728,90 | **자동화의 경계 — 무엇이 자동이고 무엇이 승인인가** |
| Trust statement | 96,190,1728,80 | Worker는 프로젝트를 관찰하고 학습하지만, 구조 변경은 사용자 승인 없이 하지 않는다. |
| Checklist 4 rows | 180,300,1560,520 | (아래 테이블) |
| Footer reassurance | 96,860,1728,100 | 코드가 바뀌는 건 오직 /cac-apply를 실행할 때뿐. 그 외에는 관찰하고 제안할 뿐이다. |

**Checklist 테이블:**

| 산출물 | 자동 | 승인 | 설명 |
|--------|------|------|------|
| `.claude/rules/` 생성 | state/convention | — | 반복 패턴에서 암묵지 추출 → convention 명문화. 코드 변경 아님. |
| `CLAUDE.md` 갱신 | state/convention | — | 비자명한 실행 방법 추가. 코드 변경 아님. |
| `offers/` 구조 제안 | state/candidate | — | Worker가 제안 파일 생성. 아직 아무것도 안 바뀜. |
| 구조 리팩토링 실행 | — | state/approval | `/cac-apply` 로 사용자가 선택한 offer만 실행. |

행 색상: 자동 행 = bg/surface-1, 승인 행 = bg/surface-2 + state/approval left border

---

## Slide 8 — Two-Speed: Fast Lane과 Slow Lane (M3 Split Compare)

**목적:** "Hook은 즉시, Worker는 천천히" 라는 투 스피드 아키텍처의 이해

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Header | 96,72,1728,90 | **Two-Speed 아키텍처 — 빠른 수집, 느린 분석** |
| Left fast lane | 96,220,820,620 | Fast Lane (아래) |
| Mid log bus | 932,260,56,540 | SQLite 버스 (세로 파이프) |
| Right slow lane | 1004,220,820,620 | Slow Lane (아래) |
| Hook events strip | 96,880,1728,120 | (아래) |

**Left — Fast Lane (state/observe #38BDF8 accent)**
```
제목: Fast Lane — 수집

PostToolUse 이벤트 발생
    │
    ▼
Hook (셸 스크립트)
    │  바보. pipe만.
    ▼
collector.mjs
    │  JSON 파싱
    │  parameterized INSERT
    ▼
SQLite raw_events
    processed = 0

생명주기: fire-and-forget
레이턴시: ms 단위
Main Session 영향: 없음
```

**Mid — SQLite Bus**
```
세로 파이프 표현
위에서 아래로 데이터 흐름
색상: line/default (#26324A)
중앙에 DB 아이콘
```

**Right — Slow Lane (state/candidate #22D3EE accent)**
```
제목: Slow Lane — 분석

Worker (polling loop)
    │
    ├─ processed=0 조회
    │
    ├─ Tool Events 분석
    │  → 5차원 점수 산출
    │
    ├─ 대화 요약 (Stop RAW)
    │  → sessions 테이블
    │
    └─ 누적 분석 (N세션)
       → insights 테이블
       → rules/ 생성
       → offers/ 생성

생명주기: 상주 프로세스
주기: polling
Main Session과: 완전 독립
```

**Hook events strip:**
```
Glob → Read → Edit → Read → Bash → Read → Edit → Stop
  │      │      │      │      │      │      │      │
  ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
 RAW    RAW    RAW    RAW    RAW    RAW    RAW    RAW   ──→ SQLite
```

**연출:** Left 등장 → Mid 파이프 Wipe Down → Right 등장 (순차)

---

## Slide 9 — Tech Stack (M5 Data Table)

**목적:** 구현 스택 한 눈에 정리

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Header | 96,72,1728,90 | **기술 스택** |
| Subline | 96,180,1728,70 | 최소 의존성. Claude Code의 Node.js 환경만으로 동작한다. |
| Table full | 96,280,1728,680 | (아래 테이블) |

**테이블 (3열: 컴포넌트 / 기술 / 설명)**

| 컴포넌트 | 기술 | 설명 |
|----------|------|------|
| **Hook** | Bash (셸 스크립트) | PostToolUse, Stop 이벤트를 받아 collector에 pipe. 가공 없음. |
| **Collector** | Node.js (collector.mjs) | JSON 파싱 + SQLite parameterized INSERT. 이벤트당 한 번 실행 후 종료. |
| **Storage** | SQLite (better-sqlite3) | raw_events · sessions · insights 3개 테이블. .claude-auto-context/db/ |
| **Worker** | Claude Code (별도 프로세스) | SQLite polling → RAW 분석 → 요약 · 패턴 추출 · 5차원 점수 산출 |
| **Input** | .claude/rules/ (Markdown) | glob 스코핑. Claude가 파일 수정 시 자동 로드. Worker가 생성/갱신. |
| **Output** | .claude-auto-context/offers/ | 구조 변경 제안. /cac-apply 스킬로 사용자 승인 후 실행. |
| **Notification** | UserPromptSubmit Hook | pending offer 확인 → 알림 주입. offer 없으면 패스. |

표 헤더: fill #172238, text #E8EEF9
표 행: 짝수 bg/surface-1, 홀수 bg/base

---

## Slide 10 — UX Demo: 사용자 경험 흐름 (M6 Stepper Flow)

**목적:** 실제 사용자가 보게 될 화면과 흐름

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Header | 96,72,1728,90 | **사용자 경험 — 5단계** |
| Stepper row | 96,260,1728,380 | 5단계 (아래) |
| Result panel | 96,700,1728,250 | 알림 예시 (아래) |

**Stepper 5단계 (좌→우, 각 ~330w)**

Step 1 — state/observe (#38BDF8)
```
아이콘: 코딩
제목: 평소처럼 코딩
설명: Claude Code로 일상적 작업.
플러그인은 보이지 않게 동작.
```

Step 2 — state/observe (#38BDF8)
```
아이콘: 데이터베이스
제목: 자동 수집
설명: 매 도구 사용마다
Hook → collector → SQLite
```

Step 3 — state/candidate (#22D3EE)
```
아이콘: 분석 차트
제목: 백그라운드 분석
설명: Worker가 패턴 감지.
5차원 점수 산출.
```

Step 4 — state/approval (#F59E0B)
```
아이콘: 벨
제목: 알림 수신
설명: 다음 세션에서
"N건의 Offer 대기 중" 알림
```

Step 5 — state/convention (#22C55E)
```
아이콘: 체크마크
제목: /cac-apply
설명: offer 선택 → Claude가
자동 리팩토링 + 테스트 확인
```

**Result panel (bg/surface-2, border state/approval):**
```
─────────────────────────────────────────────────
🔔 Auto Context — 2건의 Offer 대기 중
─────────────────────────────────────────────────
1. src/utils.ts 분할 (Readability +0.5)
2. routes/ 패턴 통일 (Predictability +0.8)
💡 /cac-apply 로 적용 · /cac-status 로 상세 확인
─────────────────────────────────────────────────
```
폰트: JetBrains Mono, 18/26

---

## Slide 11 — Summary: Before / After (M3 Split Compare)

**목적:** 한 장으로 가치 요약

| 요소 | 좌표 | 콘텐츠 |
|------|------|--------|
| Header | 96,72,1728,90 | **Auto Context가 바꾸는 것** |
| Before/After table | 96,220,1728,620 | (아래 테이블) |
| Closing statement | 96,880,1728,120 | (아래) |

**Before / After 테이블 (3열: 차원 / Before / After)**

| 차원 | Before (state/decay) | After (state/convention) |
|------|---------------------|------------------------|
| **CLAUDE.md** | 아키텍처 지도, API 문서, 파일 설명… 수백 줄 | 암묵지만. 컨벤션, 금지 규칙, 비자명한 관계. 최소한. |
| **컨벤션** | 사람이 기억에 의존. 세션마다 불일치. | Worker가 자동 추출 → rules/ 명문화. |
| **파일 구조** | utils.ts 800줄. Claude가 매번 전부 읽음. | offer로 분할 제안 → /cac-apply로 리팩토링. |
| **탐색 효율** | 목표 파일까지 평균 4+ 검색. | 구조 개선 후 1-2회로 수렴. |
| **학습** | 없음. 매 세션이 첫 날. | SQLite에 세션 축적. Worker가 누적 학습. |
| **안전** | 자동화 없음. 전부 수동. | 관찰은 자동, 구조 변경은 승인 후만. |

Before 열: text state/decay (#F43F5E)
After 열: text state/convention (#22C55E)

**Closing statement:**
```
프로젝트에 더 많은 문서를 넣는 것이 아니라,
프로젝트 자체가 문서가 되게 만드는 것.

Auto Context.
```
