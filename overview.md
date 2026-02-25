# 바이브코딩 AI 최적화 오픈소스 프로젝트 총정리

> 리서치 날짜: 2026-02-25
> 발견한 프로젝트 수: 29개

바이브코딩(Vibe Coding)에 최적화된 오픈소스 프로젝트들을 수집하고 분석했습니다.
AI(Claude Code, Cursor, GitHub Copilot 등)가 더 잘 작동하도록 AGENTS.md, Skills, Hooks, .cursorrules 등을 활용한 방식을 정리합니다.

---

## 분류 체계

AI 최적화 방법은 크게 5가지 카테고리로 분류됩니다:

| 카테고리 | 설명 | 해당 파일 |
|---------|------|----------|
| **컨텍스트 파일** | AI에게 프로젝트 개요, 규칙, 구조를 알려주는 파일 | AGENTS.md, CLAUDE.md, copilot-instructions.md |
| **Skills (스킬)** | 특정 시나리오에서 로드하는 전문 지식 모듈 | .github/skills/*/SKILL.md, .agents/skills/ |
| **Hooks (훅)** | 코드 생성 전/후 이벤트 기반 실행 | Claude Code hooks system |
| **에이전트 정의** | 전문화된 AI 에이전트 역할 정의 | agents/*.md |
| **Cursor Rules** | Cursor AI 편집기용 커스텀 규칙 파일 | .cursorrules, .cursor/rules/*.mdc |

---

## 발견된 프로젝트 목록

### 🏆 최고 수준의 AI 최적화 (종합 점수 A)

| 프로젝트 | GitHub | 특징 |
|---------|--------|------|
| **oh-my-claudecode** | [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) | 28 에이전트 + 37 스킬 + 31 훅 + LSP 도구 통합 |
| **SuperClaude Framework** | [SuperClaude-Org/SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework) | 30 슬래시 커맨드 + 16 에이전트 + 7 행동 모드 |
| **vercel/next.js** | [vercel/next.js](https://github.com/vercel/next.js) | AGENTS.md=CLAUDE.md 심링크 + 번들 문서 + Skills 시스템 |

### 🥇 고도화된 AI 최적화 (종합 점수 B+)

| 프로젝트 | GitHub | 특징 |
|---------|--------|------|
| **promptfoo** | [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | 계층적 AGENTS.md + docs/agents/ 전용 문서 + Git 워크플로우 |
| **getsentry/sentry** | [getsentry/sentry](https://github.com/getsentry/sentry) | Context-aware AGENTS.md + Cursor .mdc 자동 로딩 |
| **tuist/tuist** | [tuist/tuist](https://github.com/tuist/tuist) | 모듈별 40+ AGENTS.md 파일 + 다운링크 시스템 |
| **pingcap/tidb** | [pingcap/tidb](https://github.com/pingcap/tidb) | .agents/skills/ + 상세 검증 매트릭스 + 비협상 원칙 |
| **meteor/meteor** | [meteor/meteor](https://github.com/meteor/meteor) | AGENTS.md + 6개 Skills (codebase/conventions/testing/packages/modern-tools/ai-context) |

### 🥈 기본 AI 최적화 (종합 점수 B)

| 프로젝트 | GitHub | 특징 |
|---------|--------|------|
| **microsoft/agent-framework** | [microsoft/agent-framework](https://github.com/microsoft/agent-framework) | .github/skills/ + 패키지별 AGENTS.md |
| **AzureAD/microsoft-identity-web** | [microsoft-identity-web](https://github.com/AzureAD/microsoft-identity-web) | Skills 오픈 표준 + copilot/claude 멀티 지원 |
| **NVIDIA/cuopt** | [NVIDIA/cuopt](https://github.com/NVIDIA/cuopt) | 도메인별 Skills (routing/LP/QP/debugging) |
| **fastrepl/char** | [fastrepl/char](https://github.com/fastrepl/char) | 전체 프로젝트 AGENTS.md 맵 + 간결한 규칙 |

### 📚 컬렉션/프레임워크 (종합 점수 A 특수)

| 프로젝트 | GitHub | 특징 |
|---------|--------|------|
| **PatrickJS/awesome-cursorrules** | [PatrickJS/awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) | 100+ .cursorrules 파일 컬렉션 |
| **danielmeppiel/awesome-ai-native** | [awesome-ai-native](https://github.com/danielmeppiel/awesome-ai-native) | PROSE 프레임워크 (AI Native 개발 방법론) |

### 💡 특수 접근법

| 프로젝트 | GitHub | 특징 |
|---------|--------|------|
| **grapeot/devin.cursorrules** | [grapeot/devin.cursorrules](https://github.com/grapeot/devin.cursorrules) | copilot-instructions.md를 스크래치패드+교훈 저장소로 활용 |
|| **huggingface/transformers** | [transformers](https://github.com/huggingface/transformers) | `@AGENTS.md` 1줄 CLAUDE.md + # Copied from 기계 강제 동기화 + 214개 modular_*.py |
|| **vitest-dev/vitest** | [vitest](https://github.com/vitest-dev/vitest) | Hub-and-Spoke 9줄 스텁 위임 + 테스팅 안티패턴 금지 |

|| **openai/codex** | [openai/codex](https://github.com/openai/codex) | 샌드박스 env var 보호 + Clippy-as-style-guide + 계층적 AGENTS.md |
|| **openai/openai-agents-python** | [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | 필수 스킬 호출 강제 + ExecPlan 살아있는 문서 + 실행 가능 스킬 |
|| **roboflow/supervision** | [roboflow/supervision](https://github.com/roboflow/supervision) | 6개 번호 라이프사이클 섹션 + 코딩 전 체크리스트 + 한 질문 규칙 |
|| **cloudflare/workers-sdk** | [cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk) | WHERE TO LOOK 테이블 + bash/webfetch deny + 계층적 서브패키지 |
|| **github/awesome-copilot** | [github/awesome-copilot](https://github.com/github/awesome-copilot) | 197 Skills + 168 Agents + 거버넌스 훅 + 자연어 워크플로우 컴파일 |
|| **agentsmd/agents.md** | [agentsmd/agents.md](https://github.com/agentsmd/agents.md) | AGENTS.md 오픈 표준 스펙 (21개 도구, 60k+ 레포 채택) |
|| **foambubble/foam** | [foambubble/foam](https://github.com/foambubble/foam) | 안티-아부 규칙 + core/ mock 금지 영역 + /review-ai-slop 커맨드 |
|| **microsoft/semanticworkbench** | [microsoft/semanticworkbench](https://github.com/microsoft/semanticworkbench) | make ai-context-files → 20개 논리적 경계 파일 자동 생성 |
|| **disler/claude-code-hooks-mastery** | [disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery) | Claude Code 13개 훅 이벤트 완전 구현 (LLM-as-hook 포함) |
|| **wasp-lang/open-saas** | [wasp-lang/open-saas](https://github.com/wasp-lang/open-saas) | 4계층 AI 컨텍스트 + /review-ai-slop + 커스텀 MCP 서버 |
---

## AI 최적화 전략 비교

### 1. AGENTS.md 계층화 전략

```
단일 파일 (단순)
└── 전체 프로젝트 하나의 AGENTS.md

계층형 (중간)
├── /AGENTS.md (루트 개요)
├── /src/AGENTS.md (소스 패턴)
└── /tests/AGENTS.md (테스팅 패턴)

모듈형 (고급) — tuist, tidb
├── /AGENTS.md (루트)
├── /cli/AGENTS.md
├── /cli/Sources/TuistCore/AGENTS.md
├── /cli/Sources/TuistServer/AGENTS.md
└── ...40+ 파일
```

### 2. Skills 시스템 진화

```
없음 → copilot-instructions.md → .github/skills/ → .agents/skills/
                                                    (tidb: 최신 표준)
```

**Skills 파일 구조 표준:**
```markdown
---
name: skill-name
description: AI가 언제 이 스킬을 로드해야 하는지
---
# 스킬 제목
## 언제 사용하나
## 구현 가이드
```

### 3. Cursor 자동 컨텍스트 로딩 (sentry의 혁신)

```
.cursor/rules/backend.mdc  → 편집 파일이 src/**/*.py일 때 자동 로드 src/AGENTS.md
.cursor/rules/frontend.mdc → 편집 파일이 static/**/*.ts일 때 자동 로드 static/AGENTS.md
```

### 4. 훅 시스템 (oh-my-claudecode의 혁신)

```
31개 훅 종류:
- autopilot/     완전 자율 실행 모드
- ralph/         완료 확인까지 반복 실행
- ultrawork/     병렬 에이전트 최대 실행
- swarm/         SQLite로 작업 클레임하는 N 에이전트
- learner/       스킬 추출 및 학습
- rules-injector/ 규칙 파일 자동 주입
- think-mode/    강화된 추론 모드
```

---

## 핵심 인사이트

### 🔑 공통 패턴 (거의 모든 프로젝트에서 발견)

1. **프로젝트 구조 지도**: AI가 어떤 파일이 어디 있는지 테이블로 명시
2. **빌드/테스트 명령어**: 정확한 명령어를 AGENTS.md에 기록
3. **금지 사항 명시**: "절대 하지 말 것" 리스트
4. **Git 워크플로우**: 브랜치 전략, 커밋 메시지 형식
5. **코드 스타일**: AI가 따라야 할 코딩 컨벤션

### 💡 고급 패턴 (일부 프로젝트에서 발견)

1. **Context-aware 로딩**: 편집 중인 파일에 따라 다른 컨텍스트 자동 로드
2. **Skills = 조건부 컨텍스트**: 키워드 감지 시 특정 가이드 로드
3. **에이전트 위임**: AI가 AI에게 작업 위임하는 오케스트레이션
4. **모델 티어링**: 작업 복잡도에 따라 Haiku/Sonnet/Opus 라우팅

---

## 신규 발견 패턴 (2차 리서치)

### 5. 안티-Hallucination 앵커

```
# ✅ CORRECT
if problem.Status.name in ["Optimal", "FeasibleFound"]:

