# Codebase Structure

**Analysis Date:** 2026-03-20

## Directory Layout

```
claude-auto-context/
├── .claude-plugin/          # Plugin metadata
│   ├── plugin.json          # Plugin definition
│   └── marketplace.json     # Marketplace listing
├── .claude-auto-context/    # Runtime state (created per project)
│   ├── worker.mjs           # Main polling worker process
│   ├── collector.mjs        # Hook relay to SQLite
│   ├── db/                  # Database and logs
│   │   ├── claude-auto-context.db  # Event queue (Claim-Confirm)
│   │   └── worker.log       # Worker activity log
│   ├── suggestions/         # User-facing suggestions (created at runtime)
│   └── worker.lock          # Lock file for single-instance guarantee
├── hooks/                   # Claude Code hook configuration
│   └── hooks.json           # Hook definitions (Setup, UserPromptSubmit, PostToolUse, Stop)
├── scripts/                 # Executable hook handlers
│   ├── setup.sh             # Setup hook (install Bun)
│   ├── on-user-prompt-submit.sh  # UserPromptSubmit hook (collector + notification)
│   ├── on-post-tool-use.sh  # PostToolUse hook (collector)
│   ├── on-stop.sh           # Stop hook (collector + worker launcher)
│   ├── worker-launcher.sh   # Lock management + worker subprocess spawn
│   └── bump-version.sh      # Version sync across plugin.json, marketplace.json, package.json
├── skills/                  # Agent skill definitions
│   ├── extract-rules/
│   │   └── SKILL.md         # Extract conventions from repeated patterns
│   ├── create-suggestion/
│   │   └── SKILL.md         # Detect structural issues
│   ├── update-claudemd/
│   │   └── SKILL.md         # Update CLAUDE.md with tacit knowledge
│   ├── cac-apply/
│   │   └── SKILL.md         # Apply suggestions (user-facing command)
│   └── context-hygiene/
│       └── SKILL.md         # Hygiene audit checks
├── test/                    # Test projects and fixtures
│   ├── e2e-project/         # Sample project for testing
│   │   ├── .claude-auto-context/
│   │   ├── src/
│   │   └── package.json
│   └── fixtures/            # Test data
├── docs/                    # Project documentation
│   ├── 01-plan/             # Planning docs
│   │   └── features/
│   └── 02-design/           # Design docs
│       └── features/
├── package.json             # Plugin metadata (name, version, SDK dependency)
├── bun.lock                 # Lockfile (Bun package manager)
├── CLAUDE.md                # Project-specific rules and knowledge traps
└── README.md                # User-facing documentation
```

## Directory Purposes

