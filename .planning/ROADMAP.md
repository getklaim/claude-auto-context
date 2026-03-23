# Roadmap: claude-auto-context v1.2

**Created:** 2026-03-23
**Milestone:** v1.2 — Team Merge Conflict Elimination
**Phases:** 6-7 (continuing from v1.0 phase 5)

## Overview

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 6 | Local Isolation | Auto-generated files write to local-only paths | LOCAL-01~06, SUG-03~04, MIG-01~02 | Pending |
| 7 | Promotion Skill | Promote local rules to team-shared | PROMO-01~03 | Pending |

## Phase 6: Local Isolation

**Goal:** All auto-generated context files are written to gitignored paths, eliminating merge conflicts by design.

**Requirements:** LOCAL-01, LOCAL-02, LOCAL-03, LOCAL-04, LOCAL-05, LOCAL-06, SUG-03, SUG-04, MIG-01, MIG-02

**Success Criteria:**
1. rules-agent writes to `.claude/rules/local/` only
2. claudemd-agent removed from worker orchestrator
3. CLAUDE.md quality gate checks (Q-07~Q-09) removed
4. hygiene-agent modifies only `.claude/rules/local/` files
5. setup hook auto-adds `.claude/rules/local/` to `.gitignore`
6. Suggestion files use timestamp-based naming (YYYYMMDD-HHMMSS-slug.md)
7. Existing sequential suggestions still detected by prompt hook
8. Migration moves existing auto-generated rules to `local/`
9. Migration log records moved files
10. `git status` shows no auto-generated files

## Phase 7: Promotion Skill

**Goal:** Users can promote validated local rules to team-shared rules via a skill.

**Requirements:** PROMO-01, PROMO-02, PROMO-03

**Success Criteria:**
1. `/cac-promote` skill lists local rules
2. Shows diff/preview before moving
3. Copies file to `.claude/rules/`, removes local copy

---
*Created: 2026-03-23*
*Last updated: 2026-03-23*
