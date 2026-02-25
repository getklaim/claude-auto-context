# NVIDIA/cuopt — AI 최적화 분석

> **GitHub**: https://github.com/NVIDIA/cuopt  
> **도메인**: GPU 가속 최적화 엔진 (LP, MILP, QP, VRP)  
> **핵심 패턴**: 2단계 엔트리포인트 + 필수 베이스 레이어 + 도메인별 스킬 그래프 + 인터페이스 지원 매트릭스

---

## 개요

NVIDIA cuOpt는 GPU 가속 수학적 최적화 엔진으로, 차량 경로 문제(VRP), 선형 계획법(LP/MILP), 이차 계획법(QP)을 지원한다. 복잡한 API 표면(Python/C API/CLI/REST 4가지 인터페이스)과 도메인 특화 지식 때문에 AI가 hallucination을 일으키기 쉬운 환경이다. cuOpt의 AI 최적화는 이를 체계적으로 방지하는 **7가지 설계 패턴**으로 구성된다.

---

## 파일 구조

```
NVIDIA/cuopt/
├── AGENTS.md                          ← 루트 리다이렉트 (2줄 stub)
├── .github/
│   ├── AGENTS.md                      ← 실제 엔트리포인트 (라우팅 테이블)
│   ├── .coderabbit_review_guide.md    ← CodeRabbit AI 코드 리뷰 설정 (22KB)
│   └── skills/
│       ├── README.md                  ← 스킬 인덱스
│       ├── cuopt-user-rules/
│       │   └── SKILL.md              ← 필수 베이스 레이어 (10개 행동 규칙)
│       ├── cuopt-routing/
│       │   ├── SKILL.md              ← VRP, TSP, PDP
│       │   └── resources/
│       │       ├── python_examples.md
│       │       └── server_examples.md
│       ├── cuopt-lp-milp/
│       │   ├── SKILL.md              ← 선형/혼합정수 계획법
│       │   └── resources/
│       │       ├── python_examples.md
│       │       ├── c_api_examples.md
│       │       ├── cli_examples.md
│       │       └── server_examples.md
│       ├── cuopt-qp/
│       │   ├── SKILL.md              ← 이차 계획법 (Beta)
│       │   └── resources/
│       │       └── python_examples.md
│       ├── cuopt-debugging/
│       │   ├── SKILL.md              ← 트러블슈팅 의사결정 트리
│       │   └── resources/
│       │       └── diagnostic_snippets.md
│       ├── cuopt-installation/
│       │   ├── SKILL.md              ← 설치 경로별 전체 명령어
│       │   └── resources/
│       │       └── verification_examples.md
│       ├── cuopt-server/
│       │   ├── SKILL.md              ← REST API 배포
│       │   └── resources/
│       │       ├── routing_examples.md
│       │       └── lp_milp_examples.md
│       └── cuopt-developer/
│           └── SKILL.md              ← 기여자용 (별도 행동 규칙)
```

`CLAUDE.md`, `.cursorrules`, `copilot-instructions.md` 없음 — AGENTS.md 단일 표준.  
추가로 CodeRabbit AI 코드 리뷰 설정 파일(`.coderabbit_review_guide.md`, 22KB)도 존재한다.

---

## 패턴 1: 2단계 엔트리포인트

```
root/AGENTS.md  →  .github/AGENTS.md  →  skills/
```

**루트 `AGENTS.md`** (2줄 stub):
```markdown
# AGENTS.md

AI-agent skills for this repo are located at:

- **Entry point**: `.github/AGENTS.md`
- **Skills**: `.github/skills/`

If you are a coding agent, start at `.github/AGENTS.md`.
```

**`.github/AGENTS.md`** (실제 라우팅 테이블):
```markdown
# AGENTS.md - cuOpt AI Agent Entry Point

## Quick Start

| Task | Read These Skills |
|------|-------------------|
| **Using cuOpt** (routing, LP, etc.) | `skills/cuopt-user-rules/` → then domain skill |
| **Developing cuOpt** (contributing) | `skills/cuopt-developer/` |
```

루트 파일은 도구들(Codex, Claude 등)이 기본으로 찾는 위치에 있고, `.github/` 내부의 실제 파일로 즉시 리다이렉트한다.

