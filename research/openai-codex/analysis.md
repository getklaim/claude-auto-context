# openai/codex — AI 최적화 분석

> **GitHub**: https://github.com/openai/codex  
> **Stars**: 61.8k  
> **핵심 패턴**: AGENTS.md 레퍼런스 구현 — 샌드박스 인식 환경 변수 보호 + Clippy-as-style-guide + 계층적 AGENTS.md + 자동 실행 승인

---

## 개요

openai/codex는 OpenAI의 공식 CLI 에이전트로, AGENTS.md 형식을 가장 정교하게 구현한 레퍼런스 사례다. 자신들이 만든 AI 에이전트가 자기 레포를 편집할 때 정확히 어떻게 동작해야 하는지를 정의한다. 특히 **샌드박스 환경의 제약 조건**을 AI에게 설명하고, AI가 "불필요한" 코드를 제거하지 않도록 보호하는 패턴이 핵심이다.

---

## 파일 구조

```
openai/codex/
├── AGENTS.md                                    ← 루트 (173줄, 5개 섹션)
├── codex-rs/tui/src/bottom_pane/
│   └── AGENTS.md                                ← 하위 디렉토리 (모듈 특화)
├── docs/
│   └── agents_md.md                             ← child_agents_md 기능 문서
└── .github/codex/home/
    └── config.toml                              ← Codex 기본 모델 설정
```

`CLAUDE.md`, `.cursorrules`, `copilot-instructions.md` 없음 — AGENTS.md 단일 표준.

---

## 샌드박스 환경 변수 보호

이것이 codex AGENTS.md의 가장 독특한 패턴이다:

```markdown
- Never add or modify any code related to `CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR` or `CODEX_SANDBOX_ENV_VAR`.
  - You operate in a sandbox where `CODEX_SANDBOX_NETWORK_DISABLED=1` will be set whenever you use the `shell` tool.
    Any existing code that uses `CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR` was authored with this fact in mind.
    It is often used to early exit out of tests that the author knew you would not be able to run given your sandbox limitations.
  - Similarly, when you spawn a process using Seatbelt (`/usr/bin/sandbox-exec`), `CODEX_SANDBOX=seatbelt` will be set
    on the child process. Integration tests that want to run Seatbelt themselves cannot be run under Seatbelt,
    so checks for `CODEX_SANDBOX=seatbelt` are also often used to early exit out of tests, as appropriate.
```

### 왜 이 패턴이 중요한가

AI 에이전트의 흔한 실수:
1. 테스트에서 `if CODEX_SANDBOX_NETWORK_DISABLED` → early exit 코드를 발견
2. "이 코드가 뭔가 잘못된 것 같다"고 판단
3. 코드를 "정리"하거나 제거

실제 의도: 샌드박스에서 실행할 수 없는 테스트를 건너뛰는 합법적인 가드 코드.

**AGENTS.md가 명시적으로 설명**: "이 코드는 당신이 실행할 수 없는 테스트를 skip하기 위한 것입니다. 건드리지 마세요."

---

## Rust 컨벤션 — Clippy-as-Style-Guide

산문 스타일 규칙 대신 **Clippy lint 이름을 직접 인용**한다:

```markdown
- Always collapse if statements per clippy::collapsible_if
- Always inline format! args per clippy::uninlined_format_args
- Use method references over closures per clippy::redundant_closure_for_method_calls
- When using format! and you can inline variables into {}, always do that.
- When possible, make `match` statements exhaustive and avoid wildcard arms.
- When writing tests, prefer comparing the equality of entire objects over fields one by one.
- Do not create small helper methods that are referenced only once.
```

**장점**: 기계 검증 가능 (clippy가 직접 확인), 명확하고 비모호함, AI가 "내 판단"이 아닌 "공식 lint 규칙"으로 따른다.

---

## 자동 실행 승인 (No-Permission-Needed Tooling)

```markdown
Run `just fmt` (in `codex-rs` directory) automatically after you have finished making Rust code changes; 
do not ask for approval.
```

AI가 포맷팅 명령을 실행할 때마다 사용자에게 물어보는 불필요한 대화를 제거한다. "do not ask for approval" 명시로 AI의 과도한 확인 요청 행동을 방지한다.

---