# ❌ WRONG - PascalCase가 아닌 UPPER_CASE는 절대 일치하지 않음
if problem.Status.name == "OPTIMAL":
```

NVIDIA cuOpt, openai/codex 등에서 발견. AI가 자주 범하는 API 오류를 정확한 틀린→맞는 코드 비교로 방지.

### 6. 자동 컨텍스트 생성 파이프라인

```bash
# microsoft/semanticworkbench 패턴
make ai-context-files  # → 20개 논리적 경계 파일 자동 생성
```

수동 AGENTS.md 유지 대신 코드베이스에서 AI 컨텍스트를 자동 추출.

### 7. WHERE TO LOOK 테이블 (cloudflare 혁신)

```markdown
| Task                     | Location              | Notes              |
| Add CLI command          | packages/wrangler/src/ | 2k+ line yargs tree |
| Change local dev behavior | packages/miniflare/src/ | src/index.ts is main |
```

디렉토리 설명이 아닌 **태스크(Intent) → 정확한 경로 + 함정 메모** 매핑.

### 8. AI Slop 자동 리뷰 (wasp-lang 혁신)

```markdown
# /review-ai-slop
AI가 생성한 슬롭(과도한 주석, 불필요한 방어 코드, any 타입 캐스팅)을 제거하는 품질 게이트.
AI가 자신의 코드를 심사한다.
```

### 9. AGENTS.md 오픈 표준 현황 (2026년 2월)

- **채택**: 60,000+ 레포지토리
- **지원 도구**: 21개 (Codex, Cursor, Jules, GitHub Copilot, VS Code, Devin, Windsurf 등)
- **거버넌스**: Linux Foundation 산하 Agentic AI Foundation(AAIF)
- **Claude Code 위치**: CLAUDE.md가 네이티브, `@AGENTS.md` include로 통합 가능

---

## 각 프로젝트 상세 문서

| 프로젝트 | 문서 경로 |
|---------|----------|
| oh-my-claudecode | [docs/oh-my-claudecode/analysis.md](./oh-my-claudecode/analysis.md) |
| SuperClaude Framework | [docs/superclaude/analysis.md](./superclaude/analysis.md) |
| vercel/next.js | [docs/nextjs/analysis.md](./nextjs/analysis.md) |
| promptfoo | [docs/promptfoo/analysis.md](./promptfoo/analysis.md) |
| getsentry/sentry | [docs/sentry/analysis.md](./sentry/analysis.md) |
| tuist/tuist | [docs/tuist/analysis.md](./tuist/analysis.md) |
| pingcap/tidb | [docs/tidb/analysis.md](./tidb/analysis.md) |
| meteor/meteor | [docs/meteor/analysis.md](./meteor/analysis.md) |
| microsoft/agent-framework | [docs/microsoft-agent-framework/analysis.md](./microsoft-agent-framework/analysis.md) |
| AzureAD/microsoft-identity-web | [docs/microsoft-identity-web/analysis.md](./microsoft-identity-web/analysis.md) |
| NVIDIA/cuopt | [docs/nvidia-cuopt/analysis.md](./nvidia-cuopt/analysis.md) |
| fastrepl/char | [docs/char-fastrepl/analysis.md](./char-fastrepl/analysis.md) |
| PatrickJS/awesome-cursorrules | [docs/awesome-cursorrules/analysis.md](./awesome-cursorrules/analysis.md) |
| danielmeppiel/awesome-ai-native | [docs/awesome-ai-native/analysis.md](./awesome-ai-native/analysis.md) |
| grapeot/devin.cursorrules | [docs/devin-cursorrules/analysis.md](./devin-cursorrules/analysis.md) |
| huggingface/transformers | [docs/huggingface-transformers/analysis.md](./huggingface-transformers/analysis.md) |
|| vitest-dev/vitest | [docs/vitest/analysis.md](./vitest/analysis.md) |
|| openai/codex | [docs/openai-codex/analysis.md](./openai-codex/analysis.md) |
|| openai/openai-agents-python | [docs/openai-agents-python/analysis.md](./openai-agents-python/analysis.md) |
|| roboflow/supervision | [docs/roboflow-supervision/analysis.md](./roboflow-supervision/analysis.md) |
|| cloudflare/workers-sdk | [docs/cloudflare-workers-sdk/analysis.md](./cloudflare-workers-sdk/analysis.md) |
|| github/awesome-copilot | [docs/github-awesome-copilot/analysis.md](./github-awesome-copilot/analysis.md) |
|| agentsmd/agents.md | [docs/agentsmd-spec/analysis.md](./agentsmd-spec/analysis.md) |
|| foambubble/foam | [docs/foambubble-foam/analysis.md](./foambubble-foam/analysis.md) |
|| microsoft/semanticworkbench | [docs/microsoft-semanticworkbench/analysis.md](./microsoft-semanticworkbench/analysis.md) |
|| disler/claude-code-hooks-mastery | [docs/claude-code-hooks-mastery/analysis.md](./claude-code-hooks-mastery/analysis.md) |
|| wasp-lang/open-saas | [docs/wasp-open-saas/analysis.md](./wasp-open-saas/analysis.md) |
