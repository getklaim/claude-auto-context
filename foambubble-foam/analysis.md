# foambubble/foam — AI 최적화 분석

> **GitHub**: https://github.com/foambubble/foam  
> **Stars**: 16.9k  
> **핵심 패턴**: 안티-아부(Anti-Sycophancy) 규칙 + Mock 금지 영역(core/) + 커스텀 슬래시 커맨드 + 에이전트 작업 지속성

---

## 개요

foambubble/foam은 VS Code 기반 개인 지식 관리 도구다.  
`CLAUDE.md`는 AI와의 **협업 원칙**을 정의하는 문서로, 기술적 정확성이 동의보다 우선한다는 원칙과 테스트에서 mock 사용을 최소화하는 철학을 명시한다. 특히 `.claude/commands/`의 커스텀 슬래시 커맨드가 이슈 조사와 PR 준비 워크플로우를 구조화한다.

---

## 파일 구조

```
foambubble/foam/
├── CLAUDE.md                     ← 협업 원칙 + 테스트 규칙 + 워크플로우
└── .claude/
    └── commands/
        ├── research-issue.md     ← /research-issue 슬래시 커맨드
        └── prepare-pr.md         ← /prepare-pr 슬래시 커맨드
```

`AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md` 없음.

---

## CLAUDE.md — 협업 원칙

### 안티-아부(Anti-Sycophancy) 규칙

파일 최상단에 위치:

```markdown
## Collaboration Principles

**Be honest and objective**: Evaluate all suggestions, ideas, and feedback on their
technical merits. Don't be overly complimentary or sycophantic. If something doesn't
make sense, doesn't align with best practices, or could be improved, say so directly
and constructively. Technical accuracy and project quality take precedence over being
agreeable.
```

추가 강화:
```markdown
Whenever we work together on a task, feel free to challenge my assumptions and ideas
and be critical if useful.
```

**이 규칙이 금지하는 AI 행동**:
- "Great question!" 같은 칭찬
- 사용자 의견에 무조건 동의
- 기술적으로 잘못된 방향을 "좋은 아이디어"라고 포장

**왜 첫 번째 섹션인가**: AI의 기본 동작(아첨)이 가장 먼저 재설정되어야 하기 때문이다.

---

## 테스팅 철학 — Mock 최소화 + 금지 영역

```markdown
When writing tests keep mocking to a bare minimum. Code should be written in a way
that is easily testable and if I/O is necessary, it should be done in appropriate
temporary directories.
Never mock anything that is inside `packages/foam-vscode/src/core/`.
```

### 핵심 규칙 3개

**1. Mock 최소화**: "bare minimum" — AI는 자연스럽게 mock을 많이 사용하므로 명시적 제약 필요.

**2. core/ 모킹 금지 영역**: `packages/foam-vscode/src/core/`는 절대 mock하지 않는다.
- core 모듈은 순수 비즈니스 로직
- 이 모듈이 mock 없이 테스트 가능하도록 설계 강제
- AI가 "편의상" core를 mock하는 것을 완전히 차단

**3. 기대값 수정 금지**:
```markdown
Never fix a test by adjusting the expectation — fix the code instead.
```
AI가 테스트 실패를 "테스트를 약화"하여 해결하는 것을 금지.

### 테스트 유틸리티 표준

```markdown
Use shared utilities: test-utils.ts, test-utils-vscode.ts, test-datastore.ts
Set up and tear down within the test case itself (avoid beforeEach unless clearly better)
```

---

## 커스텀 슬래시 커맨드

### /research-issue

이슈 조사 자동화 워크플로우:

```markdown
1. gh 명령어로 이슈 상세 가져오기
2. 코드베이스 검색으로 관련 파일 탐색
3. 근본 원인 파악
4. 두 가지 순위 매긴 해결책 제안
5. 결과를 .agent/tasks/<issue-id>-<title>.md 에 저장
```

**에이전트 작업 지속성**: 조사 결과가 `.agent/tasks/` 폴더에 저장되어 세션 간 유지된다.

### /prepare-pr

PR 제목 + 설명 생성, 엄격한 제약:

```markdown
- **100–200 단어 총량**
- **"No filler or pleasantries"** — 또 다른 안티-아부 신호
- **"No file names or 'updated X file' statements"**
- 능동태, WHAT과 WHY 집중
```

`"No filler or pleasantries"` — CLAUDE.md의 협업 원칙을 슬래시 커맨드 수준에서도 반복한다.

---

## 연구→계획→구현→검증 워크플로우

CLAUDE.md가 정의하는 전체 작업 흐름:

```
1. Research   → 코드베이스 탐색, 유사 패턴 파악
2. Plan       → .agent/current-plan.md 에 계획 저장
3. Implement  → 최소 변경, 기존 패턴 준수
4. Validate   → 테스트 실행 확인 (실패 먼저)
```

**계획 지속성**: `.agent/current-plan.md`에 계획을 저장하여 세션 중단 후 재개 가능.

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| 안티-아부 | 파일 최상단에 "technical accuracy > agreeableness" |
| Mock 금지 영역 | core/ 디렉토리는 절대 mock 금지 |
| 기대값 수정 금지 | "Never fix a test by adjusting the expectation" |
| 슬래시 커맨드 | .claude/commands/ 로 반복 워크플로우 구조화 |
| 에이전트 작업 지속성 | .agent/ 폴더에 조사/계획 저장 |
| PR 품질 제약 | 단어 수 제한 + 불필요한 말 금지 |

---

## 요약

foambubble/foam의 AI 최적화에서 가장 강력한 혁신은 **안티-아부 규칙**이다. AI의 기본 동작인 아첨/동의를 파일 최상단에서 재설정하고, 기술적 비판을 장려한다. `core/` 모킹 금지와 기대값 수정 금지 규칙은 AI가 "편의적 테스트 약화"를 하지 못하도록 막는다. 슬래시 커맨드로 반복 워크플로우를 구조화하여 AI 상호작용을 일관되게 만든다.

| 지표 | 값 |
|------|-----|
| AI 설정 파일 수 | CLAUDE.md + 2개 슬래시 커맨드 |
| 지원 AI 도구 | Claude Code |
| 핵심 혁신 | 안티-아부 규칙 + core/ mock 금지 영역 |
| 슬래시 커맨드 | /research-issue, /prepare-pr |
| 에이전트 지속성 | .agent/ 폴더 (작업/계획 저장) |
