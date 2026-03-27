# Skill Prompt: cross-file-naming-convention-fix

## What
This skill automates a **multi-phase audit-and-fix** workflow for file naming convention inconsistencies across a project.

Specifically:
1. Inspect the current installed version and file state of the project (Bash ×12+)
2. Search for all places that produce or reference filenames (Grep)
3. Read implementation files to understand the current naming logic (Read)
4. Apply consistent naming prefix/format changes across all relevant files (Edit)

The pattern was triggered when the user noticed that two related output types (`hygiene` and `suggestions`) used different filename formats and asked Claude to unify them to a shared prefix convention (e.g., `suggestion-YYYYMMDD-...`, `hygiene-YYYYMMDD-...`).

Typical tool sequence:
`Bash×12+ → Grep×2 → Read×2 → Edit×4+`

## When
Trigger this skill when the user:
- Asks to unify or standardize filename patterns across multiple files/generators
- Points out that two or more output types look inconsistent (e.g., "why do these look different?") AND wants them fixed
- Says something like "naming 통일해줘", "파일명 규칙 맞춰줘", "prefix 통일", "convention fix"
- Mentions a specific format they want enforced (e.g., `TYPE-YYYYMMDD-HHMMSS-slug.md`)

Example prompts that should trigger this skill:
- "hygiene랑 suggestions 네이밍 통일해야 함. 앞에 suggestion-, hygiene- prefix 붙이는 식으로"
- "파일 생성 경로가 두 곳인데 네이밍이 달라. 통일해줘"
- "이 두 종류 output 파일 이름 규칙이 다른데 같게 맞춰줘"

## Why
Without this skill, the user must manually:
1. Find all code paths that generate output files
2. Trace each generator's filename template
3. Identify divergences
4. Edit each file carefully to match the target convention

This is error-prone across 4+ files spanning SKILL.md templates, worker code, and programmatic generators. The automation value is high because:
- Multiple files must be edited atomically (missing one leaves the convention broken)
- The investigation phase (Bash + Grep + Read) is repetitive and templated
- The convention must be documented (rules file update) after the fix

Score: 17 (24 tool steps across the session).

## When NOT to Use
Do NOT trigger this skill for:
- Single-file renames or path changes (use Edit directly)
- Pure investigation of "why does the naming look like X" without an intent to fix (use the `implementation-naming-trace` skill instead)
- Renaming variables inside code (not file naming conventions)
- Cases where only one generator exists (no cross-file coordination needed)
- Exploratory sessions that do not end in file modifications
