# danielmeppiel/awesome-ai-native — AI 최적화 분석

> **GitHub**: https://github.com/danielmeppiel/awesome-ai-native  
> **사이트**: https://danielmeppiel.github.io/awesome-ai-native  
> **License**: CC BY-NC-SA 4.0  
> **분류**: 📚 AI Native 개발 방법론 (PROSE 프레임워크)

---

## 프로젝트 개요

awesome-ai-native는 "AI Native 개발"을 위한 방법론 프레임워크인 **PROSE**를 정의하고 문서화합니다.
바이브코딩에서 AI와의 상호작용을 체계화하는 아키텍처 스타일입니다.

---

## PROSE 프레임워크

"Programming has evolved. 어셈블리에서 Python으로, 각 추상화는 인간의 사고에 더 가까워졌습니다. 이제 최종 레이어에 도달했습니다: _산문(prose) 자체가 실행 가능해졌습니다_."

| | 제약 | 원칙 | 유도된 속성 |
|---|---------|-------|------------|
| **P** | **Progressive Disclosure** | Just-in-time 컨텍스트, Just-in-case 아님 | 효율적 컨텍스트 활용 |
| **R** | **Reduced Scope** | 컨텍스트 용량에 맞게 작업 크기 조정 | 관리 가능한 복잡도 |
| **O** | **Orchestrated Composition** | 단순한 것이 합성됨; 복잡한 것이 무너짐 | 유연성, 재사용성 |
| **S** | **Safety Boundaries** | 가드레일 내에서의 자율성 | 신뢰성, 보안 |
| **E** | **Explicit Hierarchy** | 범위가 좁아질수록 구체성 증가 | 모듈성, 상속 |

---

## PROSE 각 원칙 상세

### P - Progressive Disclosure (점진적 공개)

**실패 모드**: 컨텍스트 과부하가 주의를 희석시킴  
**해결책**: Just-in-time으로 컨텍스트 로드

```markdown
❌ 잘못된 방법:
모든 코드베이스 문서를 한 번에 AI에게 제공

✅ PROSE 방법:
- 최소 기본 컨텍스트 (AGENTS.md 루트)
- 작업 관련 컨텍스트는 Skills로 분리
- 필요 시에만 로드
```

### R - Reduced Scope (축소된 범위)

**실패 모드**: 범위 크리프가 품질을 저하시킴  
**해결책**: 컨텍스트 용량에 맞게 작업 크기 조정

```markdown
❌ 잘못된 방법:
"전체 인증 시스템을 구현해줘"

✅ PROSE 방법:
1. 먼저: JWT 토큰 유효성 검사 함수
2. 그다음: 미들웨어 적용
3. 그다음: 리프레시 토큰 로직
```

### O - Orchestrated Composition (오케스트레이션된 합성)

**실패 모드**: 모놀리식 프롬프트가 붕괴됨  
**해결책**: 작은 프리미티브에서 합성

```markdown
Agent Primitives:
- 단일 책임 에이전트 정의
- 재사용 가능한 스킬 모듈
- 합성 가능한 명령어

이 프리미티브들을 결합하여 복잡한 워크플로우 구성
```

### S - Safety Boundaries (안전 경계)

**실패 모드**: 무제한적 자율성이 불안전함  
**해결책**: 도구, 지식, 승인을 정의

```markdown
각 에이전트/스킬에:
- allowed-tools: 허용된 도구만 명시
- 작업 범위 명확히 제한
- 승인이 필요한 작업 정의
- 절대 하지 말 것 목록
```

### E - Explicit Hierarchy (명시적 계층)

**실패 모드**: 평평한 가이드가 컨텍스트를 오염시킴  
**해결책**: 전역에서 로컬로 가이드 레이어링

```markdown
전역 (AGENTS.md 루트)
  ↓ 구체화
모듈 (src/AGENTS.md)
  ↓ 더 구체화
컴포넌트 (src/auth/AGENTS.md)
  ↓ 최대 구체화
Skills (필요 시 로드)
```

---

## AI Primitives (에이전트 원시 요소)

PROSE는 AI Native 개발을 위한 5가지 핵심 프리미티브를 정의합니다:

### 1. Instructions File (항상 활성)

```markdown
# .github/copilot-instructions.md 또는 AGENTS.md

범위: 항상 활성 (전체 저장소)
목적: 일반 코딩 표준
특징: 항상 컨텍스트에 포함
```

### 2. Skills (조건부 활성)

```markdown
---
name: skill-name
description: 자동 활성화 트리거 설명
---
# 스킬 내용

범위: 컨텍스트/키워드로 활성화
목적: 특정 구현 시나리오
특징: description이 자동 召환 트리거
```

### 3. Prompts (온디맨드)

```markdown
# .github/prompts/prompt-name.md

범위: 사용자 명시적 호출
목적: 워크플로우 템플릿
특징: 재사용 가능한 작업 패턴
```

### 4. Chat Modes (역할 기반)

```markdown
# .github/chatmodes/mode-name.md

범위: 사용자가 모드 선택 시
목적: 역할 기반 AI 전문가
예: security-expert, data-analyst, frontend-architect
```

### 5. Specifications (구현 청사진)

```markdown
# .github/specs/feature-spec.md

범위: 특정 기능 구현 시
목적: 상세한 구현 청사진
특징: 단계별 지침 + 예제 코드
```

---

## PROSE Skill 설치

Claude Code 또는 GitHub Copilot CLI에서 직접 사용:

```bash
# 마켓플레이스 추가
/plugin marketplace add danielmeppiel/awesome-ai-native

# 스킬 설치
/plugin install prose-architect@prose
```

설치 후 자동 활성화:
- AI Native 앱 구축 요청 시
- 레거시 프로젝트 AI Native화 시
- 에이전트 워크플로우 설계 시

---

## Examples Repository 구조

```
_examples/
├── instructions/       # 도메인 특화 가이드
│   ├── backend-api.md
│   ├── frontend-react.md
│   └── data-pipeline.md
├── chatmodes/          # 역할 기반 AI 전문가
│   ├── security-expert.md
│   └── ux-researcher.md
├── prompts/            # 워크플로우 템플릿
│   ├── code-review.md
│   └── feature-planning.md
└── specifications/     # 구현 청사진
    └── auth-system.md
```

---

## 핵심 인사이트

### 패러다임 전환

> **전통적 접근**: "AI에게 무엇을 하라고 말하기"  
> **PROSE 접근**: "최적 인지 성능을 위한 컨텍스트와 구조를 설계하기"

### 5가지 실패 모드 해결

| PROSE 제약 | 해결하는 실패 모드 |
|----------|----------------|
| Progressive Disclosure | 컨텍스트 과부하로 주의 희석 |
| Reduced Scope | 범위 크리프로 품질 저하 |
| Orchestrated Composition | 모놀리식 프롬프트 붕괴 |
| Safety Boundaries | 무제한 자율성의 위험 |
| Explicit Hierarchy | 평평한 가이드의 컨텍스트 오염 |

---

## 배울 점

1. **PROSE 원칙** — 5가지 AI Native 개발 제약 조건 프레임워크
2. **Progressive Disclosure** — 필요할 때만 컨텍스트 로드 (토큰 최적화)
3. **Safety Boundaries** — 에이전트의 도구/지식/승인 범위 명시적 정의
4. **Explicit Hierarchy** — 전역→로컬 가이드 레이어링
5. **5가지 Primitive** — Instructions, Skills, Prompts, ChatModes, Specifications 분류
