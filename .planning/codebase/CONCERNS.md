# Codebase Concerns

**Analysis Date:** 2026-03-20

## Tech Debt

**Orphaned Database File:**
- Issue: `.claude-auto-context/db/auto-context.db` (20KB) exists alongside `claude-auto-context.db` (10MB)
  - Files: `.claude-auto-context/db/auto-context.db`, `.claude-auto-context/db/auto-context.db-shm`, `.claude-auto-context/db/auto-context.db-wal`
  - This is an old database file from a previous version; CLAUDE.md explicitly specifies the canonical DB should be `claude-auto-context.db` (line 10 of CLAUDE.md)
  - Impact: Silent data duplication; migrations failed; all new events go to the correct DB, but old events are trapped in the stale file; cleanup tools would be needed to consolidate or discard
  - Fix approach: Document migration path for users; add cleanup to setup script to remove stale DB files on first run; or add migration logic to `collector.mjs` to check and warn if old DB exists

**Silent Logging Failures:**
- Issue: Logging function swallows all errors silently
  - File: `.claude-auto-context/worker.mjs` line 35
  - Code: `try { appendFileSync(logPath, line); } catch {}`
  - Impact: If log directory is missing, inaccessible, or disk is full, worker continues silently with no visibility; critical diagnostics are lost; makes debugging stale locks and worker failures impossible
  - Fix approach: Log to stderr as fallback when file write fails; ensure log directory exists before any logging; check disk space on startup

**Missing Error Context in Batch Processing:**
- Issue: Batch rejection after error doesn't capture error details
  - File: `.claude-auto-context/worker.mjs` lines 514-517
  - Code: `catch (err) { ... rejectBatch(...); }` — error is logged but batch is rejected without recording why
  - Impact: Transient errors (network timeout, Agent SDK abort) trigger retry on exactly the same data, potentially causing infinite loops if errors are deterministic; no way to track which batches fail repeatedly
  - Fix approach: Add `error_reason` column to `raw_events` table; record error type and message before rejecting; log error with stack trace; add circuit-breaker pattern if same batch fails 3+ times consecutively

**Uncaught Promise Rejections in Agent Loop:**
- Issue: `processBatch()` is async but errors in the main loop may not be fully caught
  - File: `.claude-auto-context/worker.mjs` lines 505-517
  - If `claimBatch()` or `processBatch()` throws but the error is partially handled, the process may exit unexpectedly
  - Impact: Worker crashes without proper cleanup; lock file is left behind; next invocation detects stale lock but data loss is possible
  - Fix approach: Wrap entire `claimBatch` + `processBatch` + `confirmBatch` in try-catch-finally; ensure all paths call `cleanup()` before exit; add unhandled rejection handler

## Known Bugs

**Empty Commands Directory:**
- Symptoms: `.claude/commands/` directory exists but is empty; no commands are registered
  - Files: `.claude/commands/` (empty)
  - Current code: All skills are in `.claude/skills/` and referenced in worker.mjs but no command files exist in commands directory
  - Trigger: Directory was created but never populated; plugin.json doesn't reference a commands field
  - Workaround: Commands are triggered via skill names in agent definitions (lines 385-405 of worker.mjs), not via command files; skills are referenced directly by name
  - Note: This may be intentional (commands optional in newer Claude SDK versions) but empty directory suggests incomplete migration

**Database Name Mismatch in Documentation:**
- Symptoms: CLAUDE.md states canonical DB is `claude-auto-context.db` but documentation may reference `auto-context.db`
  - Files: CLAUDE.md line 10, `.claude-auto-context/collector.mjs` line 20, `.claude-auto-context/worker.mjs` line 17
  - Both resolve to the same path but naming inconsistency in old database file name creates confusion
  - Impact: Users reading old documentation or migration guides may point to wrong file

## Security Considerations

