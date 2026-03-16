# Context Hygiene Check

Run a 6-point quality audit on the project's `.claude/rules/*.md` and `CLAUDE.md` files.

## Procedure

1. Read all `.claude/rules/*.md` files
2. Read `CLAUDE.md`
3. Check minimum threshold: at least 2 rules files OR CLAUDE.md >= 10 lines
   - If not met: report "Not enough context files to analyze" and stop
4. Run the 6-point checklist:
   - **H-01 Duplicate**: Compare all rules file pairs — flag overlapping globs with same behavior
   - **H-02 Contradiction**: Compare rules pairs AND rules vs CLAUDE.md — flag opposite instructions for same scope
   - **H-03 Stale Reference**: For each rules file with globs in frontmatter, use Glob to verify matching files exist — flag if 0 matches
   - **H-04 Verbosity**: Flag rules files over 500 chars where 50%+ compression is possible — suggest compressed version
   - **H-05 CLAUDE.md Bloat**: If CLAUDE.md exceeds 30 lines, identify content that should move to scoped rules files
   - **H-06 Priority Placement**: When 5+ rules files exist, flag critical rules (error handling, security, testing) that have narrow globs limiting visibility
5. For each issue found, create a suggestion file in `.claude-auto-context/suggestions/` using the standard format:
   - Filename: `{NNN}-hygiene-{slug}.md` (check existing files for next sequence number)
   - Include: Status (pending), Category (hygiene-*), Problem, Proposal, Evidence, Metrics sections
6. Report summary: "{N} issues found, {M} context files analyzed"
   - If no issues: "All 6 checks passed. Context files are clean."
