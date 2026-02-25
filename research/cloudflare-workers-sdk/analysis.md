# cloudflare/workers-sdk — AI 최적화 분석

> **GitHub**: https://github.com/cloudflare/workers-sdk  
> **Stars**: 3.8k  
> **핵심 패턴**: "WHERE TO LOOK" 태스크-to-경로 테이블 + 계층적 서브패키지 AGENTS.md + AI 권한 잠금(opencode.json) + Cloudflare AI Gateway 도그푸딩

---

## 개요

cloudflare/workers-sdk는 Wrangler CLI, Miniflare 런타임 시뮬레이터, Create-Cloudflare 등을 포함하는 모노레포다.  
AI가 모노레포에서 가장 많이 범하는 실수 — **"어디서 시작해야 할지 모름"** — 를 **"WHERE TO LOOK" 테이블**로 직접 해결한다. 또한 `opencode.json`으로 AI 세션의 **보안 권한을 잠근다**.

---

## 파일 구조

```
cloudflare/workers-sdk/
├── AGENTS.md                              ← 루트 (WHERE TO LOOK 테이블 포함)
├── CLAUDE.md                              ← Claude Code: @AGENTS.md 리다이렉트
├── .github/
│   └── opencode.json                      ← AI 권한 설정 (bash: deny, webfetch: deny)
└── packages/
    ├── wrangler/
    │   └── AGENTS.md                      ← Wrangler 특화 규칙
    ├── miniflare/
    │   └── AGENTS.md                      ← Miniflare 특화 규칙
    ├── create-cloudflare/
    │   └── AGENTS.md                      ← 템플릿 제외 규칙
    ├── vite-plugin-cloudflare/
    │   └── AGENTS.md                      ← tsdown vs tsup 규칙
    ├── vitest-pool-workers/
    │   └── AGENTS.md                      ← 3-컨텍스트 아키텍처
    └── workers-utils/
        └── AGENTS.md                      ← 테스트 헬퍼 API 문서
```

---

## CLAUDE.md — 단일 줄 리다이렉트

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See @AGENTS.md
```

`@AGENTS.md` 참조 문법으로 모든 실질적 내용을 AGENTS.md에 위임한다.

---

## 핵심 혁신: "WHERE TO LOOK" 테이블

루트 `AGENTS.md`의 가장 주목할 패턴:

```markdown
| Task                                           | Location                                       | Notes                                                            |
| ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| Add/modify a CLI command                       | `packages/wrangler/src/`                       | Commands registered in `src/index.ts` (2k+ line yargs tree)      |
| Change local dev behavior                      | `packages/miniflare/src/`                      | `src/index.ts` is the main `Miniflare` class                     |
| Modify Workers runtime simulation              | `packages/miniflare/src/workers/`              | ~30 embedded worker scripts, built via `worker:` virtual imports |
| Add a test fixture                             | `fixtures/`                                    | Each fixture is a full workspace member with own `package.json`  |
| Shared config types/validation                 | `packages/workers-utils/src/config/`           | `validation.ts` is the config normalizer (large file)            |
| Test helpers (runInTempDir, seed, mockConsole) | `packages/workers-utils/src/test-helpers/`     | Shared across wrangler, miniflare, others                        |
| Cloudflare API mocks for tests                 | `packages/wrangler/src/__tests__/helpers/msw/` | MSW handlers per API domain                                      |
| CI workflows                                   | `.github/workflows/`                           | `test-and-check.yml` is the primary gate                         |
| Build/deploy scripts                           | `tools/deployments/`                           | Validation + deployment helpers                                  |
| Changeset config and rules                     | `.changeset/README.md`                         | Must read before creating changesets                             |
```

### 왜 이 테이블이 혁신적인가

기존 AGENTS.md 패턴:
```
디렉토리 구조 설명 → AI가 이해는 하지만 "어디서 시작?"은 여전히 불명확
```

WHERE TO LOOK 패턴:
```
태스크(Intent) → 정확한 경로 + 함정 메모
```

AI 에이전트가 실제로 묻는 질문 — "CLI 커맨드 추가하려면 어디?"  — 에 직접 답한다.  
특히 **함정 메모**(e.g., "2k+ line yargs tree")가 AI가 잘못된 파일을 열어 컨텍스트를 낭비하는 것을 방지한다.

---

## opencode.json — AI 권한 잠금

```json
{
  "$schema": "https://opencode.ai/config.json",
  "disabled_providers": ["opencode"],
  "enabled_providers": ["cloudflare-ai-gateway"],
  "provider": {
    "cloudflare-ai-gateway": {
      "models": {
        "anthropic/claude-sonnet-4-5": {}
      }
    }
  },
  "permission": {
    "read": "allow",
    "edit": "allow",
    "glob": "allow",
    "grep": "allow",
    "bash": "deny",
    "task": "allow",
    "skill": "allow",
    "todoread": "allow",
    "todowrite": "allow",
    "webfetch": "deny"
  }
}
```

두 가지 주목할 설계:

### 1. 보안 퍼스트 권한 설정
- `bash: deny` — AI가 임의 쉘 명령 실행 불가
- `webfetch: deny` — AI가 외부 URL 접근 불가
- 읽기/편집/검색은 모두 허용 — 코딩 작업에 필요한 최소 권한만 부여

### 2. 자사 AI Gateway 도그푸딩
Cloudflare는 AI 코딩 세션을 자신들의 **Cloudflare AI Gateway**를 통해 라우팅한다. 이는:
- 자사 제품을 직접 사용하여 실제 사용 경험 수집
- 기본 opencode 제공자 대신 자체 인프라 사용
- `anthropic/claude-sonnet-4-5`를 Cloudflare Gateway를 통해 접근

---

## 계층적 서브패키지 AGENTS.md

### 설계 원칙: "루트 반복 금지"

각 패키지 AGENTS.md는 루트 규칙을 반복하지 않고, **해당 패키지에만 특화된 내용**만 담는다.

### 주요 서브패키지 AGENTS.md 내용

**`packages/wrangler/AGENTS.md`:**
- `cli.ts` ≠ 진짜 CLI 엔트리포인트임 명시 (`src/index.ts`가 실제 엔트리)
- 테스트 헬퍼 인벤토리 문서화

**`packages/miniflare/AGENTS.md`:**
```markdown
## Lint Status (Transitional)
ESLint rule X is currently disabled because of ongoing migration.
Do NOT re-enable it — this is intentional, not an oversight.
```
AI가 "비활성화된 lint 규칙을 고치려는" 잘못된 행동을 명시적으로 차단한다.

**`packages/vitest-pool-workers/AGENTS.md`:** 3-컨텍스트 아키텍처 문서화:
```
컨텍스트 1: Node.js 풀 프로세스 (vitest 코어 실행)
컨텍스트 2: Node.js 설정 (wrangler 설정 파싱)
컨텍스트 3: workerd worker (실제 테스트 코드 실행)
```
이 세 컨텍스트를 혼동하면 AI가 런타임 API를 잘못된 환경에서 사용한다.

---

## 루트 AGENTS.md 추가 패턴

### Anti-Patterns 섹션

```markdown
## Anti-Patterns

