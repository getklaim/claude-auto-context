## Plugin Version Sync
- Version must match in 3 files: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`
- `scripts/bump-version.sh` syncs all 3 on commit via PreToolUse hook (not git pre-commit hook)

## Offers System
- Detection: `scripts/on-user-prompt-submit.sh` greps `^applied$` (bare word, not `## Status: applied`)
- Offer format: `## Status\npending` / `## Status\napplied`

## Worker Runtime
- Canonical DB: `.claude-auto-context/db/claude-auto-context.db` (NOT `auto-context.db`)
- Hooks config: `hooks/hooks.json`; logs: `.claude-auto-context/db/worker.log`
- `STALE_THRESHOLD_S` must exceed `AGENT_TIMEOUT_MS / 1000` (currently 650s > 600s) — if smaller, self-heal loop prematurely recovers still-active events, causing duplicate processing
- On startup, `selfHeal(db, true)` (forceAll=true) must run before the poll loop to recover events left in `processing` state by a previously crashed/SIGKILL'd worker
- SIGKILL cannot be caught; stale lock file is handled by `scripts/worker-launcher.sh` via `kill -0` on the stored PID — stale lock is removed before relaunch
- `worker.mjs` uses Bun-specific built-ins (`bun:sqlite`); syntax is verified by `bun --check` via PostToolUse hook (`bun-check-after-mjs-edit.sh`) — do NOT call `bun --check` manually via Bash tool (hook runs in ~50ms; Bash tool adds ~2min approval overhead)

## Rules Files
- Frontmatter key is `paths:` (NOT `globs:`) — using an unrecognized key like `globs:` causes the rule to load unconditionally for ALL files

## External Documentation
- Claude Code docs: `https://code.claude.com/docs/en/` (NOT `docs.anthropic.com`)

## Skills Distribution
- Plugin skills live in `skills/` (plugin root) — auto-discovered when plugin is enabled
- `.claude/skills/` is the user's project-local directory, not used by this plugin

## Subprocess Spawning
- `CLAUDECODE` env var must be unset before spawning `claude -p` or Agent SDK (double-fix: shell launcher + process.env delete)
- `claude -p` hangs indefinitely inside Claude Code sessions — must run from standalone terminal
