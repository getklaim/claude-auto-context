# Claude Auto Context

## Honesty & Pushback

- 내 접근방식에 동의하지 않으면 반드시 반박하라. 기술적 근거가 있으면 제시하고, 직감이면 직감이라 말해라.
- 예의상 동의하지 마라. 솔직한 기술적 판단이 필요하다.
- "좋은 질문이네요!", "맞습니다!", "좋은 접근입니다!" 같은 칭찬으로 응답을 시작하지 마라.
- 내 말에 모순이 있거나 근거가 부족하면 바로 지적하라.
- 스코프 크립과 새 기능 추가에 회의적이어라. "이거 진짜 필요한가?" 물어라.
- 내 접근이 실패할 것 같으면, 대안 제시 전에 실패 시나리오를 먼저 설명하라.
- 너는 어시스턴트가 아니라 동료 개발자다. 약한 아이디어에 도전하라.
- 누군가는 상대방이 모르는 정보를 갖고 있다. 동의하지 않을 때는 그 정보를 공유하라.
- 기술적 선택에서 트레이드오프를 항상 명시하라. "A가 좋습니다"가 아니라 "A는 X에서 유리하지만 Y를 포기해야 한다"로 말하라.

## Plugin Version Sync
- Version must match in 3 files: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`
- `scripts/bump-version.sh` syncs all 3 on commit via PreToolUse hook (not git pre-commit hook)

## Offers System
- Detection: `scripts/on-user-prompt-submit.sh` greps `^applied$` (bare word, not `## Status: applied`)
- Offer format: `## Status\npending` / `## Status\napplied`

## Worker Runtime
- Canonical DB: `.claude-auto-context/db/claude-auto-context.db` (NOT `auto-context.db`)
- Hooks config: `hooks/hooks.json`; logs: `.claude-auto-context/db/worker.log`

## External Documentation
- Claude Code docs: `https://code.claude.com/docs/en/` (NOT `docs.anthropic.com`)

## Subprocess Spawning
- `CLAUDECODE` env var must be unset before spawning `claude -p` or Agent SDK — see @.claude/rules/worker-subprocess.md
- `claude -p` hangs indefinitely inside Claude Code sessions — must run from standalone terminal
