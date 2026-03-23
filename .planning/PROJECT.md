# Claude Auto Context

## What This Is

A Claude Code plugin that captures session events (prompts, tool calls, session lifecycle) and auto-generates context files — rules, CLAUDE.md updates, and structural suggestions — using a background worker with multi-agent orchestration. The plugin improves AI coding quality over time without manual effort.

## Core Value

Continuously improve Claude Code's project understanding by extracting patterns from real usage and turning them into actionable context, automatically.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- [x] **HOOK-01**: Plugin captures UserPromptSubmit, PostToolUse, and Stop events via lifecycle hooks
- [x] **HOOK-02**: Events are stored in SQLite with Claim-Confirm queue pattern
- [x] **HOOK-03**: Background worker polls and processes events in batches
- [x] **HOOK-04**: Worker survives crash/SIGKILL via self-heal on startup
- [x] **RULE-01**: rules-agent extracts conventions from repeated patterns across 2+ sessions
- [x] **RULE-02**: Rules are written as separate .claude/rules/*.md files with frontmatter
- [x] **CMD-01**: claudemd-agent updates CLAUDE.md with tacit knowledge (max 3 lines per update)
- [x] **SUG-01**: suggestion-agent detects structural issues and creates proposal files
- [x] **SUG-02**: Users review and apply suggestions via /cac-apply skill
- [x] **QA-01**: Hygiene auditor checks for duplicates, contradictions, stale references after agent updates
- [x] **SYS-01**: Lock file management guarantees single worker instance
- [x] **SYS-02**: Bun auto-installed on first plugin load via Setup hook

### Active

<!-- Current scope. Building toward these. -->

- [ ] **AHOOK-01**: hooks-agent analyzes session patterns to detect repetitive manual actions
- [ ] **AHOOK-02**: hooks-agent generates hook configurations (PostToolUse, PreToolUse) for detected patterns
- [ ] **AHOOK-03**: Generated hooks cover linting/formatting automation
- [ ] **AHOOK-04**: Generated hooks cover dangerous command blocking (PreToolUse deny)
- [ ] **AHOOK-05**: Generated hooks cover test auto-execution before commits
- [ ] **AHOOK-06**: Generated hooks cover secret/credential detection in file writes
- [ ] **AHOOK-07**: hooks-agent directly modifies target project's hooks configuration
- [ ] **AHOOK-08**: User receives notification when new hooks are added

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Team merge conflict handling for auto-generated files — Deferred to next milestone; needs separate design for rules, CLAUDE.md, and hooks.json
- Project initial scan (one-time analysis of package.json, tsconfig, etc.) — Session pattern analysis only for this milestone
- Gradual trust/auto-apply system — Direct modification chosen; trust escalation deferred
- Hook removal/cleanup — Focus on generation first; lifecycle management later

## Context

- Plugin uses Bun runtime with built-in SQLite (`bun:sqlite`)
- Agent orchestration via `@anthropic-ai/claude-agent-sdk` v0.2.62
- Current 3-agent pipeline: rules-agent, suggestion-agent, claudemd-agent
- Worker spawns agents with `query()` function, $1.0 USD budget per batch
- Hooks config lives in target project's settings or `.claude/settings.json`
- Claude Code supports PreToolUse and PostToolUse hooks with matchers (tool_name, command patterns)

## Constraints

- **Runtime**: Bun-only (worker.mjs uses `bun:sqlite`; cannot run on Node.js)
- **Budget**: Agent SDK cost stays within $1.0 per batch (4 agents now instead of 3)
- **Latency**: Hook scripts must complete <100ms (non-blocking)
- **Compatibility**: Generated hooks must be valid Claude Code hook format
- **Safety**: hooks-agent must not generate hooks that break existing workflow

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Session pattern analysis over initial scan | Consistent with existing capture-first architecture | -- Pending |
| Direct hooks.json modification | User wants immediate effect, not suggestion review | -- Pending |
| Quality gate scope (comprehensive) | Covers linting, blocking, testing, secrets | -- Pending |
| Merge conflict handling deferred | Focus on core hook generation first | -- Pending |

---
*Last updated: 2026-03-23 after brownfield initialization*
