# Plan: Offer Workflow (알림 → 승인 → 적용)

## 1. 개요

Offer 파일 생성(worker offer-agent)은 이미 구현되어 있다.
이 Plan은 **생성 이후 파이프라인** — 사용자에게 알림, 선택적 적용, 상태 전이 — 을 구현한다.

## 2. 현황 분석

| 구성요소 | 상태 | 위치 |
|---------|------|------|
| offer-agent (생성) | ✅ 구현됨 | `.claude-auto-context/worker.mjs` |
| create-offer 스킬 | ✅ 구현됨 | `.claude/skills/create-offer/SKILL.md` |
| offers/ 디렉토리 | ✅ 존재 | `.claude-auto-context/offers/` |
| UserPromptSubmit에서 pending offer 알림 | ❌ 미구현 | `scripts/on-user-prompt-submit.sh` |
| `/cac-apply` 스킬 | ❌ 미구현 | 파일 없음 |
| offer 상태 전이 (pending → applied) | ❌ 미구현 | — |

## 3. 구현 범위

### Task 1: UserPromptSubmit Hook에 offer 알림 주입

**목표**: 사용자가 프롬프트를 입력할 때, pending offer가 있으면 알림을 표시한다.

**변경 파일**: `scripts/on-user-prompt-submit.sh`

**동작**:
1. `.claude-auto-context/offers/` 디렉토리에서 `## Status` 또는 `## 상태`가 `pending`인 `.md` 파일을 스캔
2. pending offer가 0건이면 → 기존대로 collector에만 전달
3. pending offer가 1건 이상이면 → stdout으로 알림 텍스트 출력

**알림 포맷** (설계서 기준):
```
─────────────────────────────────────────────────
🔔 Auto Context — {N}건의 Offer 대기 중
─────────────────────────────────────────────────
1. {offer 제목}
2. {offer 제목}
💡 /cac-apply 로 적용
─────────────────────────────────────────────────
```

**구현 방식**: 순수 bash로 구현 (bun 의존 없음). `grep -l` + `head`로 pending 파일과 제목 추출.

### Task 2: `/cac-apply` 스킬 생성

**목표**: 사용자가 `/cac-apply`를 실행하면 pending offer 목록을 보여주고, 선택한 offer를 Claude가 자동 리팩토링한다.

**생성 파일**: `.claude/skills/cac-apply/SKILL.md`

**동작**:
1. `.claude-auto-context/offers/`에서 pending offer 파일 목록 로드
2. 없으면 → "대기 중인 offer가 없습니다" 출력
3. 있으면 → AskUserQuestion으로 사용자에게 선택지 제시
4. 선택된 offer 파일의 `## Proposal` / `## 제안` 섹션을 읽어 리팩토링 수행
5. 리팩토링 완료 후 offer 파일의 상태를 `pending` → `applied`로 변경
6. 변경된 파일 목록과 결과 요약 출력

**지원 명령**:
- `/cac-apply` — 목록 표시 후 선택
- `/cac-apply {id}` — 특정 offer 바로 적용 (예: `/cac-apply 001`)
- `/cac-apply all` — 모든 pending offer 순차 적용

### Task 3: offer 상태 전이 로직

**목표**: offer 파일 내 상태 필드를 일관되게 관리한다.

**상태 값**:
- `pending` — 생성됨, 미적용
- `applied` — 사용자가 승인하여 적용 완료
- `rejected` — 사용자가 거부 (향후 확장)

**구현 위치**: `/cac-apply` 스킬 내에서 `Edit` 도구로 상태 변경

## 4. 구현 순서

```
Task 1: UserPromptSubmit Hook 알림
  ↓
Task 2: /cac-apply 스킬 생성
  ↓
Task 3: offer 상태 전이
```

Task 2와 Task 3은 사실상 하나의 스킬 파일 안에서 함께 구현된다.
실질적으로는 **2개 파일**만 변경/생성하면 된다:

1. `scripts/on-user-prompt-submit.sh` — 알림 로직 추가
2. `.claude/skills/cac-apply/SKILL.md` — 새 스킬 생성

## 5. 비범위 (Out of Scope)

- offer 자동 생성 로직 변경 (이미 동작함)
- offer 파일 포맷 변경
- DB 스키마 변경
- `/cac-apply-all` 별도 스킬 (→ `/cac-apply all`로 통합)

## 6. 검증 기준

- [ ] pending offer가 있을 때 새 세션에서 알림이 표시되는가
- [ ] pending offer가 없을 때 알림이 표시되지 않는가
- [ ] `/cac-apply` 실행 시 pending offer 목록이 보이는가
- [ ] offer 선택 후 리팩토링이 수행되는가
- [ ] 적용 후 offer 파일의 상태가 `applied`로 변경되는가
- [ ] 기존 collector 기능(프롬프트 DB 저장)이 영향 없는가
