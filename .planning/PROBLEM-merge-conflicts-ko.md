# 문제 정의: 자동 생성 파일로 인한 팀 머지 컨플릭트

**날짜:** 2026-03-23
**상태:** 정의 완료 — v1.2 마일스톤 준비됨
**배경:** 팀 배포 전 사전 분석. 현재 팀에서 사용 중인 곳은 없음.

---

## 문제 요약

claude-auto-context 플러그인은 git에 커밋되는 파일을 자동으로 생성하고 수정한다. 같은 프로젝트에서 여러 개발자가 각자 Claude Code 세션을 실행하면, 각자의 백그라운드 워커가 **독립적으로** 같은 파일들에 서로 다른 변경을 만들어낸다. 이로 인해 사실상 모든 PR에서 머지 컨플릭트가 발생하여 팀 사용성이 심각하게 저하된다.

## 충돌 대상 파일

### 높은 위험 — 충돌 거의 확실

| 파일 | 에이전트 | 충돌 원인 |
|------|---------|----------|
| `CLAUDE.md` | claudemd-agent | 단일 파일에 append-only 방식. 두 개발자가 같은 위치(EOF)에 서로 다른 줄을 추가한다. CLAUDE.md를 포함하는 모든 PR 쌍이 충돌. |
| `.claude/rules/*.md` | rules-agent, hygiene-agent | **생성 충돌:** 두 개발자가 같은 패턴을 감지하면 같은 파일명으로 다른 내용이 생성됨. **수정 충돌:** 한쪽의 hygiene-agent가 규칙 파일을 수정/중복 제거하는 동안 다른 브랜치에서도 해당 파일을 수정. **삭제 충돌:** hygiene-agent가 오래된 규칙을 삭제하는데 다른 브랜치에서는 해당 규칙을 수정 중 → modify/delete 충돌. 파일명이 감지된 패턴에서 파생되므로(예: `no-console-log.md`) 공통 컨벤션에 대한 충돌 가능성이 높음. |
| `.claude-auto-context/suggestions/NNN-*.md` | suggestion-agent, hygiene-agent | 순차 번호 매기기(`001-`, `002-`, ...). 독립적으로 실행되는 두 워커가 같은 번호를 서로 다른 제안에 부여. |

### 위험 없음 — 이미 제외됨

| 파일 | 이유 |
|------|------|
| `.claude-auto-context/db/` | .gitignore에 포함 |
| `.claude-auto-context/worker.lock` | .gitignore에 포함 |
| `worker.log` | db/ 디렉토리 내부, gitignore 대상 |

## 충돌 시나리오

### 시나리오 1: CLAUDE.md Append 경쟁 (가장 빈번)

```
main:    CLAUDE.md = [1~20줄]
                |
dev-A 브랜치:  CLAUDE.md = [1~20줄] + [A의 새 3줄]
dev-B 브랜치:  CLAUDE.md = [1~20줄] + [B의 새 2줄]
                |
A → main 머지: OK
B → main 머지: CONFLICT (둘 다 21번째 줄에 append)
```

**빈도:** 두 개발자가 활성 세션을 가진 거의 모든 PR 쌍.
**심각도:** 성가시지만 해결 가능 — 양쪽 추가 내용 모두 유효하며 공존해야 함.

### 시나리오 2: Suggestion 번호 충돌

```
main:    suggestions/ = [001-split-utils.md]
                |
dev-A 브랜치:  suggestions/ + [002-add-types.md]
dev-B 브랜치:  suggestions/ + [002-fix-imports.md]
                |
A → main 머지: OK (002-add-types.md)
B → main 머지: CONFLICT (002-fix-imports.md가 같은 접두사)
```

**빈도:** 중간 — 제안 생성 빈도에 따라 다름.
**심각도:** 파일 수준 충돌. 제안 자체는 독립적.

### 시나리오 3: 중복 규칙 감지

```
devA와 devB 모두 세션에서 console.log 사용.
양쪽 워커 모두 "프로덕션에서 console.log 사용 금지" 패턴 감지.
양쪽 모두 .claude/rules/no-console-log.md 를 약간 다른 문구로 생성.

A → main 머지: OK
B → main 머지: CONFLICT (같은 파일명, 다른 내용)
```

**빈도:** 낮음 — 같은 패턴이 독립적으로 감지되어야 함.
**심각도:** 내용 수준 충돌. 의미적으로는 같은 규칙.

### 시나리오 4: Hygiene 에이전트 교차 수정

```
dev-A 세션: hygiene-agent가 중복 규칙 감지, rules/a.md + rules/b.md → rules/a.md로 병합
dev-B 세션: B는 독립적으로 rules/b.md를 수정 중

머지: rules/b.md가 A에 의해 삭제, B에 의해 수정 → CONFLICT (modify/delete)
```

**빈도:** 낮음 — hygiene 실행은 조건부.
**심각도:** 높음 — modify/delete 충돌은 내용 충돌보다 해결이 어려움.

## 영향 평가

| 차원 | 영향 |
|------|------|
| **PR 마찰** | 활성 세션이 있는 개발자의 모든 PR이 다른 개발자의 PR과 충돌할 가능성 높음. 5인 팀에서 PR 사이클당 4건 이상의 충돌 해결이 필요할 수 있음. |
| **개발자 경험** | 자동 생성 파일의 충돌 해결은 특히 답답함 — 개발자가 직접 작성한 내용이 아니라서 어느 버전이 "맞는지" 판단할 수 없음. |
| **도입 장벽** | 팀이 지속적인 충돌을 감당하느니 플러그인을 아예 비활성화할 수 있음 — 플러그인의 모든 가치가 무효화됨. |
| **의미적 정확성** | 단순한 충돌 해결(accept-theirs / accept-mine)은 유효한 자동 생성 컨텍스트를 잃어버릴 수 있어, Claude의 프로젝트 이해도가 조용히 저하됨. |

## 근본 원인

1. **단일 공유 파일** — CLAUDE.md가 모든 개발자의 단일 append 대상
2. **패턴 기반 결정적 네이밍** — 규칙 파일명이 감지된 패턴에서 파생되므로, 같은 컨벤션을 독립적으로 감지한 워커들이 같은 파일명에 다른 내용을 생성
3. **조율 부재** — 워커들이 다른 워커의 출력을 인식하지 못한 채 독립 실행
4. **순차 번호 매기기** — Suggestion 파일이 글로벌 유니크하지 않은 카운터 사용
5. **중복 감지** — 여러 워커가 같은 패턴을 독립적으로 감지할 수 있음
6. **파괴적 Hygiene** — Hygiene-agent가 기존 rules/suggestions를 수정 및 삭제하여 브랜치 간 modify/delete 충돌 생성
7. **git 커밋 대상** — 자동 생성 파일이 사람이 작성한 코드 변경과 함께 커밋됨

## 해결책에 대한 제약 조건

- 단독 개발자 경험을 저하시키면 안 됨 (솔로 사용 시 설정 불필요)
- 자동 생성된 컨텍스트는 결국 팀 전체가 공유해야 함 (플러그인의 존재 이유)
- 중앙 서버나 조율 서비스를 요구할 수 없음 (플러그인은 로컬 전용)
- 표준 git 워크플로우와 호환되어야 함 (GitHub Flow, trunk-based 등)
- Quality gate와 hygiene 검사가 계속 작동해야 함

---

*이 문서는 마일스톤 v1.2 요구사항 정의의 입력이 됨.*
