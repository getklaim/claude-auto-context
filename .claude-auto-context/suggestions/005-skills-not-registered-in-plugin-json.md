# Suggestion: Register Skills in plugin.json for Distribution

## Status
pending

## Category
structure

## Problem

The plugin ships 5 skills (`extract-rules`, `create-suggestion`, `update-claudemd`, `cac-apply`, `context-hygiene`) as SKILL.md files under `.claude/skills/*/`, but `plugin.json` contains no `skills` field — only `name`, `version`, `description`, `author`, `license`, and `keywords`.

When a user installs this plugin in a different project, the plugin manifest provides no information about which skills exist or where to find them. There is no machine-readable index linking the plugin identity to its skill files. A search for any skill name (`cac-apply`, `context-hygiene`, etc.) outside of the SKILL.md files themselves returns zero results — the names appear nowhere in any manifest, registry, or index file.

This means:
- The Claude Code plugin installer has no way to copy or register skills automatically
- Users must discover skills by manually browsing `.claude/skills/`
- Skills cannot be listed, enabled, or disabled at the plugin level
- The gap between `plugin.json` and the actual skill set is invisible until installation fails

## Proposal

Add a `skills` array to `.claude-plugin/plugin.json` that enumerates each skill by name and relative path:

```json
{
  "name": "claude-auto-context",
  "version": "1.2.0",
  "description": "Hook interceptor plugin that captures and logs all Claude Code lifecycle events",
  "author": { "name": "getklaim" },
  "license": "MIT",
  "keywords": ["hooks", "interceptor", "logging", "lifecycle"],
  "skills": [
    { "name": "extract-rules",    "path": ".claude/skills/extract-rules/SKILL.md" },
    { "name": "create-suggestion","path": ".claude/skills/create-suggestion/SKILL.md" },
    { "name": "update-claudemd",  "path": ".claude/skills/update-claudemd/SKILL.md" },
    { "name": "cac-apply",        "path": ".claude/skills/cac-apply/SKILL.md" },
    { "name": "context-hygiene",  "path": ".claude/skills/context-hygiene/SKILL.md" }
  ]
}
```

This makes the skill set machine-readable, enables any installer or onboarding script to copy the correct files, and makes the plugin manifest the single source of truth for what the plugin provides.

## Evidence Sessions

- session (2026-03-16): `plugin.json` read to check skills registration — file confirmed to contain only name/version/description/author/license/keywords with NO skills config
- session (2026-03-16): Glob `**/*cac-apply*` returned empty — skill name is not referenced in any non-SKILL.md file, confirming zero manifest registration
- session (2026-03-16): `marketplace.json` found via Glob but also contains no skills field — gap exists in both manifest files

## Metrics

- Skills registered in plugin.json: 0 / 5 (0%)
- Skills discoverable without browsing filesystem: 0
- Manifest files missing skills field: 2 (plugin.json, marketplace.json)
- Estimated impact: Every new installation of this plugin silently delivers no registered skills; users report skills "don't work after installation elsewhere"