---

## 패턴 2: 필수 베이스 레이어 (cuopt-user-rules)

모든 사용자 스킬은 `cuopt-user-rules`를 먼저 읽어야 한다. 이 스킬은 **AI 행동의 헌법**으로, 10개 규칙을 정의한다:

| 규칙 | 내용 |
|------|------|
| 1. Ask Before Assuming | 인터페이스(Python/REST/C/CLI), 문제 유형, 제약 조건, 출력 형식 먼저 확인 |
| 2. Handle Incomplete Questions | 빠진 정보를 추측하지 말고 탐색 |
| 3. Clarify Data Requirements | 데이터가 합성인지 사용자 제공인지 항상 명시 |
| 4. MUST Verify Understanding | 상당한 코드 작성 전 필수 확인 블록 |
| 5. Follow Requirements Exactly | 요청하지 않은 기능 추가 금지, 처음부터 재작성 금지 |
| 6. Read Examples First | 문제 유형별 정식 예제 위치 매핑 (API hallucination 방지) |
| 7. Check Results | 상태 코드, 제약 조건, 목적 함수 값 검증 안내 |
| 8. Check Environment First | Python API vs C API vs REST Server 구분 (별도 패키지!) |
| 9. Ask Before Running | `pip`, `conda`, `apt` 실행 전 허가 요청 |
| 10. No Privileged Operations | `sudo` 금지, 시스템 파일 수정 금지 |

**규칙 6의 구체적 예제 경로 매핑**이 핵심이다:
```
- Routing/VRP → skills/cuopt-routing/resources/python_examples.md
- LP/MILP     → skills/cuopt-lp-milp/resources/python_examples.md
- REST API    → skills/cuopt-server/resources/routing_examples.md
```
AI가 레포 내 정식 예제를 먼저 읽도록 강제함으로써 API 발명을 방지한다.

---

## 패턴 3: 스킬 = SKILL.md + resources/ 일관된 구조

모든 스킬이 동일한 2파일 구조를 따른다:

```
cuopt-routing/
├── SKILL.md         ← 지시사항 (규칙, 패턴, 주의사항)
└── resources/
    ├── python_examples.md    ← 복사-붙여넣기 코드 예제
    └── server_examples.md    ← REST 예제
```

개발자 스킬(`cuopt-developer`)에는 `resources/` 없음 — 개발 태스크는 코드 우선이기 때문이다.

---

## 패턴 4: 인터페이스 지원 매트릭스

모든 도메인 스킬에 인터페이스별 지원 여부 테이블이 포함된다:

**cuopt-qp (이차 계획법) 지원 매트릭스:**
| 인터페이스 | 지원 |
|-----------|------|
| Python API | ✅ |
| C API | ❌ |
| CLI | ❌ |
| REST | ❌ |

이 매트릭스가 없으면 AI가 "REST로 QP 해주세요"라는 요청에 존재하지 않는 API를 발명할 수 있다.

---

## 패턴 5: 안티-Hallucination 앵커 (Anti-Hallucination Anchors)

### 정확한 틀린→맞는 코드 비교

**cuopt-lp-milp의 Status 체크 패턴:**
```python
# ✅ CORRECT
if problem.Status.name in ["Optimal", "FeasibleFound"]:

# ❌ WRONG - will silently fail!
if problem.Status.name == "OPTIMAL":  # Never matches! (PascalCase, not UPPER_CASE)
```

**cuopt-qp의 최대화 패턴:**
```python
# ❌ WRONG - will fail
problem.setObjective(x*x + y*y, sense=MAXIMIZE)

# ✅ CORRECT - minimize instead
problem.setObjective(-(x*x + y*y), sense=MINIMIZE)
```

### Python API vs REST API 용어 차이 테이블

```
| Concept      | Python API              | REST API           |
|--------------|-------------------------|--------------------|
| Jobs         | order_locations         | task_locations     |
| Time windows | set_order_time_windows()| task_time_windows  |
```

이 테이블이 없으면 AI가 Python 용어를 REST 페이로드에 그대로 사용하여 API 오류를 발생시킨다.

---

## 패턴 6: 에스컬레이션 라우팅 (Escalation Routing)

