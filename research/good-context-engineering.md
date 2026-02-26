# Good Context Engineering 정의

## 한 문장 정의

> **Good Context Engineering은 원하는 결과의 확률을 극대화하는, 가장 작고 신호가 강한 토큰 집합을 매 추론마다 큐레이션하는 엔지니어링 분야다.**

이 정의는 세 가지 축으로 분해된다:

| 축 | 핵심 질문 | 원리 |
|---|---|---|
| Quality over Quantity | 무엇을 넣을 것인가 | 양이 아니라 질 |
| Informativity over Exhaustiveness | 얼마나 넣을 것인가 | 완전성이 아니라 정보성 |
| Continuous Curation | 언제 판단할 것인가 | 한 번이 아니라 매 추론마다 |

---

## Context의 해부학 — 무엇으로 구성되는가

Good Context Engineering을 논하려면 먼저 Context가 무엇인지 정의해야 한다.

> **Context = 추론 시점에 모델이 접근 가능한 완전한 상태 (the complete state available to a language model at inference time)**

| 구성 요소 | 특성 | 전형적 토큰 범위 |
|-----------|------|----------------|
| **System Prompt** | 정체성, 제약, 행동 지침. 세션 내 안정. 모든 추론의 기반. | 500-2,000 |
| **Tool Definitions** | 행동 가능한 도구 명세. 에이전트의 행동을 조종하는 암묵적 프롬프트. | 도구당 100-500 |
| **Retrieved Documents** | 런타임에 끌어온 도메인 지식. Just-in-time 로딩의 대상. | 가변 (종종 최대 소비자) |
| **Message History** | 대화 이력. 스크래치패드이자 상태 저장소. 시간에 따라 성장. | 가변 (대화와 함께 성장) |
| **Tool Outputs** | 행동의 결과물. **전체 토큰의 83.9%까지 차지** 가능. | 가변 (context 지배 가능) |

5가지 구성 요소는 각각 다른 생명주기, 다른 변동성, 다른 최적화 전략을 요구한다. System Prompt는 안정적이므로 KV-Cache에 유리하고, Tool Outputs는 휘발적이므로 Observation Masking의 대상이다. 이 구분을 인식하는 것이 Good Context Engineering의 출발점이다.

### Altitude Calibration — 지시의 고도 조절

System Prompt 설계에서 핵심은 "고도(altitude)"의 선택이다:

- **너무 낮음 (Brittle)**: 모든 경우의 수를 하드코딩 → 유지보수 불가능, 깨지기 쉬움
- **너무 높음 (Vague)**: "도움이 되어라" 수준의 지시 → 구체적 신호 부재
- **최적 (Heuristic-Driven)**: 명확한 단계 + 실행의 유연성 → 강한 휴리스틱

```
[Too Low]  if user asks X, do Y, then Z, then W...
[Too High] Be helpful and accurate.
[Optimal]  For pricing inquiries:
           1. Retrieve current rates from docs/pricing.md
           2. Apply user location adjustments
           3. Format with appropriate currency
           Prefer exact figures. When unavailable, say so explicitly.
```

---

## 축 1: 양(Quantity)이 아니라 질(Quality)

### 핵심 주장

"Context window가 크면 더 좋다"는 실증적으로 반박된 가정이다.

### 근거

**Attention은 유한한 예산이다.** n개 토큰은 n²개의 관계를 계산해야 한다. 토큰이 2배 되면 연산은 4배. 이것은 비용 문제를 넘어 모델의 주의력 자체가 희석되는 문제다.

**RULER 벤치마크의 현실.** 32K+ context를 주장하는 모델 중 50%만 32K에서 만족스러운 성능을 유지한다. needle-in-haystack 통과가 실제 장문 이해를 보장하지 않는다.

| 모델 | 열화 시작점 | 심각한 열화 |
|------|-----------|------------|
| Claude Opus 4.5 | ~100K tokens | ~180K tokens |
| GPT-5.2 | ~64K tokens | ~200K tokens |
| Gemini 3 Pro | ~500K tokens | ~800K tokens |

