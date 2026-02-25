# microsoft/semanticworkbench — AI 최적화 분석

> **GitHub**: https://github.com/microsoft/semanticworkbench  
> **Stars**: 387  
> **핵심 패턴**: `make ai-context-files` 자동 컨텍스트 생성 시스템 — 20개 논리적 경계 파일 + 스마트 diff + 역할별 파일 라우팅

---

## 개요

microsoft/semanticworkbench는 Semantic Workbench AI 플랫폼의 오픈소스 구현이다.  
AI 최적화의 핵심은 **코드베이스를 자동으로 AI 컨텍스트 파일로 변환하는 파이프라인**이다. 440MB+ 대규모 모노레포에서 AI가 필요한 파일만 논리적 경계로 묶어 제공한다. `make ai-context-files` 하나로 20개의 역할별 컨텍스트 파일이 생성된다.

---

## 파일 구조

```
microsoft/semanticworkbench/
├── CLAUDE.md                              ← AI 개발자 가이드 + 컨텍스트 파일 라우팅
├── Makefile                               ← ai-context-files 타겟
├── tools/
│   ├── build_ai_context_files.py          ← 오케스트레이터 (20개 태스크 정의)
│   └── collect_files.py                  ← 파일 수집 엔진 (독립 CLI 포함)
└── ai_context/
    └── generated/                         ← 생성된 20개 컨텍스트 파일
        ├── PYTHON_LIBRARIES_CORE.md
        ├── PYTHON_LIBRARIES_AI_CLIENTS.md
        ├── WORKBENCH_FRONTEND.md
        ├── WORKBENCH_SERVICE.md
        ├── ASSISTANTS_OVERVIEW.md
        ├── ASSISTANT_PROJECT.md           ← (가장 복잡한 어시스턴트)
        └── ... (20개 총)
```

`AGENTS.md` 없음 — `CLAUDE.md`가 AI 개발자 가이드 역할.

---

## make ai-context-files 명령

```makefile
.PHONY: ai-context-files
ai-context-files:
	@echo "Building AI context files..."
	@python tools/build_ai_context_files.py
	@echo "AI context files generated in ai_context/generated/"
```

단순한 9줄 Makefile 타겟. 실제 로직은 `tools/build_ai_context_files.py`에 있다.

---

## 자동 컨텍스트 생성 시스템

### build_ai_context_files.py — 오케스트레이터

20개 태스크 디스크립터를 정의하여 소스 경로 → 출력 파일을 매핑한다:

```python
tasks = [
    {
        "patterns": [
            "libraries/python/semantic-workbench-api-model", 
            "libraries/python/semantic-workbench-assistant", 
            "libraries/python/events"
        ],
        "output": f"{OUTPUT_DIR}/PYTHON_LIBRARIES_CORE.md",
        "exclude": collect_files.DEFAULT_EXCLUDE,
        "include": ["pyproject.toml", "README.md"],  # 항상 포함
    },
    {
        "patterns": ["workbench-app/src"],
        "output": f"{OUTPUT_DIR}/WORKBENCH_FRONTEND.md",
        "exclude": collect_files.DEFAULT_EXCLUDE + ["*.svg", "*.png", "*.jpg"],
        "include": ["package.json", "tsconfig.json", "vite.config.ts"],
    },
    # ... 18개 더
]
```

**스마트 Diff — 타임스탬프 무시**:
```python
def strip_date_line(text: str) -> str:
    """Remove any '**Date:** …' line so we can compare content ignoring timestamps."""
    return re.sub(r"^\*\*Date:\*\*.*\n?", "", text, flags=re.MULTILINE)

# 내용이 동일하면 (타임스탬프 제외) 쓰기 건너뜀
if existing_sanitized == new_sanitized:
    print(f"No substantive changes in {output}, skipping write.")
    continue
```

이로 인해 CI에서 `make ai-context-files`를 실행해도 변경 없으면 파일이 업데이트되지 않는다.

### collect_files.py — 파일 수집 엔진

```python
DEFAULT_EXCLUDE = [
    ".venv", "node_modules", "*.lock", ".git", "__pycache__", 
    "*.pyc", "*.ruff_cache", "logs", "output"
]

# include가 exclude를 오버라이드 — pyproject.toml은 항상 포함
def collect_files(patterns, exclude_patterns, include_patterns) -> List[str]:
    ...
```

바이너리 파일 감지:
```python
def read_file(file_path):
    with open(file_path, "rb") as f:
        chunk = f.read(1024)
        if b"\0" in chunk:  # 단순 바이너리 감지
            return "[Binary file not displayed]", None
```

독립 CLI로도 사용 가능:
```bash
python collect_files.py *.py --exclude "tests" --format markdown > output.md
```

---

## 20개 생성 파일 전체 목록

