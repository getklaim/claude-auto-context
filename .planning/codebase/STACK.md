# Technology Stack

**Analysis Date:** 2026-03-20

## Languages

**Primary:**
- JavaScript (ES6+) - Runtime implementation for worker and collector
- TypeScript (v5.7.3) - Test project language (e2e-project)
- Bash - Hook scripts and system integration (scripts/)

**Secondary:**
- Shell scripts - Plugin hook runners and version management

## Runtime

**Environment:**
- Bun v1.0+ - JavaScript runtime with built-in SQLite support
  - Used for worker.mjs, collector.mjs, and all .mjs entry points
  - Provides `bun:sqlite` native module (zero dependency)
  - Required for subprocess spawning via `bun run`

**Package Manager:**
- npm (via package.json)
- Lockfile: bun.lock (Bun lockfile format)

## Frameworks

**Core:**
- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk` v0.2.62) - Orchestration engine for multi-agent analysis
  - Used in `.claude-auto-context/worker.mjs` for `query()` function
  - Spawns three sub-agents (rules-agent, suggestion-agent, claudemd-agent)
  - Processes session events and generates rules/suggestions

**Testing (Test Project):**
- Express (v4.21.2) - Web framework for e2e test API
- Prisma (v6.4.0) - ORM for database operations
- TypeScript (v5.7.3) - Type safety for test project

**Database:**
- SQLite (via `bun:sqlite`) - Event storage and queue management
  - Database file: `.claude-auto-context/db/claude-auto-context.db`
  - WAL (Write-Ahead Logging) mode enabled
  - Used for Claim-Confirm queue pattern (raw_events table)

## Key Dependencies

**Critical:**
- `@anthropic-ai/claude-agent-sdk` (v0.2.62) - Enables multi-agent orchestration
  - Required for orchestrator, rules-agent, suggestion-agent, claudemd-agent, hygiene-agent
  - Provides `query()` function with tool allowlists and skill injection

**Test Project Dependencies:**
- `@prisma/client` (v6.4.0) - Database client for e2e testing
- `express` (v4.21.2) - Web framework for API server
- `zod` (v3.24.2) - Schema validation
- `dotenv` (v16.4.7) - Environment variable loading

**Optional (Sharp image processing dependencies):**
- `@img/sharp-*` (v0.34.5+) - Image processing libraries (optional dependencies from SDK)
- Platform-specific binaries for darwin-arm64, darwin-x64, linux-*, win32-*

## Configuration

**Environment:**
- Loaded via hook scripts (setup.sh, on-post-tool-use.sh, etc.)
- Critical env vars:
  - `CLAUDE_PROJECT_DIR` - Target project directory for event collection
  - `CLAUDE_PLUGIN_ROOT` - Plugin installation directory
  - `CLAUDECODE` - Must be unset before spawning Agent SDK subprocesses (see CLAUDE.md)

**Build:**
- No build configuration file
- No tsconfig.json for root project (TypeScript only in test project)
- Bun-specific shebang: `#!/usr/bin/env bun` for worker.mjs and collector.mjs
- Version synchronization via `scripts/bump-version.sh` (PreToolUse hook)

**Plugin Configuration:**
- `.claude-plugin/plugin.json` - Plugin metadata (version 1.3.3)
- `.claude-plugin/marketplace.json` - Marketplace registration
- `hooks/hooks.json` - Hook lifecycle configuration (Setup, UserPromptSubmit, PreToolUse, PostToolUse, Stop)

## Platform Requirements

**Development:**
- macOS 10.13+ or Linux or Windows (due to platform-specific Sharp binaries)
- Bun runtime installed (auto-installed by setup.sh if missing)
- Node.js not required (Bun is standalone)
- Bash shell for hook scripts

**Production:**
- Claude Code IDE (plugin system)
- Local SQLite database directory with write permissions (`.claude-auto-context/db/`)
- Bun runtime environment
- Network access to Anthropic API (for Claude Agent SDK)

**Plugin Distribution:**
- GitHub marketplace: `getklaim/claude-auto-context`
- Distributed via Claude Code plugin manager
- Skills directory: `.claude/skills/` (manually copied to target projects)

---

*Stack analysis: 2026-03-20*
