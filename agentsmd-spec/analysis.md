# AGENTS.md 오픈 표준 스펙 — AI 최적화 분석

> **GitHub**: https://github.com/agentsmd/agents.md (원래 openai/agents.md)  
> **Stars**: 18,004 | **채택**: 60,000+ 레포지토리  
> **핵심 패턴**: 완전 오픈 표준 — 필수 필드 없음, 21개 AI 도구 지원, Linux Foundation 거버넌스

---

## 개요

`agentsmd/agents.md`는 AGENTS.md 파일 형식의 공식 오픈 표준 스펙이다. 2025년 8월 OpenAI가 시작하여, 2025년 12월 Linux Foundation 산하 **Agentic AI Foundation(AAIF)**이 스튜어드쉽을 맡았다. 60,000+ 레포지토리에 채택된 사실상의 AI 에이전트 지시 파일 표준이다.

---

## 공식 스펙 — 핵심 규칙

### 필수 필드: 없음

```
AGENTS.md는 표준 마크다운입니다. 원하는 헤딩을 사용하세요; 에이전트는 제공하는 텍스트를 파싱합니다.
```

파일 형식에 스키마나 YAML frontmatter가 없다. 완전한 자유 형식 마크다운이다.

### 파일 명명 및 위치 규칙

- **정식 파일명**: `AGENTS.md` (복수형, 대문자)
- **위치**: 프로젝트 전체 지시는 **레포지토리 루트**
- **서브디렉토리**: 모노레포 서브프로젝트용 중첩 AGENTS.md 파일

### 충돌 해결 / 우선순위

```
1. 명시적 사용자 채팅 프롬프트  ← 최고 우선순위, 모든 것 오버라이드
2. 편집 파일에 가장 가까운 AGENTS.md  ← 근접성 기반 해결
3. 부모 디렉토리 AGENTS.md 파일  ← 트리 위로 폴백
```

### 모노레포 지원

```
각 패키지 안에 AGENTS.md를 배치하세요. 에이전트는 자동으로 디렉토리 트리에서 
가장 가까운 파일을 읽으므로, 가장 가까운 것이 우선하고 각 서브프로젝트는 
맞춤 지시를 제공할 수 있습니다. 참고로 메인 OpenAI 레포에는 88개의 AGENTS.md 파일이 있습니다.
```

---

## 권장 섹션 (필수 아님)

| 섹션 유형 | 목적 | 예시 헤딩 |
|---------|------|---------|
| **프로젝트 개요** | 아키텍처 컨텍스트 | `# Overview`, `# Architecture` |
| **빌드 및 테스트 명령** | 컴파일/실행 방법 | `## Setup commands`, `## Dev environment tips` |
| **코드 스타일 가이드라인** | 컨벤션 | `## Code style`, `## Formatting Rules` |
| **테스팅 지시** | 테스트 실행 | `## Testing instructions`, `## Running Tests` |
| **보안 고려사항** | 취약점 방지 | `## Security`, `## Auth Flow` |
| **PR/커밋 가이드라인** | 워크플로우 컨벤션 | `## PR instructions`, `## Commit Messages` |

### 공식 최소 예시 (README에서)

```markdown
# Sample AGENTS.md file

## Dev environment tips
- Use `pnpm dlx turbo run where <project_name>` to jump to a package...
- Run `pnpm install --filter <project_name>` to add the package to your workspace...

## Testing instructions
- Find the CI plan in the .github/workflows folder.
- Run `pnpm turbo run test --filter <project_name>` to run every check...
- Add or update tests for the code you change, even if nobody asked.

## PR instructions
- Title format: [<project_name>] <Title>
- Always run `pnpm lint` and `pnpm test` before committing.
```

---

## 공식 지원 AI 도구 (21개)

