# roboflow/supervision — AI 최적화 분석

> **GitHub**: https://github.com/roboflow/supervision  
> **Stars**: 36.5k  
> **핵심 패턴**: 번호 매긴 라이프사이클 섹션 + 코딩 전 체크리스트 + 커밋 전 게이트 + 멀티 에이전트 팬아웃

---

## 개요

roboflow/supervision은 컴퓨터 비전 유틸리티 Python 라이브러리(YOLO, SAM 등 지원)다.  
AGENTS.md를 **개발 워크플로우 라이프사이클** 형태로 구성하여, AI가 단순한 스타일 가이드가 아닌 **순서가 있는 절차**를 따르도록 한다. `CLAUDE.md`는 `@AGENTS.md` 단일 포함(include)으로, 단일 진실 원천 패턴을 완벽하게 구현한다.

---

## 파일 구조

```
roboflow/supervision/
├── AGENTS.md                          ← 범용 AI 지시 (6개 번호 섹션)
├── CLAUDE.md                          ← Claude Code: 2줄 (@AGENTS.md import)
└── .github/
    └── copilot-instructions.md        ← GitHub Copilot: 이모지 섹션, 상세 구조
```

`.cursorrules`, Skills 폴더 없음.

---

## CLAUDE.md — @AGENTS.md Import

```markdown
# Claude Code Project Instructions

<!-- Imports AGENTS.md, which contains agent roles, behavioral rules, and coding constraints for this project. -->

@AGENTS.md
```

**전체 내용**: 주석 1줄 + `@AGENTS.md` 포함 지시어. Claude Code의 파일 포함 문법으로 AGENTS.md를 직접 로드한다. 주석이 *왜* import하는지 설명한다는 점이 특이하다 — AI 도구가 이 패턴을 처음 보더라도 이해할 수 있게 한다.

---

## AGENTS.md — 6개 번호 매긴 라이프사이클 섹션

```markdown
# Agent Guidelines for `supervision`

Behave like a senior contributor: precise, efficient, aligned with the project's
philosophy, and focused on maintainability and clarity.
```

### §1 Before You Code (코딩 전 체크리스트)

```markdown
## 1. Before You Code

- Read the task/issue thoroughly before acting.
- Identify missing information; ask **one targeted clarification question** if needed.
- Outline a step-by-step plan before making changes.
- Check whether the feature or fix already exists under a different name.
- Confirm alignment with the repository's architecture (`src/supervision/`).
```

5개 항목의 순서가 명시적이다:
1. 읽기 → 2. 한 가지 질문 → 3. 계획 수립 → 4. 중복 확인 → 5. 아키텍처 정렬 확인

**"ask one targeted clarification question"**: AI가 여러 질문을 한꺼번에 쏟아내는 것을 방지하는 명시적 제약.

### §2 Repository Conventions

```markdown
### Branching & Commits
- Branch from `develop` using prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`
- Use **conventional commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `test:`, `chore:`
- PRs must target the `develop` branch

### Code Style
- **Formatting and linting** enforced by **pre-commit**
  Hook chain: ruff-check, ruff-format, codespell, mdformat, prettier, pyproject-fmt
- **Type hints**: required on all new code
- **Docstrings**: Google Python docstring style. Required for all new functions and classes.
  Must include usage examples with primitive values so they serve as runnable documentation.
```

### §3 Implementing Features

```markdown
- Provide a minimal, clean implementation.
- Include type hints and Google-style docstrings with usage examples.
- All new functionality must be covered with tests, including edge cases.
- Ensure compatibility with core dependencies: NumPy, OpenCV, SciPy.
```

### §4 Fixing Bugs

```markdown
1. Reproduce and understand the root cause.
2. Write a test that reproduces the bug (it should fail before the fix).
3. Apply a minimal, targeted fix.
4. Verify the test passes and no other components break.
```

버그 수정의 순서를 1~4로 번호 매김. 특히 "먼저 테스트 작성 → 이후 수정" 순서를 강제한다.

### §5 Refactoring

```markdown
- Preserve behavior and API stability.
- Improve readability or performance.
- Avoid large, sweeping refactors unless explicitly requested.
```

### §6 Before You Commit (커밋 전 게이트)

```markdown
## 6. Before You Commit

