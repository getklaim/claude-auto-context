# Auto-Context

Auto-Context is a Claude Code plugin that makes your project smarter over time. Instead of manually maintaining CLAUDE.md, it observes your coding sessions, extracts patterns, detects conventions, and progressively improves your project's context — so Claude gets better at navigating and understanding your codebase with every session.

Think of it as "organizational scar tissue" — but automated.

## How it works

It starts the moment you open a Claude Code session. Tool calls (`Edit`, `Write`, `Bash`, `NotebookEdit`) and user prompts get silently captured and stored in a local SQLite database. Payloads are compressed at ingestion — only metadata (file paths, commands) is kept, not full file contents.

When enough events accumulate (100+), a background worker launches. It analyzes the events across sessions, delegates to specialized sub-agents via the Claude Agent SDK, and produces:

1. **Rules files** (`.claude/rules/local/*.md`) are auto-generated from repeated conventions and user corrections. Claude loads them automatically when touching matching files.
2. **Structural suggestions** are created when agents detect AI-unfriendly code patterns (monoliths, unclear naming, missing context). These require your explicit approval.
3. **Skills** (`.claude/skills/*/SKILL.md`) are extracted from repeated multi-step workflows — reusable slash commands.
4. **Hooks** (`.claude/hooks/*.sh`) are generated when repetitive manual actions are detected (lint, format, test).
5. **Hygiene reports** flag duplicates, contradictions, and stale references in existing rules and suggestions.

Nothing structural changes without your say-so. You run `/cac-apply`, review the evidence, and decide.

## Installation

### From GitHub (Recommended)

Add the marketplace:

```
/plugin marketplace add getklaim/claude-auto-context
```

Install the plugin:

```
/plugin install claude-auto-context@claude-auto-context-marketplace
```

Or open the interactive plugin manager with `/plugin`, navigate to the **Marketplaces** tab to add the marketplace, then switch to **Discover** to install.

### From Git URL

```
/plugin marketplace add https://github.com/getklaim/claude-auto-context.git
```

### Verify Installation

Start a new Claude Code session. The setup hook will auto-install Bun (if missing) and create `.claude/rules/local/`. The background worker launches automatically when enough events accumulate — no manual setup needed.

### Updating

```
/plugin update claude-auto-context@claude-auto-context-marketplace
```

## The Core Workflow

### Automatic (Zero Config)

Once installed, hooks fire automatically across six lifecycle events:

| Event | What happens |
|-------|-------------|
| **SessionStart** | Outputs dashboard stats (rules count, pending suggestions, DB size) into session context |
| **Setup** | Installs Bun if missing, creates `.claude/rules/local/`, runs auto-cleanup |
| **UserPromptSubmit** | Captures user prompt → SQLite (uncompressed, to preserve intent), checks for pending suggestions |
| **PreToolUse** | Version sync on commit, blocks conflict markers and planning files from staging |
| **PostToolUse** | Captures `Edit\|Write\|Bash\|NotebookEdit` events → SQLite (compressed), syntax checks on edited files |
| **Stop** | Launches background worker if 100+ pending events |

All hooks execute in under 100ms. You never notice them.

### Commands

| Command | Purpose |
|---------|---------|
| `/cac-apply` | Review and apply a specific structural suggestion |
| `/create-suggestion` | Manually create a structural suggestion with evidence |
| `/extract-rules` | Manually extract convention rules from current session |
| `/context-hygiene` | Run a context quality audit (duplicates, contradictions, stale refs) |
| `/cac-create-skill` | Create a SKILL.md from a detected workflow pattern |
| `/run-worker` | Manually trigger the background worker |

### What the Worker Produces

**Auto-generated** (no approval needed):

```
.claude/rules/local/
  error-handling.md    ← "Use Result type, not try-catch" (globs: src/**/*.ts)
  api-patterns.md      ← "All endpoints return ApiResponse<T>" (globs: src/api/**)
```

Rules files are scoped by glob pattern via frontmatter. Claude loads them automatically when it touches matching files — no CLAUDE.md bloat. Rules auto-decay: revalidated after 30 days, force-deleted after 60 days of no validation.

**Suggestions** (requires your approval):

```
.claude-auto-context/suggestions/
  001-split-utils.md          ← "src/utils.ts has 4% signal ratio → split into date.ts, string.ts"
  002-unify-route-patterns.md ← "routes/ uses 3 different patterns → standardize"
```

Each suggestion includes the problem, proposed fix, and evidence from specific sessions.

## Architecture

```
Main Claude Session
│
├─► Edit ───► PostToolUse Hook ──► collector.mjs ──┐
├─► Write ──► PostToolUse Hook ──► collector.mjs ──┤  Compressed
├─► Bash ───► PostToolUse Hook ──► collector.mjs ──┤  at ingestion.
├─► Notebook► PostToolUse Hook ──► collector.mjs ──┤
│                                                   │
├─► Prompt ─► UserPromptSubmit ──► collector.mjs ──┤  Uncompressed
│                                                   │  (user intent).
│                                                   ▼
│                                            ┌─────────────┐
│                                            │   SQLite     │
│                                            │  raw_events  │
│                                            └──────┬───────┘
│                                                   │
└─► Stop ──► threshold check (≥100) ──► worker-launcher.sh
                                                   │
                                                   ▼
                                            ┌──────────────────┐
                                            │ Background Worker │
                                            │  (Agent SDK)      │
                                            │                   │
                                            │ ┌───────────────┐ │
                                            │ │ rules-agent   │─┼─► .claude/rules/local/ (auto)
                                            │ │ suggestion    │─┼─► suggestions/ (pending)
                                            │ │ hooks-agent   │─┼─► .claude/hooks/ (auto)
                                            │ │ skills-agent   │─┼─► .claude/skills/ (auto)
                                            │ │ hygiene-agent │─┼─► hygiene/ (pending)
                                            │ └───────────────┘ │
                                            │  + quality gate   │
                                            └──────────────────┘
```

