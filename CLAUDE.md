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