| 도구 | 공급사 | 네이티브 지원 | 설정 필요 |
|------|------|------------|---------|
| **Codex** | OpenAI | ✅ | 없음 |
| **Jules** | Google | ✅ | 없음 |
| **Amp** | Sourcegraph | ✅ | 없음 |
| **Cursor** | Cursor | ✅ | 없음 |
| **Factory** | Factory.ai | ✅ | 없음 |
| **RooCode** | — | ✅ | 없음 |
| **Aider** | — | ⚙️ 설정 필요 | `.aider.conf.yml`: `read: AGENTS.md` |
| **Gemini CLI** | Google | ⚙️ 설정 필요 | `.gemini/settings.json`: `{"contextFileName": "AGENTS.md"}` |
| **goose** | Block | ✅ | 없음 |
| **Kilo Code** | — | ✅ | 없음 |
| **opencode** | — | ✅ | 없음 |
| **Phoenix** | — | ✅ | 없음 |
| **Zed** | Zed Industries | ✅ | 없음 |
| **Semgrep** | Semgrep | ✅ | 없음 |
| **Warp** | Warp | ✅ | 없음 |
| **GitHub Copilot** (코딩 에이전트) | Microsoft/GitHub | ✅ | 없음 |
| **VS Code** | Microsoft | ✅ | 없음 |
| **Devin** | Cognition | ✅ | 없음 |
| **Windsurf** | Cognition | ✅ | 없음 |
| **Ona** | Ona | ✅ | 없음 |
| **UiPath Autopilot** | UiPath | ✅ | 없음 |

**주목할 부재**: Claude Code는 공식 호환성 섹션에 없다. Claude Code의 네이티브 형식은 `CLAUDE.md`이며, AGENTS.md는 지시가 있을 때 읽을 수 있다.

### 레거시 형식 마이그레이션

```bash
mv AGENT.md AGENTS.md && ln -s AGENTS.md AGENT.md
```

---

## 역사 및 기원

| 날짜 | 이벤트 |
|------|------|
| **2025-08-19** | OpenAI의 Romain Huet가 `openai/agents.md`로 초기 커밋 |
| **2025-08-20** | 커뮤니티가 즉시 Aider, Gemini, Kilo Code, Zed 등 지원 요청 |
| **2025-08-21** | Aider, Gemini, Kilo Code, opencode, Phoenix, Zed 추가 |
| **2025-09-02** | GitHub Copilot 코딩 에이전트 추가 |
| **2025-09-09** | VS Code, Devin 추가 |
| **2025-12-11** | `agentsmd` org으로 이전; **Agentic AI Foundation(AAIF)** 이 Linux Foundation 하에 스튜어드쉽 인수 |

**공식 기원 문구**:
> "AGENTS.md emerged from collaborative efforts across the AI software development ecosystem, including OpenAI Codex, Amp, Jules from Google, Cursor, and Factory."

---

## 자동 명령 실행

```
Yes — if you list them. The agent will attempt to execute relevant programmatic 
checks and fix failures before finishing the task.
```

AGENTS.md에 테스트 명령을 나열하면 에이전트가 자동으로 실행하고 실패를 수정한다.

---

## 에코시스템 통계

- **60,000+** 레포지토리 채택 (2025년 12월 기준)
- **GitHub Blog** 2025년 11월: 2,500+ AGENTS.md 파일 분석 모범 사례 발행
- **공식 검증 도구**: 없음 (의도적 — 스키마 없는 마크다운 자유 형식)

---

## 학습 포인트

| 원칙 | 스펙 규칙 |
|------|---------|
| 필수 구조 없음 | 표준 마크다운, 어떤 헤딩이든 가능 |
| 근접성 우선 | 편집 코드에 가장 가까운 파일이 우선 |
| 사용자가 파일 오버라이드 | 명시적 채팅 프롬프트가 AGENTS.md보다 우선 |
| 모노레포 네이티브 | 중첩 파일, 각 패키지 맞춤 지시 가능 |
| 살아있는 문서 | README처럼 코드와 함께 업데이트 |
| 자동 실행 | 에이전트가 나열된 테스트 명령 실행 |

---

## 요약

AGENTS.md 오픈 표준은 **"최소 마찰 + 최대 채택"** 원칙으로 설계되었다. 필수 필드 없음, 자유 형식 마크다운, 21개 AI 도구 네이티브 지원으로 바이브코딩 생태계에서 가장 광범위하게 채택된 표준이 되었다. Linux Foundation 거버넌스 이관으로 장기적 중립성과 지속성이 보장된다.

| 지표 | 값 |
|------|-----|
| 채택 레포 수 | 60,000+ |
| 지원 AI 도구 | 21개 (네이티브 19개 + 설정 2개) |
| 필수 필드 | 0개 |
| 거버넌스 | Agentic AI Foundation / Linux Foundation |
| 기원 | OpenAI (2025-08-19) → AAIF (2025-12-11) |
