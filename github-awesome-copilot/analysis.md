# github/awesome-copilot — AI 최적화 분석

> **GitHub**: https://github.com/github/awesome-copilot  
> **Stars**: 22.5k  
> **핵심 패턴**: 197개 Skills + 168개 Agents + Hook 이벤트 시스템 + 자연어 Workflow 컴파일 + 거버넌스 감사 훅

---

## 개요

`github/awesome-copilot`은 GitHub Copilot용 Skills, Agents, Instructions, Hooks, Workflows, Plugins의 공식 큐레이션 컬렉션이다. 단순한 레포지토리를 넘어 **AI 코딩 생태계의 컴포넌트 마켓플레이스**로, MCP 서버를 통해 VS Code에서 직접 설치할 수 있다.

---

## 전체 구조

```
github/awesome-copilot/
├── skills/          ← 197개 AI 기능 (SKILL.md + 번들 자산)
├── agents/          ← 168개 AI 페르소나/특화 모드
├── instructions/    ← 174개 코딩 표준/모범 사례
├── hooks/           ← 3개 자동화 훅
├── workflows/       ← 1개 Agentic Workflow
├── plugins/         ← 3개 번들 플러그인
├── .schemas/        ← JSON 스키마 (검증용)
├── docs/            ← 자동 생성 README 테이블
├── cookbook/        ← 복사-붙여넣기 코드 스니펫
├── website/         ← GitHub Pages (llms.txt 포함)
└── AGENTS.md        ← 레포 자체에 기여할 때 AI 지침
```

설치: `ghcr.io/microsoft/mcp-dotnet-samples/awesome-copilot:latest` MCP 서버로 VS Code/Visual Studio에서 직접 검색 및 설치.

---

## 규모 통계

| 컬렉션 | 수량 |
|--------|------|
| Skills | **197개** |
| Agents | **168개** |
| Instructions | **174개** |
| Hooks | 3개 |
| Workflows | 1개 |
| Plugins | 3개 |

---

## SKILL.md 형식 표준

### YAML Frontmatter 필드

```yaml
---
name: make-skill-template              # 1-64자, 소문자 하이픈, 폴더명과 일치
description: 'Create new Agent Skills for GitHub Copilot...'  # 1-1024자, WHAT + WHEN 설명
license: MIT                           # (선택)
compatibility: "VS Code 1.95+"         # (선택)
allowed-tools: "github mcp"            # (선택) 사전 승인된 도구 목록
---
```

### 번들 자산 디렉토리

```
skill-name/
├── SKILL.md              ← 스킬 정의
├── scripts/              ← 실행 가능한 Python/Bash/JS 자동화
├── references/           ← AI가 읽는 마크다운 참조 문서
├── assets/               ← 그대로 사용하는 정적 파일
└── templates/            ← AI가 수정할 스타터 코드
```

**극단적 번들 예시**: `excalidraw-diagram-generator` — 8개 `.excalidraw` 템플릿 + 2개 참조 문서 + 3개 Python 스크립트 번들.

### 스킬 카테고리 샘플

| 카테고리 | 예시 스킬 |
|---------|---------|
| MCP 서버 생성 | `csharp-mcp-server-generator`, `python-mcp-server-generator`, `go-mcp-server-generator` (10개 언어) |
| Azure / Cloud | `azure-deployment-preflight`, `azure-resource-health-diagnose`, `az-cost-optimize` |
| 테스팅 | `playwright-generate-test`, `pytest-coverage`, `polyglot-test-agent`, `scoutqa-test` |
| 문서화 | `create-readme`, `create-specification`, `create-architectural-decision-record`, `create-llms` |
| 리팩토링 | `refactor`, `refactor-plan`, `refactor-method-complexity-reduce` |
| 다이어그램 | `excalidraw-diagram-generator`, `plantuml-ascii`, `architecture-blueprint-generator` |
| 메모리/컨텍스트 | `remember`, `memory-merger`, `context-map`, `what-context-needed` |
| AI/에이전트 | `agent-governance`, `agentic-eval`, `ai-prompt-engineering-safety-review`, `structured-autonomy-plan` |
| 프로젝트 계획 | `breakdown-epic-arch`, `prd`, `create-implementation-plan`, `create-technical-spike` |

---

## Hook 이벤트 시스템

### 지원 이벤트

```
sessionStart | sessionEnd | userPromptSubmitted | preToolUse | postToolUse | errorOccurred
```

### 훅 파일 형식

```json
{
  "version": 1,
  "hooks": {
    "sessionEnd": [
      {
        "type": "command",
        "bash": ".github/hooks/session-auto-commit/auto-commit.sh",
        "timeoutSec": 30
      }
    ]
  }
}
```

