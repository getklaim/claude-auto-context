# wasp-lang/open-saas — AI 최적화 분석

> **GitHub**: https://github.com/wasp-lang/open-saas  
> **Stars**: 13,433  
> **설명**: "AI-ready with tailored AGENTS.md, skills, and Claude Code plugin"  
> **핵심 패턴**: 4계층 AI 컨텍스트 주입 — Cursor Rules + Claude Skills + 슬래시 커맨드 + MCP 서버 + llms.txt 생성 + `/review-ai-slop` 품질 게이트

---

## 개요

wasp-lang/open-saas는 Wasp 프레임워크 기반 AI-ready SaaS 보일러플레이트다. **Wasp는 DSL(도메인 특화 언어)** 이어서 AI 모델이 기본으로 알지 못한다. 이 문제를 해결하기 위해 4계층 AI 컨텍스트 주입 시스템을 구축했다. `claude-code-mds` 브랜치에서 Claude Code 특화 인프라가 활발히 개발 중이다.

---

## 파일 구조

### main 브랜치 (현재)
```
wasp-lang/open-saas/
└── template/app/
    └── .cursor/
        ├── rules/
        │   ├── wasp-overview.mdc          ← Wasp DSL 문법
        │   ├── project-conventions.mdc    ← import 규칙 + AI 실수 방지
        │   ├── database-operations.mdc    ← Prisma + Wasp operations
        │   ├── authentication.mdc         ← Auth 설정 + AuthUser 형태
        │   ├── ui-components.mdc          ← ShadCN 사용법
        │   ├── deployment.mdc             ← Fly.io 배포
        │   ├── advanced-troubleshooting.mdc
        │   └── possible-solutions-thinking.mdc  ← 메타프롬프트
        └── example-prompts.md             ← PRD/Plan 프롬프트 예시
```

### claude-code-mds 브랜치 (개발 중)
```
template/
├── CLAUDE.md                             ← 레포 기여자용 AI 가이드
├── app/
│   └── CLAUDE.md                         ← 사용자 앱용 컴팩트 참조
├── .claude/
│   ├── skills/
│   │   ├── adding-feature/
│   │   │   ├── SKILL.md                  ← 계획 필수 게이트
│   │   │   ├── database.md
│   │   │   ├── operations.md
│   │   │   ├── pages.md
│   │   │   ├── background-jobs.md
│   │   │   ├── kaizen-approach.md        ← 400줄 엔지니어링 철학
│   │   │   └── troubleshooting.md
│   │   ├── configuring-payments/
│   │   │   ├── SKILL.md
│   │   │   ├── stripe-automated-setup.md
│   │   │   └── scripts/
│   │   │       ├── check-stripe-config.sh
│   │   │       └── setup-stripe-products.sh
│   │   ├── deploying-app/SKILL.md
│   │   ├── seo-optimizer/SKILL.md
│   │   ├── setup-wizard/SKILL.md
│   │   └── validating-pre-deployment/SKILL.md
│   └── commands/
│       ├── open-saas-setup-wizard.md     ← /open-saas-setup-wizard
│       ├── deploy.md                     ← /deploy
│       └── review-ai-slop.md            ← /review-ai-slop (AI 코드 품질 게이트)
└── .mcp.json                             ← chrome-devtools + wasp-mcp-docs MCP
```

---

## 4계층 AI 컨텍스트 주입 시스템

### 계층 1: .cursor/rules/*.mdc — Cursor Always-On 컨텍스트

8개 `.mdc` 파일, 모두 `alwaysApply: true` (모든 Cursor 채팅에 자동 주입):