Window가 200K라도 200K를 채우면 안 된다. 열화 시작점 이전이 실질적 유효 범위다.

**단일 무관 문서의 파괴력.** 관련 없는 문서 하나만 context에 넣어도 성능이 유의미하게 하락한다. 노이즈 양에 비례하는 게 아니라 step function — 존재 자체가 열화를 촉발한다. 모델은 context의 어떤 것도 "건너뛸" 수 없다. 제공된 모든 것에 attend해야 한다.

**압축 전략 비교의 교훈.**

| 방법 | 압축률 | 품질 점수 |
|------|--------|----------|
| Anchored Iterative | 98.6% | 3.70 |
| Regenerative | 98.7% | 3.44 |
| Opaque | 99.3% | 3.35 |

가장 많이 줄이는 Opaque(99.3%)가 가장 낮은 품질(3.35)을 보인다. 0.7% 더 많은 토큰을 유지한 Anchored Iterative가 0.35점 더 높다. 더 적다고 더 좋은 게 아니라, 올바른 것을 유지하는 게 좋은 것이다.

### Quality의 구체적 의미

- 이 추론에 필요한 정보의 **신호 대 잡음 비율(SNR)**
- Attention이 집중되는 위치(시작과 끝)에 **핵심 정보 배치**
- 무관한 정보가 관련 정보와 attention을 **경쟁하지 않는 상태**

---

## 축 2: 완전성(Exhaustiveness)이 아니라 정보성(Informativity)

### 핵심 주장

"빠뜨리면 안 되니까 다 넣자"는 보험의 논리인데, context에서 보험은 오히려 독이다.

### 근거

**인간 인지와의 대비.** 인간은 모든 것을 외우지 않는다. 외부 조직화 시스템과 인덱싱을 통해 필요한 것을 검색한다. Good context engineering도 동일하다. 모든 것을 넣는 것이 아니라, 필요할 때 접근할 수 있는 경로를 확보하는 것.

**Progressive Disclosure.** 100개 스킬이 있다면:
- Bad: 100개 전체 내용을 system prompt에 넣는다 (context 폭발)
- Good: 이름과 한 줄 설명만 넣고, 필요할 때 전체를 로드한다

Context는 두 종류로 나뉜다:
- **Static context**: 항상 포함. 시스템 명령, 도구 정의, 핵심 규칙
- **Dynamic context**: 필요할 때 로드. 문서, 스킬 내용, 도구 출력

**Context Engineering의 4가지 실패 모드.**

| # | 실패 | 설명 |
|---|------|------|
| 1 | 부재 | 필요한 context가 전체 가용 context에 아예 없다 |
| 2 | 불충분 | 검색된 context가 필요한 context를 포괄하지 못한다 |
| 3 | 과잉 | 검색된 context가 필요한 context를 훨씬 초과한다 |
| 4 | 매몰 | 에이전트가 많은 파일에 묻힌 정보를 발견하지 못한다 |

3번이 "완전성의 함정"이다. 모든 것을 넣으면 1번은 해결되지만, 3번이 발생하여 오히려 성능이 떨어진다. Good Context Engineering은 1번과 3번 사이의 최적점을 찾는 행위다.

**Observation Masking의 실증.** 에이전트 작업 중 tool output이 전체 토큰의 83.9%를 차지한다. 웹 검색 결과 10K 토큰 중 실제 필요한 건 200 토큰일 수 있다. 나머지 9,800 토큰은 주의력을 빼앗는 잡음이다.

```
Before: 8,000 tokens in context  (web search raw output)
After:  ~100 tokens in context   (summary + reference)
        8,000 tokens accessible  (file on demand)
```

### Informativity의 구체적 의미

- 지금 판단에 **기여하는 토큰만** context에 존재
- 기여하지 않는 토큰은 **제거가 아니라 접근 가능한 외부로 이동**
- "넣을까 말까"가 아니라 "**지금** 넣어야 하는가"의 시간적 판단

---

## 축 3: 한 번의 설정이 아니라 매 추론마다의 큐레이션

### 핵심 주장

"좋은 system prompt를 한 번 쓰면 끝"이 아니다. Context engineering은 일회성 프롬프트 작성이 아닌 지속적 context 관리의 규율이다.

