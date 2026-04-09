---
name: cac-apply
description: Review and apply structural suggestions from Auto Context. USE WHEN user types /cac-apply or mentions applying suggestions.
---

# Apply Suggestion — Multi-Agent Refactoring Orchestrator

Orchestrates the cac-executor and cac-qa agents to reliably apply pending suggestions.
Reads suggestions, spawns executor for changes, spawns QA for independent verification,
iterates on failure (max 3 cycles), rolls back on persistent failure.

## Arguments

- No argument: list all pending items, ask user to select
- `{timestamp}`: apply specific item by timestamp ID (e.g., `/cac-apply 20260323-143052`)
- `all`: ask user "몇 개를 적용하시겠습니까?" then apply that many sequentially

---

## Phase 0: Safety Pre-checks

Before doing ANYTHING, verify the environment is safe for refactoring.

### 0a. Dirty tree guard

```bash
DIRTY=$(git status --porcelain 2>/dev/null | head -1)
```

If output is non-empty:
- Report: "uncommitted changes가 있습니다. 리팩토링 전에 커밋 또는 stash 하세요."
- Ask user: `A) git stash 후 진행` / `B) 현재 상태에서 진행 (위험)` / `C) 취소`
- If B: warn "테스트 실패 시 롤백이 다른 변경까지 되돌릴 수 있습니다" and proceed
- If C: stop

### 0b. Test runner detection

```bash
[ -f package.json ] && cat package.json | grep -q '"test"' && echo "HAS_TESTS" || echo "NO_TESTS"
```

Record `HAS_TESTS` or `NO_TESTS`. If tests exist, verify they pass BEFORE any changes:

```bash
npm test 2>&1 || bun test 2>&1
```

If tests already fail: report "기존 테스트가 이미 실패합니다." Ask user whether to proceed. Record failing test names as `PRE_EXISTING_FAILURES`.

### 0c. Checkpoint creation

```bash
CHECKPOINT_SHA=$(git rev-parse HEAD)
CHECKPOINT_BRANCH=$(git branch --show-current)
```

Report: "체크포인트: `{CHECKPOINT_SHA}`. 문제 발생 시 여기로 롤백합니다."

---

## Phase 1: Scan & Select

### 1a. Read all pending items

1. Read all `.md` files in BOTH directories:
   - `.claude-auto-context/suggestions/`
   - `.claude-auto-context/hygiene/`
2. For each file, check status by looking for a line matching exactly `^applied$`, `^rejected$`, or `^failed$` (bare word on its own line)
3. Files without any of these status words are pending

### 1b. Format validation gate

For each pending item, check if it has the structured format:

| Has `### Read first`? | Has `### Files to modify`? | Has `### Changes`? | Has `### Acceptance criteria`? | Action |
|---|---|---|---|---|
| YES | YES | YES | YES | **Structured** — proceed normally |
| Partial (missing some) | — | — | — | **Incomplete** — skip with message: "structured 포맷이 아닙니다. 스킵합니다." |

Only suggestions with ALL required subsections (`### Read first`, `### Files to modify`, `### Changes`, `### Acceptance criteria`) are eligible for execution. Legacy format suggestions are skipped.

### 1c. No argument — interactive selection

1. Display numbered list of eligible pending items:
   ```
   #  | Timestamp       | Title                              | Category              | Complexity
   1  | 20260404-053034 | Replace resolveElementType          | ai-unfriendly-fragile | MEDIUM (2 files)
   2  | 20260404-050020 | Embedded override scattered files   | ai-unfriendly-struct  | LOW (docs only)
   ```
2. Complexity: 1 file = LOW, 2-3 = MEDIUM, 4+ = HIGH
3. If 0 eligible: output "적용 가능한 structured suggestion이 없습니다." and stop
4. Ask user to select which item(s) to apply
5. Recommend starting with LOW complexity items

### 1d. `all` argument — count selection

1. Count eligible pending items
2. Ask: "총 {N}건 적용 가능. 몇 개를 적용하시겠습니까?"
3. Apply selected count sequentially, sorted by complexity ascending
4. Stop on first failure

---

## Phase 2: Understand Suggestion (READ ONLY)

For each selected item:

### 2a. Read suggestion file

Read the full `.md` file. Extract:
- `### Read first` — files to read before changes
- `### Files to modify` — target file list
- `### Changes` — ordered change list with function/section names
- `### Impact` — files that might break
- `### Acceptance criteria` — verification conditions

