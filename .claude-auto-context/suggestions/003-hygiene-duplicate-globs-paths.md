# Suggestion: Remove Duplicate `globs: vs paths:` Guidance from CLAUDE.md

## Status
pending

## Category
hygiene-duplicate

## Problem

The same rule — "use `globs:` not `paths:` in rules frontmatter" — is stated in two places that overlap in scope:

1. **`CLAUDE.md` (global scope)**, "## Rules Files" section:
   > Frontmatter key is `globs:` (NOT `paths:`) — using `paths:` silently applies the rule to ALL files, not matched paths

2. **`.claude/rules/rules-authoring.md`** (glob: `.claude/rules/**`), entire "## Frontmatter" section with YAML code blocks showing correct and wrong patterns.

Both files prescribe identical behavior for the same scenario. `rules-authoring.md` already provides the authoritative, detailed treatment. The CLAUDE.md line adds no information not covered by the scoped rule and burns a line of global context in every conversation.

## Proposal

Remove the "## Rules Files" section from `CLAUDE.md`. The scoped rule in `rules-authoring.md` loads automatically whenever `.claude/rules/**` files are in context — exactly when the guidance is needed. CLAUDE.md remains the right place for pitfalls that have no natural scoped home; this one does.

```diff
-## Rules Files
-- Frontmatter key is `globs:` (NOT `paths:`) — using `paths:` silently applies the rule to ALL files, not matched paths
-
 ## External Documentation
```

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: `CLAUDE.md`, `.claude/rules/rules-authoring.md`
- Check: H-01

## Metrics
- Duplication: 100% — identical guidance, one is a strict subset of the other
- Lines removed from global context: 2 (section header + bullet)
- Token savings: ~30 tokens per conversation (small but removes noise)
