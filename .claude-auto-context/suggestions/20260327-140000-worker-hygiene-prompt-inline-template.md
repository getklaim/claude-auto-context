# Suggestion: Hygiene Audit Prompt Embedded as Inline JS Template in worker.mjs

## Status
pending

## Created
2026-03-27T14:00:00Z

## Category
structure

## Problem

`worker.mjs` contains the entire hygiene audit checklist (checks H-01 through H-06), output format specification, and behavior rules as a 107-line inline markdown template string inside the `buildHygienePrompt()` function (lines 275-381). The function is 136 lines total; approximately 107 of those lines (~79%) are prose content with no JavaScript logic, embedded inside a JS template literal.

Breakdown of `buildHygienePrompt()` (lines 246-381):
- Lines 246-274: JavaScript setup logic (reading rules files, building content strings) — 29 lines of code
- Lines 275-381: Inline markdown template string returned as the agent prompt — 107 lines of prose

The 107-line inline section includes:
- `## Scope Restriction` section (6 lines)
- H-01 through H-06 checklist items with descriptions (30 lines)
- `## Output Format` with a full markdown template block (29 lines)
- `## Rules` section (5 lines)

This co-location creates two distinct maintenance problems:

**1. Content changes require JS file edits.**
In session 615e4373, adding a single `## Created` field to the suggestion format required editing `worker.mjs` (along with skill files and `skill-cap.mjs`). The change was to prose content in the checklist's output format block — not to any JavaScript logic. This means prose authors must edit a JS source file and be aware of template literal escaping rules (backtick, `\$`, `\\`).

**2. The template is not reachable by skill-loading infrastructure.**
The `context-hygiene` skill in `.claude/skills/context-hygiene/SKILL.md` and `.claude/skills/create-suggestion/SKILL.md` are loaded by Claude Code as skills and referenced in agent `skills:` arrays. The hygiene audit prompt in `buildHygienePrompt()` performs the same job as a skill but is not a skill — it is JS string concatenation. It cannot benefit from the `skills:` loading path and cannot be updated by the same workflow used to update the other skills.

**3. Checklist drift between skill and inline template.**
The context-hygiene SKILL.md and the inline `buildHygienePrompt()` template both define the hygiene agent's behavior, but they are separate artifacts with no enforced relationship. A change to one does not propagate to the other.

## Proposal

Extract the inline markdown template from `buildHygienePrompt()` into a standalone file, either:

**Option A — External prompt file (minimal change)**
Create `.claude-auto-context/prompts/hygiene-prompt.md` containing the static markdown sections (Scope Restriction, checklist, Output Format, Rules). Update `buildHygienePrompt()` to read this file and interpolate only the dynamic sections (committed rules content, local rules content, CLAUDE.md content):

```js
function buildHygienePrompt(root) {
  // ... existing file-reading logic for rules content ...
  const template = readFileSync(resolve(projectRoot, '.claude-auto-context', 'prompts', 'hygiene-prompt.md'), 'utf8');
  return template
    .replace('{{COMMITTED_RULES}}', committedRulesContent || '(none)')
    .replace('{{LOCAL_RULES}}', localRulesContent || '(none)')
    .replace('{{CLAUDE_MD}}', claudeMd || '(empty)');
}
```

Result: prose changes to the checklist require editing `.claude-auto-context/prompts/hygiene-prompt.md` (a markdown file) rather than `worker.mjs` (a JS file). No template literal escaping required.

**Option B — Promote to skill file (preferred if context-hygiene skill is the authoritative definition)**
Move the prompt content into `.claude/skills/context-hygiene/SKILL.md` as the canonical agent instruction. Update `worker.mjs` to load and use the skill file as the hygiene agent prompt:

```js
const hygieneSkill = readFileSync(resolve(projectRoot, '.claude', 'skills', 'context-hygiene', 'SKILL.md'), 'utf8');
```

This eliminates the duplicate definition problem (Option A still leaves two places defining hygiene behavior). Requires that the skill file become the single source of truth for both Claude Code (skill loading) and the worker (direct invocation).

Option A is the lower-risk change; Option B eliminates the duplication between the skill file and the inline template.

## Evidence Sessions

- session_615e4373 (2026-03-27): Adding `## Created` field to suggestion output format required editing `worker.mjs` lines 344-373 (inline template) alongside `.claude/skills/create-suggestion/SKILL.md`, `skills/create-suggestion/SKILL.md`, `.claude/skills/context-hygiene/SKILL.md`, `skills/context-hygiene/SKILL.md`, and `skill-cap.mjs`. The worker.mjs edit was to prose content inside a JS template literal, not to any logic.

## Metrics

- Inline template size: 107 lines of prose inside a 136-line JS function (79% prose, 21% logic)
- JS logic that requires the inline template to remain in the JS file: 0 lines (the dynamic interpolation points are 3 variable references that could be replaced by simple string substitution)
- Files requiring edits for a single suggestion-format change: 6 (of which 1 is worker.mjs for prose-only changes)
- Separate locations defining hygiene agent behavior: 2 (context-hygiene/SKILL.md + inline template in worker.mjs)
- Template literal escaping constraints introduced by inline embedding: backtick and `\${}` must be escaped throughout the 107-line prose block
- Estimated impact: extracting the template eliminates the need to edit worker.mjs for any future prompt content changes; reduces per-format-change file count from 6 to 5; removes escaping constraints from the prose