### 2b. Read first gate (MANDATORY)

Read EVERY file listed in `### Read first`. Report a one-line summary per file:
```
파일 확인 완료:
  - {file} ({lines}줄, {brief description})
```

If any file doesn't exist: warn "파일 없음: {path}" but continue.

### 2c. Impact assessment

Report:
1. **Scope**: "이 변경은 {N}개 파일을 수정하고 {M}개 파일을 생성합니다."
2. **Risk level**: LOW (docs only) / MEDIUM (refactoring) / HIGH (structural change)
3. **For HIGH risk**: Ask user: `A) 별도 브랜치 생성` / `B) 현재 브랜치에서 진행`

If A: `git checkout -b refactor/{suggestion-timestamp}`

---

## Phase 3: Execute (cac-executor Agent)

Spawn the cac-executor agent. Two methods (try in order):

**Method A — Plugin agent auto-discovery:**
- `subagent_type`: `claude-auto-context:cac-executor`

**Method B — Prompt-based fallback (if Method A fails or agent type not found):**
1. Read the agent prompt file: `Read agents/cac-executor.md`
2. Extract everything after the `---` frontmatter closing delimiter
3. Spawn a generic Agent with the extracted prompt as the `prompt` parameter

**Agent spawn prompt** (appended to agent prompt for both methods):
```
Apply the suggestion at {SUGGESTION_PATH}.

SUGGESTION_PATH: {absolute path to suggestion .md file}
CHECKPOINT_SHA: {checkpoint SHA from Phase 0}
TEST_RUNNER: {HAS_TESTS or NO_TESTS}
PRE_EXISTING_FAILURES: {comma-separated list or "none"}
```

**Agent configuration**:
- `description`: "Execute suggestion: {suggestion title}"

**Parse executor output**: Look for the `## Result` block at the end of the executor's response. Extract:
- `STATUS`: SUCCESS / PARTIAL / FAILED
- `COMMITS`: list of commit SHAs
- `FILES_CHANGED`: list of changed files
- `ISSUES`: list of issues encountered

**If executor STATUS is FAILED**: Skip to Phase 4.5 (iteration) or Phase 5 (finalize as failed).

---

## Phase 4: QA (cac-qa Agent)

Spawn the cac-qa agent. Two methods (try in order):

**Method A — Plugin agent auto-discovery:**
- `subagent_type`: `claude-auto-context:cac-qa`

**Method B — Prompt-based fallback (if Method A fails or agent type not found):**
1. Read the agent prompt file: `Read agents/cac-qa.md`
2. Extract everything after the `---` frontmatter closing delimiter
3. Spawn a generic Agent with the extracted prompt as the `prompt` parameter

**Agent spawn prompt** (appended to agent prompt for both methods):
```
Verify the refactoring applied by cac-executor for suggestion at {SUGGESTION_PATH}.

SUGGESTION_PATH: {absolute path to suggestion .md file}
EXECUTOR_COMMITS: {comma-separated commit SHAs from executor}
EXECUTOR_FILES: {comma-separated file list from executor}
PRE_EXISTING_FAILURES: {comma-separated list or "none"}
ITERATION: {cycle number, starting at 1}
```

**Agent configuration**:
- `subagent_type`: `claude-auto-context:cac-qa`
- `description`: "QA verify: {suggestion title}"

**Parse QA output**: Look for the `## QA Verdict` block. Extract:
- `STATUS`: PASS / FAIL
- `CONFIDENCE`: HIGH / MEDIUM / LOW
- Issues list (if FAIL)

**If QA STATUS is PASS**: Proceed to Phase 5 (finalize as applied).

**If QA STATUS is FAIL**: Proceed to Phase 4.5 (iteration loop).

---

## Phase 4.5: Iteration Loop

Maximum **3 full cycles** (executor + QA). Total agent spawns capped at 6.

Track: `ITERATION_COUNT = 1` (incremented each cycle)

### On QA FAIL:

1. Extract QA issues and fix suggestions from the `## Issues` section
2. Format feedback for executor:
   ```
   QA found {N} issues in iteration {ITERATION_COUNT}. Fix these:
   {QA issues with fix suggestions}

   Then re-apply remaining changes. Same contract — end with ## Result block.
   ```
