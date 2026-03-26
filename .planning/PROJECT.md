# Claude Auto Context

## What This Is

A Claude Code plugin that captures session events (prompts, tool calls, session lifecycle) and auto-generates context files — rules, hooks, skills, and structural suggestions — using a background worker with multi-agent orchestration. The plugin continuously improves AI coding quality without manual effort.

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
- [x] **SDET-01**: Cross-session pattern matching (Jaccard > 0.5, LCS >= 5) -- v1.3
- [x] **SDET-02**: Compound action parsing (verb chain extraction) -- v1.3
- [x] **SDET-03**: Negative heuristic filtering (5 categories) -- v1.3
- [x] **SDET-04**: Scoring formula (score >= 10 AND sessions >= 3 -> generate) -- v1.3
- [x] **SDET-05**: Classification decision tree (skill vs rule vs hook routing) -- v1.3
- [x] **SDET-06**: Self-referential filter (exclude skill invocation and .claude/ events) -- v1.3
- [x] **SINT-03**: Observations table extension (pattern_key LIKE 'skill:%') -- v1.3
- [x] **SPROM-01**: Prompt composition (what/when/why sections) -- v1.3
- [x] **SPROM-02**: Session examples with generalization -- v1.3
- [x] **SPROM-03**: Secret sanitization (8 patterns) -- v1.3
- [x] **SPROM-04**: "When NOT to use" negative examples -- v1.3
- [x] **SINT-01**: Separate query() call ($0.50, maxTurns: 8) -- v1.3
- [x] **SINT-02**: Every 3rd batch cadence -- v1.3
- [x] **SINT-04**: Context injection (bulkPrompt + existing skills) -- v1.3
- [x] **SINT-05**: 5-skill hard cap with suggestion fallback -- v1.3
- [x] **SDEL-01**: Prompt file output naming (YYYYMMDD-HHMMSS-{slug}.md) -- v1.3
- [x] **SDEL-02**: /cac-create-skill skill (delegates to skill-creator) -- v1.3
- [x] **SDEL-03**: Dependency check (skill-creator availability) -- v1.3
- [x] **SDEL-04**: Registry update (skills-registry.json tracking) -- v1.3

### Active

<!-- Current scope. Building toward these. -->

(None yet -- define in next milestone)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Project initial scan (one-time analysis of package.json, tsconfig, etc.) -- Session pattern analysis only
- Gradual trust/auto-apply system -- Direct modification chosen; trust escalation deferred
- Hook removal/cleanup -- Focus on generation first; lifecycle management later
- Embedding-based similarity -- Jaccard sufficient for v1.3; revisit if multilingual accuracy insufficient
- Cross-project skill portability -- Project-local generation only; portable detection deferred to v1.4+
- Skill lifecycle management (auto-disable, usage tracking) -- Deferred to v1.4 (SLCM-01..04)

## Context

- Plugin uses Bun runtime with built-in SQLite (`bun:sqlite`)
- Agent orchestration via `@anthropic-ai/claude-agent-sdk` v0.2.62
- Current pipeline: 3-agent orchestrator (rules, suggestion, hooks) + independent skill-agent
- Worker spawns agents with `query()` function; orchestrator $1.0 per batch, skill-agent $0.50 every 3rd batch
- Hooks config lives in target project's settings or `.claude/settings.json`
- Skill creation: skill-detector -> skill-prompt-builder -> prompt file -> /cac-create-skill -> skill-creator -> SKILL.md
- Skills tracked in skills-registry.json (max 5, gitignored)

## Constraints

- **Runtime**: Bun-only (worker.mjs uses `bun:sqlite`; cannot run on Node.js)
- **Budget**: Agent SDK cost stays within $1.0 per batch (orchestrator) + $0.50 per skill-agent run
- **Latency**: Hook scripts must complete <100ms (non-blocking)
- **Compatibility**: Generated hooks/skills must be valid Claude Code format
- **Safety**: Agents must not generate artifacts that break existing workflow
- **Skill Cap**: Max 5 auto-generated skills per project

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Session pattern analysis over initial scan | Consistent with existing capture-first architecture | Good |
| Direct hooks.json modification | User wants immediate effect, not suggestion review | Good |
| Quality gate scope (comprehensive) | Covers linting, blocking, testing, secrets | Good |
| Skill-creator delegation (not direct generation) | Quality assurance via specialized tool | Good |
| Jaccard + LCS over embeddings | Simpler, no external API dependency, sufficient accuracy | Good |
| 5-skill hard cap | Prevents context bloat; suggestion fallback preserves patterns | Good |
| Human-in-the-loop skill creation | /cac-create-skill review step ensures quality | Good |
| Every-3rd-batch cadence | Workflow patterns change slowly; reduces cost | Good |

---
*Last updated: 2026-03-26 after v1.3 milestone*
