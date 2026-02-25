# openai/openai-agents-python — AI 최적화 분석

> **GitHub**: https://github.com/openai/openai-agents-python  
> **Stars**: 19.1k  
> **핵심 패턴**: 필수 스킬 호출 강제 + ExecPlan 살아있는 문서 프로토콜 + .agents/skills/ 실행 가능 스킬 + MCP 통합

---

## 개요

openai/openai-agents-python은 OpenAI Agents SDK의 공식 Python 구현이다.  
이 레포의 AI 최적화는 **"스킬 호출을 선택사항이 아닌 필수사항으로 만드는"** 가장 정교한 구현이다. 특정 작업을 수행할 때 `$code-change-verification`과 `$openai-knowledge` 스킬을 반드시 호출해야 하며, 이를 AGENTS.md에 명시적으로 강제한다.

---

## 파일 구조

```
openai/openai-agents-python/
├── AGENTS.md                              ← 필수 스킬 호출 규칙 포함
├── CLAUDE.md                              ← 1줄 리다이렉트 → AGENTS.md
├── PLANS.md                               ← ExecPlan 살아있는 문서 템플릿
├── .agents/
│   └── skills/
│       ├── code-change-verification/
│       │   ├── SKILL.md
│       │   └── scripts/run.sh            ← 실행 가능 검증 스크립트
│       ├── openai-knowledge/
│       │   └── SKILL.md
│       ├── pr-draft-summary/
│       │   └── SKILL.md
│       ├── docs-sync/
│       │   └── SKILL.md
│       ├── examples-auto-run/
│       │   └── SKILL.md
│       ├── final-release-review/
│       │   └── SKILL.md
│       └── test-coverage-improver/
│           └── SKILL.md
└── .github/
    └── codex/
        └── prompts/
            ├── pr-labels.md              ← Codex 전용 PR 레이블링 프롬프트
            └── release-review.md         ← Codex 전용 릴리스 리뷰 프롬프트
```

---

## CLAUDE.md — 단순 리다이렉트

```markdown
Read the AGENTS.md file for instructions.
```

모든 실질적 내용은 AGENTS.md에 있다.

---

## 필수 스킬 호출 — AGENTS.md 핵심 규칙

### 필수 호출 조건

**`$code-change-verification`** — 다음 파일 변경 시 **필수**:
- `src/agents/` (라이브러리 코드) 또는 공유 유틸리티
- `tests/` 또는 스냅샷 테스트
- `examples/`
- 빌드/테스트 설정: `pyproject.toml`, `Makefile`, `mkdocs.yml`, CI 워크플로우

**`$openai-knowledge`** — 다음 작업 시 **필수**:
- Responses API, 도구, 스트리밍, Realtime API, 인증, 모델, 요율 제한
- MCP, Agents SDK, ChatGPT Apps SDK

**`$pr-draft-summary`** — 상당한 코드 작업 완료 후 **필수**:
> "When reporting code changes as complete (after substantial code work), invoke `$pr-draft-summary` to generate the required PR summary block."

### 왜 "필수"인가

일반적 스킬 시스템: 스킬이 있고 AI가 필요할 때 사용  
openai-agents-python: 특정 조건을 만족하면 **반드시 스킬을 호출해야 작업 완료**

이 차이가 중요하다 — 스킬이 선택적 도구에서 필수적 체크포인트로 격상된다.

---

## ExecPlan 프로토콜 — PLANS.md

다단계/다중 파일 작업, 새 기능, 리팩토링, 1시간 이상 소요 작업에 필수.

### ExecPlan 필수 섹션

```markdown
## Purpose / Big Picture            ← 작업 목적
## Progress                         ← 체크박스 목록 + 타임스탬프 [LIVING]
## Surprises & Discoveries          ← 예상치 못한 발견 [LIVING]
## Decision Log                     ← 결정 사항 기록 [LIVING]
## Outcomes & Retrospective         ← 결과 및 회고 [LIVING]
## Context and Orientation          ← 배경 컨텍스트
## Plan of Work                     ← 작업 계획
## Concrete Steps                   ← 구체적 단계
## Validation and Acceptance        ← 수용 기준
## Idempotence and Recovery         ← 멱등성 및 복구 계획
## Artifacts and Notes              ← 산출물 및 메모
## Interfaces and Dependencies      ← 인터페이스 및 의존성
```

**LIVING 섹션**: Progress, Surprises, Decision Log, Outcomes — 작업 진행 중 실시간으로 업데이트해야 한다.

### ExecPlan 비협상 요구사항