### 근거

**Context는 대화가 진행될수록 변한다.**

```
turn_1:   1,000 tokens   깨끗한 상태
turn_5:   8,000 tokens   관리 가능
turn_10: 25,000 tokens   주의 필요
turn_20: 60,000 tokens   열화 시작
turn_30: 90,000 tokens   심각한 열화
```

Turn 1에서 좋았던 context 구성이 Turn 20에서도 좋다는 보장이 없다.

**Context Poisoning은 누적된다.** 한 번 잘못된 정보가 context에 들어오면, 이후 모든 판단이 그것을 참조하여 피드백 루프가 만들어진다. 매 추론마다 점검하지 않으면, poisoning이 감지되지 않은 채 확산된다.

**Tokens-per-task가 올바른 최적화 목표다.**

- `tokens-per-request`: 개별 호출에서 소비하는 토큰 (잘못된 최적화 목표)
- `tokens-per-task`: 과제 완수까지 소비하는 총 토큰 (올바른 최적화 목표)

한 번 공격적으로 압축해서 0.5% 절약했지만, 에이전트가 잃어버린 정보를 다시 찾느라 20% 더 소비한다면 총 비용은 증가한다.

**Trigger-based Optimization.**

| 신호 | 조치 |
|------|------|
| 토큰 사용률 > 80% | compaction 실행 |
| 성능 열화 지표 감지 | 원인 분석 후 masking/partitioning |
| tool output이 전체의 60%+ | observation masking 적용 |

이런 트리거는 한 번 설정하는 게 아니라 매 추론 사이클마다 평가해야 작동한다.

**Multi-agent에서의 동적 큐레이션.** Coordinator는 매 턴마다 결정해야 한다:
- 이 subtask에 full context를 줄 것인가, instruction만 줄 것인가?
- Sub-agent의 결과를 그대로 전달할 것인가, 요약할 것인가?

이것은 static 설계가 아니라 runtime에서의 동적 판단이다.

### Continuous Curation의 구체적 의미

- 매 turn마다: context에 **무엇이 들어오고, 무엇이 나가는가**
- 매 tool call마다: output을 **그대로 둘 것인가, 요약할 것인가, 파일로 뺄 것인가**
- 매 compression trigger마다: **무엇을 보존하고, 무엇을 압축하고, 무엇을 버릴 것인가**
- 매 agent spawn마다: sub-agent에 **어떤 범위의 context를 줄 것인가**

---

## 세 축의 관계

```
Quality ←———→ Informativity ←———→ Curation
 (무엇을)        (얼마나)          (언제)
```

- **Quality**는 "무엇을" — 신호가 강한 토큰을 선별
- **Informativity**는 "얼마나" — 필요한 만큼만, 접근 경로는 확보
- **Curation**은 "언제" — 한 번이 아니라 매 추론마다 반복

세 축이 하나라도 빠지면 무너진다:

| 빠진 축 | 결과 |
|---------|------|
| Quality 없는 Curation | 매번 잡음을 정리하는 삽질 |
| Informativity 없는 Quality | 좋은 정보를 넣었지만 너무 많이 넣음 |
| Curation 없는 Quality + Informativity | 처음엔 좋았지만 시간이 지나면 열화 |

---

## 실패 패턴 — "Bad"의 반대로 "Good"을 정의

| 실패 패턴 | 현상 | Good의 반대 정의 |
|-----------|------|-----------------|
| Lost-in-Middle | 중간 정보의 recall이 10-40% 하락 | 주의력 지형을 이해하고 배치를 설계한다 |
| Context Poisoning | 오류가 피드백 루프로 증폭 | 오염을 감지하고 자정하는 메커니즘이 있다 |
| Context Distraction | 무관한 정보가 주의력 경쟁 | 관련 없는 것을 넣지 않는 절제가 있다 |
| Context Confusion | 어떤 맥락이 적용되는지 혼란 | 명확한 경계와 구조화가 있다 |
| Context Clash | 모순되는 정보의 충돌 | 버전 관리와 우선순위 규칙이 있다 |

---

