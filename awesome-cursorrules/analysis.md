# PatrickJS/awesome-cursorrules — AI 최적화 분석

> **GitHub**: https://github.com/PatrickJS/awesome-cursorrules  
> **Stars**: ~38k  
> **License**: CC0-1.0  
> **분류**: 📚 컬렉션 (가장 포괄적인 .cursorrules 모음)

---

## 프로젝트 개요

awesome-cursorrules는 Cursor AI 편집기용 `.cursorrules` 파일의 커뮤니티 컬렉션입니다.
100+ 다양한 기술 스택에 맞춘 규칙 파일들을 카테고리별로 정리하여 제공합니다.

---

## `.cursorrules`란?

```
프로젝트 루트에 놓인 설정 파일 (.cursorrules)
→ Cursor AI가 코드 생성 시 따르는 규칙/행동 지침
→ 사실상 AI에게 보내는 system prompt
→ 글로벌 Cursor 설정에 추가됨 (누적)
```

---

## 카테고리별 주요 .cursorrules

### Frontend 프레임워크 & 라이브러리

#### Next.js 15 + React 19 + Vercel AI + Tailwind (가장 정교)
```
You are an expert senior software engineer specializing in modern web development, 
with deep expertise in TypeScript, React 19, Next.js 15 (App Router), Vercel AI SDK, 
Shadcn UI, Radix UI, and Tailwind CSS.

## Analysis Process
Before responding, follow these steps:
1. Request Analysis - Determine task type, identify languages/frameworks
2. Solution Planning - Break down into logical steps
3. Implementation Strategy - Choose design patterns

## TypeScript Usage
- Use TypeScript for all code
- Prefer interfaces over types
- Avoid enums; use const maps instead
- Use `satisfies` operator for type validation

## React 19 Best Practices
- Use `useActionState` instead of deprecated `useFormState`
- Minimize 'use client', 'useEffect', setState - Favor RSC
- Model expected errors as return values in Server Actions
```

#### React + TypeScript (일반)
```
You are an expert AI programming assistant that primarily focuses on producing 
clear, readable React and TypeScript code.

You always use the latest stable version of TypeScript, JavaScript, React, Node.js, 
Next.js App Router, Shadcn UI, Tailwind CSS.

You carefully provide accurate, factual, thoughtful answers.
```

#### Vue 3 + Nuxt 3 + TypeScript
```
You are an expert in TypeScript, Node.js, Nuxt 3, Vue 3, Shadcn Vue, Radix Vue, 
VueUse, and Tailwind CSS.

Key Principles:
- Write concise, maintainable, and technically accurate TypeScript code
- Use functional and declarative programming patterns; avoid classes
- Favor iteration and modularization over code duplication
```

---

### Backend & Full-Stack

#### Python + FastAPI
```
You are an expert in Python, FastAPI, and scalable API development.

Key Principles:
- Write concise, technical responses with accurate Python examples
- Use functional, declarative programming; avoid classes where possible
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., is_active, has_permission)

FastAPI Best Practices:
- Use functional components (plain functions) and Pydantic models
- Use declarative route definitions with clear return type annotations
- Prefer async/await for asynchronous operations
```

#### Go REST API
```
You are an expert AI programming assistant specializing in building APIs with Go, 
using the standard library's net/http package and the new ServeMux introduced in Go 1.22.

Always use the latest stable version of Go (1.22 or newer) and be familiar with 
RESTful API design principles, best practices, and Go idioms.

Follow the user's requirements carefully & to the letter.
First think step-by-step - describe your plan in pseudocode.
```

#### TypeScript + NestJS
```
You are an expert in TypeScript, Node.js, NestJS framework.

Code Style and Structure:
- Write clean, maintainable TypeScript code
- Use decorators appropriately (@Module, @Controller, @Injectable, etc.)
- Follow NestJS architectural patterns (modules, controllers, services, repositories)
- Implement dependency injection properly
- Use TypeScript strict mode
```

---

### 모바일 개발

#### React Native Expo
```
You are an expert AI programming assistant that primarily focuses on building 
React Native applications with Expo SDK.

Always use the latest versions of React Native and Expo SDK.
Use TypeScript for all code.
Use Expo Router for navigation.
```

