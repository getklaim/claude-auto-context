# Suggestion: No Sync Mechanism Between .claude/skills/ and skills/ Directories

## Status
pending

## Created
2026-03-27T13:00:00Z

## Category
organization

## Problem

The repository maintains two parallel directories with identical SKILL.md files and no automated mechanism to keep them in sync:

- `.claude/skills/` — active runtime location Claude Code uses
- `skills/` — documented distribution source users copy from

Git status for session 615e4373 shows simultaneous modifications across both trees for 3 skills:

```
M .claude/skills/context-hygiene/SKILL.md
M .claude/skills/create-suggestion/SKILL.md
M .claude/skills/extract-rules/SKILL.md
 M skills/context-hygiene/SKILL.md
 M skills/create-suggestion/SKILL.md
 M skills/extract-rules/SKILL.md
```

Manual inspection confirms `.claude/skills/create-suggestion/SKILL.md` and `skills/create-suggestion/SKILL.md` are byte-for-byte identical (69 lines, identical content). Same for `context-hygiene/SKILL.md` (31 lines identical) and `extract-rules/SKILL.md` (79 lines identical).

CLAUDE.md documents this as a known manual step: "skills in `.claude/skills/` must be manually copied to the target project's `.claude/skills/` directory" and "there is no install script that auto-copies skills." However, this documents user-facing distribution — it does not address the in-repo duplication where both directories must stay synchronized during development.

Consequences of the current state:
1. Every skill edit requires two writes — one in each directory tree.
2. Drift is silent: no CI check, no pre-commit hook, no checksum comparison.
3. Drift has already occurred: `cac-create-skill` exists in `.claude/skills/` but not in `skills/` (tracked in suggestion `20260326-000000-skills-dir-inconsistency.md`).
4. The session 615e4373 plan to update `create-suggestion/SKILL.md` targets 6 file paths across both trees precisely because of this duplication.

## Proposal

Choose one of three resolution paths:

**Option A — Symlink (lowest overhead):**
Replace `skills/` with symlinks pointing into `.claude/skills/`:
```sh
rm -rf skills/
ln -s .claude/skills skills
```
Eliminates duplication entirely. Risk: tools that resolve symlinks may show `.claude/skills/` paths in output.

**Option B — Build/copy step (explicit source of truth):**
Designate `.claude/skills/` as the authoritative source. Add a `scripts/sync-skills.sh` script:
```sh
rsync -av --delete .claude/skills/ skills/
```
Wire it as a git pre-commit hook or npm `prepare` script. Requires contributors to run it but makes the relationship explicit and automatable in CI.

**Option C — CLAUDE.md documentation (minimal change):**
Add an explicit entry to CLAUDE.md under `## Skills Distribution`:
```
## Skills Distribution
- `.claude/skills/` is the authoritative source; `skills/` is a distribution mirror
- When editing any SKILL.md in `.claude/skills/`, copy the same change to `skills/` immediately
- Both directories must stay identical; drift between them is a bug
```
This makes the requirement explicit without restructuring, but still relies on manual discipline.

Options A or B are preferred; Option C is the minimum acceptable change if structural changes are blocked.

## Evidence Sessions

- session_615e4373 (2026-03-27): Git status showed 6 simultaneous staged/unstaged modifications split across both skill directory trees for create-suggestion, context-hygiene, and extract-rules. Agent plan for adding `## Created` timestamp targets both `.claude/skills/create-suggestion/SKILL.md` AND `skills/create-suggestion/SKILL.md` as separate write targets — direct evidence that every single-logical-change requires two physical writes.
- session (2026-03-26): `cac-create-skill` found absent from `skills/` while present in `.claude/skills/` — first confirmed instance of drift caused by the missing sync mechanism.

## Metrics

- Duplicated files: 4 of 4 shared skills (100% of skills in `skills/` have a duplicate in `.claude/skills/`)
- Write amplification: 2x — every skill edit requires identical change in two locations
- Drift rate: 1 of 5 skills (20%) already out of sync after an unspecified number of development sessions
- Automated sync guards in place: 0 (no pre-commit hook, no CI check, no checksum assertion)
- Sessions affected: 2/2 observed sessions both encountered the dual-write requirement
- Estimated impact: Each SKILL.md change has a 50% chance of being applied to only one tree if the developer forgets the second write; drift will compound over time without a mechanical guard
