# AzureAD/microsoft-identity-web — AI 최적화 분석

> **GitHub**: https://github.com/AzureAD/microsoft-identity-web  
> **Stars**: 2k+  
> **핵심 패턴**: GitHub Agent Skills 오픈 표준 선도 구현 — 번들 코드 자산 + 에이전트 대화 스크립팅 + 2단계 워크플로우 라우팅

---

## 개요

`AzureAD/microsoft-identity-web`은 .NET 앱에 Microsoft Entra ID (Azure AD) 인증을 통합하는 라이브러리다.  
2026년 1월~2월, GitHub Agent Skills 오픈 표준의 **주요 Microsoft OSS 프로젝트 최초 사례** 중 하나로 `.github/skills/` 구조를 도입했다. 두 번째 커밋 메시지에는 `"Co-authored-by: Copilot"`이 명시되어 있어, 스킬 파일 자체를 AI와 함께 작성했음을 알 수 있다.

---

## 파일 구조

```
AzureAD/microsoft-identity-web/
├── .github/
│   ├── copilot-instructions.md        ← 단일 줄 리다이렉트 → AGENTS.md
│   └── skills/
│       ├── README.md                  ← 스킬 인덱스 + 사용 가이드
│       ├── entra-id-aspire-authentication/
│       │   ├── SKILL.md               ← Phase 1: 인증 코드 설치
│       │   ├── BlazorAuthenticationChallengeHandler.cs   ← 번들 C# 파일
│       │   └── LoginLogoutEndpointRouteBuilderExtensions.cs  ← 번들 C# 파일
│       └── entra-id-aspire-provisioning/
│           └── SKILL.md               ← Phase 2: Azure AD 앱 등록 (PowerShell)
```

`AGENTS.md` 루트 파일은 HEAD 기준 존재하지 않음 (브랜치에 있거나 forward-looking).  
`CLAUDE.md`, `.cursorrules` 없음 — 단일 표준(`SKILL.md`)으로 모든 도구 지원.

---

## 멀티 AI 도구 지원 전략

`skills/README.md` 에서 명시적으로 선언:

```markdown
### Supported AI Assistants

Skills work with multiple AI coding assistants that support the open skills format:

- **GitHub Copilot** - Native support in VS Code, Visual Studio, GitHub Copilot CLI, and other IDEs
- **Claude** (Anthropic) - Via Claude for VS Code extension and Claude Code
- **Other assistants** - Any AI tool that follows the skills convention
```

전략의 핵심은 **오픈 표준 이식성**: 하나의 `SKILL.md` 형식이 모든 AI 도구에서 동작한다. 도구별 파일 없음.

### Instructions vs. Skills 공식 분류

| 측면 | copilot-instructions.md | Skills |
|------|------------------------|--------|
| 범위 | 레포 전체에 항상 활성 | 컨텍스트/키워드로 활성화 |
| 목적 | 일반 코딩 표준 | 특정 구현 시나리오 |
| 위치 | `.github/copilot-instructions.md` | `.github/skills/<name>/SKILL.md` |
| 내용 | 스타일 가이드, 컨벤션 | 단계별 튜토리얼, 패턴 |
| 표준 | AI 도구별 다름 | 모든 도구에서 오픈 표준 |

---

## YAML Frontmatter 형식

### entra-id-aspire-authentication

```yaml
---
name: entra-id-aspire-authentication
description: |
  Guide for adding Microsoft Entra ID (Azure AD) authentication to .NET Aspire applications.
  Use this when asked to add authentication, Entra ID, Azure AD, OIDC, or identity to an Aspire app,
  or when working with Microsoft.Identity.Web in Aspire projects.
license: MIT
---
```

### entra-id-aspire-provisioning

```yaml
---
name: entra-id-aspire-provisioning
description: |
  Provision Entra ID (Azure AD) app registrations for .NET Aspire applications and update configuration.
  Use after adding Microsoft.Identity.Web authentication code to create or update app registrations,
  configure scopes, credentials, and update appsettings.json files.
  Triggers: "provision entra id", "create app registration", "register azure ad app", 
  "configure entra id apps", "set up authentication apps".
license: MIT
---
```

**스키마**: `name` (kebab-case) + `description` (멀티라인, 명시적 트리거 구문 포함) + `license`

특히 provisioning 스킬의 description에 **키워드 라우팅 테이블**이 내장되어 있다. AI가 "provision entra id" 같은 구문을 감지하면 이 스킬을 자동 활성화한다.

---

## 핵심 AI 최적화 패턴

### 1. 번들 코드 자산 (Bundled Code Assets)

인증 스킬 폴더에는 SKILL.md 외에 **바로 복사 가능한 C# 파일**이 포함되어 있다:

| 파일 | 목적 |
|------|------|
| `BlazorAuthenticationChallengeHandler.cs` | Blazor Server에서 Conditional Access / 증분 동의 처리 |
| `LoginLogoutEndpointRouteBuilderExtensions.cs` | scope/claims 파라미터를 포함한 로그인/로그아웃 엔드포인트 |

스킬은 AI에게 이렇게 지시한다:  
*"Copy `BlazorAuthenticationChallengeHandler.cs` from this skill's folder to the Web project root."*

AI가 스킬 폴더의 파일을 읽어 타겟 프로젝트에 그대로 복사한다. 코드를 생성할 필요가 없어 hallucination 위험이 제거된다.

### 2. 에이전트 대화 스크립팅 (Agent Dialogue Scripting)

