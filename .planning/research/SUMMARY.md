# Research Synthesis: hooks-agent (v1.1)

**Date:** 2026-03-23
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## 1. Stack Additions

No new runtime dependencies. All changes are additive to existing code.

| Item | Change |
|------|--------|
| `worker.mjs` | Add `hooks-agent` as 4th entry in `agents` map; update orchestrator prompt; add `.claude/hooks` mkdir; filter `settings.json` from hygiene trigger |
| `quality-gate.mjs` | Add `settings.json` to `takeContentSnapshot`; add `'hook'` fileType; add Q-12 (format validity) and Q-13 (no-duplicate) checks; exclude `settings.json` from Q-07 append-only check |
| `skills/generate-hooks/SKILL.md` | New skill file (parallel to `skills/extract-rules/SKILL.md`) |
| Budget | Give hooks-agent isolated `maxBudgetUsd: 0.25` (not shared with orchestrator pool) |

---

## 2. Feature Table Stakes (must-have for v1.1)

| Hook | Event | Trigger | Condition |
|------|-------|---------|-----------|
| Dangerous command blocker | `PreToolUse:Bash` | Unconditional — generate for all projects | Patterns: `rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE` |
| Auto-formatter | `PostToolUse:Edit\|Write` | Same formatter run observed in 3+ distinct sessions | Detect `prettier`, `eslint --fix`, `black`, `gofmt` in Bash events |
| `.env` / secrets file protection | `PreToolUse:Edit\|Write\|MultiEdit` | First occurrence of Write to `*.env`, `*.pem`, `*.key` | No frequency threshold — zero tolerance |
| Stop test gate | `Stop` | Test command appears after Stop event in 3+ sessions | Must include `stop_hook_active` guard; background-spawn only |
| Settings JSON merge (not overwrite) | — | Every write | Read → parse → dedup → write-atomic (temp + mv) |
| User notification on hook add | — | Every new hook written | Write suggestion file with `## Status\napplied` |

**Stop hook infinite loop guard is non-negotiable:** every generated Stop hook must check `stop_hook_active`.

---

## 3. Architecture Integration

hooks-agent runs **in parallel** with the existing 3 agents inside the orchestrator `query()` session. It reads the same `buildBulkPrompt()` output and writes to a separate target (`.claude/settings.json`), creating no dependency on rules-agent or claudemd-agent.

```
raw_events (SQLite)
  ↓ buildBulkPrompt()
Orchestrator
  ├── rules-agent       → .claude/rules/*.md
  ├── suggestion-agent  → .claude-auto-context/suggestions/*.md
  ├── claudemd-agent    → CLAUDE.md
  └── hooks-agent       → .claude/settings.json + .claude/hooks/*.sh
  ↓
runQualityGate()
  └── Q-12/Q-13 on settings.json   [NEW]
  ↓
hasContentChanged() — settings.json excluded from hygiene trigger
  ↓ (rules/CLAUDE.md changed only)
hygiene-agent
```

**Write target:** `$CLAUDE_PROJECT_DIR/.claude/settings.json` only. Never write to plugin's `hooks/hooks.json`.

**Generated scripts:** `.claude/hooks/*.sh` in the target project. Use `$CLAUDE_PLUGIN_ROOT` nowhere in generated hooks — use `$CLAUDE_PROJECT_DIR` only.

**Registry:** `.claude-auto-context/hooks-registry.json` — tracks every generated hook with source session IDs, timestamp, previous-settings snapshot (enables rollback).

---

## 4. Build Order