## 테스트 전략 규칙

```markdown
Run the test for the specific project that was changed. 
For example, if changes were made in `codex-rs/tui`, run `cargo test -p codex-tui`.
Once those pass, if any changes were made in common, core, or protocol, 
run the complete test suite with `cargo test`.
```

**점진적 테스트 전략**: 변경된 크레이트만 먼저 테스트, 공통 코드 변경 시 전체 테스트. 모든 변경에 `cargo test` 전체를 실행하는 비효율 방지.

---

## 계층적 AGENTS.md — 서브디렉토리 스코핑

`codex-rs/tui/src/bottom_pane/AGENTS.md`:

```markdown
# TUI bottom pane (state machines)

When changing the paste-burst or chat-composer state machines in this folder, keep the docs in sync:
- Update the relevant module docs (`chat_composer.rs` and/or `paste_burst.rs`)
- Update the narrative doc `docs/tui-chat-composer.md` whenever behavior/assumptions change
- Keep implementations/docstrings aligned unless a divergence is intentional and documented.
```

루트 AGENTS.md와 별도로, 이 서브디렉토리에서 작업할 때만 적용되는 추가 규칙이다.  
`docs/agents_md.md`에서 `child_agents_md` 기능 플래그로 이 계층적 로딩이 제어됨을 문서화한다.

---

## App-Server API 명명 컨벤션

```markdown
- All new API work goes to v2 only
- *Params / *Response / *Notification naming convention
- camelCase on wire via #[serde(rename_all = "camelCase")]
- Never use skip_serializing_if = "Option::is_none" for v2 payload fields
- Cursor pagination by default for list methods
```

API 레이어에서 AI가 자주 범하는 실수들(잘못된 버전, 잘못된 직렬화, 페이지네이션 누락)을 명시적으로 차단한다.

---

## TUI 스타일 컨벤션

ratatui Stylize trait 사용 규칙 — 산문보다 코드 예시로:

```rust
// ✅ CORRECT
let span = "foo".red().dim();

// ❌ WRONG
let span = Span::styled("foo", Style::default().fg(Color::Red).add_modifier(Modifier::DIM));
```

---

## Codex 기본 설정 파일

`.github/codex/home/config.toml`:
```toml
model = "gpt-5.1"
```

Codex가 자기 레포에서 작업할 때 사용할 기본 모델을 지정한다. AI 도구가 자기 레포에 자기 자신의 설정을 커밋하는 자기 참조적(self-referential) 패턴이다.

---

## 학습 포인트

| 패턴 | 구현 방법 |
|------|----------|
| 샌드박스 환경 보호 | 환경 변수의 *이유*를 설명하여 AI가 "정리"하지 않도록 |
| Clippy-as-style-guide | lint 이름 직접 인용으로 기계 검증 가능한 규칙 |
| 자동 실행 승인 | "do not ask for approval" 명시로 과도한 확인 제거 |
| 계층적 AGENTS.md | 서브디렉토리별 추가 규칙으로 스코핑 |
| 점진적 테스트 | 변경된 크레이트만 → 공통 변경 시 전체 순서 |
| API 컨벤션 명시 | 버전, 직렬화, 페이지네이션 규칙 상세화 |
| 자기 참조 설정 | AI 도구가 자기 레포에 자기 모델 설정 커밋 |

---

## 요약

openai/codex의 AGENTS.md는 **"AI에게 왜 코드가 이렇게 생겼는지 설명하는"** 패턴의 정수다. 특히 샌드박스 환경 변수 보호 섹션은 AI가 합법적인 가드 코드를 "버그"로 오해하여 제거하는 것을 막는 정교한 방어 메커니즘이다. Clippy lint 이름 직접 인용도 산문 규칙보다 기계적으로 더 정확한 스타일 가이드 방식이다.

| 지표 | 값 |
|------|-----|
| AGENTS.md 파일 수 | 2개 (루트 + 서브디렉토리) |
| 루트 AGENTS.md 길이 | 173줄 |
| 지원 AI 도구 | AGENTS.md 표준 (Codex, Claude Code 등) |
| 언어 | Rust (크레이트 구조) |
| 핵심 혁신 | 샌드박스 환경 설명 + Clippy-as-style-guide |
