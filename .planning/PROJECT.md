# Claude Auto Context

## What This Is

A Claude Code plugin that captures session events (prompts, tool calls, session lifecycle) and auto-generates context files — rules, CLAUDE.md updates, and structural suggestions — using a background worker with multi-agent orchestration. The plugin improves AI coding quality over time without manual effort.

## Core Value

Continuously improve Claude Code's project understanding by extracting patterns from real usage and turning them into actionable context, automatically.

## Current Milestone: v1.3 Skill Agent

**Goal:** Add a skill-agent to the worker orchestrator that detects repetitive workflows from session data and auto-generates high-quality SKILL.md files.

**Target features:**
- Detect patterns in session data that indicate repeatable workflows suitable for skills
- Auto-generate SKILL.md files with correct frontmatter, description, and instructions
- Quality criteria for generated skills (triggering accuracy, instruction clarity, scope)

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- [x] **HOOK-01**: Plugin captures UserPromptSubmit, PostToolUse, and Stop events via lifecycle hooks
- [x] **HOOK-02**: Events are stored in SQLite with Claim-Confirm queue pattern
- [x] **HOOK-03**: Background worker polls and processes events in batches
- [x] **HOOK-04**: Worker survives crash/SIGKILL via self-heal on startup
- [x] **RULE-01**: rules-agent extracts conventions from repeated patterns across 2+ sessions
- [x] **RULE-02**: Rules are written as separate .claude/rules/*.md files with frontmatter
- [x] **CMD-01**: claudemd-agent updates CLAUDE.md with tacit knowledge (replaced by rules-agent in v1.2)
- [x] **SUG-01**: suggestion-agent detects structural issues and creates proposal files
- [x] **SUG-02**: Users review and apply suggestions via /cac-apply skill
- [x] **QA-01**: Hygiene auditor checks for duplicates, contradictions, stale references after agent updates
- [x] **SYS-01**: Lock file management guarantees single worker instance
- [x] **SYS-02**: Bun auto-installed on first plugin load via Setup hook
- [x] **AHOOK-01**: hooks-agent analyzes session patterns to detect repetitive manual actions
- [x] **AHOOK-02**: hooks-agent generates hook configurations (PostToolUse, PreToolUse) for detected patterns
- [x] **LOCAL-01**: rules-agent writes to `.claude/rules/local/` (gitignored)
- [x] **LOCAL-02**: claudemd-agent removed; rules-agent handles global knowledge via globs-less rules
- [x] **SUG-03**: Timestamp-based suggestion filenames (YYYYMMDD-HHMMSS-slug.md)

### Active

<!-- Current scope. Building toward these. -->

- [x] **SDET-01**: Skill detector identifies repetitive workflows from session data — Validated in Phase 8: detection-foundation
- [x] **SDET-02**: Detector uses frequency + structure heuristics (min 2 sessions, ≥3 steps) — Validated in Phase 8
- [x] **SDET-03**: Detector outputs structured JSON (skill name, steps, evidence sessions) — Validated in Phase 8
- [x] **SPRO-01**: Skill-prompt-builder generates LLM-ready prompt files from detector output — Validated in Phase 9
- [x] **SPRO-02**: Generated prompts include generalized instructions, not session-specific details — Validated in Phase 9
- [x] **SINT-05**: 5-skill hard cap enforced before LLM call, suggestion fallback at cap — Validated in Phase 10: delivery-ux
- [x] **SDEL-01**: Skill-prompt files use YYYYMMDD-HHMMSS-{slug}.md naming convention — Validated in Phase 10
- [x] **SDEL-02**: /cac-create-skill skill delegates to skill-creator and updates registry — Validated in Phase 10
- [x] **SDEL-03**: Setup hook checks skill-creator availability with guidance message — Validated in Phase 10
- [x] **SDEL-04**: skills-registry.json bootstrapped at worker startup, gitignored — Validated in Phase 10

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Project initial scan (one-time analysis of package.json, tsconfig, etc.) — Session pattern analysis only
- Gradual trust/auto-apply system — Direct modification chosen; trust escalation deferred
- Hook removal/cleanup — Focus on generation first; lifecycle management later

## Context

- Plugin uses Bun runtime with built-in SQLite (`bun:sqlite`)
- Agent orchestration via `@anthropic-ai/claude-agent-sdk` v0.2.62
- Current 5-agent pipeline: rules-agent, suggestion-agent, hooks-agent, skill-detector + skill-prompt-builder
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
*Last updated: 2026-03-26 after Phase 10 completion — v1.3 milestone complete*
