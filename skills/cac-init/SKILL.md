---
name: cac-init
description: "Generate a codebase map (MAP.md) by exploring project files. USE WHEN user types /cac-init or wants to create a codebase overview for Auto Context."
---

# Codebase Map Generator

Explore the project codebase and generate `.claude-auto-context/MAP.md` — a file-per-line map grouped by directory.

## Arguments

- No argument: generate MAP.md from scratch (warn if MAP.md already exists, show its `Generated:` timestamp, ask to confirm overwrite)
- `refresh`: overwrite existing MAP.md without confirmation

## MAP.md Output Format

```markdown
# Codebase Map
Generated: {ISO 8601 timestamp}
Files: {N} | Dirs: {N}

## src/
src/index.ts — app entry point, Express server setup
src/config.ts — env loading, DB connection config

## Config
package.json — scripts: dev, build, test, lint
tsconfig.json — strict mode, paths alias
.env.example — DB_URL, STRIPE_KEY
```

Match project language for descriptions (Korean project = Korean descriptions).

## Procedure

### Step 1: Check existing MAP.md

1. Check if `.claude-auto-context/MAP.md` exists
2. If exists AND no `refresh` argument: read first lines for `Generated:` timestamp, show it, ask user to confirm overwrite
3. If exists AND `refresh` argument: proceed to Step 2

### Step 2: Discover project files

1. Glob `**/*` from project root
2. Exclude these patterns entirely (hard excludes):
   - `node_modules/**`, `dist/**`, `.next/**`, `build/**`, `.git/**`, `.cache/**`, `coverage/**`
   - `*.lock` (bun.lock, package-lock.json, yarn.lock)
   - `__pycache__/**`, `.venv/**`, `vendor/**`
   - `*.min.js`, `*.map`, `*.d.ts`
   - Binary files: `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.ico`, `*.woff`, `*.woff2`, `*.ttf`, `*.eot`, `*.mp3`, `*.mp4`, `*.zip`, `*.tar.gz`
3. Sort remaining files by directory path

### Step 3: Be selective for large codebases

1. If total file count > 100: describe only significant files, skip trivial/boilerplate
2. For directories with 5+ similar files (e.g., migrations, fixtures, snapshots): group as single entry — `src/db/migrations/ — DB migrations (14 files)`
3. Skip test fixture files, snapshot files, auto-generated files
4. Target: every entry line ≤ 100 characters including file path

### Step 4: Generate file descriptions

1. For each selected file: Read first 20-30 lines to understand purpose
2. Write one-line description (path + dash + description): `src/api/auth.ts — auth middleware (JWT verify, refreshSession)`
3. Group entries under `## {directory}/` headers
4. Quality rules:
   - GOOD: `src/api/auth.ts — auth middleware (JWT verify, refreshSession)`
   - BAD (too generic): `src/api/auth.ts — TypeScript file`
   - BAD (too long): `src/api/auth.ts — middleware that authenticates users using JWT tokens and handles refresh sessions and...`

### Step 5: Extract config information

1. `package.json`: Read → extract `scripts` object → format as `package.json — scripts: dev, build, test, lint`
   - If many scripts: include only the most important (dev, build, test, start, deploy)
2. `.env.example` (or `.env` if .example missing): extract variable NAMES only, never values → `.env.example — DB_URL, STRIPE_KEY, SENDGRID_KEY`
3. `tsconfig.json`: note `strict`, `paths`, `target` if present
4. Other config files (`eslint.config.*`, `docker-compose.yml`, `*.config.ts/js`): note tool name and key settings
5. Place all config entries under `## Config` section at the end of MAP.md

### Step 6: Write MAP.md

1. Ensure `.claude-auto-context/` directory exists (create if needed via `mkdir -p`)
2. Write to `.claude-auto-context/MAP.md` using the output format above
3. Include accurate `Files: {N} | Dirs: {N}` counts in header

### Step 7: Report

1. Output: number of files mapped, number of directories, MAP.md file size
2. Format: "MAP.md generated: {N} files, {M} dirs, {size} bytes → `.claude-auto-context/MAP.md`"

## Edge Cases

- Empty project (no source files): write MAP.md with header + "No source files found."
- Very large project (500+ files): be highly selective — describe directories not individual files where appropriate
- Monorepo: treat each package/app as a top-level directory group
- No package.json: skip Config section gracefully
- `.env.example` missing but `.env` exists: use `.env` variable names only (never values)

## Anti-Patterns

- Do NOT read every file fully — skim first 20-30 lines only
- Do NOT include file content in MAP.md — descriptions only
- Do NOT list node_modules, dist, build, or .git entries
- Do NOT exceed 100 characters per entry line
- Do NOT include secrets or env values — variable names only
- Do NOT create MAP.md larger than 4KB (be more selective if approaching limit)