#### SwiftUI
```
You are an expert iOS developer specializing in SwiftUI.

Follow Apple's Human Interface Guidelines.
Use SwiftUI's latest APIs and features.
Use @State, @StateObject, @ObservedObject, @Binding appropriately.
Implement proper error handling and loading states.
```

---

## 공통 구조 패턴

대부분의 `.cursorrules` 파일이 따르는 구조:

```
1. 역할 선언 (Role Declaration)
   "You are an expert in [technology stack]..."

2. 핵심 원칙 (Key Principles)
   - Write concise, technical code
   - Use functional/declarative patterns
   - Prefer composition over inheritance

3. 코드 스타일 (Code Style)
   - 명명 컨벤션
   - 타입 시스템 사용 방법
   - 파일 구조

4. 프레임워크 특화 규칙
   - 최신 API 사용 지침
   - 성능 최적화 팁
   - 안티패턴 회피

5. 에러 처리 (Error Handling)
   - Early returns
   - Edge case handling
   - User feedback states
```

---

## 2026 최신 트렌드

### "Concise Architect" 규칙

2026 최신 모범 사례:

```markdown
# 2026 Best Practices

## 행동 전환 (Behavior Shift)
Old: "게으르지 마라" (모델이 게으른 것이 문제였음)
New: "과도하게 설명하지 마라" (모델이 너무 장황한 것이 문제)

## 새로운 규칙
- Be concise. Do not explain standard code patterns unless asked.
- Focus on the "Unique Value" of the change.
- If a solution is effectively identical to existing code, say "No changes needed".
- No unnecessary boilerplate, no re-explaining the obvious.

## Security First (에이전트용 필수)
에이전트가 재귀적으로 실행되므로 보안 제약을 명시적으로 추가:
- Never execute shell commands without explicit confirmation
- Never modify files outside the project directory
- Ask before creating new files in unexpected locations
```

---

## 사용 방법

### 방법 1: 직접 복사
```bash
# 프로젝트 루트에 .cursorrules 복사
cp awesome-cursorrules/rules/nextjs-react-typescript/.cursorrules ./

# 필요에 맞게 커스터마이즈
```

### 방법 2: VSCode Extension 사용
```
1. "Cursor Rules: Add .cursorrules" 확장 설치
2. Cmd+Shift+P → "Cursor Rules: Add .cursorrules"
3. 원하는 규칙 선택
```

---

## 새로운 Cursor .mdc 형식 (Cursor 0.45+)

Legacy `.cursorrules` 대신 `.cursor/rules/` 폴더의 `.mdc` 파일 사용:

```markdown
---
description: TypeScript React 컴포넌트 개발 규칙
globs: ["src/components/**/*.tsx", "src/pages/**/*.tsx"]
---

# React 컴포넌트 규칙

- 함수형 컴포넌트만 사용
- TypeScript strict 모드
- Props는 인터페이스로 정의
```

**장점:**
- `globs`로 파일 패턴별 규칙 적용
- 여러 규칙 파일 분리 관리
- 더 세밀한 컨텍스트 제어

---

## 핵심 인사이트

### .cursorrules = 팀의 코딩 표준서

`.cursorrules`의 가장 큰 가치는 팀 내 AI 생성 코드의 일관성:

> "By defining coding standards and best practices in your .cursorrules file, 
> you can ensure that the AI generates code that aligns with your project's style guidelines."

### 역할 페르소나가 효과적인 이유

"You are an expert in X" 로 시작하는 이유:
- AI가 해당 도메인의 베스트 프랙티스를 적용
- 최신 버전 API 사용 촉진
- 특정 스타일 가이드 따르기

### 네거티브 규칙의 중요성

금지 사항을 명시하는 것이 긍정 규칙만큼 중요:
- "Avoid enums; use const maps instead"
- "Never use 'any' type"
- "Don't use class components"
- "Minimize 'use client'"

---

## 배울 점

1. **역할 선언으로 시작** — "You are an expert in [stack]..." 로 AI에게 전문가 페르소나 부여
2. **금지 사항 명시** — 특정 패턴 사용 금지를 명확히 기술
3. **최신 API 강제** — 구버전 API 대신 최신 API 사용 지시
4. **분석 프로세스 정의** — 코딩 전 분석 단계 명시
5. **2026 트렌드: 간결성 강제** — "과도한 설명 금지" 규칙 추가