모든 스킬이 "When to Escalate" 섹션으로 끝나며, 어떤 상황에서 다른 스킬로 전환할지 명시한다:

```
cuopt-routing  →  "Infeasible 반복 시" → cuopt-debugging
cuopt-routing  →  "API 행동이 이상할 때" → cuopt-debugging  
cuopt-routing  →  "새 기능 추가 필요 시" → cuopt-developer
```

이로써 스킬들이 **격리된 문서가 아닌 연결된 그래프**를 형성한다.

---

## 패턴 7: 사용자 vs 개발자 분리

`cuopt-developer` 스킬은 완전히 다른 행동 규칙을 가진다:

```markdown
# cuopt-developer 행동 규칙 (user-rules와 다름)
- 빌드/테스트 명령어는 물어보지 않고 실행해도 됨
- git commit, git push, 패키지 설치는 여전히 허가 필요
- DCO 서명 필수: git commit -s
```

그리고 아키텍처 맵을 포함한다:
```
cuopt/
├── cpp/          # 핵심 C++ 엔진 (CUDA 커널)
├── python/
│   ├── cuopt/         # Python 바인딩 + routing API
│   ├── cuopt_server/  # REST API 서버
│   └── libcuopt/      # C 라이브러리 Python 래퍼
├── ci/
└── docs/
```

---

## cuopt-debugging — 증상 기반 의사결정 트리

디버깅 스킬은 **증상 → 진단 → 수정** 구조로 조직된다:

| 증상 | 원인 | 수정 |
|------|------|------|
| "Solution is None but status OK" | Status 문자열 대소문자 오류 | PascalCase 사용 |
| "Infeasible" | 충돌하는 제약 조건 | 시간 창 긩완화 |
| "Server returns 422" | 잘못된 필드명 | REST 용어 테이블 참조 |
| "OutOfMemoryError" | 문제 크기 초과 | 진단 스니펫 참조 |
| "cudf Type Errors" | dtype 불일치 | 명시적 dtype 요구사항 |

---

## cuopt-installation — 설치 경로 완전 문서화

```
pip install cuopt-cu12   (CUDA 12)
pip install cuopt-cu13   (CUDA 13)
conda install -c rapidsai cuopt
docker run --gpus all nvidia/cuopt:latest
```

GPU 요구사항 (Compute Capability ≥ 7.0, Volta+), 클라우드 배포 인스턴스 타입, 오프라인 설치 워크플로우까지 포함.

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| 2단계 엔트리포인트 | 루트 stub → .github/AGENTS.md → skills/ |
| 필수 베이스 레이어 | user-rules를 항상 먼저 읽도록 강제 |
| 인터페이스 매트릭스 | 도메인별 지원 여부 표로 unsupported 조합 차단 |
| 정확한 코드 비교 | `✅ CORRECT` / `❌ WRONG` 형식으로 API gotcha 명시 |
| 용어 차이 테이블 | Python API vs REST API 필드명 매핑 |
| 에스컬레이션 라우팅 | "When to Escalate" 섹션으로 스킬 그래프 형성 |
| 사용자/개발자 분리 | 완전히 다른 행동 규칙 적용 |
| 진단 체크리스트 | 8개 항목 순서대로 검사하도록 강제 |

---

## 요약

NVIDIA cuOpt의 AI 최적화는 **도메인 특화 지식과 안티-hallucination 방어의 결합**이다. 4가지 인터페이스(Python/C/CLI/REST)와 도메인별 API 표면이 AI에게 위험한 환경이지만, 인터페이스 지원 매트릭스, 정확한 틀린→맞는 코드 비교, 용어 차이 테이블이 이를 체계적으로 방지한다.

| 지표 | 값 |
|------|-----|
| 스킬 수 | 8개 (user-rules + 6 도메인 + developer) |
| 지원 AI 도구 | AGENTS.md 표준 지원 모든 도구 |
| 인터페이스 수 | 4개 (Python, C API, CLI, REST) |
| resources/ 파일 수 | 10개 |
| 핵심 혁신 | 필수 베이스 레이어 + 인터페이스 매트릭스 + 에스컬레이션 라우팅 |
| 추가 AI 도구 | CodeRabbit (AI 코드 리뷰, 22KB 설정) |
