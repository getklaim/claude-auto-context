# Suggestion: Missing .claude/settings.json Causes Repeated Write Permission Denials

## Status
pending

## Created
2026-03-27T13:00:01Z

## Category
hygiene-permissions

## Problem

`.claude/settings.json` does not exist in the claude-auto-context project. Confirmed: Glob for `.claude/settings.json` returns no results.

Claude Code uses `settings.json` to grant or deny tool permissions at the project level. Without it, write operations to `.claude/rules/local/` are subject to the default deny policy, requiring interactive user approval on every invocation. The cross-cycle observation data records 4 sessions blocked on this:

> "rules-local-permission-fix-via-settings (4 sessions blocked): No `.claude/settings.json` exists in the claude-auto-context project. This absence is the root cause of repeated write permission denials for `.claude/rules/local/`."

The `extract-rules` skill and `context-hygiene` skill both write to `.claude/rules/local/` as their primary output. Every automated invocation of either skill will stall at the permission prompt unless the user is present to approve — defeating the purpose of background automation.

The fix is a single file creation with a known, specific schema.

## Proposal

Create `/Users/dgsw67/claude-auto-context/.claude/settings.json` with permissions allowing writes to `.claude/rules/local/`:

```json
{
  "permissions": {
    "allow": [
      "Write(.claude/rules/local/**)"
    ]
  }
}
```

This is the minimal grant: it permits writes only to the auto-generated local rules directory and leaves all other write targets at their default policy. No other permissions need to be elevated.

If broader automation is desired (e.g., suggestion file writes), extend the allow list:
```json
{
  "permissions": {
    "allow": [
      "Write(.claude/rules/local/**)",
      "Write(.claude-auto-context/suggestions/**)"
    ]
  }
}
```

The file should be committed to the repository so it applies consistently across all developer machines and CI environments.

## Evidence Sessions

- cross-cycle observation (4 sessions, dates unrecorded): Repeated write permission denials for `.claude/rules/local/` confirmed as the root cause; identified as a structural gap in the project. Exact session IDs not captured in the observation record, but 4 independent occurrences are noted.
- session_615e4373 (2026-03-27): Structural analysis confirmed `.claude/settings.json` absent (Glob returns 0 results). The missing file was flagged as a structural gap requiring a suggestion.

## Metrics

- Sessions blocked: 4 (all failed on the same root cause)
- Files needed to fix: 1 (`.claude/settings.json`, ~5 lines)
- Skills affected: 2 of 5 (`extract-rules`, `context-hygiene` both write to `.claude/rules/local/`)
- Automated agent runs unblocked by fix: all future invocations of extract-rules and context-hygiene skills
- Estimated impact: Without this file, every background automated run of extract-rules or context-hygiene stalls indefinitely at an interactive permission prompt; with it, both skills run unattended as designed