3. Re-spawn cac-executor with the feedback appended to the original prompt
4. Parse executor result
5. Re-spawn cac-qa with updated EXECUTOR_COMMITS and incremented ITERATION
6. Parse QA result
7. If QA PASS: proceed to Phase 5
8. If QA FAIL and ITERATION_COUNT < 3: increment and repeat
9. If QA FAIL and ITERATION_COUNT >= 3: proceed to rollback

### On 3rd cycle failure:

```bash
git reset --hard {CHECKPOINT_SHA}
```

Report: "3회 시도 후에도 QA 통과 실패. 체크포인트로 롤백했습니다."
Mark suggestion as `failed`.

---

## Phase 4.6: Agent Spawn Failure Handling

If Agent tool spawn fails (model quota, crash, timeout, no output):

1. **1회 실패**: 재시도 (same prompt)
2. **2회 실패**: 기존 단일 에이전트 모드로 fallback
   - Report: "에이전트 spawn 실패. 단일 에이전트 모드로 전환합니다."
   - Execute changes inline (orchestrator가 직접 Phase 3-4 로직 수행)
   - No independent QA in fallback mode — rely on syntax checks and tests only

---

## Phase 5: Finalize

### 5a. Update suggestion status

Find the existing `## Status` line. Replace the ENTIRE status block:

1. Remove ALL existing lines matching: `## Status`, `applied`, `rejected`, `failed`, `pending`, `## Applied At`, `## Changes Made`
2. Append a single clean status block at the END:

```
## Status
{applied or failed}

## Applied At
{ISO 8601 timestamp}

## Changes Made
- {file}: {description of change}

## Commits
- {sha short}: {commit message}

## Verification
- Executor: {STATUS from executor}
- QA: {STATUS from QA} (iteration {N})
- Tests: {PASS/SKIP/FAIL}
- Confidence: {HIGH/MEDIUM/LOW}
```

### 5b. Before/after summary

```
=== Suggestion {Applied/Failed}: {title} ===

변경 전:
  - {file}: {original state}

변경 후:
  - {file}: {new state}

커밋: {N}개
QA iterations: {N}/3
최종 QA: {PASS/FAIL} (confidence: {level})
```

### 5c. Next item or finish

If applying multiple items:
1. Report completion of current item
2. Ask: "다음 suggestion으로 진행할까요? ({remaining}개 남음)"
3. If yes: return to Phase 2
4. If no: proceed to finish

### Finish report

```
=== cac-apply 완료 ===

적용: {N}개
스킵: {M}개 (legacy format)
실패: {K}개

커밋 목록:
  - {sha}: {message}

롤백 방법: git reset --hard {CHECKPOINT_SHA}
```

---

## Error Handling

| 상황 | 행동 |
|------|------|
| suggestion에 structured format 없음 | 스킵 (legacy format 거부) |
| Read first 파일 없음 | 경고 출력, 계속 진행 |
| Executor STATUS: FAILED | QA 스킵, iteration 또는 failed 처리 |
| QA STATUS: FAIL | Iteration loop (max 3 cycles) |
| 3회 iteration 후 QA FAIL | Rollback to checkpoint, failed 처리 |
| Agent spawn 실패 1회 | 재시도 |
| Agent spawn 실패 2회 | Inline fallback (단일 에이전트 모드) |
| Tests fail (new failure) | QA가 FAIL verdict, iteration loop |
| Tests fail (pre-existing) | 무시 — 리팩토링 원인 아님 |
| HIGH risk + dirty tree | 강력히 경고, 브랜치 생성 권장 |

## Anti-Patterns

- Do NOT apply suggestions without structured format (Read first, Files to modify, Changes, Impact, Acceptance criteria)
- Do NOT skip the Read first gate
- Do NOT self-verify — always use cac-qa agent for independent verification
- Do NOT batch all changes into one commit
- Do NOT exceed 3 iteration cycles — rollback and report failure
- Do NOT modify the suggestion's Problem/Evidence sections
- Do NOT leave the working tree dirty after completion

## Escalation

If the orchestrator itself encounters an unrecoverable error:

```
STATUS: BLOCKED
REASON: {1-2 sentences}
ATTEMPTED: {what was tried}
SUGGESTION: {what the user should do}
ROLLBACK: git reset --hard {CHECKPOINT_SHA}
```

Stop. Do not retry further.
