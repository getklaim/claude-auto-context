# Architecture

**Analysis Date:** 2026-03-20

## Pattern Overview

**Overall:** Event-driven pipeline with deferred processing (Claim-Confirm queue pattern)

**Key Characteristics:**
- Capture-first, analyze-later to avoid blocking user sessions
- Hook-based interception during Claude Code lifecycle
- Background worker processes batched events asynchronously
- Multi-agent delegation for specialized analysis tasks
- Context hygiene auditing with feedback loop

## Layers

**Hook Layer (Synchronous):**
- Purpose: Intercept Claude Code lifecycle events and forward to collector
- Location: `scripts/on-*.sh` (Setup, UserPromptSubmit, PostToolUse, Stop)
- Contains: Bash scripts that fire on specific hooks
- Depends on: `collector.mjs` for storage, `worker-launcher.sh` for worker startup
- Used by: Claude Code runtime (via hooks.json configuration)
- Execution: <100ms per hook (non-blocking)

**Collector (SQLite Relay):**
- Purpose: Ingest raw event JSON into database with minimal overhead
- Location: `.claude-auto-context/collector.mjs`
- Contains: Schema creation, event insertion
- Depends on: Bun runtime, SQLite
- Used by: All hook scripts
- Pattern: Fail-silently on errors (never blocks main session)

**Queue Management:**
- Purpose: Implement Claim-Confirm pattern for reliable event processing
- Location: `worker.mjs` (functions: claimBatch, confirmBatch, rejectBatch, selfHeal)
- Contains: Transactional queue operations, stale event recovery
- Depends on: SQLite WAL mode, automatic retry logic
- Guarantees: Exactly-once processing per event (with retry cap)

**Worker Process (Async Polling):**
- Purpose: Continuously poll for pending events and process them in batches
- Location: `.claude-auto-context/worker.mjs` (main loop: lines 504-525)
- Contains: Event polling, batch formation, worker lifecycle management
- Depends on: ClaudeCodeAgent SDK for subprocess spawning
- Timeout: 3 minutes per batch, 5 minutes idle exit
- Stale threshold: 200s (just above 3min timeout to avoid premature self-heal)

**Agent Orchestrator:**
- Purpose: Delegate analysis tasks to specialized agents
- Location: `worker.mjs` (processBatch function)
- Spawns: Three child agents via Claude Agent SDK
  - `rules-agent`: Extracts conventions from repeated patterns
  - `suggestion-agent`: Detects structural issues
  - `claudemd-agent`: Updates project-wide CLAUDE.md
- Timeout: 1.0 USD budget per batch, 0.5 USD for hygiene audit

**Hygiene Auditor:**
- Purpose: Quality check context files (rules and CLAUDE.md) after agent updates
- Location: `worker.mjs` (buildHygienePrompt function)
- Triggers: Only if context changed AND minimum threshold met (2+ rules OR 10+ CLAUDE.md lines)
- Creates: Suggestion files in `.claude-auto-context/suggestions/`
- Checks: Duplication, contradiction, stale references, verbosity, bloat, ordering

## Data Flow

**Event Capture (Synchronous):**

1. Hook fires during Claude Code session (UserPromptSubmit, PostToolUse, Stop)
2. Hook script pipes JSON to `collector.mjs` stdin
3. Collector parses JSON, creates schema if needed, inserts into `raw_events` table
4. Process exits within 100ms (hook returns to Claude Code runtime)

**Event Processing (Asynchronous):**

1. Session stops → Stop hook triggers `worker-launcher.sh`
2. Launcher checks for existing worker (via lock file + kill -0)
3. If no worker running: spawns `worker.mjs` in background (nohup)
4. Worker wakes up on 30s poll interval
5. Worker claims batch of pending events (atomic transaction)
6. For each batch:
   - Build bulk prompt from event data (grouped by session, separated by type)
   - Query Claude Agent SDK with orchestrator prompt
   - Orchestrator delegates to three agents
   - Each agent reads/writes/edits project files
   - Worker snapshots context files before and after
   - If context changed AND thresholds met: run hygiene audit
   - Confirm batch (mark events as done) or reject (reset to pending, increment retry)
7. When idle >5min: worker exits (self-cleanup)

**State Transitions:**

```
pending → claimed → processing → done
          ↓
        (stale after 200s)
          ↓
       pending (retry_count++)
          ↓
        (if retry_count > 3)
          ↓
          dead
```

## Key Abstractions