## 실천 체계 — Write / Select / Compress / Isolate

Good Context Engineering을 달성하는 4가지 동사:

| 동사 | 설명 | 해당하는 축 |
|------|------|-----------|
| **Write** | context 바깥에 저장 (파일시스템, 메모리) | Informativity |
| **Select** | 관련된 것만 끌어옴 (검색, 필터링) | Quality |
| **Compress** | 토큰을 줄이되 정보를 보존 (요약, 마스킹) | Quality + Informativity |
| **Isolate** | sub-agent로 context 분리 (파티셔닝) | Curation |

각 동사의 성능 기준:

| 기법 | 토큰 감소 | 품질 영향 |
|------|----------|----------|
| Compaction | 50-70% | <5% 저하 |
| Observation Masking | 60-80% | <2% 영향 |
| KV-Cache 최적화 | 50%+ 비용 절감 | 0% (동일 결과) |
| Context Partitioning | 분배 | 격리로 품질 향상 가능 |

---

## 확장 원리 7개

세 축에서 파생되는 구체적 원리:

### 1. Informativity over Exhaustiveness
완전성이 아닌 정보성. 지금 판단에 필요한 최소 토큰만.

### 2. Structure Forces Preservation
구조가 보존을 강제한다. 자유 형식 요약은 정보를 흘린다. JSON, 테이블, 명시적 섹션은 누락을 구조적으로 방지한다.

### 3. Context Isolation > Context Accumulation
쌓지 말고 분리하라. Multi-agent의 본질은 역할 분리가 아닌 context window 격리다.

### 4. Tokens-per-Task > Tokens-per-Request
개별 요청의 토큰 절약이 아닌, 과제 완수까지의 총 토큰이 진짜 비용이다.

### 5. Progressive Disclosure
이름과 설명만 먼저, 전체 내용은 필요할 때만. 인간 인지와 동일 원리.

### 6. Design for Degradation
완벽한 조건을 가정하지 말고, 열화에 대비하라. Lost-in-Middle, Poisoning, Clash는 피할 수 없는 현실이다.

### 7. Measure, Don't Assume
최적화 전에 측정하라. 직관적 최적화는 실제 병목과 다른 곳을 고칠 수 있다.

```
[1] Informativity ──→ 무엇을 넣을지 결정
         │
[5] Progressive   ──→ 언제 넣을지 결정
    Disclosure
         │
[2] Structure     ──→ 어떤 형태로 넣을지 결정
         │
[3] Isolation     ──→ 어디에 넣을지 결정
         │
[4] Tokens/Task   ──→ 얼마나 넣을지의 기준
         │
[6] Degradation   ──→ 실패할 때 어떻게 할지
         │
[7] Measure       ──→ 위 모든 결정을 검증
```

---

## Claude Code에서의 Good Context Engineering

일반 원리를 Claude Code 코딩 세션에 적용하면 고유한 제약과 기회가 드러난다.

### Claude Code의 컨텍스트 구조

```
┌─ 고정 (제어 불가) ──────────────────────────┐
│  System Prompt     클로드코드 내장 지시문      │
│  Tool Definitions  Read, Edit, Grep 등 도구   │
└────────────────────────────────────────────────┘
┌─ 반고정 (제어 가능) ───────────────────────────┐
│  CLAUDE.md         프로젝트 지시문              │
└────────────────────────────────────────────────┘
┌─ 동적 (세션 중 누적) ─────────────────────────┐
│  Conversation      사용자 요청 + Claude 응답    │
│  Tool Outputs      파일 내용, grep 결과, bash  │ ← 전체의 80%+
└────────────────────────────────────────────────┘
```

플러그인이 제어할 수 있는 영역은 "반고정"과 "동적"에서의 신호 품질이다.

### 코딩 세션의 생명주기와 컨텍스트 소비

```
사용자: "인증 기능 추가해줘"
         │
    ① 탐색 (Discovery)          ← 컨텍스트 소비의 대부분
       Glob → 파일 찾기
       Grep → 패턴 검색
       Read → 파일 읽기
         │
    ② 이해 (Comprehension)       ← 축적된 컨텍스트의 품질에 의존
         │
    ③ 실행 (Action)              ← Edit/Write
         │
    ④ 검증 (Verification)        ← 또 컨텍스트 소비
```

