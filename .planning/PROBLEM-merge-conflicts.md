# Problem Definition: Team Merge Conflicts from Auto-Generated Files

**Date:** 2026-03-23
**Status:** Defined — ready for milestone v1.2
**Context:** Pre-team-deployment analysis; no team is currently using the plugin

---

## Problem Statement

claude-auto-context plugin auto-generates and modifies files that are checked into git. When multiple developers on the same project each run Claude Code sessions, their independent background workers produce divergent changes to the same files. This causes merge conflicts on virtually every PR, degrading team usability.

## Conflict Surface

### High Risk — Guaranteed/Frequent Conflicts

| File | Agent | Why It Conflicts |
|------|-------|-----------------|
| `CLAUDE.md` | claudemd-agent | Single file, append-only. Two developers append different lines at the same location (EOF). Every PR that includes CLAUDE.md changes will conflict with any other PR that also touches CLAUDE.md. |
| `.claude/rules/*.md` | rules-agent, hygiene-agent | **Creation conflict:** Two developers detect the same pattern → same filename generated with different content. **Modification conflict:** One developer's hygiene-agent edits/deduplicates a rule file that another developer also modified. **Delete conflict:** Hygiene-agent removes a stale rule on one branch while another branch modifies it → modify/delete conflict. Unlike CLAUDE.md, rules are multiple files, but the filenames are derived from the detected pattern (e.g., `no-console-log.md`), making collisions likely for common conventions. |
| `.claude-auto-context/suggestions/NNN-*.md` | suggestion-agent, hygiene-agent | Sequential numbering (`001-`, `002-`, ...). Two workers running independently will assign the same number to different suggestions. |

### No Risk — Already Excluded

| File | Reason |
|------|--------|
| `.claude-auto-context/db/` | In .gitignore |
| `.claude-auto-context/worker.lock` | In .gitignore |
| `worker.log` | Inside db/ directory, gitignored |

## Conflict Scenarios

### Scenario 1: CLAUDE.md Append Race (Most Common)

```
main:    CLAUDE.md = [line 1..20]
                |
dev-A branch:  CLAUDE.md = [line 1..20] + [A's 3 new lines]
dev-B branch:  CLAUDE.md = [line 1..20] + [B's 2 new lines]
                |
merge A → main: OK
merge B → main: CONFLICT (both appended at line 21)
```

**Frequency:** Nearly every PR pair where both developers had active sessions.
**Severity:** Annoying but resolvable — both additions are valid and should coexist.

### Scenario 2: Suggestion Number Collision

```
main:    suggestions/ = [001-split-utils.md]
                |
dev-A branch:  suggestions/ + [002-add-types.md]
dev-B branch:  suggestions/ + [002-fix-imports.md]
                |
merge A → main: OK (002-add-types.md)
merge B → main: CONFLICT (002-fix-imports.md has same prefix)
```

**Frequency:** Moderate — depends on how often suggestions are generated.
**Severity:** File-level conflict; the suggestions themselves are independent.

### Scenario 3: Duplicate Rule Detection

```
Both devA and devB use console.log in their sessions.
Both workers detect "avoid console.log in production code" pattern.
Both create .claude/rules/no-console-log.md with slightly different wording.

merge A → main: OK
merge B → main: CONFLICT (same filename, different content)
```

**Frequency:** Lower — requires same pattern detected independently.
**Severity:** Content-level conflict; semantically the rules say the same thing.

### Scenario 4: Hygiene Agent Cross-Modification

```
dev-A session: hygiene-agent detects duplicate rules, merges rules/a.md + rules/b.md → rules/a.md
dev-B session: B was modifying rules/b.md independently

merge: rules/b.md deleted by A, modified by B → CONFLICT (modify/delete)
```

**Frequency:** Low — hygiene runs are conditional.
**Severity:** High — modify/delete conflicts are harder to resolve than content conflicts.

## Impact Assessment

| Dimension | Impact |
|-----------|--------|
| **PR friction** | Every PR from a developer with active sessions will likely conflict with another developer's PR. In a 5-person team, this could mean 4+ conflict resolutions per PR cycle. |
| **Developer experience** | Resolving auto-generated file conflicts is especially frustrating because the developer didn't write the content. They can't judge which version is "correct." |
| **Adoption blocker** | Teams may disable the plugin entirely rather than deal with constant conflicts, negating all value. |
| **Semantic correctness** | Naive conflict resolution (accept-theirs / accept-mine) may lose valid auto-generated context, silently degrading Claude's project understanding. |

## Root Causes

1. **Single shared files** — CLAUDE.md is a single append target for all developers
2. **Deterministic naming from patterns** — Rules filenames are derived from detected patterns, so independent workers detecting the same convention produce the same filename with divergent content
3. **No coordination** — Workers run independently with no awareness of other workers' outputs
4. **Sequential numbering** — Suggestion files use a counter that isn't globally unique
5. **Content duplication** — Multiple workers may detect the same patterns independently
6. **Destructive hygiene** — Hygiene-agent modifies and deletes existing rules/suggestions, creating modify/delete conflicts across branches
7. **Checked into git** — Auto-generated files are committed alongside human code changes

## Constraints on Any Solution

- Must not degrade single-developer experience (zero-config for solo use)
- Auto-generated context must eventually be shared across the team (the whole point)
- Cannot require a central server or coordination service (plugin is local-only)
- Must work with standard git workflows (GitHub Flow, trunk-based, etc.)
- Quality gate and hygiene checks must still function

---

*This document feeds into milestone v1.2 requirements definition.*
