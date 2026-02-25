# vercel/next.js — AI 최적화 분석

> **GitHub**: https://github.com/vercel/next.js  
> **Stars**: ~130k  
> **License**: MIT  
> **분류**: 🏆 최고 수준 AI 최적화 (프레임워크 레벨)

---

## 프로젝트 개요

Next.js는 React 기반 웹 프레임워크입니다. 2025년부터 AI 코딩 도구 최적화에 매우 적극적으로 투자하여,
AI 에이전트가 항상 정확한 버전별 문서를 참조하도록 하는 혁신적인 시스템을 구축했습니다.

---

## AI 최적화 구성 요소

### 1. AGENTS.md = CLAUDE.md 심링크 전략

```bash
# CLAUDE.md는 AGENTS.md의 심링크
CLAUDE.md → AGENTS.md  # 동일한 파일
```

> **Note:** `CLAUDE.md` is a symlink to `AGENTS.md`. They are the same file.

**의도**: Claude Code 사용자는 `CLAUDE.md`를, 다른 도구 사용자는 `AGENTS.md`를 읽도록.
둘 다 정확히 같은 내용을 가리키므로 중복 없음.

---

### 2. 버전 일치 번들 문서 시스템 (혁신적!)

```
node_modules/next/dist/docs/
```

`next` 패키지 설치 시 버전과 일치하는 문서가 `node_modules/next/dist/docs/`에 번들됨.
AI 에이전트가 훈련 데이터의 오래된 정보 대신, 설치된 버전의 정확한 문서를 참조하도록 지시.

**AGENTS.md에서 지시:**
```markdown
Before writing any code, read the relevant bundled docs at node_modules/next/dist/docs/
```

**create-next-app으로 자동 생성:**
```bash
npx create-next-app@latest my-app
# → AGENTS.md 자동 생성 (번들 문서 참조 포함)
# → CLAUDE.md 자동 생성 (AGENTS.md 심링크)
```

---

### 3. Skills 시스템 (`.agents/skills/`)

Next.js는 `.agents/skills/` 디렉토리에 전문화된 스킬 파일 보유:

```
.agents/skills/
├── pr-status-triage/SKILL.md   - CI 실패 및 PR 리뷰 트리아지
├── flags/SKILL.md              - Feature flag 배선
├── dce-edge/SKILL.md           - DCE-safe require() 패턴
├── react-vendoring/SKILL.md    - React 벤더링 규칙
├── runtime-debug/SKILL.md      - 런타임 디버깅
└── authoring-skills/SKILL.md   - 스킬 작성/유지보수 방법
```

**스킬 사용 예시 (AGENTS.md에서):**
```markdown
## Specialized Skills
- `$pr-status-triage` - CI failure triage with scripts/pr-status.js
- `$flags` - feature-flag wiring across config/schema/define-env/runtime env
- `$dce-edge` - DCE-safe require() patterns and edge/runtime constraints
- `$react-vendoring` - entry-base.ts boundaries and React type/runtime rules
- `$runtime-debug` - runtime-bundle/module-resolution regression reproduction
- `$authoring-skills` - how to create and maintain skills in .agents/skills/
```

**스킬 파일 구조 예시 (pr-status-triage/SKILL.md):**
```markdown
---
name: pr-status-triage
description: >
  Triage CI failures and PR review comments using scripts/pr-status.js.
  Use when investigating failing CI jobs, flaky tests, or PR review feedback.
---

# PR Status Triage
## Workflow
1. Run `node scripts/pr-status.js` (or `node scripts/pr-status.js <number>`)
2. Read generated files in `scripts/pr-status/`
3. Prioritize blocking jobs first: build, lint, types, then test jobs
```

---

### 4. 빠른 로컬 개발 루프 (AI 에이전트용)

**기본 에이전트 규칙:**
```
만약 Next.js 소스나 통합 테스트를 변경한다면, 편집 시작 전에 별도 터미널에서
pnpm --filter=next dev를 시작하라 (이미 실행 중이 아니라면).
```

**빠른 반복 루프:**
```bash
# 1. 백그라운드 워치 빌드 시작 (변경 시 ~1-2초 재빌드)
pnpm --filter=next dev

# 2. 테스트를 빠르게 (격리 없음, 패킹 없음)
NEXT_SKIP_ISOLATE=1 NEXT_TEST_MODE=dev pnpm testonly test/path/to/test.ts

# 3. 타입 에러만 확인 (~10초, 전체 빌드 ~60초 대신)
pnpm --filter=next types
```

---

### 5. 테스트 명령어 (비대화형 AI용)

```bash
# 테스트 생성 (비대화형 모드 - AI 에이전트용)
pnpm new-test --args true my-feature e2e
# Format: pnpm new-test --args <appDir> <name> <type>
```

**테스트 출력 분석:**
```bash
# 한 번 실행 후 저장
HEADLESS=true pnpm test-dev-turbo test/path/to/test.ts > /tmp/test-output.log 2>&1

# 재실행 없이 분석
grep "●" /tmp/test-output.log            # 실패한 테스트
grep -A5 "Error:" /tmp/test-output.log   # 에러 세부사항
tail -5 /tmp/test-output.log             # 요약
```