**Bun Runtime Requirement Not Validated:**
- Risk: Setup script uses curl to auto-install Bun from external URL; no checksum verification
  - File: `scripts/setup.sh` lines 8-9
  - Risk: MITM attack during Bun download; malicious binary execution with user privileges
  - Current mitigation: Uses official bun.sh domain (assumed HTTPS); relies on curl's default CA validation
  - Recommendations:
    - Add checksum verification after download (`bun --version` check or hash verification)
    - Cache Bun installer hash in plugin or fetch from multiple sources
    - Document that Bun must be installed separately (don't auto-install); make it a hard requirement instead

**SQLite Database Permissions:**
- Risk: Database files are created with default permissions; may be readable by other users on shared systems
  - Files: `.claude-auto-context/db/claude-auto-context.db` (contains project hooks and tool calls)
  - Database may contain sensitive information: API keys in tool inputs, file paths, user prompts
  - Current mitigation: Relies on system umask and home directory permissions
  - Recommendations:
    - Explicitly set file permissions to 0600 when creating DB file in `collector.mjs`
    - Document that `.claude-auto-context/db/` should be .gitignored (it is, but should be explicit)

**Agent SDK Subprocess Environment:**
- Risk: Worker unsets `CLAUDECODE` but may not clean other sensitive env vars before spawning agent subprocess
  - File: `.claude-auto-context/worker.mjs` line 13
  - Subprocess inherits worker's entire environment including `CLAUDE_PROJECT_DIR`
  - Impact: Subprocess has access to all parent env vars; if subprocess is compromised, sensitive keys could be extracted
  - Current mitigation: `settingSources: ['project']` limits config to project-specific settings
  - Recommendations:
    - Use `allowedTools` whitelist (already done)
    - Add `forbiddenEnvVars` or explicit `env` object to subprocess; only pass necessary vars
    - Document that worker should never run in environments with sensitive global vars

## Performance Bottlenecks

**Event Batch Processing Without Pagination:**
- Problem: `buildBulkPrompt()` accumulates all pending events into a single prompt with no cursor-based pagination
  - File: `.claude-auto-context/worker.mjs` lines 146-214
  - Adds MAX_TOTAL limit (100KB) but if that limit is hit, truncation occurs and remaining events are never processed
  - Current: Events stay in `pending` state, next poll retries them, infinite truncation loop
  - Impact: Long sessions with heavy tool usage accumulate unprocesable events; prompt quality degrades due to truncation
  - Improvement path:
    - Add `event_offset` to track processing position within pending batch
    - Process in fixed-size windows (e.g., 20 events per batch) with pagination
    - Mark intermediate completion to avoid reprocessing same events

**Worker Polling at Fixed 30-Second Interval:**
- Problem: POLL_INTERVAL_MS = 30_000 (line 21) is hardcoded; no exponential backoff for idle periods
  - File: `.claude-auto-context/worker.mjs` lines 21, 523
  - After Stop hook fires, worker wakes immediately and polls every 30s for 5 minutes
  - On busy projects with many sessions, creates predictable CPU/disk wake-up pattern
  - Impact: Increased resource usage on long-idle projects; battery drain on laptops
  - Improvement path:
    - Add exponential backoff starting at 5s, capping at 300s
    - Reset backoff when events are found
    - Make POLL_INTERVAL_MS configurable via env var or config file

**No Batch Size Limit in Event Claiming:**
- Problem: `claimBatch()` claims ALL pending events without limit (line 120-127)
  - File: `.claude-auto-context/worker.mjs` lines 117-129
  - A large session with 1000+ events triggers agent with 100K+ context in one call
  - Agent may hit token budget before processing all events
  - Impact: Large sessions overload agent; subsequent retries process same events again
  - Improvement path:
    - Add MAX_BATCH_SIZE limit (e.g., 50 events per call)
    - Claim in fixed-size batches
    - Track which events were successfully processed in agent result

## Fragile Areas

**Worker Lifecycle and Lock File Race:**
- Files: `.claude-auto-context/worker.mjs`, `scripts/worker-launcher.sh`
- Why fragile:
  - Lock file (`worker.lock`) is checked with `kill -0` in launcher (line 19 of launcher.sh)
  - But there's a gap: after check passes, worker process could be killed before writing to DB
  - SIGKILL cannot be caught (worker.mjs line 28), so lock file cleanup never runs
  - Next invocation sees stale lock and removes it, but worker may have been in the middle of `processBatch()`
  - If worker crashes during `confirmBatch()`, some events may be partially confirmed
  - Safe modification:
    - Use atomic database transactions for lock state (store PID + timestamp in DB instead of file)
    - Or use lock file with expiration timestamp checked against clock; launcher removes lock if both conditions met: `kill -0` fails AND lock is older than AGENT_TIMEOUT_MS
  - Test coverage: No tests for crash recovery or lock races

**Manual Skill Distribution During Plugin Install:**
- Files: `CLAUDE.md` line 24-25, `skills/*/` directories
- Why fragile:
  - Plugin manifest (`plugin.json`) does NOT auto-copy skills to user's project
  - Skills must be manually copied to target project's `.claude/skills/` directory
  - If user updates plugin but forgets to update skills, old skill code runs with new worker logic
  - Safe modification:
    - Add `setup.sh` hook to auto-copy skills on first run: `cp -r $PLUGIN_ROOT/skills/* $PROJECT_ROOT/.claude/skills/`
    - Or detect skill version mismatch and warn user
    - Document this step prominently in README
  - Test coverage: No integration test for plugin install

**Hygiene Agent Timeout Not Isolated:**
- Files: `.claude-auto-context/worker.mjs` lines 434-465
- Why fragile:
  - If hygiene agent times out, it logs "non-fatal" error (line 462) but doesn't prevent main loop from continuing
  - If hygiene agent modifies context files and then times out, snapshot may be inconsistent
  - Next poll may re-trigger hygiene on same files, creating duplicate suggestions
  - Safe modification:
    - Snapshot context AFTER hygiene completes successfully, not before
    - Or rollback context changes if hygiene times out
    - Add guard: if hygiene has failed 3+ times in a row, skip it for this session
  - Test coverage: No tests for timeout scenarios

## Scaling Limits

**SQLite Database WAL Mode Constraints:**
- Current capacity: worker.log shows 178KB log file; db is 10.7MB with 32KB WAL file
- Limit: SQLite with WAL mode can handle ~1000 writes/sec on typical disk; with 30s poll interval and 50 events/batch, scales to ~1500 events/day per session
- For 100+ concurrent projects running, database file contention becomes issue; WAL locks may cause timeouts
- Scaling path:
  - Monitor `busy_timeout` behavior (currently 5s in worker, line 491)
  - Add metrics: track query latencies, retry counts due to locks
  - At 10K events/day, consider splitting by project into separate DB files
  - Or move to a real database (PostgreSQL, DuckDB) if scaling beyond single-machine

**Agent Subprocess Budget:**
- Current capacity: maxBudgetUsd = 1.00 per batch (line 380); hygiene = 0.50 (line 449); with Sonnet at ~$3/MTok, that's ~300-500 events per batch
- Limit: 100+ events starts hitting token limits on complex projects; rate limit errors
- Scaling path:
  - Add budget tracking across batches; warn user if approaching daily limit
  - Implement adaptive batch sizing based on event complexity
  - Cache analysis results to avoid reprocessing same code patterns

## Dependencies at Risk

**Bun Runtime Lock-in:**
- Risk: Project uses `bun:sqlite` for zero-dependency DB access; requires Bun runtime
  - File: `.claude-auto-context/worker.mjs` line 7, `.claude-auto-context/collector.mjs` line 7
  - If Bun project diverges (license change, discontinuation), migration path is blocked
  - `bun --check` is used for syntax validation, not standard `node --check` (CLAUDE.md line 15)
  - Impact: Cannot easily switch to Node.js runtime; `bun:sqlite` has no Node.js equivalent
  - Migration plan:
    - Swap `bun:sqlite` for `better-sqlite3` (native module) or `sql.js` (WASM)
    - Requires rebuilding for new runtime; ~1-2 days work
    - Add abstraction layer: create `db.js` wrapper around SQLite client; implement once for Bun, again for Node.js

**Claude Agent SDK Version Pinning:**
- Risk: Exact pinned version `^0.2.62` in package.json may have breaking changes in 0.3.0+
  - File: `package.json` line 7
  - `query()` API shape may change; agent options may change
  - Current: No version constraints, no tests for SDK compatibility
  - Migration plan:
    - Add unit tests for agent interface (mock SDK responses)
    - Pin to major version only: `^0.2` with regular tested updates
    - Monitor SDK changelog before updating

## Missing Critical Features

**No Metrics or Observability:**
- Problem: Worker logs to file only; no way to monitor health across sessions
  - Files: `.claude-auto-context/db/worker.log` (log-to-file only)
  - No metrics: events processed, errors, timeouts, agent costs
  - No dashboards; users can't tell if worker is healthy
  - Blocks: Cannot diagnose performance issues; cannot alert on failures
  - Suggestion: Add optional telemetry export (Prometheus, CloudWatch); make it opt-in; document privacy implications

**No Configuration File or Environment-Based Tuning:**
- Problem: All constants (POLL_INTERVAL_MS, STALE_THRESHOLD_S, MAX_RETRIES) are hardcoded in worker.mjs
  - File: `.claude-auto-context/worker.mjs` lines 21-25
  - Users with different needs (fast feedback vs low resource usage) cannot tune behavior
  - Blocks: Custom deployments, performance optimization, enterprise use
  - Suggestion: Add `claude-auto-context.config.json` support; allow override via env vars

**No Dry-Run or Testing Mode:**
- Problem: Worker always processes events; no way to test skill changes or rule extraction in sandbox
  - Files: All worker code
  - Users cannot verify behavior before deploying changes
  - Blocks: Safe iteration on skill logic; testing in development environment
  - Suggestion: Add `DRY_RUN=1 worker.mjs` mode that logs what would be written instead of writing

## Test Coverage Gaps

**No Tests for Worker Restart Recovery:**
- What's not tested: Worker crash during `processBatch()`, stale lock removal, orphaned event recovery
  - Files: `.claude-auto-context/worker.mjs` lines 89-115 (`selfHeal` function), `scripts/worker-launcher.sh` lines 18-26
  - Risk: Database corruption if worker is killed mid-transaction; lock file races; events stuck in `processing` state forever
  - Priority: High — this is a critical fault-tolerance path

**No Tests for Batch Truncation Edge Cases:**
- What's not tested: MAX_TOTAL limit (100KB) in `buildBulkPrompt()`; behavior when single event exceeds MAX_PAYLOAD (2KB)
  - Files: `.claude-auto-context/worker.mjs` lines 146-214
  - Risk: Infinite truncation loop; data loss if batch cannot be built
  - Priority: Medium — affects large sessions only

**No Integration Tests for Plugin Lifecycle:**
- What's not tested: Plugin install, skill copying, hook registration, end-to-end event capture → processing → rules generation
  - Files: All hook and skill files
  - Risk: Silent failures during user installation; new Claude Code versions may break hooks
  - Priority: High — affects all users

**No Tests for Concurrent Event Processing:**
- What's not tested: Multiple sessions generating events concurrently; lock contention; WAL file growth
  - Files: `.claude-auto-context/collector.mjs`, `.claude-auto-context/worker.mjs`
  - Risk: Database corruption under concurrent load; timeout errors
  - Priority: Medium — affects multi-session workflows

---

*Concerns audit: 2026-03-20*
