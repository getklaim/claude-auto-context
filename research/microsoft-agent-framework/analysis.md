# microsoft/agent-framework — AI 최적화 분석

> **GitHub**: https://github.com/microsoft/agent-framework  
> **Stars**: 마이크로소프트 공식 프로젝트  
> **License**: MIT  
> **분류**: 🥈 기본 AI 최적화 (Microsoft Skills 표준)

---

## 프로젝트 개요

Microsoft Agent Framework는 AI 에이전트 구축을 위한 Python 프레임워크입니다.
`.github/skills/` 디렉토리를 통해 GitHub Copilot과 Claude를 위한 Skills 시스템을 구현합니다.

---

## AI 최적화 구성 요소

### 1. AGENTS.md + 패키지별 AGENTS.md

```
/python/AGENTS.md                       - Python 코드베이스 전체 개요
/python/packages/core/AGENTS.md         - 코어 에이전트 프레임워크
/python/packages/anthropic/AGENTS.md    - Anthropic Claude 통합
/python/packages/azure-ai/AGENTS.md     - Azure AI Foundry 에이전트
/python/packages/azure-ai-search/AGENTS.md - Azure AI Search RAG
/python/packages/bedrock/AGENTS.md      - AWS Bedrock
/python/packages/ollama/AGENTS.md       - 로컬 Ollama 추론
/python/packages/mem0/AGENTS.md         - Mem0 메모리 통합
/python/packages/redis/AGENTS.md        - Redis 스토리지
... (20+ 패키지)
```

---

### 2. Skills 시스템 (`.github/skills/`)

```
.github/skills/
├── python-development/SKILL.md     - 코딩 표준, 타입 어노테이션, docstring, 로깅
├── python-testing/SKILL.md         - 테스트 구조, fixtures, async 모드
├── python-code-quality/SKILL.md    - 린팅, 포매팅, 타입 체킹, pre-commit hooks
├── python-package-management/SKILL.md - 모노레포 구조, lazy loading, 버전 관리
└── python-samples/SKILL.md         - 샘플 파일 구조, PEP 723, 문서 가이드라인
```

**Skills 참조 방식 (AGENTS.md에서):**
```markdown
**Agent Skills** (`.github/skills/`) — 온디맨드 로드되는 상세 작업별 지침:
- `python-development` — 코딩 표준, 타입 어노테이션, docstring, 로깅, 성능
- `python-testing` — 테스트 구조, fixtures, async 모드, 테스트 실행
- `python-code-quality` — 린팅, 포매팅, 타입 체킹, pre-commit hooks, CI 워크플로우
- `python-package-management` — 모노레포 구조, lazy loading, 버전 관리, 새 패키지
- `python-samples` — 샘플 파일 구조, PEP 723, 문서 가이드라인
```

---

### 3. 프로젝트 구조 (AI용 빠른 참조)

```
python/
├── packages/
│   ├── core/                 # agent-framework-core (메인 패키지)
│   │   ├── agent_framework/  # 공개 API 내보내기
│   │   └── tests/
│   ├── azure-ai/             # agent-framework-azure-ai
│   ├── anthropic/            # agent-framework-anthropic
│   ├── ollama/               # agent-framework-ollama
│   └── ...                   # 기타 프로바이더 패키지
├── samples/                  # 샘플 코드 및 예제
├── .github/skills/           # Copilot용 에이전트 Skills
└── tests/                    # 통합 테스트
```

---

### 4. 패키지 관계

```
agent-framework-core 
  → 코어 추상화 및 OpenAI/Azure OpenAI 내장 지원
  
프로바이더 패키지들 (azure-ai, anthropic, 등)
  → core를 상속하여 특정 통합 확장
  
코어는 provider 폴더의 __getattr__로 lazy loading 구현
  예: agent_framework/azure/
```

---

### 5. 문서 유지보수 규칙

```markdown
## 문서 유지보수

패키지 변경 시 다음 항목 업데이트 여부 확인:
- 패키지의 `AGENTS.md` 파일
  (공개 API 추가/제거/이름변경, 아키텍처 변경, import 경로 변경 시)
- `.github/skills/`의 에이전트 Skills
  (컨벤션, 명령어, 워크플로우 변경 시)
```

---

### 6. 빠른 참조 명령어

```bash
# python/ 디렉토리에서 uv run poe 실행하면 사용 가능한 명령어 확인
uv run poe

# 상세 사용법은 DEV_SETUP.md 참조
```

---

## 패키지별 AGENTS.md 예시

### 코어 패키지 (`packages/core/AGENTS.md`)

```markdown
# agent-framework-core

## Purpose
Core abstractions, types, and built-in OpenAI/Azure OpenAI support.

## Key Modules
- `agent_framework/` - Public API exports
- `agent_framework/azure/` - Azure OpenAI (lazy loaded)
- `agent_framework/openai/` - OpenAI client

## Key Patterns
- Lazy loading via __getattr__ for provider modules
- Type annotations everywhere
- Async-first design
```

---

## 핵심 인사이트

### Microsoft의 Skills 접근 방식

Microsoft는 `.github/skills/` 폴더를 통해 GitHub Copilot의 Skills 표준을 구현.
각 스킬은 언제 사용해야 하는지를 YAML frontmatter로 명시하여 자동 활성화.

### 패키지별 AGENTS.md 패턴

모노레포에서 각 패키지/라이브러리에 독립적인 AGENTS.md를 두는 패턴.
AI가 특정 패키지 작업 시 해당 패키지의 AGENTS.md에서 정확한 컨텍스트 로드.

### 문서 동기화 규칙

코드 변경 → AGENTS.md 업데이트 → Skills 업데이트의 3단계 동기화 규칙을 명시.
AI 가이드 문서가 항상 최신 상태를 유지하도록 강제.

---

## 배울 점

1. **Python 특화 스킬** — 언어별 특화된 skills (타입 어노테이션, async, PEP 규칙 등)
2. **패키지별 AGENTS.md** — 모노레포에서 각 패키지에 독립 가이드
3. **문서 동기화 3단계** — 코드 → AGENTS.md → Skills 동시 업데이트 규칙
4. **Lazy loading 패턴 문서화** — 프로바이더 패키지의 lazy loading 아키텍처 명시
5. **Copilot Skills 표준 준수** — Microsoft의 공식 Skills 포맷 사용