스킬에는 `> **AGENT:**` 블록이 있어 AI가 사용자에게 **무슨 말을 해야 하는지** 미리 작성해 둔다:

```markdown
> **AGENT: Show detected topology and ask for confirmation:**
> "I detected:
> - **Web App** (Blazor): `{webProjectName}`
> - **API**: `{apiProjectName}`
> 
> The web app will authenticate users and call the API. Is this correct?"
```

이는 **대화 스크립팅 패턴**이다 — 스킬 작성자가 AI의 대화를 사전에 작성하여 사용자 경험을 일관되게 만든다.

### 3. 구현 후 검증 체크리스트

```markdown
## Post-Implementation Verification

**AGENT: After completing all steps, verify:**

- [ ] API `Program.cs` has `AddMicrosoftIdentityWebApi`
- [ ] Web `Program.cs` has `AddMicrosoftIdentityWebApp` and `AddMicrosoftIdentityMessageHandler`
- [ ] Web has `Components/UserInfo.razor` (**LOGIN BUTTON**)
- [ ] **Every page calling protected APIs** has try/catch with `ChallengeHandler.HandleExceptionAsync(ex)`
```

AI가 완료 선언 전에 반드시 통과해야 할 체크리스트를 강제한다.

### 4. 2단계 워크플로우 라우팅

두 스킬이 명시적으로 연결되어 있다:

```markdown
> "✅ **Phase 1 complete!** Authentication code is in place. The app will **build** but **won't run** 
> until app registrations are configured.
> 
> **Next:** Run the `entra-id-aspire-provisioning` skill to:
> - Create Entra ID app registrations
> - Update `appsettings.json` with real ClientIds
```

이는 **스킬 그래프** 패턴이다:

```
entra-id-aspire-authentication (코드 설치, Phase 1)
           │
           └──► entra-id-aspire-provisioning (Azure AD 앱 등록, Phase 2)
```

각 스킬이 다음 스킬로 명시적 핸드오프를 수행한다.

### 5. 대화형 의사결정 트리 (Interactive Decision Trees)

provisioning 스킬은 분기 사용자 상호작용을 스크립팅한다:

```markdown
**AGENT: Based on findings, ask the user:**

**If existing ClientIds found:**
> "I found existing app registrations in your configuration:
> Should I:
> 1. **Use these existing apps** and complement them if needed?
> 2. **Create new app registrations** and update the configuration?"
```

AI가 상황에 따라 다른 대화를 선택하는 조건부 흐름을 스킬에서 정의한다.

### 6. 완전한 PowerShell 스크립트 내장

provisioning 스킬에는 Microsoft Graph 작업을 위한 **실행 가능한 완전한 PowerShell 스크립트**가 포함된다 (`New-MgApplication`, `Update-MgApplication`, `Add-MgApplicationPassword` 등). 의사코드가 아닌 실제 실행 코드다.

---

## copilot-instructions.md 패턴

```markdown
Carefully review the agents.md file in the repository root. This contains your custom instructions 
for agent automation and development guidelines.
```

**단 한 줄**이다. 모든 AI 에이전트(Copilot, Claude, Cursor)에게 루트 `AGENTS.md`를 읽으라고 지시한다. 이 파일이 존재하는 이유는 GitHub Copilot이 `.github/copilot-instructions.md`를 자동으로 읽기 때문이다.

---

## 커밋 타임라인

| 날짜 | 커밋 | 내용 |
|------|------|------|
| 2026-01-30 | "Adding an article and an agent skill..." (#3689) | 첫 스킬 도입, `Co-authored-by: Copilot` |
| 2026-02-02 | "Improves the Aspire doc article and skills" (#3695) | 스킬 개선 |

이 타임라인은 GitHub Agent Skills 오픈 표준이 **2026년 초에 주요 Microsoft 프로젝트에 도입**되기 시작했음을 보여준다.

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| 번들 코드 자산 | 스킬 폴더에 바로 복사 가능한 파일 포함 |
| 대화 스크립팅 | `> **AGENT:**` 블록으로 AI 발화 사전 정의 |
| 워크플로우 라우팅 | Phase 1 완료 시 Phase 2 스킬로 명시적 핸드오프 |
| 키워드 라우팅 | YAML description에 트리거 구문 내장 |
| 검증 체크리스트 | 완료 선언 전 `- [ ]` 항목 강제 |
| 오픈 표준 | 도구별 파일 없이 단일 SKILL.md로 모든 AI 지원 |
| AI 공동 작성 | 스킬 자체를 AI와 함께 작성 (Co-authored-by: Copilot) |

---

## 요약

microsoft-identity-web의 GitHub Skills 구현은 **스킬이 단순한 문서가 아닌 실행 가능한 워크플로우**임을 보여주는 최고의 사례다. 번들 코드 자산, 대화 스크립팅, 2단계 라우팅, 완전한 PowerShell 스크립트를 결합하여 AI가 복잡한 인증 설정을 **안내받으며 완료**할 수 있도록 한다.

| 지표 | 값 |
|------|-----|
| AI 설정 파일 수 | 1 (copilot-instructions.md) + 2 SKILL.md |
| 지원 AI 도구 | GitHub Copilot, Claude Code, 오픈 표준 호환 모든 도구 |
| 스킬 수 | 2 (authentication + provisioning) |
| 번들 코드 자산 | 2개 C# 파일 |
| 핵심 혁신 | 대화 스크립팅 + 2단계 워크플로우 라우팅 |
| 도입 시점 | 2026년 1~2월 (GitHub Skills 오픈 표준 초기 채택자) |