> **클로드코드에서의 Good Context Engineering = 탐색 오버헤드를 최소화하면서 탐색 정확도를 극대화하는 것**

### 5가지 차원

| # | 차원 | 핵심 질문 | 나쁠 때의 비용 |
|---|------|----------|---------------|
| 1 | **Navigability** | 찾을 수 있는가? | grep/glob 반복 → 검색 결과 누적 |
| 2 | **Readability** | 읽었을 때 신호가 높은가? | 큰 파일 읽기 → 잡음 토큰 축적 |
| 3 | **Predictability** | 하나로 나머지를 추론 가능한가? | 확인 읽기 반복 → 중복 컨텍스트 |
| 4 | **Self-documentation** | 스스로 설명하는가? | 매 세션 재탐색 → tokens-per-task 폭증 |
| 5 | **Isolation** | 범위가 한정되는가? | 과도한 탐색 → 컨텍스트 오염 |

### "클린 코드"와의 차이 — Claude 고유의 제약

| 차원 | 사람 개발자 | Claude Code |
|------|-----------|-------------|
| **기억** | 세션 간 기억 유지 | 매 세션 = 첫 날 (CLAUDE.md 필수) |
| **파일 읽기** | 스크롤하며 훑기 | 전체를 컨텍스트에 로드 (크기 = 비용) |
| **네비게이션** | IDE의 Go to Definition | Grep/Glob 검색 (이름 = 발견 가능성) |
| **패턴 학습** | 코드베이스와 오래 함께함 | 지금 읽은 것에서만 추론 (일관성 = 효율) |
| **범위 파악** | 경험적으로 앎 | 명시적 경계 없으면 과도하게 탐색 |

### CLAUDE.md의 Static Context 자격 기준

CLAUDE.md는 매 세션, 매 턴마다 로드되는 Static Context다. 따라서 아래 4가지 기준을 모두 충족하는 정보만 자격이 있다:

| 기준 | 설명 |
|------|------|
| **발견 불가능** | 코드베이스를 아무리 읽어도 알 수 없는 것 |
| **매 세션 필요** | 거의 모든 작업에서 필요한 것 |
| **안정적** | 자주 바뀌지 않는 것 |
| **고신호** | 없으면 Claude가 실수하는 것 |

**자격 있는 정보:**

```
✅ 컨벤션 (코드에서 추론 불가)
   "우리는 factory 패턴을 씀, constructor 아님"
   "에러 처리는 Result 타입, try-catch 아님"

✅ 금지 규칙 (코드에 '없는 것'은 발견 불가)
   "ORM X 사용 금지 — 성능 이슈 있었음"
   "any 타입 금지"

✅ 비자명한 실행 방법 (추측 불가)
   "bun test --filter=unit"
   "DB 마이그레이션: bun run db:push"

✅ 비자명한 관계 (구조로 안 보이는 것)
   "Service A는 반드시 Service B 초기화 후에 시작"
```

**자격 없는 정보 — 아키텍처 지도의 함정:**

아키텍처 지도는 파일시스템 구조의 복제본이다. `ls src/`로 발견 가능한 정보를 Static Context에 복제하면:
- 동기화 실패 시 Context Poisoning 발생 (리팩토링 후 CLAUDE.md 미갱신)
- 매 턴마다 불필요한 토큰 소비
- Exhaustiveness의 함정

```
❌ 아키텍처 지도 (ls로 발견 가능)
❌ API 문서 (코드에서 발견 가능)
❌ 타입 정의 (코드 자체가 정의)
❌ 파일별 설명 (파일이 스스로 설명해야 함)
```

아키텍처 지도가 필요하다는 것은 프로젝트의 Navigability가 나쁘다는 신호다. 지도를 추가하는 것은 나쁜 구조에 대한 보상 장치이지, 해결책이 아니다.

### 핵심 설계 원칙