### Data Flow

1. **Hooks** are dumb pipes. Shell scripts receive raw JSON on stdin and forward it to `collector.mjs`.
2. **Collector** parses JSON and compresses PostToolUse payloads at ingestion (strips tool responses, keeps only metadata). UserPromptSubmit payloads are stored uncompressed. Stop events are skipped entirely.
3. **SQLite** stores events in `raw_events` with a claim-confirm queue pattern (`pending` → `processing` → `done`).
4. **Worker** polls for pending events, builds a bulk prompt, and delegates to an orchestrator that dispatches to 5 sub-agents via the Claude Agent SDK. Each agent runs conditionally — skipped if its input criteria aren't met.
5. **Quality Gate** evaluates agent output after each batch. Low-quality changes can be auto-reverted.

### Why SQLite, Not JSON Files

- Concurrent writes from multiple hooks don't corrupt data (WAL mode)
- Querying across thousands of events is instant
- No file-per-event explosion
- Claim-confirm queue pattern enables reliable batch processing with self-healing

## Data Store

All runtime data lives in `.claude-auto-context/` in your project root:

```
.claude-auto-context/
├── collector.mjs              # Hook → SQLite relay (compressed ingestion)
├── worker.mjs                 # Background polling worker (Agent SDK orchestrator)
├── quality-gate.mjs           # Post-agent output evaluator
├── skill-prompt-builder.mjs   # Builds context for skills-agent
├── db/
│   ├── claude-auto-context.db # SQLite (raw_events, observations)
│   └── worker.log             # Worker activity log
├── suggestions/               # Pending structural suggestions
└── hygiene/                   # Pending hygiene reports
```

The SQLite database contains two tables:

| Table | Purpose |
|-------|---------|
| `raw_events` | Every captured event with claim-confirm queue (`pending` → `processing` → `done` / `dead`) |
| `observations` | Cross-session pattern observations (deduplicated by pattern_key + session_id) |

The `db/` directory is gitignored — it's machine-local runtime data.

## Philosophy

- **Structure over documentation** — The goal isn't a bigger CLAUDE.md. It's a project that doesn't need one. Rules files and structural suggestions fix root causes, not symptoms.
- **Implicit knowledge, not explicit** — Only captures what Claude can't discover from code alone: conventions, prohibitions, non-obvious commands, runtime dependencies.
- **Dumb collection, smart analysis** — Hooks are fast and stupid (<100ms). All intelligence lives in the background worker where latency doesn't matter.
- **Human-in-the-loop for structure** — Convention rules auto-generate. Structural suggestions (file splits, directory reorganization) always require approval via `/cac-apply`.
- **Local and private** — All processing happens on your machine. SQLite is local. No data leaves your project.
- **Self-correcting** — Conventions that stop being relevant auto-decay (30-day revalidation, 60-day force-delete). Suggestions that get dismissed are marked, not re-proposed.

## Requirements

- Claude Code 1.0.33+
- [Bun](https://bun.sh) (auto-installed by setup hook if missing)
- `@anthropic-ai/claude-agent-sdk` (bundled in `package.json`)

## Project Structure

```
claude-auto-context/
├── .claude-plugin/
│   ├── plugin.json              # Plugin manifest
│   └── marketplace.json         # Marketplace definition
├── hooks/
│   └── hooks.json               # Hook definitions (6 lifecycle events)
├── scripts/
│   ├── setup.sh                 # Installs Bun, creates dirs, runs auto-cleanup
│   ├── on-session-start.sh      # Dashboard stats → session context
│   ├── on-user-prompt-submit.sh # Captures user prompt, checks pending suggestions
│   ├── on-post-tool-use.sh      # Pipes tool events → collector
│   ├── on-stop.sh               # Threshold check → worker launch
│   ├── worker-launcher.sh       # Single-instance worker launcher (lock file)
│   ├── bump-version.sh          # Version sync across plugin.json/marketplace.json/package.json
│   ├── block-conflict-markers-on-stage.sh
│   ├── bash-check-after-sh-edit.sh
│   ├── auto-cleanup.sh          # Convention decay + stale artifact cleanup
│   └── common.sh                # Shared shell helpers
├── .claude-auto-context/
│   ├── collector.mjs            # JSON → SQLite relay
│   ├── worker.mjs               # Background worker (5 sub-agents via Agent SDK)
│   ├── quality-gate.mjs         # Output quality evaluator
│   └── skill-prompt-builder.mjs # Skill context builder
├── skills/                      # Plugin-shipped skills (distribution copies)
│   ├── cac-apply/SKILL.md
│   ├── create-suggestion/SKILL.md
│   ├── extract-rules/SKILL.md
│   ├── context-hygiene/SKILL.md
│   ├── cac-create-skill/SKILL.md
│   └── run-worker/SKILL.md
├── package.json                 # Dependencies (@anthropic-ai/claude-agent-sdk)
└── README.md
```

## Contributing

Contributions welcome. The codebase is shell scripts for hooks, Bun/JS for collection and worker logic, and SQLite for storage.

1. Fork the repository
2. Create a branch for your change
3. Submit a PR

## License

MIT License — see [LICENSE](LICENSE) file for details.
