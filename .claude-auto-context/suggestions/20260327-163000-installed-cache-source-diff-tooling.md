# Suggestion: No Tooling to Compare Installed Plugin Cache Against Source

## Status
pending

## Created
2026-03-27T16:30:00Z

## Category
organization

## Problem

When debugging behavior differences between the currently running worker and source edits, there is no tooling to compare the installed plugin cache against the source tree. In session 2787571a, an agent navigated directly to:

```
/Users/dgsw67/.claude/plugins/cache/claude-auto-context-marketplace/claude-auto-context/1.3.3/.claude-auto-context/worker.mjs
```

and read it at `offset 295, limit 20` specifically to compare the installed version's hygiene prompt section against the source version. This required:

1. Knowing the full cache path (non-obvious; nested under `~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/`)
2. Knowing the installed version number (1.3.3) to construct the path
3. Manually reading a targeted offset in the cached file to find the relevant section
4. Mentally diffing against the source file at `.claude-auto-context/worker.mjs`

The cache path is not documented anywhere in the project. The installed version (1.3.3) differs from what may be on the current branch (post-v1.3 commits exist: `b9130c8`, `17f3b58`, `6a73124`). There is no `scripts/diff-installed.sh` or similar utility, and CLAUDE.md contains no entry for the cache path pattern.

This matters operationally because the worker running in production (klaim project, as seen by the `worker.log` reads in session 2787571a) is running the installed v1.3.3 build, not the source branch. Any source edits will not affect the running worker until the plugin is re-installed. Without a diff tool, it is not obvious whether a bug is in source or in the installed cache.

## Proposal

Add a `scripts/diff-installed.sh` script that:

1. Resolves the installed cache path by reading the version from `package.json`
2. Runs `diff -r` between the source `.claude-auto-context/` directory and the installed cache
3. Prints the cache path so it can be used for manual inspection

Minimal implementation:

```sh
#!/usr/bin/env bash
set -e
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$PLUGIN_ROOT/package.json').version")
CACHE_DIR="$HOME/.claude/plugins/cache/claude-auto-context-marketplace/claude-auto-context/$VERSION/.claude-auto-context"

if [ ! -d "$CACHE_DIR" ]; then
  echo "Installed cache not found: $CACHE_DIR"
  echo "Is version $VERSION installed?"
  exit 1
fi

echo "Source:    $PLUGIN_ROOT/.claude-auto-context"
echo "Installed: $CACHE_DIR (v$VERSION)"
echo ""
diff -r --exclude="*.db" --exclude="*.log" --exclude="*.lock" \
  "$PLUGIN_ROOT/.claude-auto-context" "$CACHE_DIR" || true
```

Additionally, document the cache path pattern in CLAUDE.md or a dedicated rule file so agents can construct it without needing to search.

## Evidence Sessions

- session_2787571a (2026-03-27): Agent read `/Users/dgsw67/.claude/plugins/cache/claude-auto-context-marketplace/claude-auto-context/1.3.3/.claude-auto-context/worker.mjs` at offset 295, limit 20. This was a targeted comparison of the installed v1.3.3 hygiene prompt section against source. No script facilitated this — the agent navigated the cache path manually.

## Metrics

- Installed cache path components requiring manual knowledge: 4 (marketplace name, plugin name, version, subdirectory)
- Source files in cache vs. source: 8 `.mjs` files in the v1.3.3 cache; same directory exists in source
- Commits on master since v1.3.3: at least 5 (`b9130c8`, `17f3b58`, `6a73124`, `56a6d81`, `c2bc920`) — source and installed are already diverged
- Tooling gap: 0 scripts exist to compare installed vs. source (verified by Glob of `scripts/`)
- Sessions affected: 1 observed (2787571a); expected to recur whenever source edits are made and behavior in production (installed) is being debugged
- Estimated impact: a 10-line script eliminates the need to manually construct the cache path and do mental diffs; makes installed-vs-source drift immediately visible