> **플러그인의 역할은 CLAUDE.md에 더 많은 정보를 채워넣는 것이 아니라, 프로젝트 자체를 Claude가 탐색하기 쉬운 구조로 만드는 것 — 그래서 CLAUDE.md가 최소한만 필요하게 만드는 것이다.**

이것은 context engineering의 핵심 원리인 "Informativity over Exhaustiveness"의 프로젝트 수준 적용이다. 정보를 더 넣는 것이 아니라, 구조를 고쳐서 정보가 필요 없게 만드는 것.

---

## 측정 — Good을 판별하는 기준

### 성능 분산의 구조 (BrowseComp 연구)

| 요인 | 분산 설명 비율 | 함의 |
|------|-------------|------|
| Token usage | 80% | 토큰을 어디에 쓰는지가 결정적 |
| Tool calls | ~10% | 탐색의 양이 기여 |
| Model choice | ~5% | 모델 업그레이드가 토큰 증가보다 효율적 |

이것은 역설을 만든다 — "최소 토큰"이 원리인데 성능은 "더 많은 토큰"과 상관. 이 긴장의 해소:

> Good Context Engineering = 토큰을 아끼는 것이 아니라, 주어진 토큰 예산 안에서 signal-to-noise ratio를 극대화하는 것.

### 평가 차원 6가지

| 차원 | 측정 대상 |
|------|----------|
| Accuracy | 기술적 세부사항의 정확성 (파일 경로, 함수명, 에러 코드) |
| Context Awareness | 현재 대화 상태의 반영 정도 |
| Artifact Trail | 어떤 파일이 읽히고 수정되었는지 추적 |
| Completeness | 질문의 모든 부분에 대한 응답 |
| Continuity | 정보 재탐색 없이 작업 지속 가능 여부 |
| Instruction Following | 명시된 제약 조건의 준수 |

### 반직관적 발견

- **Shuffled haystacks > Coherent haystacks**: 일관된 맥락이 오히려 거짓 연관을 만든다
- **Single distractor의 불균형적 영향**: 무관한 문서 1개만으로 성능 급락
- **Context window 확대 ≠ 성능 향상**: 32K+ 주장 모델 중 50%만 실제 유지

---

## 종합: Good Context Engineering의 3개 층위

세 축, 5가지 실패 패턴, 4가지 동사, 7가지 원리를 관통하면 하나의 구조가 드러난다. Good Context Engineering은 3개 층위로 구성된다:

### 층위 1 — 원리 (What)

> 원하는 결과의 확률을 극대화하는 최소한의 고신호 토큰 집합을 큐레이션하는 것.

이것은 "무엇이 Good인가"에 대한 답이다. 토큰을 아끼는 것이 목적이 아니라, 주어진 토큰 예산 안에서 signal-to-noise ratio를 극대화하는 것이 목적이다.

### 층위 2 — 실천 (How)

> Write / Select / Compress / Isolate의 4가지 동사로, 매 추론마다 컨텍스트의 신호 대 잡음 비율을 능동적으로 관리하는 것.

이것은 "어떻게 Good을 달성하는가"에 대한 답이다. 정적 설계가 아니라 런타임의 동적 행위다.

### 층위 3 — 검증 (Measure)

> 5가지 실패 패턴(Lost-in-Middle, Poisoning, Distraction, Confusion, Clash)의 부재를 확인하고, 다차원 루브릭으로 결과 품질을 측정하는 것.

이것은 "Good인지 어떻게 아는가"에 대한 답이다. 측정 없는 최적화는 직관의 함정에 빠진다.

```
┌─────────────────────────────────────────┐
│         층위 1: 원리 (What)              │
│  "최소 고신호 토큰으로 결과 극대화"       │
├─────────────────────────────────────────┤
│         층위 2: 실천 (How)              │
│  Write / Select / Compress / Isolate    │
│  × 매 추론마다 동적 큐레이션             │
├─────────────────────────────────────────┤
│         층위 3: 검증 (Measure)           │
│  5 실패 패턴 부재 확인                   │
│  + 다차원 루브릭 측정                    │
└─────────────────────────────────────────┘
```

### 3층위와 기존 구조의 매핑

