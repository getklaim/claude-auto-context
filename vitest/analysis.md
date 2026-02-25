# vitest-dev/vitest — AI 최적화 분석

> **GitHub**: https://github.com/vitest-dev/vitest  
> **Stars**: 14k+  
> **핵심 패턴**: Hub-and-Spoke 위임 모델 — tool-specific stub → AGENTS.md 단일 진실 원천

---

## 개요

Vitest는 Vite 기반의 차세대 테스트 프레임워크로, 15개 이상의 패키지를 포함한 pnpm 모노레포다.  
AI 최적화 전략은 **극도의 단순함**에 있다: 각 AI 도구는 9줄짜리 스텁 파일을 읽고, 즉시 `AGENTS.md`로 리다이렉트된다.

---

## 파일 구조

```
vitest/
├── AGENTS.md                          ← 단일 진실 원천 (canonical source)
├── CLAUDE.md                          ← Claude Code용 스텁 (9줄, AGENTS.md 위임)
├── .github/
│   ├── copilot-instructions.md        ← GitHub Copilot용 스텁 (9줄, AGENTS.md 위임)
│   ├── commit-convention.md           ← Angular-style 커밋 컨벤션
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/
```

`.cursorrules` 없음. Cursor는 명시적으로 지원하지 않음.

---

## Hub-and-Spoke 위임 패턴

### 아키텍처

```
.github/copilot-instructions.md  ──┐
                                    ├──► AGENTS.md  (단일 진실 원천)
CLAUDE.md                          ──┘
```

### 스텁 파일 구조 (공통, 9줄)

**`.github/copilot-instructions.md`:**
```markdown
# copilot-instructions.md

This file provides guidance to Copilot Agent when working with code in this repository.

## Codebase Overview

Vitest is a next-generation testing framework powered by Vite. This is a monorepo using pnpm workspaces.

## Essential references

- Agent-specific guide: See [AGENTS.md](../AGENTS.md)
```

**`CLAUDE.md`:**
```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Codebase Overview

Vitest is a next-generation testing framework powered by Vite. This is a monorepo using pnpm workspaces.

## Essential references

- Agent-specific guide: See [AGENTS.md](AGENTS.md)
```

두 파일은 **구조가 동일**하다. 차이점은 첫 줄의 도구 이름("Copilot Agent" vs "Claude Code")과 AGENTS.md 경로(`../AGENTS.md` vs `AGENTS.md`)뿐이다.

---

## AGENTS.md — 실제 내용

