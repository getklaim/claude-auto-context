# Auto-Context

Auto-Context is a Claude Code plugin that makes your project smarter over time. Instead of manually maintaining CLAUDE.md, it observes your coding sessions, extracts patterns, detects conventions, and progressively improves your project's context — so Claude gets better at navigating and understanding your codebase with every session.

Think of it as "organizational scar tissue" — but automated.

## How it works

It starts the moment you open a Claude Code session. Every tool call — every `Glob`, `Read`, `Edit`, `Bash` — gets silently captured and stored in a local SQLite database. No filtering, no analysis at capture time. Just raw events.

When your session ends, a background worker wakes up. It analyzes the accumulated events across sessions and looks for patterns — conventions, anti-patterns, implicit knowledge — and acts on them:

1. **Rules files** (`.claude/rules/*.md`) are auto-generated from repeated patterns. These load automatically when Claude touches matching files.
2. **CLAUDE.md updates** are made for project-wide implicit knowledge like non-obvious build commands.
3. **Structural suggestions** are created when the worker detects deeper issues (like a file that should be split). These require your explicit approval.

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

Start a new Claude Code session. The setup hook will auto-install dependencies. The background worker will automatically analyze your sessions — no manual verification needed.

### Updating

```
/plugin update claude-auto-context@claude-auto-context-marketplace
```

## The Core Workflow

### Automatic (Zero Config)

Once installed, three hooks fire automatically during every session:

| Event | What happens |
|-------|-------------|
| **Session start** | Installs dependencies if needed |
| **Tool use** | Captures raw event → SQLite (every `Glob`, `Read`, `Edit`, `Bash`) |
| **Session stop** | Captures session summary → SQLite, triggers background worker |

All hooks execute in under 100ms. You never notice them.

### Commands

| Command | Purpose |
|---------|---------|
| `/cac-apply {suggestion-id}` | Review and apply a specific structural suggestion |
| `/cac-apply-all` | Apply all pending suggestions sequentially |

### What the Worker Produces

**Auto-generated** (no approval needed):

```
.claude/rules/
  error-handling.md    ← "Use Result type, not try-catch" (glob: src/**/*.ts)
  api-patterns.md      ← "All endpoints return ApiResponse<T>" (glob: src/api/**)
  testing.md           ← "Run tests with: bun test --filter=unit"
```

Rules files are scoped by glob pattern. Claude loads them automatically when it touches matching files — no CLAUDE.md bloat.

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
├─► Glob ──► PostToolUse Hook ──► RAW JSON ──┐
├─► Read ──► PostToolUse Hook ──► RAW JSON ──┤
├─► Edit ──► PostToolUse Hook ──► RAW JSON ──┤  No analysis.
├─► Bash ──► PostToolUse Hook ──► RAW JSON ──┤  Just store.
│                                             │
└─► Stop ──► Stop Hook ────────► RAW JSON ──┤
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │   SQLite     │
                                      │  raw_events  │
                                      └──────┬───────┘
                                             │
                                        (polling)
                                             │
                                             ▼
                                      ┌──────────────┐
                                      │  Background  │
                                      │   Worker     │
                                      │              │
                                      │ ┌──────────┐ │
                                      │ │Rules Agent│─┼─► .claude/rules/ (auto)
                                      │ │Suggestion │─┼─► suggestions/ (pending)
                                      │ │ ClaudeMD  │─┼─► CLAUDE.md (auto)
                                      │ └──────────┘ │
                                      │(3 sub-agents)│
                                      └──────────────┘
