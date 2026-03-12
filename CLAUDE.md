## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction: update `tasks/lessons.md` with the pattern
- Write rules that prevent the same mistake

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- Non-trivial changes: pause and ask "is there a more elegant way?"
- Skip this for simple, obvious fixes

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it, don't ask for hand-holding
- Zero context switching required from the user

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Track Progress**: Mark items complete as you go
3. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible
- **No Laziness**: Find root causes. No temporary fixes
- **Minimal Impact**: Only touch what's necessary

## Plugin Version Sync
- Version must match in 3 files: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`
- `scripts/bump-version.sh` syncs all 3 on commit via PreToolUse hook (not git pre-commit hook)

## Offers System
- Detection: `scripts/on-user-prompt-submit.sh` greps `^applied$` (bare word, not `## Status: applied`)
- Offer format: `## Status\npending` / `## Status\napplied`

## Worker Runtime
- Canonical DB: `.claude-auto-context/db/claude-auto-context.db` (NOT `auto-context.db`)
- Hooks config: `hooks/hooks.json`; logs: `.claude-auto-context/db/worker.log`
- Polls 30s, exits 5min idle, stale healing 60s, max 3 retries → `dead`
- 3 Agent SDK sub-agents are code-complete but NOT e2e validated

## External Documentation
- Claude Code docs: `https://code.claude.com/docs/en/` (NOT `docs.anthropic.com`)

## Subprocess Spawning
- `CLAUDECODE` env var must be unset before spawning `claude -p` or Agent SDK — see @.claude/rules/worker-subprocess.md
- `claude -p` hangs indefinitely inside Claude Code sessions — must run from standalone terminal
