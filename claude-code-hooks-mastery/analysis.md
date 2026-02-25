# disler/claude-code-hooks-mastery — AI 최적화 분석

> **GitHub**: https://github.com/disler/claude-code-hooks-mastery  
> **핵심 패턴**: 13개 Claude Code 훅 이벤트 완전 구현 — 보안 차단, 자동 린팅, LLM 에이전트 명명, TTS 완료 메시지, 권한 자동 제어

---

## 개요

`disler/claude-code-hooks-mastery`는 Claude Code의 13개 훅 이벤트를 모두 구현한 레퍼런스 레포지토리다. 단순한 예제를 넘어, UV 단일 파일 스크립트 아키텍처로 가상환경 없이 즉시 실행 가능한 훅 시스템을 구현한다. LLM이 다른 LLM의 행동을 제어하는 **메타 AI 시스템**의 사례이기도 하다.

---

## 파일 구조

```
disler/claude-code-hooks-mastery/
└── .claude/
    ├── settings.json                   ← 모든 훅 이벤트 설정
    ├── hooks/
    │   ├── pre_tool_use.py             ← PreToolUse: 보안 차단
    │   ├── post_tool_use.py            ← PostToolUse: 검증/린팅
    │   ├── user_prompt_submit.py       ← UserPromptSubmit: 로깅 + 에이전트 명명
    │   ├── notification.py             ← Notification: TTS 알림
    │   ├── stop.py                     ← Stop: 완료 메시지 + 트랜스크립트
    │   ├── subagent_stop.py            ← SubagentStop: 서브에이전트 완료 알림
    │   ├── session_start.py            ← SessionStart: 개발 컨텍스트 로딩
    │   ├── permission_request.py       ← PermissionRequest: 자동 허가/거부
    │   ├── setup.py                    ← Setup: 컨텍스트 주입
    │   └── validators/
    │       └── ruff_validator.py       ← PostToolUse용 Ruff 린터 자동 차단
    └── status_lines/
        └── status_line_v6.py           ← 동적 상태 표시줄
```

---

## 13개 훅 이벤트 완전 참조

| # | 훅 | 실행 시점 | 차단 가능? |
|---|---|---------|---------|
| 1 | **UserPromptSubmit** | 사용자 프롬프트 제출, Claude 처리 전 | ✅ exit 2 |
| 2 | **PreToolUse** | 도구 실행 전 | ✅ exit 2 |
| 3 | **PostToolUse** | 도구 성공 완료 후 | ⚠️ 피드백만 |
| 4 | **PostToolUseFailure** | 도구 실행 실패 시 | ❌ |
| 5 | **Notification** | Claude가 알림 발송 시 | ❌ |
| 6 | **Stop** | Claude 응답 완료 시 | ✅ 중지 차단 |
| 7 | **SubagentStart** | Task 도구 서브에이전트 생성 시 | ❌ |
| 8 | **SubagentStop** | Task 도구 서브에이전트 완료 시 | ✅ |
| 9 | **PreCompact** | 컨텍스트 압축 전 | ❌ |
| 10 | **SessionStart** | 세션 시작 또는 재개 시 | ❌ |
| 11 | **SessionEnd** | 세션 종료 시 | ❌ |
| 12 | **PermissionRequest** | 사용자에게 권한 대화상자 표시 시 | ✅ allow/deny |
| 13 | **Setup** | Claude가 레포 진입(초기화) 또는 주기적 유지보수 시 | ❌ |

---

## settings.json — 훅 설정 구조

```json
{
  "permissions": {
    "allow": ["Bash(mkdir:*)", "Bash(uv:*)", "Write", "Edit"],
    "deny": []
  },
  "statusLine": {
    "type": "command",
    "command": "uv run $CLAUDE_PROJECT_DIR/.claude/status_lines/status_line_v6.py",
    "padding": 0
  },
  "hooks": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [{"type": "command", "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/pre_tool_use.py"}]
    }],
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{"type": "command", "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/post_tool_use.py"}]
    }],
    "UserPromptSubmit": [{
      "hooks": [{"type": "command", "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/user_prompt_submit.py --log-only --store-last-prompt --name-agent"}]
    }],
    "PermissionRequest": [{
      "matcher": "",
      "hooks": [{"type": "command", "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/permission_request.py --log-only"}]
    }]
    // ... 나머지 9개 이벤트
  }
}
```