| 파일 | 내용 |
|------|------|
| `wasp-overview.mdc` | Wasp DSL 기초, 프로젝트 구조, `wasp.sh/llms.txt` 링크 |
| `project-conventions.mdc` | import 규칙, `#region` 그룹핑, 일반 패턴 |
| `database-operations.mdc` | Prisma 스키마 규칙, Wasp operations 패턴, enum import |
| `authentication.mdc` | Auth 설정, `AuthUser` 형태, `useAuth` 훅 사용법 |
| `ui-components.mdc` | ShadCN 설정, 새 컴포넌트 추가 방법 |
| `deployment.mdc` | Fly.io 배포 단계 |
| `advanced-troubleshooting.mdc` | 백그라운드 잡, 커스텀 HTTP API, 미들웨어 |
| `possible-solutions-thinking.mdc` | 메타프롬프트: "해결하기 전에 가능한 시나리오를 생각하라" |

**LLM 최적화 문서 링크** (wasp-overview.mdc에서):
```markdown
- Wasp 문서 (LLM 최적화): https://wasp.sh/llms.txt
- 전체 Wasp 문서 (LLM 최적화): https://wasp.sh/llms-full.txt
```

### 계층 2: .claude/skills/ — Claude Code 온디맨드 스킬

**adding-feature 스킬** — 계획 우선 게이트:
```markdown
**IMPORTANT:** Before implementing any feature, use the EnterPlanMode tool to:
1. Explore existing code patterns in the codebase
2. Design the implementation approach
3. Write a plan file for user approval and/or add tasks to the todo list

Only proceed with implementation after the user approves the plan.
```

**configuring-payments 스킬** — 실행 가능한 쉘 스크립트 번들:
```
scripts/
├── check-stripe-config.sh    ← Stripe 설정 검증
└── setup-stripe-products.sh  ← Stripe 상품 자동 설정
```

**kaizen-approach.md** — 400줄 엔지니어링 철학 문서 (AI 행동 지시로 프레임):
- Continuous Improvement (지속적 개선)
- Poka-Yoke (오류 방지)
- Standardized Work (표준화 작업)
- Just-In-Time development (적시 개발)

### 계층 3: .claude/commands/ — 슬래시 커맨드

#### /review-ai-slop — AI 코드 품질 게이트

```markdown
# Review AI Slop
Check the diff against main, and remove all AI generated slop introduced in this branch.

This includes:
- Extra comments that a human wouldn't add or is inconsistent with the rest of the file
- Extra defensive checks or try/catch blocks that are abnormal for that area of the codebase
- Casts to any (or as) to get around type issues
- Any other style that is inconsistent with the file

Report at the end with only a 1-3 sentence summary of what you changed.
```

**"AI 슬롭(slop)"** — AI가 생성하는 과도한 주석, 불필요한 방어적 코드, 타입 캐스팅을 제거하는 전용 커맨드. AI가 AI 자신의 코드를 심사한다.

#### /open-saas-setup-wizard, /deploy

설정 마법사와 배포를 구조화된 스텝으로 안내하는 커맨드.

### 계층 4: .mcp.json — MCP 서버

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    },
    "wasp-docs": {
      "command": "wasp-mcp-docs"
    }
  }
}
```

**wasp-mcp-docs** — Wasp 전용 커스텀 MCP 서버. CLAUDE.md 두 파일 모두에서 참조:
```
Use mcp__wasp-docs__find_docs to search Wasp/OpenSaaS docs
```

실시간 문서 조회로 AI가 Wasp API를 발명(hallucination)하는 것을 방지한다.

---

## CLAUDE.md 듀얼 구조

### template/CLAUDE.md (레포 기여자용)

```markdown
## LLM-optimized Documentation
If needed, ground yourself using the Wasp & Open SaaS documentation:
- https://wasp.sh/llms.txt
- https://docs.opensaas.sh/llms.txt

## MCP Documentation Lookup
- For specific lookups: Use `mcp__wasp-docs__find_docs` to search Wasp/OpenSaaS docs
```

레포 구조, Wasp import 컨벤션, operations 패턴, 데이터베이스 워크플로우 포함.

### template/app/CLAUDE.md (사용자 앱용)

```markdown
## Critical Files
Read these first to understand the app:
- main.wasp - App config: routes, pages, auth, operations, jobs
- schema.prisma - Database models and relationships
- src/payment/ - Payment processor integration
- src/auth/ - Authentication logic and pages

