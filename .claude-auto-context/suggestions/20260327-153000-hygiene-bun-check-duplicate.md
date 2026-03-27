# Suggestion: bun-check-after-mjs-edit.md duplicates CLAUDE.md for worker.mjs

## Status
pending

## Created
2026-03-27T15:30:00Z

## Category
hygiene-duplicate

## Problem

Two separate rules give identical instructions for `worker.mjs`:

**`CLAUDE.md`** (global scope):
> `worker.mjs` uses Bun-specific built-ins (`bun:sqlite`); use `bun --check worker.mjs` to verify syntax — NOT `node --check` or `esbuild`

**`.claude/rules/local/bun-check-after-mjs-edit.md`** (globs: `.claude-auto-context/*.mjs`):
> After editing any `.mjs` file in `.claude-auto-context/`, run `bun --check` before declaring the task complete. Do NOT use `node --check` or `esbuild`

For `worker.mjs`, both rules fire and prescribe exactly the same action. The local rule is strictly a superset (covers all `.mjs` files vs. just `worker.mjs`), but the overlap for `worker.mjs` is 100%.

## Proposal

Remove the `worker.mjs`-specific sentence from `CLAUDE.md` (noting CLAUDE.md is READ-ONLY — file this for maintainer action). The local rule `bun-check-after-mjs-edit.md` fully covers `worker.mjs` via its `.claude-auto-context/*.mjs` glob, making the CLAUDE.md sentence redundant.

CLAUDE.md line to remove:
> `` `worker.mjs` uses Bun-specific built-ins (`bun:sqlite`); use `bun --check worker.mjs` to verify syntax — NOT `node --check` or `esbuild` ``

The surrounding context in CLAUDE.md (STALE_THRESHOLD_S, selfHeal startup, SIGKILL behaviour) should be retained; only the syntax-check sentence is duplicated.

## Evidence
- Source: hygiene-agent automated check
- Files analyzed: `CLAUDE.md`, `.claude/rules/local/bun-check-after-mjs-edit.md`
- Check: H-01

## Metrics
- Overlapping scope: `worker.mjs` (100% duplicate instruction)
- Tokens saved by removing CLAUDE.md sentence: ~25 tokens