**핵심**: `$CLAUDE_PROJECT_DIR` 접두사로 경로를 안정적으로 해결. 모든 훅이 UV 단일 파일 Python 스크립트.

---

## UV 단일 파일 스크립트 아키텍처

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["python-dotenv"]
# ///
```

가상환경 관리 없음 — UV가 스크립트별로 의존성을 자동 해결한다.

**JSON 데이터 흐름**: Claude Code → stdin(JSON) → 훅 → stdout/stderr → exit code(제어)

---

## 주요 훅 구현 상세

### PreToolUse — 보안 차단

```python
# rm -rf 변형을 포괄적 정규식으로 차단
patterns = [
    r'\brm\s+.*-[a-z]*r[a-z]*f',       # rm -rf, rm -fr, rm -Rf
    r'\brm\s+--recursive\s+--force',
]
if is_dangerous_rm_command(command):
    print("BLOCKED: Dangerous rm command detected", file=sys.stderr)
    sys.exit(2)  # ← exit 2 = 도구 호출 차단, 오류를 Claude에 전달

# .env 파일 접근 차단
if is_env_file_access(tool_name, tool_input):
    print("BLOCKED: Access to .env files is prohibited", file=sys.stderr)
    sys.exit(2)
```

### UserPromptSubmit — LLM 에이전트 명명

```python
# Ollama → Anthropic → OpenAI 폴백으로 유니크 에이전트 이름 생성
if name_agent and "agent_name" not in session_data:
    result = subprocess.run(["uv", "run", ".claude/hooks/utils/llm/ollama.py", "--agent-name"], ...)
    # 예: "Phoenix", "Sage", "Nova" (단일 단어, 영숫자)
    session_data["agent_name"] = agent_name

# 프롬프트를 세션별 JSON에 저장
# .claude/data/sessions/<session_id>.json
session_data["prompts"].append(prompt)
```

### PostToolUse — Ruff 린터 자동 차단

```python
# 모든 Write/Edit에서 .py 파일에 자동 실행
if not file_path.endswith(".py"):
    print(json.dumps({}))  # 비Python 파일은 통과
    return

result = subprocess.run(["uvx", "ruff", "check", file_path], ...)
if result.returncode != 0:
    print(json.dumps({
        "decision": "block",
        "reason": f"Lint check failed:\n{error_output[:500]}"
    }))
    # Claude가 이를 받아 린트 오류를 수정 후 진행
```

### Stop — AI 생성 TTS 완료 메시지

```python
# LLM 우선순위: OpenAI > Anthropic > Ollama > 랜덤 폴백
def get_llm_completion_message():
    if os.getenv('OPENAI_API_KEY'):
        result = subprocess.run(["uv", "run", oai_script, "--completion"], timeout=10)
        if result.returncode == 0: return result.stdout.strip()
    # Anthropic, Ollama로 폴백...

# JSONL 트랜스크립트 → 읽기 가능한 chat.json 변환
if args.chat and 'transcript_path' in input_data:
    for line in open(transcript_path):
        chat_data.append(json.loads(line))
    json.dump(chat_data, open('logs/chat.json', 'w'))
```

### PermissionRequest — 읽기 전용 작업 자동 허가

```python
READ_ONLY_PATTERNS = {
    "Read": lambda tool_input: True,   # 모든 Read 자동 허가
    "Glob": lambda tool_input: True,
    "Grep": lambda tool_input: True,
    "Bash": lambda tool_input: is_safe_bash_command(tool_input.get("command", "")),
}
SAFE_BASH_COMMANDS = [
    r"^ls\b", r"^pwd\b", r"^git\s+(status|log|diff|show|branch|tag)\b", ...
]

# 허가/거부 JSON 출력
def create_allow_response():
    return {"hookSpecificOutput": {"hookEventName": "PermissionRequest", 
                                    "decision": {"behavior": "allow"}}}
