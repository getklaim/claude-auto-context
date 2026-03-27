# Suggestion: bun-check-after-mjs-edit.md duplicates CLAUDE.md Worker Runtime instruction

## Status
pending

## Created
2026-03-27T16:00:01Z

## Category
hygiene-duplicate

## Problem

Two separate sources give identical instructions for `.claude-auto-context/worker.mjs`:

**CLAUDE.md** (Worker Runtime section):
> `worker.mjs` uses Bun-specific built-ins (`bun:sqlite`); use `bun --check worker.mjs` to verify syntax — NOT `node --check` or `esbuild` (both fail to resolve `bun:` imports)

**`.claude/rules/local/bun-check-after-mjs-edit.md`** (glob: `.claude-auto-context/*.mjs`):
> After editing any `.mjs` file in `.claude-auto-context/`, run `bun --check` before declaring the task complete.
> **Do NOT use `node --check` or `esbuild`** — both fail to resolve `bun:` imports

Both say the same thing: use `bun --check`, not `node --check`/`esbuild`, after editing `.claude-auto-context/*.mjs`. The local rule is a superset (covers all `.mjs`, not just `worker.mjs`) but for `worker.mjs` the instructions are fully redundant.

## Proposal

Two options:

**Option A (preferred)**: Remove the `worker.mjs`-specific text from CLAUDE.md Worker Runtime section, keeping the glob-scoped local rule as the single source of truth. The local rule already covers `worker.mjs` via its glob.

**Option B**: Remove the local rule and expand the CLAUDE.md entry to mention all `.mjs` files (not just `worker.mjs`). Less preferred because CLAUDE.md has no glob scoping.

Option A keeps the more precise, glob-scoped rule and removes the redundant CLAUDE.md line.

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: `CLAUDE.md`, `.claude/rules/local/bun-check-after-mjs-edit.md`
- Overlap scope: `.claude-auto-context/worker.mjs` (appears in both)
- Check: H-01

## Metrics
- Duplicated instruction: "use bun --check, not node --check/esbuild"
- Duplication %: 100% for worker.mjs scope
- Token cost of duplicate: ~50 chars in CLAUDE.md that can be removed
