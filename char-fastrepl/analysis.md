# fastrepl/char — AI 최적화 분석

> **GitHub**: https://github.com/fastrepl/char  
> **License**: GPL-3.0  
> **분류**: 🥈 기본 AI 최적화 (전체 프로젝트 AGENTS.md 맵)

---

## 프로젝트 개요

Char는 Tauri 기반 데스크톱 노트 앱입니다. TinyBase를 메인 데이터 스토어로 사용하며,
TipTap 에디터와 Zustand 상태 관리를 활용합니다. 전체 프로젝트의 AGENTS.md 파일을
체계적으로 문서화하는 독특한 접근법을 갖고 있습니다.

---

## AI 최적화 구성 요소

### 1. 전체 AGENTS.md 맵 문서화

프로젝트에는 모든 AGENTS.md 파일의 위치를 나열하는 전용 문서 페이지가 있습니다:

```markdown
# 모든 AGENTS.md 파일 위치

| 경로 | 링크 |
|-----|------|
| .github/AGENTS.md | View |
| AGENTS.md | View |
| apps/api/AGENTS.md | View |
| apps/desktop-e2e/AGENTS.md | View |
| apps/web/AGENTS.md | View |
| apps/web/content/changelog/AGENTS.md | View |
| crates/notification-linux/AGENTS.md | View |
| plugins/AGENTS.md | View |
| plugins/hooks/AGENTS.md | View |
```

→ AI가 어떤 AGENTS.md가 존재하는지 한 눈에 파악 가능

---

### 2. 루트 AGENTS.md (간결하고 효율적)

```markdown
# Overview

Tauri desktop note-taking app (`apps/desktop/`) with a web app (`apps/web/`).
Uses pnpm workspaces.
TinyBase as the primary data store (schema at `packages/store/src/tinybase.ts`), 
Zustand for UI state, TipTap for the editor. 
Sessions are the core entity — all notes are backed by sessions.

## Commands

- Format: `pnpm exec dprint fmt`
- Typecheck (TS): `pnpm -r typecheck`
- Typecheck (Rust): `cargo check`
- Desktop dev: `pnpm -F @hypr/desktop tauri:dev`
- Web dev: `pnpm -F @hypr/web dev`
- Dev docs: https://char.com/docs/developers

## Guidelines

- Format via dprint after making changes.
- Run `pnpm -r typecheck` after TypeScript changes, `cargo check` after Rust changes.
- Use `useForm` (tanstack-form) and `useQuery`/`useMutation` (tanstack-query).
  Avoid manual state management (e.g. `setError`).
- Branch naming: `fix/`, `chore/`, `refactor/` prefixes.

## Code Style

- Avoid creating types/interfaces unless shared. Inline function props.
- Do not write comments unless code is non-obvious. Comments should explain "why", not "what".
- Use `cn` from `@hypr/utils` for conditional classNames. Always pass an array, 
  split by logical grouping.
- Use `motion/react` instead of `framer-motion`.

## Misc

- Do not create summary docs or example code files unless requested.
```

---

### 3. 코드 스타일 원칙 분석

**간결성 우선:**
```
- 공유되지 않으면 types/interfaces 생성 금지 → 함수 props 인라인
- 코드가 자명하면 주석 금지 → "why" 설명, "what" 설명 금지
- 요청 없으면 요약 문서/예제 파일 생성 금지
```

**상태 관리 명시:**
```
- useForm (tanstack-form) + useQuery/useMutation (tanstack-query) 사용
- 수동 상태 관리 (setError 등) 금지
```

**라이브러리 대체:**
```
- framer-motion → motion/react 사용
- 이유: 더 가볍고 최신
```

---

### 4. 플러그인 AGENTS.md 구조

```markdown
# plugins/AGENTS.md
플러그인 시스템 아키텍처 설명
- 플러그인 인터페이스
- 훅 시스템 참조

# plugins/hooks/AGENTS.md  
훅 시스템 상세 가이드
- 훅 타입
- 등록 방법
- 이벤트 처리
```

---

## 핵심 인사이트

### "요청 없으면 생성 금지" 패턴

```markdown
Do not create summary docs or example code files unless requested.
```

이는 AI가 불필요한 파일을 생성하는 흔한 문제를 해결:
- AI가 종종 설명용 문서, README, 예제를 자동으로 생성
- 이 규칙으로 요청 없는 파일 생성 방지

### "Inline Props" 스타일 원칙

```markdown
Avoid creating types/interfaces unless shared. Inline function props.
```

공유되지 않는 타입은 인라인으로 처리하는 명시적 규칙.
AI가 불필요한 타입 추상화를 과도하게 만드는 것 방지.

### AGENTS.md 맵 문서화

전체 프로젝트의 AGENTS.md 파일 위치를 개발자 문서 사이트에 공개적으로 나열.
→ AI와 인간 개발자 모두 어떤 가이드가 어디에 있는지 즉시 파악 가능.

---

## 배울 점

1. **전체 AGENTS.md 맵** — 모든 AI 지침 파일 위치를 문서 사이트에서 한눈에 보기
2. **"요청 없으면 생성 금지"** — AI의 불필요한 파일 생성 방지
3. **인라인 Props 규칙** — 과도한 추상화 방지
4. **주석은 Why만** — "코드가 무엇을 하는지"가 아닌 "왜 그렇게 했는지"만 설명
5. **라이브러리 대체 명시** — framer-motion → motion/react 같은 명시적 마이그레이션 가이드
