## Current Position

Phase: 6 (Local Isolation)
Plan: --
Status: Ready to plan
Last activity: 2026-03-23 -- Milestone v1.2 roadmap created

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Continuously improve Claude Code's project understanding by extracting patterns from real usage
**Current focus:** Team merge conflict elimination (v1.2)

## Accumulated Context

- Existing 3-agent orchestrator processes events in batches via Claude Agent SDK
- Worker uses Claim-Confirm queue with self-heal recovery
- Session events captured via UserPromptSubmit, PostToolUse, Stop hooks
- Team merge conflict research completed (2026-03-23 session) — now v1.2 milestone
- v1.2 strategy: local-only generation + promotion skill. claudemd-agent removed.