```markdown
# Vitest AI Agent Guide

## Project Overview
- Language: TypeScript/JavaScript (ESM-first)
- Package Manager: pnpm (required)
- Node Version: ^20.0.0 || ^22.0.0 || >=24.0.0
- Build System: Vite + Rollup
- Monorepo Structure: 15+ packages in `packages/` directory

## Setup and Development
### Initial Setup
1. Run `pnpm install`
2. Run `pnpm build`
3. Install Playwright browsers: `npx playwright install --with-deps`

### Key Scripts
- `pnpm build` / `pnpm dev` / `pnpm lint` / `pnpm lint:fix` / `pnpm typecheck`

## Testing
### Running Tests
- All tests: `CI=true pnpm test:ci`
- Specific suite: `CI=true cd test/<test-folder> && pnpm test <test-file>`
- Browser tests: `CI=true pnpm test:browser:playwright`

### ⚠️ Critical Testing Conventions
- **AVOID `toContain`** for validation — prefer `toMatchInlineSnapshot` to capture error + stack
- If snapshot fails → **update the snapshot**, do NOT revert to `toContain`
- **No mocking policy** — NEVER mock anything in tests
- Use `runInlineTests` from `test/test-utils/index.ts` for complex file system setups (>1 file)
- Use `runVitest` from `test/test-utils/index.ts` to run Vitest programmatically

## Code Style
- Always run `pnpm lint:fix` after changes
- Use utilities from `@vitest/utils/*` — NEVER import from `@vitest/utils` main entry directly
- Do NOT add comments explaining what a line does unless prompted

## Common Workflows
### Adding New Features
1. Identify package in `packages/`
2. Follow existing patterns
3. Add tests
4. Run `pnpm build && pnpm typecheck && pnpm lint:fix`

### Documentation
- When adding CLI options: run `pnpm -C docs run cli-table` to update `cli-generated.md`
```

---

## 핵심 AI 최적화 패턴 분석

### 1. 위임(Delegation) 기반 DRY 원칙

**문제**: 여러 AI 도구(Copilot, Claude Code, Cursor 등)를 지원하면 같은 내용을 여러 파일에 중복 유지해야 한다.

**해법**: 모든 실질적 내용을 `AGENTS.md`에 두고, 도구별 파일은 9줄짜리 스텁으로 유지. 내용이 변경되면 `AGENTS.md` 하나만 수정하면 된다.

```
Without delegation (bad):
  CLAUDE.md          → 500줄 (전체 내용)
  copilot-instructions.md → 500줄 (동일 내용)
  ✕ 중복, 유지보수 비용 2배

With delegation (vitest):
  CLAUDE.md          → 9줄  (스텁 + 링크)
  copilot-instructions.md → 9줄  (스텁 + 링크)
  AGENTS.md          → 실제 내용
  ✓ 단일 진실 원천, 유지보수 비용 최소화
```

### 2. 안티패턴 명시적 금지

vitest AGENTS.md의 테스팅 규칙은 `⚠️ Critical Testing Conventions` 섹션으로 명시적 경고와 함께 금지 사항을 나열한다:

| 금지 | 대신 | 이유 |
|------|------|------|
| `toContain` | `toMatchInlineSnapshot` | 에러 메시지 + 스택 전체를 캡처해야 함 |
| Mock 사용 | 실제 구현 사용 | "No mocking policy" |
| `@vitest/utils` 직접 import | `@vitest/utils/*` sub-entry 사용 | 번들 최적화 규칙 |
| 코드 설명 주석 | 없음 | 불필요한 소음 제거 |

이는 **AI가 저지르는 알려진 실수**를 사전에 차단하는 패턴이다. 일반적으로 AI는 `toContain`을 선호하고, 테스트에서 mock을 자주 사용하므로, 이를 명시적으로 금지함으로써 프로젝트 규약에 맞는 코드를 생성하도록 유도한다.

### 3. 스냅샷 우선 철학

```
If snapshot fails → update the snapshot, do NOT revert to `toContain`
```

일반적 AI 행동: 테스트 실패 시 assertion을 약화(toContain으로 변경)  
vitest 규약: 테스트 실패 시 스냅샷을 업데이트

이 한 줄이 AI의 "편의를 위한 assertion 약화" 패턴을 방지한다.

### 4. 도구 인식 파일명

- `CLAUDE.md` → Claude Code가 자동으로 읽음
- `.github/copilot-instructions.md` → GitHub Copilot이 자동으로 읽음
- `AGENTS.md` → Claude Code, Cursor, Codex 등 범용 표준

각 AI 도구의 파일명 컨벤션을 알고, 모든 도구가 같은 지식 베이스(AGENTS.md)로 유도된다.

### 5. 모노레포 컨텍스트 명시

```markdown
- Monorepo Structure: 15+ packages in `packages/` directory
```

AI가 모노레포에서 작업할 때 자주 저지르는 실수(루트에서 잘못된 패키지 수정, pnpm workspace 무시 등)를 방지하기 위해 첫 줄부터 모노레포 구조를 명시한다.

---

## 커밋 컨벤션 — AI 컨텍스트 주입

`.github/commit-convention.md`는 Angular-style 커밋 스펙을 포함한다:

```
/^(revert: )?(feat|fix|docs|dx|refactor|perf|test|workflow|build|ci|chore|types|wip|release|deps)(\(.+\))?: .{1,50}/
```

이 파일은 AI 파일에서 직접 링크되지 않지만 `CONTRIBUTING.md`에서 참조되며, copilot-instructions.md가 읽히는 컨텍스트에서 자동으로 포함될 수 있다.

---

## 학습 포인트 (다른 프로젝트 적용 시)

| 패턴 | 구현 방법 |
|------|----------|
| Hub-and-Spoke 위임 | 도구별 스텁 + AGENTS.md 단일 원천 |
| 안티패턴 금지 | `⚠️ Critical` 섹션 + 구체적 대안 제시 |
| 스냅샷 철학 | assertion 약화 금지 규칙 명시 |
| 모노레포 명시 | 첫 줄에 "Monorepo Structure" 선언 |
| 스텁 최소화 | 9줄 = 도구 식별 + 프로젝트 한 줄 설명 + 링크 |

---

## 요약

vitest의 AI 최적화는 **"적을수록 좋다(Less is more)"** 원칙의 정수다.  
도구별 파일을 9줄로 유지하고, 실제 지식은 AGENTS.md 하나에 집중한다.  
특히 테스팅 프레임워크 특성상 AI의 "편의적 assertion 약화" 패턴을 명시적으로 차단하는 것이 가장 강력한 인사이트다.

| 지표 | 값 |
|------|-----|
| AI 설정 파일 수 | 3개 (AGENTS.md, CLAUDE.md, copilot-instructions.md) |
| 스텁 크기 | 9줄 |
| AGENTS.md 크기 | ~50줄 (간결함 유지) |
| 지원 AI 도구 | GitHub Copilot, Claude Code (+ Cursor via AGENTS.md) |
| 핵심 전략 | Hub-and-Spoke 위임 + 안티패턴 명시 금지 |