Always run these before committing:

uv run pytest --cov=supervision
uv run pre-commit run --all-files
```

§1과 대칭적인 **"Before You Commit"** 게이트. 두 게이트 구조:
- `§1 Before You Code` → 계획/이해 게이트
- `§6 Before You Commit` → 검증 게이트

---

## .github/copilot-instructions.md — 이모지 섹션 구조

```markdown
# GitHub Copilot Instructions for Supervision

## 📚 Repository Overview
## 🏗️ Project Structure
## 🔧 Development Commands
## 💻 Code Conventions
## 🧪 Testing Requirements
## 📝 Documentation Requirements
## 🔍 Pull Request Reviews
## 🌿 Branching & Commits
## 🎯 Context-Aware Behavior
```

각 섹션에 이모지를 사용해 시각적 구분을 제공한다. 마지막 섹션 **🎯 Context-Aware Behavior**가 특히 주목할만하다:

```markdown
## 🎯 Context-Aware Behavior
- General dev tasks → AGENTS.md
- PR reviews → PR Review Guidelines in CONTRIBUTING.md
- Detailed processes → CONTRIBUTING.md
```

GitHub Copilot에게 상황에 따라 다른 문서를 참조하도록 라우팅 규칙을 제공한다.

---

## 멀티 에이전트 팬아웃 (Multi-Agent Fan-Out)

같은 `AGENTS.md`가 세 AI 시스템에서 소비된다:

```
Claude Code     → CLAUDE.md (@AGENTS.md) → AGENTS.md
GitHub Copilot  → copilot-instructions.md (AGENTS.md 참조) → AGENTS.md  
기타 에이전트   → AGENTS.md 직접 읽기
```

단일 진실 원천이 모든 AI 도구에 전달된다.

---

## 주목할 패턴 상세

### "한 가지 질문만" 규칙
```
ask **one targeted clarification question** if needed
```
일반적으로 AI는 불확실한 것들을 여러 질문으로 한꺼번에 쏟아낸다. 이 규칙이 사용자 경험을 개선한다.

### 버그 수정 TDD 강제
```
1. Write a test that reproduces the bug (it should fail before the fix).
2. Apply a minimal, targeted fix.
```
테스트 작성 먼저, 수정은 나중 — AI가 자연스럽게 TDD를 따르도록 순서를 명시한다.

### Docstring = 실행 가능한 문서
```
Must include usage examples with primitive values so they serve as runnable documentation.
```
AI가 작성하는 docstring에 예제를 포함하도록 강제. "runnable documentation"이라는 목적을 명시하여 AI가 의미 있는 예제를 작성하도록 유도한다.

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| 라이프사이클 섹션 | 스타일 가이드 대신 Before/During/After 워크플로우 |
| 코딩 전 체크리스트 | 5개 순서 있는 체크 항목 |
| 한 질문 규칙 | "one targeted question" 명시로 AI 대화 효율화 |
| 커밋 전 게이트 | §1(코딩 전)과 대칭되는 §6(커밋 전) |
| TDD 강제 | 버그 수정 순서를 1-4로 번호 매김 |
| 멀티 도구 팬아웃 | 단일 AGENTS.md → Claude/Copilot/기타 |
| Context-Aware 라우팅 | 상황별 다른 문서 참조 규칙 |

---

## 요약

roboflow/supervision의 AGENTS.md는 **"개발 워크플로우를 순서 있는 절차로 표현하는"** 패턴의 표준적 구현이다. 특히 코딩 전 체크리스트(§1)와 커밋 전 게이트(§6)의 대칭 구조, "한 가지 질문만" 규칙, TDD 강제 순서가 AI 상호작용 품질을 직접적으로 높인다.

| 지표 | 값 |
|------|-----|
| AI 설정 파일 수 | 3개 (AGENTS.md, CLAUDE.md, copilot-instructions.md) |
| AGENTS.md 구조 | 6개 번호 섹션 (라이프사이클) |
| 지원 AI 도구 | Claude Code, GitHub Copilot, 범용 |
| 언어 | Python (NumPy, OpenCV, SciPy) |
| 핵심 혁신 | 라이프사이클 게이트 구조 + 한 질문 규칙 |
