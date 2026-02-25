# pingcap/tidb — AI 최적화 분석

> **GitHub**: https://github.com/pingcap/tidb  
> **Stars**: ~38k  
> **License**: Apache-2.0  
> **분류**: 🥇 고도화된 AI 최적화 (엔터프라이즈 데이터베이스)

---

## 프로젝트 개요

TiDB는 분산형 SQL 데이터베이스입니다. 대규모 엔터프라이즈 오픈소스 프로젝트로서
매우 정교한 AI 에이전트 지침 시스템을 구축했습니다.

---

## AI 최적화 구성 요소

### 1. 비협상 원칙 (Non-negotiables)

가장 먼저 AI 에이전트에게 절대 규칙 선언:

```markdown
## Non-negotiables

1. 정확성 우선. TiDB는 분산 SQL 데이터베이스; 작은 변경도 SQL 의미론,
   일관성, 클러스터 동작을 변경할 수 있음.
2. 추측적 행동 금지. API, 기본값, 프로토콜 동작, 테스트 워크플로우 발명 금지.
3. 최소 diff 유지. 명시적 요청 없이 관련 없는 리팩토링, 대량 이름 변경, 
   형식 전용 변경 금지.
4. 검증 가능한 증거 남기기. 타겟 검사 실행하고 정확한 명령어 보고.
5. 생성된 코드 아티팩트 존중. 생성된 코드 수동 편집 금지; 소스 입력에서 재생성.
```

---

### 2. Quick Decision Matrix

AI가 특정 작업 시 무엇을 해야 하는지 빠른 결정 매트릭스:

| 작업 | 필요한 행동 |
|-----|-----------|
| Go 파일 추가/이동/이름 변경/삭제, Bazel 파일 변경, `go.mod`/`go.sum` 변경 | **반드시** `make bazel_prepare` 실행하고 결과 Bazel 메타데이터 변경 포함 |
| 패키지 단위 테스트 실행 | 타겟 테스트 실행 (`go test -run <TestName> -tags=intest,deadlock`) |
| failpoint를 사용하는 패키지 테스트 | 테스트 전 failpoint 활성화, 이후 비활성화 |
| 통합 테스트 기록 | `pushd tests/integrationtest && ./run-tests.sh -r <TestName> && popd` |
| RealTiKV 테스트 | 백그라운드에서 플레이그라운드 시작, 테스트 실행, 정리 |
| 버그 수정 | 회귀 테스트 반드시 추가, 수정 전 실패/후 통과 검증 |
| 형식 전용 PR | `realtikvtest` 실행 금지; 로컬 컴파일로 충분 |
| 완료 전 | `make bazel_lint_changed` 실행 |

---

### 3. Skills 시스템 (`.agents/skills/`)

```
.agents/skills/
├── <skill-name>/
│   ├── SKILL.md           - 스킬 구현
│   └── references/        - 참조 문서
```

**중요**: `.github/skills`에서 `.agents/skills/`로 마이그레이션됨.

```markdown
## Skills 경로 변경
- 새 경로: .agents/skills
- 레거시 경로: .github/skills (마이그레이션 노트용으로만 유지)
```

---

### 4. Pre-flight Checklist (비행 전 체크리스트)

AI 에이전트가 작업 시작 전 반드시 확인해야 할 5단계:

```markdown
1. 작업 목표와 수락 기준 재확인
2. 소유 서브시스템과 가장 가까운 기존 테스트 찾기
3. 테스트/빌드 실행 전 전제조건 결정 (failpoint 등)
4. 최소 유효 검증 세트 선택
5. AGENTS.md 또는 docs/agents/ 변경 시 review-guide 체크리스트 완료
```

---

### 5. Task → Validation Matrix

```
변경 범위                              최소 검증
pkg/planner/**                       → 타겟 플래너 단위 테스트 + 규칙 testdata 업데이트
pkg/executor/** SQL 동작             → 타겟 단위 테스트 + 통합 테스트
pkg/expression/** 내장 함수/타입     → 타겟 표현식 단위 테스트 (엣지 케이스 포함)
pkg/session/** 변수/프로토콜         → 타겟 패키지 테스트 + SQL 통합 테스트
pkg/ddl/** 스키마 변경               → DDL 집중 단위/통합 테스트 + 호환성 검사
pkg/store/** / pkg/kv/** 스토리지    → 타겟 단위 테스트; TiKV 의존 시 realtikv
Parser files (pkg/parser/**)         → 파서 전용 Make 타겟 + 관련 단위 테스트
tests/integrationtest/t/** 변경      → run-tests.sh -r <TestName> + 재생성 결과 검증
tests/realtikvtest/** 변경           → 플레이그라운드 시작, 범위 지정 테스트, 필수 정리
```

