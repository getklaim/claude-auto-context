# Suggestion: Hygiene Agent Generates Hallucinated Timestamps in Suggestion Filenames

## Status
pending

## Created
2026-03-27T15:00:00Z

## Category
structure

## Problem

The `buildHygienePrompt()` function in `worker.mjs` (lines 303-306) instructs the LLM hygiene agent to self-generate the suggestion filename timestamp using "current UTC time":

```
When you find an issue, create a suggestion file at:
`.claude-auto-context/suggestions/YYYYMMDD-HHMMSS-hygiene-{slug}.md`

Use current UTC time for the timestamp (e.g. 20260323-143052).
```

LLMs do not have access to the actual current time at inference time. The example value `20260323-143052` embedded in the prompt is a static hint — the agent uses it as a reference and generates plausible-looking but incorrect timestamps. Session 2787571a confirmed that suggestion filenames appeared with years 2027 and 2028, which are future dates relative to the session date of 2026-03-27.

The worker already has the correct wall-clock time at prompt-construction time via `new Date()`. `buildHygienePrompt()` is called from `processHygiene()`, so the timestamp is available in the same function scope. Instead of delegating timestamp generation to the LLM, the worker should compute the real `YYYYMMDD-HHMMSS` prefix and inject it as a literal string into the prompt.

Scope of the bug:
- Only affects LLM-generated hygiene suggestions (the `buildHygienePrompt()` path)
- `skill-cap.mjs` generates timestamps programmatically (separate minor bug — see trailing-dot suggestion)
- All existing suggestions with years 2027/2028 in their filenames are misdated

## Proposal

In `buildHygienePrompt()`, compute the timestamp once before the template string and inject it as a concrete value. Change the prompt instruction from:

```
Use current UTC time for the timestamp (e.g. 20260323-143052).
```

To:

```
Use this exact timestamp prefix for any suggestion filenames you create: ${tsPrefix}
(e.g. ${tsPrefix}-hygiene-{slug}.md)
```

Where `tsPrefix` is computed as:
```js
const now = new Date();
const tsPrefix = now.toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{6})/, '$1-$2');
```

Note: `.slice(0, 19)` captures only `YYYY-MM-DDTHH:MM:SS`, avoiding the milliseconds `.` separator that causes the trailing-dot bug in `skill-cap.mjs`.

## Evidence Sessions

- session_2787571a (2026-03-27): User explicitly noted suggestion filenames showing 2027 and 2028 instead of the expected 2026. Investigation confirmed the agent reads `YYYYMMDD-HHMMSS` format doc in `worker.mjs` lines 304/306 but generates the value itself.
- session_2787571a (2026-03-27): Grep for `slug|filename.*suggestion|suggestion.*file` in `skill-cap.mjs` found only comments, confirming the user-visible filenames come from the LLM hygiene-agent path, not skill-cap.

## Metrics

- Sessions with confirmed wrong-year filenames: 1 (session 2787571a)
- Expected year range: 2026 only (current project date)
- Observed hallucinated years: 2027, 2028 (delta: +1 to +2 years)
- Affected code path: `buildHygienePrompt()` in `worker.mjs` (~line 303-306)
- Fix complexity: 3-line change to inject pre-computed timestamp string into prompt
- Estimated impact: eliminates 100% of timestamp-year hallucination in hygiene-agent suggestions