설치: `.github/hooks/` 폴더에 복사 후 기본 브랜치에 커밋.

### 수록된 3개 훅

**1. Governance Audit (거버넌스 감사)**  
이벤트: `sessionStart`, `sessionEnd`, `userPromptSubmitted`  
기능: 프롬프트를 위협 신호로 스캔하고 추가 전용(append-only) JSON 감사 로그 작성

위협 카테고리별 심각도:

| 카테고리 | 심각도 점수 |
|---------|-----------|
| `data_exfiltration` | 0.7–0.95 |
| `privilege_escalation` | 0.8–0.95 |
| `system_destruction` | 0.9–0.95 |
| `prompt_injection` | 0.6–0.9 |
| `credential_exposure` | 0.9–0.95 |

**2. Session Auto-Commit**  
이벤트: `sessionEnd`  
기능: 세션 종료 시 자동 stage + commit + push

**3. Session Logger**  
이벤트: `sessionStart`, `sessionEnd`, `userPromptSubmitted`  
기능: 모든 세션 활동을 감사/분석용으로 로깅

---

## Agentic Workflows — 자연어 컴파일

### 형식

```markdown
---
name: "Daily Issues Report"
description: "Generates a daily summary of open issues and recent activity as a GitHub issue"
on:
  schedule: daily on weekdays
permissions:
  contents: read
  issues: read
safe-outputs:
  create-issue:
    title-prefix: "[daily-report] "
    labels: [report]
---

## Daily Issues Report

Create a daily summary of open issues for the team.

## What to Include
- New issues opened in the last 24 hours
- Issues closed or resolved
- Stale issues that need attention
```

**핵심 아이디어**: 자연어 지시 → `gh aw compile` → `.lock.yml` GitHub Actions 파일 자동 생성. `.md` 소스 파일만 커밋하고, `.lock.yml`은 CI가 거부한다.

---

## 기여 워크플로우 (CLI 우선)

```bash
# 1. 스캐폴딩
npm run skill:create -- --name <skill-name> --description "<description>"

# 2. 검증
npm run skill:validate

# 3. README 테이블 재생성
npm run build
```

**PR 규칙**:
- `staged` 브랜치 대상 (main 아님)
- 번들 자산: 각 5MB 이하
- 본문: 500줄 이하
- CI: README 테이블 stale 시 실패

**거절 기준**:
- Responsible AI 가이드라인 우회 내용
- 보안 bypass 지시
- Prompt injection 활성화
- 플랫폼 ToS 위반

---

## AGENTS.md — 레포 자체 기여 AI 지침

이 레포 자체에도 `AGENTS.md`가 있어, AI가 새로운 스킬/훅을 기여할 때 따를 규칙을 정의한다. 메타적 self-referential 패턴 — AI 코딩 도구를 위한 컨텐츠를 만드는 레포가 AI 코딩 도구를 사용해 기여 받는 방식을 정의한다.

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| 스킬 마켓플레이스 | 197개 커뮤니티 스킬 표준 형식으로 수집 |
| MCP 서버 배포 | VS Code에서 직접 스킬 검색/설치 |
| 번들 자산 | scripts/, references/, assets/, templates/ |
| 거버넌스 훅 | 프롬프트 위협 스캔 + 감사 로그 |
| 자연어 워크플로우 | 마크다운 → GitHub Actions 자동 컴파일 |
| CLI 우선 기여 | `npm run skill:create` 스캐폴딩 |
| 메타 AGENTS.md | 레포 자체에 기여하는 AI를 위한 지침 |

---

## 요약

`github/awesome-copilot`은 **AI 코딩 생태계의 컴포넌트 레지스트리**다. 197개 Skills, 168개 Agents, 3개 Hooks가 표준 형식으로 수집되어 있고, MCP 서버를 통해 IDE에서 직접 사용할 수 있다. 특히 Governance Audit 훅은 AI 세션의 보안 감사를 자동화하는 혁신적 패턴이며, 자연어 Workflow 컴파일은 GitHub Actions 설정을 마크다운으로 작성하는 새로운 DX를 제시한다.

| 지표 | 값 |
|------|-----|
| 총 컨텐츠 | Skills 197 + Agents 168 + Instructions 174 + Hooks 3 |
| 설치 방법 | MCP 서버 (Docker) |
| 지원 IDE | VS Code, Visual Studio |
| 핵심 혁신 | 스킬 마켓플레이스 + 거버넌스 훅 + 자연어 워크플로우 |
