# Suggestion: Suggestion File Format Has No Single Source of Truth

## Status
pending

## Created
2026-03-27T14:00:00Z

## Category
pattern

## Problem
The suggestion file format (section order and required fields) is defined independently as inline string literals in 3 separate code locations. There is no single canonical definition — each location owns its own copy of the template and must be manually updated when the format changes.

| Location | Form | Lines |
|---|---|---|
| `.claude/skills/create-suggestion/SKILL.md` | LLM-facing markdown template in "Output Format" section | ~30 lines |
| `.claude-auto-context/worker.mjs` | Inline template string inside `buildHygienePrompt()` (~line 346-373) | ~28 lines |
| `.claude-auto-context/skill-cap.mjs` | Hardcoded `content` string literal in `checkSkillCap()` (line 42) | 1 concatenated line |

Session 615e4373 added the `## Created` field to the suggestion format. The plan required 6 file writes: 4 of them were format template updates across these 3 locations (plus the dual-copy of `create-suggestion/SKILL.md` in `skills/`). The remaining 2 were `context-hygiene/SKILL.md` copies that reference the format. Zero of the 6 writes were logically distinct content — all were mechanical propagation of the same one-field addition.

The `skill-cap.mjs` template is the highest-risk location: it is a single minified string on line 42. Adding a new section means editing inside a concatenated string without IDE template support. It previously lacked `## Created` until session 615e4373 added it, confirming that inline templates are easy to miss during format changes.

## Proposal

Extract the canonical suggestion file format into a single shared location that all three code paths read from. Two viable approaches:

**Option A — Shared template module (preferred):**
Create `.claude-auto-context/suggestion-template.mjs` exporting a `renderSuggestionTemplate(fields)` function. `skill-cap.mjs` and any future programmatic emitters import and call this function. `worker.mjs` hygiene prompt includes the format by reading this module's exported `TEMPLATE_MARKDOWN` constant and interpolating it into the prompt string. `create-suggestion/SKILL.md` references the canonical section list by name (not by duplicating the full template).

**Option B — Template file (lower-code):**
Create `.claude-auto-context/suggestion-format.md` as the canonical section-order definition. Programmatic emitters (`skill-cap.mjs`, `worker.mjs`) read this file at runtime and use it as the template. The skill file references it explicitly. A CI assertion verifies the file exists.

Either option reduces any future format change from N file edits to 1 edit in the canonical location.

## Evidence Sessions

- session_615e4373 (2026-03-27): Plan "Add `## Created` timestamp to suggestion files" listed 6 file changes. Of these, 4 were direct template edits across the 3 independent template locations (`.claude/skills/create-suggestion/SKILL.md`, `skills/create-suggestion/SKILL.md`, `worker.mjs`, `skill-cap.mjs`). The plan explicitly names all 4 as separate write targets for a single format field addition.
- session_615e4373 (2026-03-27): `skill-cap.mjs` line 42 was found missing `## Created` — confirmed the inline template had drifted from the format convention before this session's fix.

## Metrics

- Independent template copies: 3 (create-suggestion SKILL.md, worker.mjs hygiene prompt, skill-cap.mjs content string)
- File writes per format field addition: 4 minimum (3 templates + 1 SKILL.md dual-dir copy); 6 total in session 615e4373
- Drift observed before session fix: 1 of 3 templates (skill-cap.mjs) was missing `## Created` — 33% template drift rate per format change cycle
- Sessions affected: 1/1 (direct causal evidence from plan file)
- Estimated impact: centralizing the template reduces any future format field addition from 4 file writes to 1; eliminates drift risk between template copies