---

### 6. PR 상태 자동화 스크립트

```bash
# PR CI 실패 자동 분석
node scripts/pr-status.js           # 현재 브랜치에서 PR 자동 감지
node scripts/pr-status.js <number>  # 특정 PR 번호 분석
```

결과를 `scripts/pr-status/`에 저장하여 AI가 참조.

---

### 7. 컨텍스트 효율적 워크플로우

**대용량 파일 읽기 (`>500줄`, 예: `app-render.tsx`):**
```markdown
- 관련 줄 번호를 먼저 grep으로 찾고 offset/limit으로 타겟 범위만 읽기
- 코드 변경 없이 동일 파일 섹션 재읽기 금지
- 생성 파일 (dist/, node_modules/, .next/): 읽지 말고 검색만
```

**빌드 & 테스트 출력:**
```markdown
- 한 번만 파일로 캡처: pnpm build 2>&1 | tee /tmp/build.log
- 동일 명령어 재실행 금지; 저장된 출력 재분석
```

**배치 편집:**
```markdown
- 여러 파일 관련 편집을 모아서 한 번의 빌드; 편집마다 빌드 금지
```

---

### 8. 핵심 런타임 규칙 (AI 안티패턴 가드)

```markdown
## Core Rules (Always Apply)
- 새 플래그: config-shared.ts에 타입 추가, config-schema.ts에 스키마,
  사용자 번들 코드에서 사용 시 define-env.ts 추가
- 사전 컴파일된 런타임 내부에서 플래그 사용 시 next-server.ts/export/worker.ts에도 배선
- define-env.ts는 사용자 번들링에 영향; 사전 컴파일된 런타임 번들 내부 제어 안 함
- DCE를 위한 require()는 compile-time if/else 브랜치 뒤에 유지 (early-return/throw 패턴 피하기)
- edge 빌드에서 Node-only import를 gate하는 feature flag는 define-env.ts에서 false로 강제
```

---

### 9. Secrets 안전 규칙 (AI에게 명시)

```markdown
## Secrets and Env Safety
- 환경 변수 값은 알려진 테스트 모드 플래그가 아니면 민감 정보로 취급
- 비밀 값(토큰, API 키, 쿠키) chat 응답, 커밋, 공유 로그에 출력/붙여넣기 금지
- CI env 이름과 모드는 그대로 미러; 실제 비밀 값 명령어에 인라인 금지
- 필요한 비밀이 로컬에 없으면 플레이스홀더 자격증명 발명하지 말고 사용자에게 확인
- 비밀 파일 커밋 금지; 환경 설정 문서화 시 플레이스홀더 예제만 사용
```

---

### 10. PR 및 커밋 스타일

```markdown
## Commit and PR Style
- "Generated with Claude Code" 또는 co-author 푸터 추가 금지
- 커밋 메시지는 간결하고 설명적으로
- PR은 draft 상태로 유지; 사용자가 직접 ready 표시
```

---

## 프로젝트 구조 (AI용 빠른 참조)

```
next.js/
├── packages/next/src/           - 메인 Next.js 소스 코드
│   ├── server/                  - 서버 런타임 (대부분 변경 여기)
│   ├── client/                  - 클라이언트 런타임
│   └── build/                   - 빌드 도구
├── turbopack/                   - Turbopack 번들러 (Rust)
├── test/
│   ├── e2e/                     - 엔드투엔드 테스트
│   ├── development/             - 개발 서버 테스트
│   ├── production/              - 프로덕션 빌드 테스트
│   └── unit/                    - 단위 테스트
└── .agents/skills/              - 전문화된 스킬 파일
```

---

## 핵심 인사이트

### 버전 일치 번들 문서 (가장 혁신적)

일반적인 문제: AI는 훈련 데이터의 오래된 API를 사용함.
Next.js의 해결책: `next` 패키지 설치 시 버전 일치 문서를 번들로 포함시키고,
AGENTS.md가 AI에게 그 번들 문서를 먼저 읽도록 지시.

**결과**: AI가 항상 설치된 버전에 맞는 정확한 API를 사용하게 됨.

### 비대화형 AI용 테스트 생성

`pnpm new-test --args` 같은 플래그로 AI가 대화형 프롬프트 없이 테스트를 생성할 수 있도록 설계.

### 중복 재실행 금지 패턴

AI 에이전트가 가장 낭비적으로 하는 행동 중 하나가 같은 명령어를 반복 실행하는 것.
Next.js AGENTS.md는 "한 번만 실행하고 저장된 출력을 분석하라"는 명시적 지침을 포함.

---

## 배울 점

1. **번들 문서 전략**: 패키지와 함께 AI용 문서를 번들링하여 항상 버전 일치 보장
2. **AGENTS.md = CLAUDE.md 심링크**: 중복 없이 모든 도구 지원
3. **Skills 시스템**: 복잡한 워크플로우(CI 트리아지, feature flag 배선)를 별도 스킬로 분리
4. **비대화형 명령어 설계**: AI 에이전트가 사용할 수 있는 `--args` 패턴
5. **캡처-분석 패턴**: 빌드/테스트 출력을 파일에 캡처하고 재분석 (재실행 방지)
