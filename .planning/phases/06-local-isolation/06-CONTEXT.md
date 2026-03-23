# Phase 6: Local Isolation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

All auto-generated context files are written to gitignored paths (`.claude/rules/local/`), eliminating merge conflicts by design. claudemd-agent is removed entirely. Suggestion files switch to timestamp-based naming.

</domain>

<decisions>
## Implementation Decisions

### Rules path transition
- rules-agent output path changes from `.claude/rules/` to `.claude/rules/local/`
- Change is implemented in `extract-rules/SKILL.md` only — worker.mjs changes minimized
- `.claude/rules/local/` directory created by setup hook (alongside .gitignore addition)
- Rule files in `local/` keep identical frontmatter format (globs: etc.) as committed rules
- Claude Code recognizes rules in `local/` subdirectory the same way

### Hygiene agent scope restriction
- hygiene-agent prompt explicitly states: "analyze all rules but only modify files in `.claude/rules/local/`"
- Committed rules and CLAUDE.md are read-only for hygiene-agent — never modified
- No path filter in quality-gate needed; prompt-level enforcement is sufficient

### claudemd-agent removal (complete)
- Remove from worker.mjs orchestrator (3→2 agents: rules-agent, suggestion-agent)
- Delete `skills/update-claudemd/` directory entirely
- Remove Q-09 (claudemd-no-dup) check from quality-gate.mjs
- Remove H-05 (CLAUDE.md Bloat) check from hygiene-agent prompt in worker.mjs
- Remove `shouldRunHygiene()` CLAUDE.md line count check — only check rules count
- rules-agent takes over "global rules" responsibility: rules without `globs:` frontmatter apply project-wide

### Suggestion naming
- New format: `YYYYMMDD-HHMMSS-{slug}.md` (replaces `NNN-slug.md`)
- Timestamp generation handled by suggestion-agent in `create-suggestion/SKILL.md`
- on-user-prompt-submit.sh updated to detect timestamp-named files only (no backward compat needed)
- SUG-04 (sequential suggestion detection) skipped — pre-release, no existing users

### Migration
- MIG-01 and MIG-02 skipped entirely — plugin has not been publicly released
- No migration logic needed; fresh install is the only path
- Setup hook creates `.claude/rules/local/` and adds to `.gitignore` on first load

### Claude's Discretion
- Exact implementation of setup hook .gitignore addition (idempotent check approach)
- How to handle edge case where `.claude/rules/local/` already exists
- Cleanup of stale references to claudemd-agent in hygiene prompt text

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core implementation files
- `.claude-auto-context/worker.mjs` — Agent orchestrator, processBatch(), claudemd-agent definition to remove
- `.claude-auto-context/quality-gate.mjs` — Q-09 check to remove, takeContentSnapshot() to simplify
- `skills/extract-rules/SKILL.md` — Output path to change to `.claude/rules/local/`
- `skills/create-suggestion/SKILL.md` — Naming convention to change to timestamp format
- `skills/context-hygiene/SKILL.md` — Hygiene scope restriction to add

### Hook scripts
- `scripts/setup.sh` — Add `.claude/rules/local/` creation + .gitignore entry
- `scripts/on-user-prompt-submit.sh` — Update suggestion detection to timestamp format

### Skills to remove
- `skills/update-claudemd/SKILL.md` — Entire directory to delete (claudemd-agent removal)

### Requirements
- `.planning/REQUIREMENTS.md` — LOCAL-01~06, SUG-03 requirements (SUG-04, MIG-01, MIG-02 skipped)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worker.mjs:shouldRunHygiene()` — Currently checks rules count + CLAUDE.md lines; simplify to rules-only
- `quality-gate.mjs` — Already has Q-07/Q-08 removed; Q-09 removal follows same pattern
- `setup.sh` — Simple bash script; easy to extend with mkdir + gitignore logic

### Established Patterns
- Agents get behavior from SKILL.md instructions; path changes go in skill files, not worker
- Hook scripts use `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PROJECT_DIR` env vars for path resolution
- quality-gate uses snapshot-based before/after comparison

### Integration Points
- `worker.mjs` processBatch() orchestrator section (lines ~330-390) — claudemd-agent block to remove
- `worker.mjs` buildHygienePrompt() — references to CLAUDE.md to remove from hygiene prompt
- `on-user-prompt-submit.sh` — ID extraction regex to update for timestamp format

</code_context>

<specifics>
## Specific Ideas

- Pre-release: no backward compatibility needed. Clean break from sequential naming to timestamps.
- MIG-01/MIG-02 intentionally skipped — no public users exist.
- SUG-04 (sequential suggestion detection) also skipped for same reason.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-local-isolation*
*Context gathered: 2026-03-23*
