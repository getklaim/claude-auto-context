---
globs:
  - "test/e2e-project/.claude/skills/create-suggestion/SKILL.md"
---

# e2e Fixture: create-suggestion SKILL.md Uses Old Filename Format

The file `test/e2e-project/.claude/skills/create-suggestion/SKILL.md` is a test fixture that still uses the **old** suggestion filename format `{NNN}-{slug}.md`. The production SKILL.md at `.claude/skills/create-suggestion/SKILL.md` uses the **new** format `YYYYMMDD-HHMMSS-{slug}.md`.

**Do NOT copy the e2e fixture format into production code.** The e2e fixture is intentionally stale — it is used to test behavior with the old format (sequence numbers like 2027, 2028 are sequence numbers, not years).

When updating the production create-suggestion SKILL.md filename format, the e2e fixture must be updated separately and deliberately.

Evidence: session 2787571a confirmed the divergence — user saw `2027-hygiene-bloat.md`, `2028-hygiene-contradiction.md` and asked why the naming was year-like; root cause was the e2e fixture using the old `{NNN}` sequential format with ~2026 pre-existing files.
