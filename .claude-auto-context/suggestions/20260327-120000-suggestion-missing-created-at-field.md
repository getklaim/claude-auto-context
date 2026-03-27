# Suggestion: Suggestion Files Lack "Created At" Field in Body

## Status
pending

## Category
pattern

## Problem
Suggestion files store their creation timestamp exclusively in the filename (`YYYYMMDD-HHMMSS-{slug}.md`). The file body contains no `## Created At` section. This means the creation date is lost if a file is renamed, moved, or opened from a file picker that does not show the filename.

4 independent code paths all emit suggestion files without a body-level timestamp:

1. `.claude/skills/create-suggestion/SKILL.md` — output template has `## Status`, `## Category`, `## Problem`, `## Proposal`, `## Evidence Sessions`, `## Metrics`; no `## Created At`.
2. `skills/create-suggestion/SKILL.md` — identical template, same omission.
3. `.claude-auto-context/skill-cap.mjs` line 42 — hardcoded template string written via `writeFileSync`; sections are `## Status`, `## Category`, `## Problem`, `## Proposal`, `## Evidence Sessions`, `## Metrics`; no `## Created At`.
4. `worker.mjs` hygiene agent prompt (~line 305) — instructs the LLM to use timestamp in filename only; no instruction to write `## Created At` in body.

The `cac-apply` skill adds `## Applied At` when applying a suggestion, proving the pattern of body-level timestamps already exists for one lifecycle event — but the creation event is unrecorded in the body.

## Proposal

Add `## Created At\n{YYYYMMDD-HHMMSS}` as the second section (immediately after `## Status`) in all 4 locations:

1. `.claude/skills/create-suggestion/SKILL.md` — update the output format template block.
2. `skills/create-suggestion/SKILL.md` — same update (kept in sync with `.claude/skills/`).
3. `.claude-auto-context/skill-cap.mjs` — insert `## Created At\n${ts}\n\n` after the `## Status\npending\n\n` segment in the hardcoded `content` string (line 42).
4. `worker.mjs` hygiene agent prompt — add an instruction to write `## Created At\n{timestamp}` (same timestamp used for the filename) as the second section of the generated file body.

Uniform section order after change:
```
## Status
## Created At
## Category
## Problem
## Proposal
## Evidence Sessions
## Metrics
```

## Evidence Sessions
- session_615e4373 (2026-03-27): User reviewed suggestion files and explicitly stated "이거 suggestions 에 언제 생성된건지 명시해야겠다" — direct request to record creation time inside the file body.

## Metrics
- Templates affected: 4 of 4 (100% of suggestion-emitting code paths lack the field)
- Sessions affected: 1/1 (user-identified gap, explicit request)
- Estimated impact: Every suggestion file created after this fix will be self-describing; rename/move operations will not lose creation provenance