```

### Data Flow

1. **Hooks** are dumb pipes. They receive raw JSON on stdin and forward it to the collector. No parsing, no filtering.
2. **Collector** (`collector.mjs`) parses JSON and inserts into SQLite with parameterized queries. Safe escaping, no shell injection risks.
3. **SQLite** stores everything in `raw_events` table with `processed=0`.
4. **Worker** polls for unprocessed events, analyzes patterns across sessions, and produces rules/suggestions/CLAUDE.md updates.

### Why SQLite, Not JSON Files

- Concurrent writes from multiple hooks don't corrupt data (WAL mode)
- Querying across thousands of events is instant
- No file-per-event explosion
- Worker can atomically mark events as processed

## Data Store

All runtime data lives in `.claude-auto-context/` in your project root:

```
.claude-auto-context/
├── collector.mjs          # Hook → SQLite relay
├── db/
│   └── claude-auto-context.db    # SQLite (raw_events, sessions, insights)
└── suggestions/
    ├── 001-split-utils.md        # pending
    └── 002-unify-routes.md       # pending
```

The SQLite database contains three tables:

| Table | Purpose |
|-------|---------|
| `raw_events` | Every hook event, unprocessed. The source of truth. |
| `sessions` | Worker-generated session summaries (task type, files touched, patterns found) |
| `insights` | Cumulative analysis results (conventions, structure suggestions) |

The `db/` directory is gitignored — it's machine-local runtime data. Rules files and suggestions are committed.

## Philosophy

- **Structure over documentation** — The goal isn't a bigger CLAUDE.md. It's a project that doesn't need one. Rules files and structural suggestions fix root causes, not symptoms.
- **Implicit knowledge, not explicit** — Only captures what Claude can't discover from code alone: conventions, prohibitions, non-obvious commands, runtime dependencies.
- **Dumb collection, smart analysis** — Hooks are fast and stupid (<100ms). All intelligence lives in the background worker where latency doesn't matter.
- **Human-in-the-loop for structure** — Convention rules auto-generate. Structural suggestions (file splits, directory reorganization) always require approval via `/cac-apply`.
- **Local and private** — All processing happens on your machine. SQLite is local. No data leaves your project.
- **Self-correcting** — Conventions that stop being relevant decay. Suggestions that get dismissed teach the worker what not to suggest.

## Requirements

- Claude Code 1.0.33+
- Node.js 18+ (for `collector.mjs`)
- `better-sqlite3` (auto-installed by setup hook)

## Project Structure

```
claude-auto-context/
├── .claude-plugin/
│   ├── plugin.json            # Plugin manifest
│   └── marketplace.json       # Marketplace definition
├── hooks/
│   └── hooks.json             # Hook definitions (Setup, PostToolUse, Stop)
├── scripts/
│   ├── setup.sh               # Installs dependencies
│   ├── on-post-tool-use.sh    # Pipes tool events → collector
│   └── on-stop.sh             # Pipes session end → collector
├── .claude-auto-context/
│   └── collector.mjs          # JSON → SQLite relay
├── docs/
│   ├── architecture.md        # Architecture overview
│   ├── hook-collection.md     # Hook Collection + SQL Storage
│   └── background-worker.md   # Background Worker
├── package.json               # Dependencies (better-sqlite3)
└── README.md
```

## Roadmap

- [x] Hook → Collector → SQLite pipeline
- [x] SQLite polling worker (Claim-Confirm queue pattern)
- [ ] 3 sub-agent architecture (Rules Agent, Suggestion Agent, CLAUDE.md Agent)
- [ ] Bulk prompt construction from SQLite data
- [ ] Auto-generated `.claude/rules/` from conventions (Rules Agent)
- [ ] Suggestions system for structural proposals (Suggestion Agent)
- [ ] CLAUDE.md auto-update for implicit knowledge (CLAUDE.md Agent)
- [ ] `/cac-apply` suggestion review and application
- [ ] Convention decay (auto-remove stale rules)

## Want the Easy Version?

If the above feels too technical, check out the plain-language walkthrough — using analogies instead of jargon:

- [English](docs/easy-explanation.md)
- [한국어](docs/easy-explanation-ko.md)

## Contributing

Contributions welcome. The codebase is intentionally simple — shell scripts for hooks, one Node.js collector, and SQLite for storage.

1. Fork the repository
2. Create a branch for your change
3. Submit a PR

## License

MIT License — see [LICENSE](LICENSE) file for details.
