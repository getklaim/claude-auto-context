# Skill Prompt: implementation-naming-trace

## What
This skill automates a **read-only code tracing** workflow to explain why output filenames look the way they do.

Specifically:
1. Grep for the filename pattern or string that the user finds surprising (Grep)
2. Grep for the code that generates those filenames (Grep)
3. Run a Bash command to inspect actual files on disk (e.g., `ls`, `cat`)
4. Grep again to confirm the root cause in the implementation (Grep)

The pattern was triggered when the user saw hygiene output files named `2027-...`, `2028-...` and asked why — expecting year-prefixes but getting sequence numbers that looked like years.

Typical tool sequence:
`Grep → Grep → Bash → Grep`

## When
Trigger this skill when the user:
- Shows a filename or file listing that looks unexpected and asks "왜 이런 이름이야?" / "why does it look like this?"
- Asks to trace where a filename format originates in the codebase
- Says something like "구현체 기반으로 설명해줘", "이 naming이 어디서 오는거야", "왜 이런 prefix가 붙어?"

Example prompts that should trigger this skill:
- "hygiene 파일이 2027, 2028 이렇게 보이는데 왜 이런 이름이야? 구현체 보여줘"
- "이 output 파일 이름 규칙이 어디서 정의되는지 찾아줘"
- "파일 prefix가 왜 이렇게 생겼는지 코드 기반으로 알려줘"

## Why
Without this skill, the user must manually grep through multiple code paths to find where a filename is assembled. The value is:
- Fast diagnosis of confusing output filenames before deciding to fix them
- Serves as a prerequisite step before triggering `cross-file-naming-convention-fix`
- Saves repeated grep + ls + grep cycles the user would otherwise ask for one by one

Score: 7 (4 tool steps; low step count but high explanatory value).

## When NOT to Use
Do NOT trigger this skill for:
- Sessions where the user also wants the naming fixed (use `cross-file-naming-convention-fix` instead, which includes this investigation as a sub-phase)
- Tracing logic other than filename/path generation (e.g., algorithmic behavior, data flow)
- Situations where the filename source is already known and the user just wants it changed
- Sessions requiring file modifications — this skill is read-only
