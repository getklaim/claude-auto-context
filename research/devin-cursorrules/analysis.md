# grapeot/devin.cursorrules — AI 최적화 분석

> **GitHub**: https://github.com/grapeot/devin.cursorrules  
> **Stars**: ~5.9k  
> **License**: MIT  
> **분류**: 💡 특수 접근법 (살아있는 기억 패턴)

---

## 프로젝트 개요

devin.cursorrules는 Cursor와 GitHub Copilot을 [Devin](https://devin.ai)과 유사한 자율 에이전트처럼 만드는 설정 시스템입니다.
가장 독창적인 점은 **AI가 자신의 지시 파일을 직접 업데이트하는 "살아있는 기억" 패턴**입니다.

---

## AI 최적화 구성 요소

### 1. 살아있는 기억 패턴 (Living Memory Pattern)

핵심 지시:

```markdown
During your interaction with the user, if you find anything reusable in this project 
(e.g. version of a library, model name), especially about a fix to a mistake you made 
or a correction you received, you should take note in the `Lessons` section in the 
`.github/copilot-instructions.md` file so you will not make the same mistake again.
```

**AI가 직접 업데이트하는 파일 = 학습 기록 저장소**

---

### 2. 스크래치패드 시스템

```markdown
You should also use the `.github/copilot-instructions.md` file's "scratchpad" section 
as a Scratchpad to organize your thoughts. Especially when you receive a new task, 
you should first review the content of the Scratchpad, clear old different task if necessary, 
first explain the task, and plan the steps you need to take to complete the task.

You can use todo markers to indicate the progress, e.g.
[X] Task 1
[ ] Task 2

Also update the progress of the task in the Scratchpad when you finish a subtask.
Especially when you finished a milestone, it will help to improve your depth of 
task accomplishment to use the Scratchpad to reflect and plan.
```

**copilot-instructions.md = AI의 작업 공간 + 장기 기억**

---

### 3. Lessons 섹션 예시

AI가 스스로 축적한 교훈들:

```markdown
# Lessons

## User Specified Lessons
- Include "[Cursor] " in the commit message and PR title.
- Due to Cursor's limit, when you use `git` and need to submit a multiline commit message, 
  first write the message in a file, then use `git commit -F <filename>`

## Cursor learned
- For search results, ensure proper handling of different character encodings (UTF-8)
- Use 'gpt-4o' as the model name for OpenAI's GPT-4 with vision capabilities
- Use 'one-' prefix for one-shot learning models (e.g., 'one-mini')
- Always run `npm audit` before deploying
- When working with Python async code, use `asyncio.run()` not `loop.run_until_complete()`
```

---

### 4. 도구 시스템

프로젝트에 포함된 AI 사용 가능 도구들:

```
tools/
├── llm_api.py          - 멀티 프로바이더 LLM API
├── web_search.py       - 웹 검색 도구
├── web_scraper.py      - 웹 스크래퍼
└── screenshot.py       - 스크린샷 촬영 및 검증
```

#### 멀티 프로바이더 LLM API
```python
# tools/llm_api.py - 여러 LLM 프로바이더 지원
# OpenAI, Azure, DeepSeek, Anthropic, Gemini, 로컬 모델
```

#### 스크린샷 검증 워크플로우
```bash
# AI가 UI 변경을 시각적으로 검증
python tools/screenshot.py  # 스크린샷 촬영
# → AI가 스크린샷을 분석하여 변경 결과 확인
```

---

### 5. .cursorrules 구조

```markdown
# Instructions

## Role
You are an autonomous coding agent similar to Devin.

## Working Memory
- Use .github/copilot-instructions.md as your working memory
- Update the Scratchpad section as you work
- Record lessons learned in the Lessons section
- Never lose track of context between sessions

## Tools Available
- Screenshot: python tools/screenshot.py
- Web Search: python tools/web_search.py  
- Web Scraper: python tools/web_scraper.py
- LLM API: python tools/llm_api.py

## Workflow
1. Review existing Scratchpad content
2. Plan new task with [X]/[ ] checklist
3. Execute step by step
4. Update progress after each step
5. Record lessons learned

## Constraints
- Always verify changes visually with screenshots
- Test before claiming completion
- Never claim something works without evidence
```

---

## 핵심 인사이트

### "살아있는 기억" 패턴의 혁신성

일반적인 AI 코딩 도구:
- 매 세션마다 처음부터 시작
- 이전에 한 실수를 반복
- 컨텍스트를 잃어버림

devin.cursorrules의 접근:
- AI가 교훈을 파일에 직접 기록
- 다음 세션에서 그 파일을 읽어 이전 교훈 활용
- 세션 간 지속적 학습

### 작업 관리로서의 지시 파일

copilot-instructions.md를 단순한 설정 파일이 아닌:
- **스크래치패드**: 현재 작업 계획 및 진행상황
- **교훈 저장소**: 과거 실수 및 수정사항
- **장기 기억**: 세션 간 지속되는 컨텍스트

### 검증 우선 접근법

```
코드 변경 → 스크린샷 촬영 → AI가 시각적 검증 → 완료 확인
```

AI가 자신의 작업을 스스로 검증하는 루프를 명시적으로 설계.

---

## AI 자기개선 프로토콜

가장 진보적인 측면: AI가 자신의 지시 파일을 개선:

```markdown
## 자기개선 규칙:
1. 실수 발생 → Lessons 섹션에 기록
2. 사용자 수정 수령 → 교훈으로 변환하여 저장
3. 반복적인 패턴 발견 → 명시적 규칙으로 추가
4. 라이브러리 버전 발견 → 참조용으로 기록
```

---

## 배울 점

1. **살아있는 기억 패턴** — AI가 지시 파일을 직접 업데이트하여 세션 간 학습
2. **스크래치패드 패턴** — 지시 파일을 AI의 작업 공간으로 활용
3. **교훈 섹션** — 실수와 수정사항을 체계적으로 축적
4. **시각적 검증 워크플로우** — 스크린샷으로 변경 결과 확인
5. **멀티 프로바이더 도구** — 여러 LLM에 접근하는 도구를 AI에게 제공