❌ Using `wrangler.config` type in tests (use test-specific types)
❌ Direct `process.env` access (use `ctx.env` from execution context)
❌ Importing from `miniflare` in `wrangler` source code
```

AI가 자주 범하는 실수들을 명시적으로 나열하고, 올바른 대안을 제시한다.

### Subdirectory Knowledge Index

```markdown
## Subdirectory Knowledge

For package-specific patterns, see:
- `packages/wrangler/AGENTS.md`
- `packages/miniflare/AGENTS.md`
- ...
```

루트 AGENTS.md가 모든 서브패키지 AGENTS.md 파일의 인덱스 역할을 하여, AI가 더 깊이 읽어야 할 파일을 알 수 있다.

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| WHERE TO LOOK 테이블 | 태스크(Intent) → 경로 + 함정 메모 |
| AI 권한 잠금 | opencode.json: bash/webfetch deny |
| 도그푸딩 | 자사 AI Gateway로 AI 세션 라우팅 |
| 계층적 AGENTS.md | 루트 + 패키지별 (반복 없이 델타만) |
| Anti-patterns 섹션 | 알려진 AI 실수 명시적 금지 |
| 과도기 상태 문서화 | "이 lint는 의도적으로 비활성화됨" |
| 서브디렉토리 인덱스 | 루트가 서브 AGENTS.md 파일 목록 제공 |

---

## 요약

cloudflare/workers-sdk의 AI 최적화에서 가장 강력한 혁신은 **WHERE TO LOOK 테이블**이다. 모노레포에서 AI의 가장 큰 문제(어디서 시작해야 할지 모름)를 태스크-to-경로 매핑으로 직접 해결한다. `opencode.json`의 권한 잠금과 Cloudflare AI Gateway 도그푸딩은 보안과 자사 제품 활용의 이중 효과를 낸다.

| 지표 | 값 |
|------|-----|
| AGENTS.md 파일 수 | 7개 (루트 + 6 서브패키지) |
| 지원 AI 도구 | Claude Code, 범용 AGENTS.md |
| 언어 | TypeScript/JavaScript |
| AI 권한 | bash: deny, webfetch: deny |
| 핵심 혁신 | WHERE TO LOOK 테이블 + 계층적 AGENTS.md |
| 추가 특이점 | Cloudflare AI Gateway 도그푸딩 |
