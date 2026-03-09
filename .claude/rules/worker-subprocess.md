---
globs: ".claude-auto-context/**,scripts/worker-launcher.sh"
---

# Worker Subprocess Conventions

## Claude Code Subprocess Spawning — CLAUDECODE env var

When spawning Claude Code (or the Agent SDK `query()`) from within an already-running Claude Code session, the `CLAUDECODE` environment variable inherited from the parent session causes the child process to abort with:

> "Claude Code cannot be launched inside another Claude Code session"

**Fix must be applied in TWO places (double-fix defense):**

1. Shell launcher script — unset before launching bun:
   ```sh
   unset CLAUDECODE
   nohup bun "$PLUGIN_ROOT/.claude-auto-context/worker.mjs" ...
   ```

2. Node.js / bun worker entry point — delete immediately after imports, before any Agent SDK call:
   ```js
   import { query } from '@anthropic-ai/claude-agent-sdk';
   // ...all other imports...

   // Prevent "cannot be launched inside another Claude Code session" error
   delete process.env.CLAUDECODE;
   ```

Doing it only at the shell level is not sufficient because the variable can survive into the process through other launch paths. Doing it only at the process level is not sufficient if the SDK checks the env before user code runs.

## Worker Launch Pattern

The worker is launched with the project root passed via an environment variable, not by changing cwd:

```sh
export CLAUDE_PROJECT_DIR="$PROJECT_DIR"
nohup bun "$PLUGIN_ROOT/.claude-auto-context/worker.mjs" >> "$LOG_FILE" 2>&1 &
```

Inside the worker, the project root is resolved as:

```js
const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
```

Do NOT rely on `process.cwd()` as the authoritative project root; always prefer `CLAUDE_PROJECT_DIR` when set.

## Single-Instance Lock File

The launcher checks `.claude-auto-context/worker.lock` before starting. The lock file contains the worker PID. A stale lock (process no longer alive) is removed before re-launching. The worker itself writes and removes the lock file on startup and shutdown (SIGTERM/SIGINT).