---

### 6. Agent Output Contract

작업 완료 시 반드시 보고해야 할 항목:

```markdown
## 완료 시 보고 항목:
1. 변경된 파일
2. 위험 요소: 정확성, 호환성, 성능
3. 검증을 위해 실행한 정확한 명령어
4. 로컬에서 검증하지 않은 항목
```

---

### 7. 저장소 맵 (Repository Map)

```
/pkg/planner/             - 플래너 및 최적화 진입점
/pkg/executor/, /pkg/expression/ - SQL 실행 및 표현식 평가
/pkg/session/, /pkg/sessionctx/  - 세션 수명 주기 및 런타임 문맥
/pkg/ddl/, /pkg/infoschema/, /pkg/meta/ - 스키마 및 메타데이터 관리
/pkg/store/, /pkg/kv/     - 스토리지 및 분산 쿼리 인터페이스
/pkg/statistics/          - 통계 및 추정 동작 진입점
/pkg/parser/              - SQL 문법 및 AST
/tests/integrationtest/, /tests/realtikvtest/ - SQL 통합 및 실제 TiKV 테스트
/cmd/tidb-server/         - TiDB 서버 진입점
```

---

### 8. Issue & PR 규칙

```markdown
### 이슈 규칙
- type/* 레이블 필수
- 최소 하나의 component/* 레이블 필수
- 버그/회귀의 경우 severity/* 및 영향받는 버전 레이블 포함

### PR 요구사항
- PR 제목: pkg [, pkg2, pkg3]: what is changed 또는 *: what is changed
- 본문 반드시 PR 템플릿 따르기
- 한 줄의 Issue Number: 포함 (close #<id> 또는 ref #<id>)
- HTML 주석 변경 금지 (CI 도구가 의존)
- force-push 가능하면 피하기; --force-with-lease 사용
```

---

### 9. DDL 모듈 특별 규칙

```markdown
## DDL 모듈 규칙
- 필수: DDL 모듈 변경 전 docs/agents/ddl/README.md 먼저 읽기
- 디버깅: docs/agents/ddl/* 참고 가능하지만 가설로 취급
- 문서 드리프트: 구현과 docs/agents/ddl/*이 다를 경우 
  실제 코드와 일치하도록 docs 업데이트 필수 (연기 금지)
```

---

## 핵심 인사이트

### 엔터프라이즈 데이터베이스의 AI 가이드 철학

TiDB의 AGENTS.md는 다른 프로젝트들과 다른 중요한 특징이 있습니다:

1. **"정확성 우선"** — DB 프로젝트에서는 AI가 편의상 추측하는 것이 재앙적일 수 있음
2. **"추측적 행동 금지"** — API나 동작을 발명하는 것 명시적으로 금지
3. **"최소 diff"** — 불필요한 리팩토링으로 인한 회귀 방지

### Skills 마이그레이션 패턴

`.github/skills/` → `.agents/skills/`로의 마이그레이션은 업계 표준의 진화를 보여줌.
새 프로젝트는 `.agents/skills/`를 사용해야 함.

### Failpoint 패턴

Go 기반 분산 시스템의 테스팅에서 failpoint(의도적 실패 주입)를 관리하는 명확한 프로토콜.
AI 에이전트가 이를 잊지 않도록 명시적으로 가이드.

---

## 배울 점

1. **비협상 원칙 선언** — 절대 해서는 안 되는 것을 먼저 명시
2. **Quick Decision Matrix** — 작업 유형별 즉각적인 행동 지침
3. **Agent Output Contract** — AI 작업 완료 시 반드시 보고할 항목
4. **pre-flight 체크리스트** — 코딩 시작 전 5단계 확인
5. **Validation Matrix** — 변경 범위별 최소 필요 검증 정의
