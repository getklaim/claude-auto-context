# Suggestion: Skill Detection Thresholds Are Unnamed Magic Numbers

## Status
pending

## Category
structure

## Problem

A user asked "how often does skill creation run?" — a basic operational question. Answering it required 3 separate grep passes across 7+ files and returned 0 results for any named threshold constant (`SESSION_THRESHOLD`, `MIN_SESSIONS`, `SKILL_CREATE_INTERVAL`, `minSessions`). The actual answer — every 3rd batch — is buried as an unnamed literal at `worker.mjs` line 526:

```js
if (batchCount % 3 === 0) {
```

This single literal `3` encodes the entire skill-agent invocation frequency policy. It has no named constant, no comment explaining why 3 was chosen, and no connection to the batch interval (`POLL_INTERVAL_MS = 30_000`), so a reader cannot derive wall-clock frequency without cross-referencing both files.

Beyond the invocation frequency, `skill-detector.mjs` contains 6 additional unnamed classification thresholds embedded in conditional expressions:

| Line | Literal | Role |
|------|---------|------|
| 101 | `taskCount >= 2` | task-delegation session filter |
| 149 | `bashErrors.length >= 5` | debugging-spiral detection |
| 290 | `jaccard > 0.5` | prompt similarity grouping threshold |
| 290 | `lcsLen >= 5` | tool-sequence similarity grouping threshold |
| 442 | `stepCount < 5` | minimum steps to qualify as a skill |
| 457 | `stepCount < 8` | linear-chain cutoff for hooks-agent reclassification |

None of these are exported, documented, or searchable by name. All classification behavior is opaque to both users and automated agents.

## Proposal

Declare all threshold literals as named constants at the top of each file, grouped under a comment block:

In `worker.mjs` (near the other `const` declarations at lines 25-29):
```js
const SKILL_AGENT_BATCH_INTERVAL = 3;  // run skill-agent every Nth batch (~90s at 30s poll)
```
Replace `batchCount % 3 === 0` with `batchCount % SKILL_AGENT_BATCH_INTERVAL === 0`.

In `skill-detector.mjs` (new constant block after the tool classification sets):
```js
// --- Classification Thresholds ---
const MIN_TASK_TOOLS_FOR_DELEGATION  = 2;   // sessions with >= N task-tool calls are excluded
const MIN_BASH_ERRORS_FOR_SPIRAL     = 5;   // sessions with >= N bash errors are debugging spirals
const PROMPT_SIMILARITY_THRESHOLD    = 0.5; // Jaccard threshold for grouping sessions by prompt
const SEQUENCE_SIMILARITY_MIN_LCS    = 5;   // minimum LCS length for grouping sessions by tool seq
const MIN_STEPS_FOR_SKILL            = 5;   // patterns with < N steps are rules/hooks, not skills
const MAX_STEPS_FOR_LINEAR_CHAIN     = 8;   // linear patterns with < N steps go to hooks-agent
```

No logic changes — this is a pure rename/extract. All 6 constants in `skill-detector.mjs` and the 1 constant in `worker.mjs` become searchable by name and self-documenting.

## Files to Change

- `.claude-auto-context/worker.mjs` — line 526: extract `3` to `SKILL_AGENT_BATCH_INTERVAL`
- `.claude-auto-context/skill-detector.mjs` — lines 101, 149, 290 (x2), 442, 457: extract 6 literals to named constants

## Evidence Sessions

- session fb9f05d6 (2026-03-27): User asked "how often does skill creation run?" — grep for `SESSION_THRESHOLD|MIN_SESSIONS|SKILL_CREATE_INTERVAL|skill.*threshold|skill.*frequency` returned 0 results across entire codebase; 3 separate grep passes required to locate answer; answer found at `worker.mjs:526` as unnamed literal `3`

## Metrics

- Named threshold constants: 0 of 7 (0% named)
- Grep passes required to answer basic operational question: 3
- Files searched before finding answer: 7
- Thresholds findable by semantic name search: 0/7 (grep for any plausible constant name returns 0 results)
- Estimated impact: any agent or user debugging skill detection behavior must read and parse conditional logic in 2 files rather than scanning a constant block