- **자기 포함(Self-contained)**: 모든 용어 정의, 초보자도 이해 가능
- **살아있는 문서**: 작업 진행에 따라 계속 수정
- **결과 중심**: 관찰 가능한 수용 기준 명시
- **명시적 수용**: 명령어 + 예상 출력값 포함

---

## .agents/skills/ — 실행 가능한 스킬

### 스킬 디렉토리 (7개)

| 스킬 | 트리거 조건 |
|------|-----------|
| `$code-change-verification` | 런타임/테스트/빌드 파일 변경 시 |
| `$openai-knowledge` | OpenAI API/플랫폼 통합 작업 시 |
| `$pr-draft-summary` | 상당한 코드 작업 완료 후 |
| `$docs-sync` | 문서 커버리지 감사 또는 동기화 요청 시 |
| `$examples-auto-run` | 예제를 자동 모드로 실행할 때 |
| `$final-release-review` | 릴리스 전 검증 시 |
| `$test-coverage-improver` | 커버리지 회귀 또는 개선 요청 시 |

### code-change-verification SKILL.md + run.sh

```yaml
---
name: code-change-verification
description: Run the mandatory verification stack when changes affect runtime code,
  tests, or build/test behavior in the OpenAI Agents Python repository.
---
```

실행 스크립트 `scripts/run.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

make format
make lint
make mypy
make tests
echo "code-change-verification: all commands passed."
```

**스킬이 실행 가능한 코드**다 — 문서가 아닌 실제로 실행되는 검증 파이프라인.

### openai-knowledge SKILL.md 워크플로우

```markdown
1. MCP 도구 확인: mcp__openaiDeveloperDocs__* 도구 존재 여부 확인
2. search_openai_docs 호출: 관련 주제 검색
3. fetch_openai_doc 호출: 정확한 문서 가져오기
4. 가져온 텍스트에 기반하여 답변 — 필드명/기본값 절대 발명 금지
```

**MCP 통합**: 이 스킬은 AI 에이전트가 MCP를 설정했다고 가정한다. `mcp__openaiDeveloperDocs__*` 도구로 공식 문서에서 직접 정보를 가져온다.

### pr-draft-summary SKILL.md

자동으로:
1. git 상태 수집 (브랜치, diff, base 대비 커밋)
2. 변경 유형 추론
3. `"This pull request <verb> ..."` 로 시작하는 구조화된 PR 블록 생성

---

## .github/codex/prompts/ — Codex 전용 프롬프트

```
.github/codex/prompts/
├── pr-labels.md       ← PR 레이블링 자동화 프롬프트
└── release-review.md  ← 릴리스 리뷰 자동화 프롬프트
```

Codex가 특정 GitHub 자동화 작업을 할 때 사용할 맞춤 프롬프트. AGENTS.md의 범용 지시 외에 Codex 특화 작업 프롬프트를 별도로 관리한다.

---

## Public API 위치 호환성 규칙

```markdown
**Public API Positional Compatibility** — Treat parameter/field order of exported runtime APIs 
as a compatibility contract. No inserting new params in the middle of existing public order.
```

Python 라이브러리의 특성상 위치 인자 순서가 중요하다. AI가 새 파라미터를 기존 파라미터 사이에 삽입하는 breaking change를 방지한다.

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| 필수 스킬 호출 | "must invoke" 명시로 선택→필수 격상 |
| 실행 가능 스킬 | scripts/run.sh로 스킬이 실제 코드 실행 |
| ExecPlan 프로토콜 | 살아있는 문서 템플릿 (LIVING 섹션) |
| MCP 통합 | openai-knowledge 스킬이 MCP 도구 사용 |
| Codex 전용 프롬프트 | .github/codex/prompts/ 별도 관리 |
| 위치 호환성 보호 | 공개 API 파라미터 순서를 계약으로 취급 |
| PR 자동화 | pr-draft-summary 스킬로 PR 블록 자동 생성 |

---

## 요약

openai/openai-agents-python의 AI 최적화는 **"스킬을 체크포인트로 격상"**하는 패턴의 가장 완성된 구현이다. 실행 가능한 스크립트를 포함한 스킬, MCP 도구 통합, ExecPlan 살아있는 문서 프로토콜이 결합되어 AI가 구조화된 방식으로 복잡한 작업을 완수하도록 강제한다.

| 지표 | 값 |
|------|-----|
| 스킬 수 | 7개 (.agents/skills/) |
| 실행 가능 스킬 | code-change-verification (run.sh 포함) |
| ExecPlan 섹션 수 | 12개 (4개 LIVING) |
| 지원 AI 도구 | Claude Code, Codex, AGENTS.md 범용 |
| 핵심 혁신 | 필수 스킬 강제 + 실행 가능 스킬 + MCP 통합 |