```

### Setup — 컨텍스트 주입

```python
# 세션 초기화 시 프로젝트 컨텍스트를 Claude의 시스템 프롬프트에 주입
output = {
    "hookSpecificOutput": {
        "hookEventName": "Setup",
        "additionalContext": context  # git 브랜치, 의존성, 프로젝트 파일 등
    }
}
print(json.dumps(output))
```

### SessionStart — 개발 컨텍스트 로딩

```python
# 세션 시작 시 자동 로드
context_parts = [f"Git branch: {branch}", f"Uncommitted changes: {changes} files"]

# .claude/CONTEXT.md, .claude/TODO.md, TODO.md 읽기
for file_path in [".claude/CONTEXT.md", ".claude/TODO.md", "TODO.md"]:
    if Path(file_path).exists():
        context_parts.append(open(file_path).read()[:1000])

# GitHub 오픈 이슈 최근 5개 로드
issues = subprocess.run(['gh', 'issue', 'list', '--limit', '5', '--state', 'open'], ...)
```

---

## JSON 흐름 제어 참조

```json
// PreToolUse — 도구 차단
{ "decision": "block", "reason": "Claude에게 표시되는 설명" }

// PreToolUse — 권한 우회
{ "decision": "approve", "reason": "사용자에게 표시" }

// PostToolUse — Claude 재시도 강제
{ "decision": "block", "reason": "파일 쓰기 실패, 권한 확인" }

// Stop — Claude 종료 방지
{ "decision": "block", "reason": "테스트 실패 중. 완료 전 수정 필요." }

// Setup/SessionStart — 컨텍스트 주입
{ "hookSpecificOutput": { "hookEventName": "Setup", "additionalContext": "..." } }

// PermissionRequest — 자동 허가
{ "hookSpecificOutput": { "hookEventName": "PermissionRequest", "decision": { "behavior": "allow" } } }

// 출력 억제
{ "continue": true, "suppressOutput": true }
```

---

## 가장 혁신적인 패턴

| 패턴 | 구현 |
|------|------|
| LLM이 LLM을 명명 | Ollama/Anthropic/OpenAI로 에이전트 이름 생성 (Phoenix, Sage) |
| PostToolUse 린터 차단 | Python 파일 쓰기마다 Ruff 자동 실행, 실패 시 차단 |
| TTS 완료 메시지 | LLM 생성 완료 메시지를 ElevenLabs/OpenAI/pyttsx3로 읽어줌 |
| 트랜스크립트 변환 | Stop 훅이 JSONL → 읽기 가능한 chat.json으로 자동 변환 |
| 컨텍스트 주입 | Setup이 git 상태 + GitHub 이슈를 시스템 프롬프트에 자동 추가 |
| 읽기 전용 자동 허가 | PermissionRequest가 Read/Glob/Grep을 사용자 없이 자동 허가 |

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| UV 단일 파일 스크립트 | 가상환경 없이 즉시 실행 가능한 훅 |
| exit 2 차단 | 도구 실행 전 보안 검사, 실패 시 exit 2 |
| PostToolUse 린팅 | 파일 쓰기마다 린터 자동 실행 |
| 에이전트 명명 | 세션마다 유니크한 이름으로 추적 가능 |
| 컨텍스트 주입 | Setup/SessionStart로 프로젝트 상태 자동 주입 |
| 권한 자동화 | PermissionRequest로 안전한 작업 자동 허가 |

---

## 요약

`claude-code-hooks-mastery`는 Claude Code 훅 시스템의 **완전한 레퍼런스 구현**이다. 보안 차단(PreToolUse), 자동 린팅(PostToolUse), LLM 에이전트 명명(UserPromptSubmit), 읽기 전용 자동 허가(PermissionRequest), 프로젝트 컨텍스트 주입(Setup)이 모두 UV 단일 파일 스크립트로 구현되어 즉시 사용 가능하다.

| 지표 | 값 |
|------|-----|
| 구현된 훅 이벤트 | 13개 전체 |
| 스크립트 언어 | Python (UV 단일 파일) |
| LLM 통합 | Ollama, Anthropic, OpenAI (폴백 체인) |
| 보안 기능 | rm -rf 차단, .env 접근 차단, 권한 자동 제어 |
| 핵심 혁신 | LLM-as-hook + PostToolUse 린팅 + 컨텍스트 자동 주입 |