**.claude-plugin/**
- Purpose: Plugin manifest for Claude Code plugin system
- Contains: JSON metadata (name, version, description, author)
- Key files: `plugin.json` (plugin definition), `marketplace.json` (marketplace listing)

**.claude-auto-context/**
- Purpose: Runtime state directory (created inside projects that use the plugin)
- Contains: Worker process, collector, SQLite database, lock file, suggestions
- Key files:
  - `worker.mjs`: Main event processing loop
  - `collector.mjs`: Hook relay (stdin → SQLite)
  - `db/claude-auto-context.db`: Event queue (Claim-Confirm pattern)
  - `db/worker.log`: Worker activity log (timestamps, batch sizes, decisions)
  - `worker.lock`: Lock file (PID stored for stale detection)
- Committed: No (git ignored)
- Generated: Yes (created at runtime if missing)

**hooks/**
- Purpose: Hook registration for Claude Code lifecycle
- Contains: Hook configuration file
- Key files: `hooks.json` (Setup, UserPromptSubmit, PostToolUse, Stop)
- When invoked: Hooks fire automatically (no user action required)

**scripts/**
- Purpose: Executable shell scripts for hook handlers and utilities
- Contains: Bash scripts for each lifecycle event
- Key files:
  - `setup.sh`: Bun installation
  - `on-user-prompt-submit.sh`: User prompt capture + notification
  - `on-post-tool-use.sh`: Tool call capture
  - `on-stop.sh`: Session end capture + worker launch
  - `worker-launcher.sh`: Lock file checks, worker subprocess spawn
  - `bump-version.sh`: Version sync utility (PreToolUse hook for Bash commands)

**skills/**
- Purpose: Agent skill definitions (instructions for specialized agents)
- Contains: Markdown skill files with decision trees and output formats
- Key files:
  - `extract-rules/SKILL.md`: Rules extraction logic
  - `create-suggestion/SKILL.md`: Structural issue detection
  - `update-claudemd/SKILL.md`: CLAUDE.md update logic
  - `cac-apply/SKILL.md`: User-facing suggestion application
  - `context-hygiene/SKILL.md`: Hygiene audit checks
- Pattern: Skills are NOT registered in plugin.json; must be copied manually to user's `.claude/skills/`
- Loaded by: Agent SDK when agents are spawned (via skills parameter)

**test/**
- Purpose: Test projects and fixtures
- Contains:
  - `e2e-project/`: Sample Next.js/Express project for integration tests
  - `fixtures/`: Test data and mock objects
- Generated: At runtime during test execution

**docs/**
- Purpose: Project documentation and design records
- Contains: Planning and design documents for features
- Key structure: `01-plan/features/` and `02-design/features/`

## Key File Locations

**Entry Points:**
- `scripts/setup.sh`: Bun runtime setup (runs once on plugin load)
- `scripts/on-user-prompt-submit.sh`: Captures user prompts + shows pending suggestions
- `scripts/on-stop.sh`: Triggers worker launch
- `.claude-auto-context/worker.mjs`: Main event processing loop (spawned as subprocess)

**Configuration:**
- `hooks/hooks.json`: Hook registration (matches events to scripts)
- `.claude-plugin/plugin.json`: Plugin metadata
- `package.json`: SDK dependency (`@anthropic-ai/claude-agent-sdk`)

**Core Logic:**
- `.claude-auto-context/worker.mjs`: Event polling, batch processing, agent orchestration
- `.claude-auto-context/collector.mjs`: SQLite schema + event insertion
- `scripts/worker-launcher.sh`: Lock file management + process spawning

**Data Storage:**
- `.claude-auto-context/db/claude-auto-context.db`: SQLite queue (raw_events table)
- `.claude-auto-context/db/worker.log`: Worker activity log
- `.claude-auto-context/worker.lock`: Lock file (contains PID)

**Skills (Loaded by Agents):**
- `skills/extract-rules/SKILL.md`: Rules extraction decision tree
- `skills/create-suggestion/SKILL.md`: Structural issue detection logic
- `skills/update-claudemd/SKILL.md`: CLAUDE.md update constraints
- `skills/cac-apply/SKILL.md`: User-facing suggestion application instructions

## Naming Conventions

**Files:**
- Hook scripts: `on-{event-name}.sh` (e.g., `on-user-prompt-submit.sh`)
- Worker/utility scripts: `{name}.sh` (e.g., `worker-launcher.sh`, `setup.sh`)
- Skill files: `{skill-name}/SKILL.md` (e.g., `extract-rules/SKILL.md`)
- Suggestion files: `{NNN}-{slug}.md` where NNN is zero-padded (e.g., `001-split-utils.md`)
- Rules files (created in target project): `{domain}-{aspect}.md` (e.g., `error-handling.md`, `api-patterns.md`)

**Directories:**
- Hook handlers: `scripts/`
- Plugin metadata: `.claude-plugin/`
- Runtime state: `.claude-auto-context/`
- Queue database: `.claude-auto-context/db/`
- Suggestions: `.claude-auto-context/suggestions/`
- Skills: `skills/{skill-name}/`
- Test projects: `test/e2e-project/`
- Documentation: `docs/{phase}/`

## Where to Add New Code

**New Hook Handler:**
- File: `scripts/on-{event-name}.sh`
- Register: Add entry to `hooks/hooks.json` matching Claude Code hook name
- Pattern: Bash script that pipes stdin to collector.mjs (or performs side effects)
- Example: `on-session-start.sh` → register in hooks.json → fires on SessionStart event

**New Agent Skill:**
- Directory: `skills/{skill-name}/`
- File: `SKILL.md` (contains decision tree and output format)
- Integration: Agent requests skill via `skills: ['skill-name']` parameter in Agent SDK options
- Pattern: Skill file contains instructions; agent implements them using available tools

**New Worker Feature:**
- File: `.claude-auto-context/worker.mjs`
- Pattern: Add function, integrate into main loop or processBatch
- Example: Add new selfHeal check → invoke from main loop on startup

**New Utility Script:**
- File: `scripts/{utility-name}.sh`
- Pattern: Bash script that can be called from hooks or manually
- Execution: Must handle `CLAUDE_PROJECT_DIR` and `CLAUDE_PLUGIN_ROOT` env vars

## Special Directories

**.claude-auto-context/db/**
- Purpose: SQLite database and worker logs
- Generated: Yes (created at runtime if missing)
- Committed: No (git ignored)
- Contents:
  - `claude-auto-context.db`: Event queue (Claim-Confirm pattern)
  - `worker.log`: Worker activity log (append-only)
  - `.wal` and `.shm` files: SQLite WAL mode files (transient)

**.claude-auto-context/suggestions/**
- Purpose: User-facing structural suggestions
- Generated: Yes (created by agents at runtime)
- Committed: No (user reviews and applies via /cac-apply)
- Pattern: Markdown files with Status section (pending/applied/rejected/failed)

**skills/{skill-name}/**
- Purpose: Agent skill definitions
- Contents: `SKILL.md` file with decision tree, output format, anti-patterns
- Important: Skills are NOT registered in plugin.json
- Distribution: Must be manually copied to user's `.claude/skills/` directory
- Reason: Plugin.json only contains plugin metadata; skills are separate distribution mechanism

---

*Structure analysis: 2026-03-20*