| 파일 | 소스 경로 |
|------|---------|
| `PYTHON_LIBRARIES_CORE.md` | api-model, assistant framework, events |
| `PYTHON_LIBRARIES_AI_CLIENTS.md` | anthropic-client, openai-client, llm-client |
| `PYTHON_LIBRARIES_EXTENSIONS.md` | assistant-extensions, mcp-extensions, mcp-tunnel, content-safety |
| `PYTHON_LIBRARIES_SPECIALIZED.md` | assistant-drive, guided-conversation |
| `PYTHON_LIBRARIES_SKILLS.md` | skills library |
| `DOTNET_LIBRARIES.md` | libraries/dotnet |
| `WORKBENCH_FRONTEND.md` | workbench-app/src |
| `WORKBENCH_SERVICE.md` | workbench-service |
| `ASSISTANTS_OVERVIEW.md` | 모든 어시스턴트 README + Makefile |
| `ASSISTANT_PROJECT.md` | assistants/project-assistant (가장 복잡) |
| `ASSISTANT_DOCUMENT.md` | assistants/document-assistant |
| `ASSISTANT_CODESPACE.md` | assistants/codespace-assistant |
| `ASSISTANT_NAVIGATOR.md` | assistants/navigator-assistant |
| `ASSISTANT_PROSPECTOR.md` | assistants/prospector-assistant |
| `ASSISTANTS_OTHER.md` | explorer, guided-conversation, skill assistants |
| `MCP_SERVERS.md` | mcp-servers |
| `EXAMPLES.md` | examples |
| `TOOLS.md` | tools |
| `CONFIGURATION.md` | 루트 *.md, *.toml, Makefile, *.json, *.yml |
| `ASPIRE_ORCHESTRATOR.md` | aspire-orchestrator |

---

## 생성 파일 형식

```markdown
# libraries/python/semantic-workbench-api-model | ...

[collect-files]

**Search:** ['libraries/python/semantic-workbench-api-model', ...]
**Exclude:** ['.venv', 'node_modules', ...]
**Include:** ['pyproject.toml', 'README.md']
**Date:** 5/29/2025, 11:45:28 AM
**Files:** 45

=== File: README.md ===
<원본 파일 내용>

=== File: libraries/python/.../pyproject.toml ===
<원본 파일 내용>
```

**마크다운 코드 블록이 아닌 `=== File: path ===` 구분자** 사용 — AI 컨텍스트 창에 직접 주입되는 형식.

---

## CLAUDE.md — 역할별 파일 라우팅

CLAUDE.md의 핵심은 **어떤 역할의 개발자가 어떤 컨텍스트 파일을 읽어야 하는지** 명시한다:

```markdown
## AI Context System

**Generate comprehensive codebase context for development:**
* `make ai-context-files` - Generate AI context files for all components
* Files created in `ai_context/generated/` organized by logical boundaries:

**Usage by developer role:**
- 신규 개발자 → `CONFIGURATION.md` + `PYTHON_LIBRARIES_CORE.md`
- 어시스턴트 구축 → `ASSISTANTS_OVERVIEW.md` 먼저, 이후 `ASSISTANT_*.md`
- 프론트엔드 작업 → `WORKBENCH_FRONTEND.md`
- 백엔드 API 작업 → `WORKBENCH_SERVICE.md`
- MCP 서버 작업 → `MCP_SERVERS.md`
```

---

## 설계 원칙 분석

### 1. 논리적 경계 그룹화 (디렉토리 미러링 아님)

Python 라이브러리가 기능 역할(core/AI 클라이언트/확장/특화/skills)로 분리된다. 폴더 구조가 아닌 **사용 케이스 기준**으로 묶인다. "LLM 클라이언트 추가" 작업은 45개 파일 컨텍스트로 집중, 2000개 파일 전체 레포가 아니다.

### 2. include가 exclude를 오버라이드

설정 파일(`pyproject.toml`, `README.md`, `package.json`)은 디렉토리 제외 여부와 무관하게 항상 포함된다. AI 컨텍스트에 의존성/인터페이스 정보가 항상 있도록 보장한다.

### 3. 멱등 생성 (타임스탬프 인식 diff)

`strip_date_line()`으로 타임스탬프를 제거하고 비교. 내용이 동일하면 파일을 쓰지 않는다. CI에서 안전하게 실행 가능.

### 4. `--force` 플래그

```bash
python tools/build_ai_context_files.py --force
```

diff 체크를 우회하고 모든 파일을 무조건 덮어씀.

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| 자동 컨텍스트 생성 | Makefile 타겟 → Python 스크립트 파이프라인 |
| 논리적 경계 분리 | 폴더 구조 아닌 기능 역할로 파일 묶기 |
| 역할별 라우팅 | CLAUDE.md에 "역할 → 읽을 파일" 매핑 |
| 스마트 diff | 타임스탬프 제거 후 비교, 불필요한 쓰기 방지 |
| include 오버라이드 | 설정 파일은 항상 포함 |
| 바이너리 감지 | `\0` 바이트로 바이너리 파일 자동 건너뜀 |
| 독립 CLI | collect_files.py는 단독 도구로도 사용 가능 |

---

## 요약

microsoft/semanticworkbench의 AI 최적화는 **"코드베이스를 직접 AI 컨텍스트로 변환하는 파이프라인"**이라는 혁신적 접근이다. 수동으로 AGENTS.md를 유지하는 대신, 코드 변경 시 `make ai-context-files` 하나로 20개의 최신 컨텍스트 파일이 자동 생성된다. 역할별 라우팅으로 AI가 필요한 파일만 읽도록 안내하여 컨텍스트 창을 효율적으로 사용한다.

| 지표 | 값 |
|------|-----|
| 생성 컨텍스트 파일 | 20개 |
| 생성 도구 | build_ai_context_files.py (Python) |
| 지원 AI 도구 | Claude Code (CLAUDE.md) |
| 핵심 혁신 | 자동 컨텍스트 생성 파이프라인 |
| 추가 특징 | 스마트 diff, 역할별 라우팅, 멱등 생성 |