**raw_events Table:**
- Purpose: Immutable event log across all sessions
- Fields: id, session_id, timestamp, hook_type, tool_name, payload (JSON string), status, claimed_at, retry_count
- Indexes: status, session_id
- Pattern: Append-only; never delete (only status transition)

**Claim-Confirm Queue:**
- Purpose: Guarantee worker can crash/SIGKILL at any time without losing events
- Pattern: Mark as "processing" → do work → mark as "done" (atomic)
- Self-heal: On startup, any "processing" events older than threshold reset to "pending"
- Reason: Handle SIGKILL (cannot catch), OOM kills, machine reboots

**Bulk Prompt Builder (buildBulkPrompt):**
- Purpose: Summarize event batch for agent analysis
- Strategy: Group events by session, separate into sections (User Prompts, Tool Activity, Session End)
- Limits: Max 100k characters total, 2k per event (truncate larger payloads)
- Why: LLM sees user intent (prompts) before tool outputs; tool activity second

**Skill Framework:**
- Purpose: Encapsulate agent-specific analysis logic
- Location: `skills/{extract-rules, create-suggestion, update-claudemd}/SKILL.md`
- Loaded: By agents via skills parameter in Agent SDK options
- Pattern: Skill files are NOT in plugin.json; must be manually copied to target projects

## Entry Points

**Setup Hook:**
- Location: `scripts/setup.sh`
- Triggers: Once when plugin loads (matches "*")
- Responsibilities: Ensure Bun runtime installed (auto-installs if missing)

**UserPromptSubmit Hook:**
- Location: `scripts/on-user-prompt-submit.sh`
- Triggers: Every time user submits prompt in Claude Code
- Responsibilities:
  1. Pipe JSON to collector (store user intent)
  2. Scan suggestions directory for pending items
  3. Display notification with suggestion titles and count
- Detection: Grep for `^applied$` (bare word, not in frontmatter) to filter shown suggestions

**PostToolUse Hook:**
- Location: `scripts/on-post-tool-use.sh`
- Triggers: After every tool execution (Read, Glob, Bash, Write, Edit, etc.)
- Responsibilities: Pipe tool event JSON to collector

**Stop Hook:**
- Location: `scripts/on-stop.sh`
- Triggers: When user closes/leaves Claude Code session
- Responsibilities:
  1. Pipe session summary to collector
  2. Launch worker in background (non-blocking)

**Worker Process:**
- Location: `.claude-auto-context/worker.mjs` (main entry point)
- Triggers: Via `worker-launcher.sh` (called by Stop hook)
- Responsibilities:
  1. Lock file management (guarantee single instance)
  2. Poll queue for events
  3. Process batches via Agent SDK
  4. Auto-heal stale events
  5. Auto-exit after idle timeout

## Error Handling

**Strategy:** Fail gracefully without blocking user sessions

**Hook Failures:**
- Collector errors: Exit 0 (silent failure)
- Worker launch errors: Exit non-zero (non-blocking — user never sees it)
- Reason: Hooks must complete in <100ms; no user-facing errors allowed

**Worker Processing Failures:**
- Batch processing error: Reject batch (reset to pending, increment retry_count)
- Hygiene audit error: Log as non-fatal, continue (doesn't block batch confirmation)
- Stale events: Auto-recover on startup (forceAll=true) and during polling

**Retry Logic:**
- Max retries: 3 (then move to "dead" status)
- Stale threshold: 200s (events in "processing" > 200s reset to "pending")
- Reason: 200s > 180s (AGENT_TIMEOUT_MS/1000) to allow still-active jobs to complete

## Cross-Cutting Concerns

**Logging:**
- Approach: Append-only log file at `.claude-auto-context/db/worker.log`
- Format: ISO timestamp prefix on each line
- What's logged: Event claims, confirmations, batch sizes, agent session results, hygiene decisions

**Validation:**
- Approach: Schema validation at DB layer (CREATE TABLE IF NOT EXISTS)
- JSON payloads: Stored as-is (no schema validation on content)
- Agent outputs: Skill files define output format expectations

**Authentication:**
- Approach: Plugin runs in user's own Claude Code session (implicit auth)
- Subprocess auth: Agent SDK handles authentication via existing session context

**Lock Management:**
- Approach: File-based lock at `.claude-auto-context/worker.lock` (PID stored inside)
- Recovery: `kill -0 $PID` check detects stale locks (handles SIGKILL)
- Cleanup: Worker removes lock file on exit (SIGTERM/SIGINT handlers)

---

*Architecture analysis: 2026-03-20*