| 층위 | 3축 | 7원리 | 4동사 | 5실패패턴 |
|------|-----|-------|-------|-----------|
| 원리 | Quality, Informativity | #1 Informativity, #4 Tokens/Task | — | — |
| 실천 | Curation | #2 Structure, #3 Isolation, #5 Progressive Disclosure | Write, Select, Compress, Isolate | — |
| 검증 | — | #6 Design for Degradation, #7 Measure | — | Lost-in-Middle, Poisoning, Distraction, Confusion, Clash |

---

## 기술적 레퍼런스 — 구현 패턴

이 섹션은 context-engineering-fundamentals의 reference 문서들에서 추출한 구현 수준의 패턴이다.

### Context Health 모니터링

Context의 건강 상태를 실시간으로 평가하는 복합 지표:

| 지표 | 경고 임계점 | 위험 임계점 |
|------|-----------|-----------|
| Context 사용률 | 70% | 90% |
| Attention 열화 영역 비율 | 30%+ | — |
| Relevance 점수 | 30% 미만 | — |
| 연속 경고 횟수 | 3회 | — |

건강 점수 해석:
- **> 0.8**: Healthy — 정상 운영
- **> 0.6**: Warning — 최적화 고려 필요
- **> 0.4**: Degraded — 즉시 최적화 필요
- **≤ 0.4**: Critical — context 리셋 고려

### Context Poisoning 감지

오염 감지의 핵심 지표:
- 미검증 주장(claims)의 비율이 전체의 30%를 초과
- 거짓으로 판명된 주장이 1개 이상 존재
- 이전 turn의 오류가 후속 turn에서 참조되는 횟수 추적

오류 전파 분석: 특정 오류 지점 이후의 모든 참조를 추적하여, 3개 이상의 downstream 참조가 있는 영역을 "고영향 영역(high impact area)"으로 분류.

### Evaluation 루브릭 가중치

| 차원 | 가중치 | 설명 |
|------|--------|------|
| Factual Accuracy | 30% | 주장이 ground truth와 일치 |
| Completeness | 25% | 요청된 모든 측면을 다룸 |
| Tool Efficiency | 20% | 적절한 도구를 합리적 횟수로 사용 |
| Citation Accuracy | 15% | 인용이 출처와 일치 |
| Source Quality | 10% | 적절한 1차 출처 사용 |

통과 기준: 가중 평균 점수 ≥ 0.7

### Context Recovery 전략

열화가 회복 불가능한 수준에 도달했을 때의 전략적 절단(truncation) 우선순위:

1. **항상 보존**: System prompt, tool definitions (시스템 요소)
2. **높은 보존**: 최근 10개 대화 턴
3. **선택적 보존**: 핵심 참조 문서
4. **필요시 요약**: 오래된 카테고리 3 요소들
5. **최후 수단**: 최근 5턴만 남기고 나머지 절단

---

## 지식 출처

이 문서는 Context Engineering Fundamentals 13개 스킬의 통합 분석에 기반한다.

| 스킬 | 이 문서에서의 역할 |
|------|------------------|
| context-fundamentals | 기초 정의, context 구성 요소, attention budget |
| context-degradation | 5가지 실패 패턴, 모델별 열화 임계점, 반직관적 발견 |
| context-optimization | 4대 최적화 전략, 성능 기준 |
| context-compression | tokens-per-task, 압축 전략 비교, 구조적 보존 |
| filesystem-context | Static vs Dynamic context, 4가지 실패 모드 |
| memory-systems | Working~Temporal KG 메모리 계층, 검색 신뢰성 |
| multi-agent-patterns | Context isolation, supervisor/swarm/hierarchical |
| tool-design | Tool description as prompt, 통합 원칙, 아키텍처 축소 |
| hosted-agents | 세션 속도, sandbox 인프라, self-spawning |
| project-development | 파이프라인 아키텍처, 파일시스템 상태머신 |
| bdi-mental-states | Belief-Desire-Intention, T2B2T 패러다임 |
| evaluation | 성능 분산 구조, 다차원 루브릭 |
| advanced-evaluation | LLM-as-Judge, Direct Scoring vs Pairwise Comparison |