## Troubleshooting
| Error | Fix |
|-------|-----|
| `Cannot find module 'wasp/...'` | Use `wasp/`, not `@wasp/` |
| `context.entities.X undefined` | Add entity to `entities: [...]` in main.wasp |
| Types not updating | Restart Wasp server, then TS server |
```

컴팩트한 참조 카드 형태 — AI가 빠르게 필수 파일과 흔한 오류를 파악할 수 있다.

---

## llms.txt 생성 시스템

Astro 문서 사이트에서 AI 최적화 문서를 자동 생성:

```javascript
function cleanContent(content) {
  // import 문 제거
  cleaned = cleaned.replace(/^import\s+.*(?:from\s+['"].*['"])?;?\s*$/gm, "");
  // JSX 주석 제거
  cleaned = cleaned.replace(/^\{\/\*.*\*\/\}\s*$/gm, "");
  // 이모지 제거
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]|.../gu, "");
  // 박스 그리기 문자 제거
  cleaned = cleaned.replace(/[│├└─╔═╗║╚╝]/g, "");
  // 과도한 공백 줄임
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
}
```

출력: `https://docs.opensaas.sh/llms.txt`, `https://docs.opensaas.sh/llms-full.txt`

**CopyForLlmButton** — 문서 사이트의 각 페이지에 LLM 최적화 형식으로 복사하는 버튼.

---

## Wasp DSL → AI 컨벤션 전달 방법

Wasp는 AI가 모르는 DSL이다. 이를 해결하는 핵심 패턴:

### Import 오류 방지 테이블

```markdown
❌ `import { ... } from '@wasp/...'`   ← 구버전 API, AI가 자주 발명
✅ `import { Task } from 'wasp/entities'`  ← 올바른 경로
```

### 예시 프롬프트 (example-prompts.md)

**PRD 프롬프트**: 템플릿을 먼저 평가하고, 여러 접근법을 제안한 후 최선을 선택. "vertical slice implementation" 방식 사용.

**Plan 프롬프트**: 코딩 전 단계별 계획 작성, 기존 보일러플레이트 기능 고려, "잘 구조화되고 간결하며 실행 가능하게" 작성.

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| DSL 컨벤션 교육 | .cursor/rules/로 Wasp 문법 AI에 주입 |
| AI 슬롭 리뷰 | /review-ai-slop 커맨드로 AI 코드 품질 게이트 |
| MCP 문서 서버 | 커스텀 wasp-mcp-docs로 실시간 문서 조회 |
| 계획 필수 게이트 | SKILL.md: "EnterPlanMode 먼저, 사용자 승인 후 구현" |
| llms.txt 생성 | 문서 사이트에서 AI 최적화 문서 자동 생성 |
| 듀얼 CLAUDE.md | 기여자용 + 사용자 앱용 별도 파일 |
| 번들 스크립트 | 스킬 폴더에 실행 가능한 쉘 스크립트 포함 |

---

## 요약

wasp-lang/open-saas는 **"AI가 모르는 DSL을 가진 프레임워크를 AI 친화적으로 만드는"** 가장 완성된 사례다. Cursor rules, Claude Skills, 슬래시 커맨드, MCP 서버, llms.txt 생성의 4계층 시스템으로 AI가 Wasp를 올바르게 사용하도록 안내한다. `/review-ai-slop` 커맨드는 AI가 자신이 생성한 코드를 스스로 심사하는 독창적 품질 게이트다.

| 지표 | 값 |
|------|-----|
| Cursor rules 파일 수 | 8개 |
| Claude Skills 수 | 6개 |
| 슬래시 커맨드 수 | 3개 |
| MCP 서버 수 | 2개 (chrome-devtools, wasp-mcp-docs) |
| 지원 AI 도구 | Cursor, Claude Code |
| 핵심 혁신 | /review-ai-slop + 커스텀 MCP 서버 + 4계층 컨텍스트 |
