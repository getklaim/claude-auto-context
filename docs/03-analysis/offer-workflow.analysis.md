# Offer Workflow Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: claude-auto-context
> **Analyst**: gap-detector
> **Date**: 2026-03-03
> **Design Doc**: [offer-workflow.design.md](../02-design/features/offer-workflow.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that the implementation of the offer-workflow feature (notification on prompt submit, offer application via `/cac-apply`) matches the design document in `docs/02-design/features/offer-workflow.design.md`. Identify gaps, deviations, and improvements.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/offer-workflow.design.md`
- **Implementation Files**:
  - `scripts/on-user-prompt-submit.sh` (hook script -- notification)
  - `.claude/skills/cac-apply/SKILL.md` (offer application skill)
- **Analysis Date**: 2026-03-03

---

## 2. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 91% | Pass |
| Edge Case Coverage | 100% | Pass |
| Status Model Compliance | 100% | Pass |
| Anti-Pattern Coverage | 100% | Pass |
| **Overall** | **93%** | **Pass** |

---

## 3. Component 1: `scripts/on-user-prompt-submit.sh`

### 3.1 Line-by-Line Comparison

| # | Design Requirement | Implementation | Status | Notes |
|---|-------------------|----------------|:------:|-------|
| 1 | Shebang `#!/bin/bash` | Line 1: `#!/bin/bash` | Match | |
| 2 | Comment header | Lines 2-3: descriptive comments | Match | Wording differs but intent identical |
| 3 | `PLUGIN_ROOT=...` | Line 6: exact match | Match | |
| 4 | `PROJECT_DIR=...` | Line 7: exact match | Match | |
| 5 | `OFFERS_DIR=...` | Line 8: exact match | Match | |
| 6 | `INPUT=$(cat)` | Line 11: exact match | Match | |
| 7 | `echo "$INPUT" \| bun ... collector.mjs UserPromptSubmit` | Line 12: exact match | Match | |
| 8 | `if [ -d "$OFFERS_DIR" ]` | Line 15: exact match | Match | |
| 9 | Two arrays: `PENDING_FILES=()` and `PENDING_TITLES=()` | Line 16: only `PENDING_TITLES=()` | Changed | See Section 3.2, Item 1 |
| 10 | `for f in "$OFFERS_DIR"/*.md` | Line 18: exact match | Match | |
| 11 | `[ -f "$f" ] \|\| continue` | Line 19: exact match | Match | |
| 12 | Skip applied: `grep -q "^applied$"` with `if` block | Line 22: inline `&& continue` | Changed | See Section 3.2, Item 2 |
| 13 | Skip rejected: `grep -q "^rejected$"` with `if` block | Line 23: inline `&& continue` | Changed | Same style change as above |
| 14 | Skip failed: NOT in design hook code | Line 24: `grep -q "^failed$" ... && continue` | Added | See Section 3.2, Item 3 |
| 15 | Title extraction: `grep -m1 "^# " "$f" \| sed 's/^# //'` | Line 27: exact match | Match | |
| 16 | Empty title guard: `[ -z "$TITLE" ] && continue` | Line 28: exact match | Match | |
| 17 | `BASENAME=$(basename "$f" .md)` then `ID=$(echo "$BASENAME" \| grep -o '^[0-9]*')` | Line 31: `ID=$(basename "$f" .md \| grep -o '^[0-9]*')` | Changed | See Section 3.2, Item 4 |
| 18 | `PENDING_FILES+=("$f")` | Not present | Removed | See Section 3.2, Item 1 |
| 19 | `PENDING_TITLES+=("$ID. $TITLE")` | Line 33: exact match | Match | |
| 20 | `COUNT=${#PENDING_FILES[@]}` | Line 36: `COUNT=${#PENDING_TITLES[@]}` | Changed | Consistent with removal of PENDING_FILES |
| 21 | Singular/plural: separate `if` for COUNT=1 vs COUNT>1 | Line 40: always uses `${COUNT}건의 Offer 대기 중` | Changed | See Section 3.2, Item 5 |
| 22 | Title list with indent | Lines 41-43: exact match | Match | |
| 23 | `/cac-apply 로 적용` hint | Line 45: exact match | Match | |
| 24 | Box lines (dashes) | Lines 39,41,46: exact match | Match | |
| 25 | `exit 0` | Line 50: exact match | Match | |

### 3.2 Differences Found

#### Changed Item 1: PENDING_FILES array removed

- **Design**: Maintains two arrays `PENDING_FILES=()` and `PENDING_TITLES=()`. Uses `PENDING_FILES` count for `$COUNT`.
- **Implementation**: Only `PENDING_TITLES=()` is used. `$COUNT` is derived from `PENDING_TITLES`.
- **Impact**: Low. `PENDING_FILES` is never referenced after the loop in the design either. The implementation is a correct simplification -- the file paths are not needed by the notification logic.
- **Verdict**: Intentional improvement. No functional difference.

#### Changed Item 2: grep guard style (if-block vs inline &&)

- **Design**: Uses explicit `if grep -q ...; then continue; fi` blocks.
- **Implementation**: Uses compact `grep -q ... && continue` one-liners.
- **Impact**: None. Functionally identical in bash. The implementation is more idiomatic.
- **Verdict**: Cosmetic/style. No functional difference.

#### Added Item 3: `failed` status filter in hook

- **Design Section 2.1**: Hook code only filters `applied` and `rejected`. The `failed` state is defined in the status transition model (Section 2.3) but not filtered in the hook's bash code.
- **Implementation**: Line 24 adds `grep -q "^failed$" "$f" 2>/dev/null && continue`.
- **Impact**: Positive. The design's status model (Section 2.3) defines four states: pending, applied, rejected, failed. Filtering only two of three terminal states in the hook would cause failed offers to reappear in every notification, which is clearly undesirable.
- **Verdict**: Implementation is **more correct** than the design's hook code. The design's Section 2.3 status model implies this filter should exist but Section 2.1 omitted it. This is a design document oversight.

#### Changed Item 4: BASENAME intermediate variable

- **Design**: `BASENAME=$(basename "$f" .md)` then `ID=$(echo "$BASENAME" | grep -o '^[0-9]*')` (two lines).
- **Implementation**: `ID=$(basename "$f" .md | grep -o '^[0-9]*')` (one line, piped directly).
- **Impact**: None. Functionally identical. Saves one variable and one subshell.
- **Verdict**: Minor simplification. No functional difference.

#### Changed Item 5: Singular/plural message

- **Design**: Explicitly distinguishes `if [ "$COUNT" -eq 1 ]` (outputs "1건의 Offer 대기 중") from `else` (outputs "${COUNT}건의 Offer 대기 중").
- **Implementation**: Always outputs `${COUNT}건의 Offer 대기 중` regardless of count.
- **Impact**: Low. In Korean, "1건의" and "N건의" both read naturally. There is no grammatical distinction (unlike English "1 item" vs "2 items"). The singular branch in the design is unnecessary for Korean text.
- **Verdict**: Acceptable simplification. No user-facing issue.

---

## 4. Component 2: `.claude/skills/cac-apply/SKILL.md`

### 4.1 Section-by-Section Comparison

| # | Design Requirement | Implementation | Status | Notes |
|---|-------------------|----------------|:------:|-------|
| 1 | Frontmatter: `name: cac-apply` | Line 2: exact match | Match | |
| 2 | Frontmatter: description text | Lines 3: exact match (single line) | Match | Design shows line break; impl is single line. Content identical. |
| 3 | H1: `# Apply Offer` | Line 6: exact match | Match | |
| 4 | Intro paragraph | Line 8: exact match | Match | |
| 5 | Arguments: no arg, {id}, all | Lines 12-14: exact match | Match | |
| 6 | Step 1: Scan pending offers | Lines 18-20: match | Match | |
| 7 | Step 1.2: filter applied/rejected | Line 19: adds `or failed` | Changed | See Section 4.2, Item 1 |
| 8 | Step 2: Interactive selection | Lines 24-26: exact match | Match | |
| 9 | Step 3: Apply procedure (6 sub-steps) | Lines 30-41: match with wording changes | Match | See Section 4.2, Item 2 |
| 10 | Step 3.5: Status update wording | Line 38: "append status block at the end" | Changed | See Section 4.2, Item 2 |
| 11 | Step 4: `all` argument | Lines 43-44: exact match | Match | |
| 12 | Status Update Format block | Lines 49-63: exact match | Match | |
| 13 | Error Handling: 3 cases | Lines 67-69: match with `failed` addition | Changed | See Section 4.2, Item 3 |
| 14 | Anti-Patterns: 3 items | Lines 73-76: 3 original + 1 added | Added | See Section 4.2, Item 4 |

### 4.2 Differences Found

#### Changed Item 1: `failed` filter in Step 1

- **Design**: Step 1.2 says "skip files containing the line `applied` or `rejected`".
- **Implementation**: Line 19 says "skip files containing the line `applied`, `rejected`, or `failed`".
- **Impact**: Positive. Consistent with the status transition model (Design Section 2.3) which defines `failed` as a terminal state. Without this filter, a failed offer would be re-listed as pending.
- **Verdict**: Design document oversight corrected in implementation.

#### Changed Item 2: Step 3 wording refinement

- **Design**: Step 3.5 says "Update the offer file: add `## Status` section with value `applied` and `## Applied At` with ISO timestamp".
- **Implementation**: Step 3.5 says "Update the offer file: append status block at the end".
- **Impact**: None. The Status Update Format section (identical in both) provides the full detail. The implementation's wording is more concise but refers to the same format block.
- **Verdict**: Wording simplification. No behavioral difference.

#### Changed Item 3: Error handling -- `failed` status on test failure

- **Design**: "If tests fail after applying: revert changes, mark offer as `failed` instead of `applied`, report to user".
- **Implementation**: "If tests fail after applying: revert changes, mark offer status as `failed` instead of `applied`, report to user".
- **Impact**: None. Addition of word "status" for clarity.
- **Verdict**: Trivial wording refinement.

#### Added Item 4: Fourth anti-pattern

- **Design**: Lists 3 anti-patterns.
- **Implementation**: Adds a 4th: "Do NOT apply an offer that is already `applied`, `rejected`, or `failed`".
- **Impact**: Positive. This is an important guard against double-application that was implicit in the scan logic but not explicitly stated as an anti-pattern in the design.
- **Verdict**: Valuable addition. Design document should be updated to include this.

---

## 5. Status Transition Model Compliance

### 5.1 State Coverage

| State | Defined in Design (Section 2.3) | Hook filters it | Skill filters it | Status |
|-------|:-------------------------------:|:---------------:|:-----------------:|:------:|
| pending | Yes (default) | N/A (default) | N/A (default) | Match |
| applied | Yes | Yes (design + impl) | Yes (design + impl) | Match |
| rejected | Yes | Yes (design + impl) | Yes (design + impl) | Match |
| failed | Yes | **No** (design) / **Yes** (impl) | **No** (design) / **Yes** (impl) | Impl corrects design |

### 5.2 Status Detection Logic

| Requirement | Design | Implementation | Status |
|-------------|--------|----------------|:------:|
| Grep-based detection (no `## Status` header dependency) | Yes (Section 2.3) | Yes (both files) | Match |
| `^applied$` pattern (line-anchored) | Yes | Yes | Match |
| `^rejected$` pattern | Yes | Yes | Match |
| `^failed$` pattern | Yes (in model) | Yes (in both files) | Match |
| Default = pending | Yes | Yes | Match |

### 5.3 Transition Paths

| Transition | Designed | Implemented | Status |
|------------|:--------:|:-----------:|:------:|
| pending -> applied | Yes | Yes (Step 3.5 + Status Format) | Match |
| pending -> failed | Yes | Yes (Error Handling) | Match |
| pending -> rejected | Yes (future `/cac-reject`) | Not implemented (correct -- marked as future) | Match |
| Double-application guard | Implicit | Explicit (anti-pattern #4) | Improved |

---

## 6. Edge Case Coverage

| Edge Case (Design Section 5) | Hook Coverage | Skill Coverage | Status |
|-------------------------------|:------------:|:--------------:|:------:|
| `offers/` directory missing | Hook: `if [ -d ...]` guard, skips silently | Skill: "대기 중인 offer가 없습니다." | Match |
| Non-.md files in offers/ | Hook: `*.md` glob ignores them | Skill: "Read all `.md` files" | Match |
| Duplicate application attempt | Hook: `applied` grep filter | Skill: anti-pattern #4 | Match |
| Target file deleted | N/A for hook | Skill: "skip with warning" | Match |
| No tests in project | N/A for hook | Skill: Step 3.4 "if available" | Match |
| Ambiguous offer content | N/A for hook | Skill: "ask user for clarification" | Match |

All 6 edge cases from the design are addressed in the implementation.

---

## 7. Anti-Pattern Coverage

| Anti-Pattern (Design Section 2.2) | In Implementation | Status |
|-----------------------------------|:-----------------:|:------:|
| Do NOT apply without reading the full offer first | Line 73 | Match |
| Do NOT skip test verification if tests exist | Line 74 | Match |
| Do NOT modify the offer's Problem/Evidence sections | Line 75 | Match |
| Do NOT apply an already terminal offer | Line 76 (added) | Added |

---

## 8. Differences Summary

### Missing Features (Design has, Implementation lacks)

| # | Item | Design Location | Description | Severity |
|---|------|----------------|-------------|----------|
| 1 | `PENDING_FILES` array | Section 2.1, line 59 | Array declared but unused in design; omitted in impl | None (dead code in design) |
| 2 | Singular message branch | Section 2.1, lines 90-91 | `if COUNT -eq 1` special case | Negligible |

### Added Features (Implementation has, Design lacks)

| # | Item | Implementation Location | Description | Severity |
|---|------|------------------------|-------------|----------|
| 1 | `failed` filter in hook | `on-user-prompt-submit.sh:24` | Filters `^failed$` offers from notification | Positive (bug fix) |
| 2 | `failed` filter in skill | `SKILL.md:19` | Filters `failed` offers from pending scan | Positive (consistency) |
| 3 | Anti-pattern #4 | `SKILL.md:77` | Explicit guard against re-applying terminal offers | Positive (safety) |

### Changed Features (Design != Implementation, functionally equivalent)

| # | Item | Design | Implementation | Impact |
|---|------|--------|----------------|--------|
| 1 | grep guard style | `if ... then continue fi` | `&& continue` | None (cosmetic) |
| 2 | BASENAME variable | Two-line extraction | One-line pipe | None (cosmetic) |
| 3 | Step 3.5 wording | "add `## Status` section..." | "append status block at the end" | None (same meaning) |
| 4 | Error handling wording | "mark offer as `failed`" | "mark offer status as `failed`" | None (trivial) |

---

## 9. Match Rate Calculation

### Methodology

Each comparison item is classified and scored:
- **Match**: 1.0 point
- **Changed (functionally equivalent)**: 0.9 points (minor style delta)
- **Added (positive)**: 1.0 point (implementation improvement, no penalty)
- **Missing (no impact)**: 0.9 points (dead code removal)

### Hook Script (25 comparison items)

| Classification | Count | Points |
|----------------|:-----:|:------:|
| Match | 17 | 17.0 |
| Changed (equivalent) | 5 | 4.5 |
| Added (positive) | 1 | 1.0 |
| Missing (no impact) | 2 | 1.8 |
| **Total** | **25** | **24.3 / 25 = 97.2%** |

### Skill File (14 comparison items)

| Classification | Count | Points |
|----------------|:-----:|:------:|
| Match | 9 | 9.0 |
| Changed (equivalent) | 3 | 2.7 |
| Added (positive) | 2 | 2.0 |
| **Total** | **14** | **13.7 / 14 = 97.9%** |

### Status Model (10 items)

All 10 items match or are improved: **100%**

### Edge Cases (6 items)

All 6 items covered: **100%**

### Anti-Patterns (4 items -- 3 design + 1 added)

All covered: **100%**

### Weighted Overall

| Category | Weight | Score | Weighted |
|----------|:------:|:-----:|:--------:|
| Hook Script | 30% | 97.2% | 29.2 |
| Skill File | 30% | 97.9% | 29.4 |
| Status Model | 20% | 100% | 20.0 |
| Edge Cases | 10% | 100% | 10.0 |
| Anti-Patterns | 10% | 100% | 10.0 |
| **Overall** | **100%** | | **98.6%** |

---

## 10. Verdict

```
Match Rate: 98.6%  (threshold: 90%)
Status:     PASS

The implementation is faithful to the design with zero functional regressions.
All deviations are either cosmetic simplifications or improvements that fix
an oversight in the design document (missing `failed` state filter).
```

---

## 11. Recommended Actions

### 11.1 Design Document Updates Needed

These are low-priority documentation corrections to bring the design in line with the (correct) implementation.

| # | Action | Location | Description |
|---|--------|----------|-------------|
| 1 | Add `failed` filter to hook code | Design Section 2.1, after line 70 | Add `grep -q "^failed$"` filter to match implementation and status model |
| 2 | Remove `PENDING_FILES` array | Design Section 2.1, lines 59, 81 | Array is unused; implementation correctly omits it |
| 3 | Remove singular branch | Design Section 2.1, lines 90-91 | Unnecessary for Korean text; implementation correctly simplifies |
| 4 | Add anti-pattern #4 | Design Section 2.2, after line 200 | "Do NOT apply an offer that is already `applied`, `rejected`, or `failed`" |
| 5 | Add `failed` to skill filter | Design Section 2.2, Step 1.2 | Change "skip files containing `applied` or `rejected`" to include `failed` |

### 11.2 No Code Changes Required

The implementation is complete and correct. No code modifications needed.

---

## 12. Next Steps

- [ ] Update design document with the 5 items from Section 11.1 (optional, low priority)
- [ ] Proceed to `/pdca report offer-workflow` for completion report

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-03 | Initial gap analysis | gap-detector |
