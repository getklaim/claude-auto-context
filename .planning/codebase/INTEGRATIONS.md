# External Integrations

**Analysis Date:** 2026-03-20

## APIs & External Services

**Anthropic Claude Agent SDK:**
- Service: Anthropic API (via `@anthropic-ai/claude-agent-sdk`)
- What it's used for: Multi-agent orchestration, rules extraction, suggestion generation, context hygiene auditing
  - SDK: `@anthropic-ai/claude-agent-sdk` (v0.2.62)
  - Auth: Implicit via Claude Code IDE session context
  - Entry point: `query()` function in `.claude-auto-context/worker.mjs` (line 358)
  - Model: `sonnet` (specified in options)
  - Budget: $1.00 per orchestrator run, $0.50 per hygiene-agent run

**Bun Package Registry:**
- Service: https://bun.sh/install (installation script)
- What it's used for: Auto-install Bun runtime
  - Called by: `scripts/setup.sh`
  - Curl invocation: `curl -fsSL https://bun.sh/install | bash`

## Data Storage

**Databases:**
- **SQLite (local)**
  - Location: `.claude-auto-context/db/claude-auto-context.db`
  - Purpose: Event queue and session data storage
  - Client: `bun:sqlite` (native Bun module)
  - Connection: Local file-based, no network connection
  - Schema: `raw_events` table (Claim-Confirm queue pattern)
    - Fields: id, session_id, timestamp, hook_type, tool_name, payload, status, claimed_at, retry_count
    - Indexes: idx_raw_events_status, idx_raw_events_session
  - WAL Mode: Enabled (`PRAGMA journal_mode = WAL`)
  - Busy timeout: 5000ms for main connection, 2000ms for collector

**File Storage:**
- Local filesystem only
  - Rules files: `.claude/rules/*.md`
  - Suggestions: `.claude-auto-context/suggestions/*.md`
  - CLAUDE.md: Project root
  - Worker lock file: `.claude-auto-context/worker.lock` (single-instance protection)
  - Worker log file: `.claude-auto-context/db/worker.log`

**Caching:**
- Context snapshot hashing (Bun.hash) used for hygiene-agent triggering
  - Computes hash of all rules files and CLAUDE.md before/after orchestrator run
  - Prevents unnecessary hygiene checks when context hasn't changed

## Authentication & Identity

**Auth Provider:**
- Implicit Claude Code session context
- No explicit API key management required (inherited from IDE)
- Agent SDK uses existing Claude Code authentication

**Subprocess Communication:**
- Spawned via Claude Agent SDK `query()` with subprocess isolation
- No inter-process authentication; sandbox via `allowedTools` and `allowDangerouslySkipPermissions` flags
- Timeout protection: AGENT_TIMEOUT_MS = 180 seconds (3 minutes)

## Monitoring & Observability

**Error Tracking:**
- None (external service)
- Local: Error events logged to `.claude-auto-context/db/worker.log`

**Logs:**
- File-based logging: `.claude-auto-context/db/worker.log` (append-only)
- Format: `[ISO timestamp] {message}`
- Content: Worker lifecycle events, batch processing, self-heal recovery, agent results, hygiene checks
- Stderr capture: Agent subprocess stderr piped to log via options.stderr callback

**Worker Supervision:**
- Lock file mechanism: `.claude-auto-context/worker.lock` (PID-based single-instance protection)
- Launcher script: `scripts/worker-launcher.sh` detects stale locks via `kill -0` PID check
- Idle timeout: 5 minutes (IDLE_TIMEOUT_MS) — worker auto-exits if no events

## CI/CD & Deployment

**Hosting:**
- Plugin marketplace: GitHub (getklaim/claude-auto-context)
- Distribution: Claude Code plugin manager
- Installation mechanism: `/plugin install` command within Claude Code IDE

**Deployment:**
- No traditional CI/CD pipeline
- Version sync: `scripts/bump-version.sh` (PreToolUse hook) — maintains version across:
  - `.claude-plugin/plugin.json`
  - `.claude-plugin/marketplace.json`
  - `package.json`

**Webhook Integration:**
- Claude Code IDE hooks (not HTTP webhooks):
  - Setup: `scripts/setup.sh`
  - UserPromptSubmit: `scripts/on-user-prompt-submit.sh`
  - PreToolUse (Bash only): `scripts/bump-version.sh`
  - PostToolUse: `scripts/on-post-tool-use.sh`
  - Stop: `scripts/on-stop.sh`

## Environment Configuration

**Required env vars:**
- `CLAUDE_PROJECT_DIR` - Target project directory (defaults to `process.cwd()`)
- `CLAUDE_PLUGIN_ROOT` - Plugin installation directory (defaults via script relative paths)
- `CLAUDECODE` - Must be unset before spawning Agent SDK subprocess (explicitly deleted in worker.mjs:13)

**Configuration Sources:**
- `.claude-plugin/plugin.json` - Plugin metadata
- `.claude-plugin/marketplace.json` - Marketplace registration
- `hooks/hooks.json` - Hook lifecycle definitions
- `package.json` - NPM metadata and dependencies

**Secrets location:**
- None required for core operation
- No .env files needed (event collection is CLI-based)
- Test project (e2e-project) uses `dotenv` for optional configuration loading

## Workflow & Event Processing Pipeline

**Event Collection (Synchronous):**
1. IDE hook fires → shell script invoked → JSON piped to collector.mjs
2. Collector writes to SQLite raw_events table
3. Returns immediately (non-blocking)

**Event Processing (Asynchronous Background Worker):**
1. `scripts/on-stop.sh` spawns `scripts/worker-launcher.sh` in background
2. Launcher checks for stale lock file (kill -0 PID check)
3. Spawns Bun worker via `bun run` (isolated subprocess)
4. Worker connects to SQLite database
5. Polls raw_events table every 30 seconds (POLL_INTERVAL_MS)
6. Claims pending events (Claim-Confirm pattern)
7. Invokes Claude Agent SDK `query()` with orchestrator prompt
8. Orchestrator delegates to 3 agents:
   - rules-agent: Extract conventions → `.claude/rules/*.md`
   - suggestion-agent: Detect structural issues → `.claude-auto-context/suggestions/*.md`
   - claudemd-agent: Update CLAUDE.md with tacit knowledge
9. Post-processing: If context changed, runs hygiene-agent (4th agent)
10. Confirms/rejects batch based on success
11. Exits after 5 minutes idle or on SIGTERM/SIGINT

**Self-Healing (Crash Recovery):**
- Startup: `selfHeal(db, true)` recovers ALL orphaned processing events
- Polling: `selfHeal(db, false)` recovers events >200s old (STALE_THRESHOLD_S)
- Over-retry protection: Events exceeding MAX_RETRIES=3 moved to dead_events status

---

*Integration audit: 2026-03-20*
