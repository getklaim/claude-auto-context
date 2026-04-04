# Context Hygiene Check

## Scope Restriction

**CRITICAL**: You may only CREATE or MODIFY files in `.claude/rules/local/`.
- `.claude/rules/*.md` (committed team rules): READ-ONLY — analyze but never modify
- `CLAUDE.md`: READ-ONLY — analyze but never modify
- `.claude/rules/local/*.md` (auto-generated rules): full read/write access
- Hygiene files in `.claude-auto-context/hygiene/`: create only

Run a 5-point quality audit on the project's `.claude/rules/*.md`, `.claude/rules/local/*.md`, and `CLAUDE.md` files.

## Procedure

1. Read all `.claude/rules/*.md` files (committed team rules)
2. Read all `.claude/rules/local/*.md` files (auto-generated rules)
3. Read `CLAUDE.md`
4. Check that rules files exist (committed + local combined)
   - If none exist: report "No context files to analyze" and stop
5. Run the 5-point checklist:
   - **H-01 Duplicate**: Compare all rules file pairs — flag overlapping globs with same behavior
   - **H-02 Contradiction**: Compare rules pairs AND rules vs CLAUDE.md — flag opposite instructions for same scope
   - **H-03 Stale Reference**: For each rules file with globs in frontmatter, use Glob to verify matching files exist — flag if 0 matches
   - **H-04 Verbosity**: Flag rules files over 500 chars where 50%+ compression is possible — suggest compressed version
   - **H-06 Priority Placement**: When 5+ rules files exist, flag critical rules (error handling, security, testing) that have narrow globs limiting visibility
6. For each issue found, create a hygiene file in `.claude-auto-context/hygiene/` using the standard format:
   - Filename: `hygiene-YYYYMMDD-HHMMSS-{slug}.md` (type-prefixed, timestamp-based naming)
   - Include: Status (pending), Created (ISO 8601 UTC), Category (hygiene-*), Problem, Proposal, Evidence, Metrics sections
7. Report summary: "{N} issues found, {M} context files analyzed"
   - If no issues: "All 5 checks passed. Context files are clean."