| Phase | Deliverable | Dependency |
|-------|-------------|------------|
| 1 | `skills/generate-hooks/SKILL.md` — detection thresholds, output format, merge procedure, anti-patterns | None — start here |
| 2 | `quality-gate.mjs` extensions — snapshot settings.json, Q-12/Q-13, exclude from Q-07, exclude from hygiene trigger | None — parallelizable with Phase 1 |
| 3 | `worker.mjs` changes — add hooks-agent to agents map, mkdir, orchestrator prompt, hygiene filter, isolated budget | Phase 1 (skill name must be final), Phase 2 (snapshot must exist) |
| 4 | `/cac-undo-hook` skill + registry read/write in hooks-agent | Phase 1; required before AHOOK-07 ships |
| 5 | E2E validation — seed test sessions, verify settings.json created/merged, Q-12/Q-13 catches errors, hygiene NOT triggered on hooks-only change | Phases 1–4 |
| 6 | Notification (AHOOK-08) — suggestion file on hook add | Phase 3 |

---

## 5. Watch Out For

**P-01: Wrong write target.**
Writing to the plugin's `hooks/hooks.json` instead of the target project's `.claude/settings.json` silently affects every user of the plugin.
Prevention: hard-code the target path as `resolve(projectRoot, '.claude', 'settings.json')`; quality gate rejects writes to any path containing `CLAUDE_PLUGIN_ROOT`.

**P-02: Infinite hook loops.**
A PostToolUse hook script that itself writes a file triggers another PostToolUse, causing unbounded re-entry. The plugin's own `collector.mjs` already generates Write events — hooks-agent will see these as patterns.
Prevention: every generated script template includes `[ -n "$CAC_HOOK_RUNNING" ] && exit 0; export CAC_HOOK_RUNNING=1`; filter events where file path is inside `.claude-auto-context/` before pattern detection.

**P-04: Command injection.**
Session data (user prompts, commit messages, file paths) fed through `buildBulkPrompt` can contain shell metacharacters. If hooks-agent embeds runtime values from session data into generated scripts, arbitrary code executes on every tool call.
Prevention: generated hook commands are static strings only — no interpolation of session data values; quality gate runs `bash -n` on generated scripts and scans for `$()`, backticks, and `eval` in variable positions.

**P-05: False positive patterns.**
High-frequency Bash events in session data may be one-off debugging sessions, not stable conventions. Claude's own verification calls (`cat file` after Write) look like user patterns.
Prevention: require 3+ distinct sessions (not 2) for formatter/test hooks; exclude tool calls where file path is inside `.claude-auto-context/` or `.claude/`; only generate hooks for patterns that co-occur with a user-initiated prompt.

**P-09: No rollback path.**
A bad PreToolUse block hook immediately breaks user workflow with no removal path. Direct modification (AHOOK-07) is unsafe without an undo mechanism.
Prevention: hooks-registry.json must store the settings.json snapshot before each write; `/cac-undo-hook` skill must exist before AHOOK-07 ships; every notification includes manual removal instructions.

---

## 6. Anti-Features

| Do Not Build | Reason |
|-------------|--------|
| Hooks writing to `~/.claude/settings.json` | Affects all projects; wrong scope |
| `type: "agent"` hooks for pattern matching | Spawns subagent on every tool call — expensive and slow |
| `type: "http"` hooks | Requires a running local server; not reliably available |
| `async: false` on PostToolUse slow commands (lint, test, tsc) | Blocks Claude Code UI; anything beyond file-stat speed must be background-spawned |
| Hooks that spawn `claude -p` | Hangs inside Claude Code sessions (documented constraint) |
| Duplicate PostToolUse format hook when project already has `pre-commit` formatting | Redundant; double-format with unpredictable last-write-wins |
| Generating more than 1 hook per batch | Hook accumulation degrades UX; if 3+ hooks already exist in registry, require user confirmation before adding more |
| Overwriting `.claude/settings.json` | Destroys user-configured hooks; always merge via read → modify → atomic write |
| Secret scanning as PostToolUse | PostToolUse cannot undo a write; secrets detection must be PreToolUse on Write/Edit content |
| TypeScript type-check hook without `tsconfig.json` present | Generates noise for non-TS projects |
| Test gate hook without detected test runner in `package.json` | Same — check project stack before generating tool-specific hooks |
