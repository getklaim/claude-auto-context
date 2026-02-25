# getsentry/sentry — AI 최적화 분석

> **GitHub**: https://github.com/getsentry/sentry  
> **Stars**: ~43.2k  
> **License**: FSL-1.1-Apache-2.0  
> **분류**: 🥇 고도화된 AI 최적화

---

## 프로젝트 개요

Sentry는 개발자 우선 에러 트래킹 및 성능 모니터링 플랫폼입니다.
Django 백엔드 + React 프론트엔드로 구성된 대규모 프로젝트입니다.

---

## AI 최적화 구성 요소

### 1. 계층형 AGENTS.md 시스템

```
/AGENTS.md              - 루트 개요 (단일 소스 of truth 선언)
/src/AGENTS.md          - 백엔드 패턴 (Python/Django)
/tests/AGENTS.md        - 백엔드 테스팅 패턴
/static/AGENTS.md       - 프론트엔드 패턴 (React/TS)
```

**핵심 원칙 선언:**
> **IMPORTANT**: AGENTS.md files are the source of truth for AI agent instructions. 
> Always update the relevant AGENTS.md file when adding or modifying agent guidance. 
> Do not add to CLAUDE.md or Cursor rules.

이는 매우 중요한 결정입니다 — 모든 AI 도구에 대한 단일 소스로 AGENTS.md를 지정하고,
도구별 파일(CLAUDE.md, .cursorrules)에는 중복하지 않는다는 방침.

---

### 2. 🔥 혁신: Cursor 컨텍스트 인식 자동 로딩

Sentry의 가장 독창적인 기여:

```
.cursor/rules/
├── backend.mdc    - src/**/*.py 편집 시 → src/AGENTS.md 자동 로드
├── testing.mdc    - tests/**/*.py 편집 시 → tests/AGENTS.md 자동 로드
└── frontend.mdc   - static/**/*.{ts,tsx,js,jsx} 편집 시 → static/AGENTS.md 자동 로드
```

**작동 방식:**
- Cursor는 `.cursor/rules/*.mdc` 파일로 컨텍스트 로딩 규칙 정의
- 편집 중인 파일 경로에 따라 관련 AGENTS.md가 자동으로 로드됨
- 각 `.mdc` 파일은 AGENTS.md를 _참조_ (복제하지 않음)
- 토큰 낭비 없이 필요한 컨텍스트만 로드

**핵심 통찰:**
> These `.mdc` files only _reference_ AGENTS.md files—they don't duplicate content. 
> All actual guidance should be added to the appropriate AGENTS.md file, not to Cursor rules.

---

### 3. Python 명령어 실행 가이드

AI 에이전트를 위한 명확한 명령어 실행 지침:

```bash
# AI 에이전트용 (자동화 명령어)
cd /path/to/sentry && .venv/bin/pytest tests/...
cd /path/to/sentry && .venv/bin/python -m mypy ...

# 또는 activate 스크립트 사용
cd /path/to/sentry && source .venv/bin/activate && pytest tests/...
```

**중요 규칙 (AI 에이전트용):**
- 항상 `required_permissions: ['all']` 사용 (샌드박스 권한 문제 방지)
- `.venv/bin/` 프리픽스 사용으로 올바른 Python 인터프리터 보장

---

### 4. 개발 명령어 완전 가이드

#### 백엔드 Setup
```bash
make develop          # 의존성 설치 및 개발 환경 셋업
devenv sync           # 최신 devenv 명령어
direnv allow          # Python venv 활성화
devservices up        # 개발 의존성 시작
devservices serve     # 개발 서버 시작
```

#### 백엔드 테스팅
```bash
# 항상 이 파라미터 사용
pytest -svv --reuse-db

# 특정 테스트 파일
pytest -svv --reuse-db tests/sentry/api/test_base.py
```

#### 프론트엔드 테스팅
```bash
# 항상 CI 플래그 사용
CI=true pnpm test <file_path>
```

#### 린팅
```bash
# 선호 방법: 특정 파일에 pre-commit hooks 실행
pre-commit run --files src/sentry/path/to/file.py
```

---

### 5. Feature Flag 시스템 (AI 가이드 포함)

```python
# 1. 등록 (src/sentry/features/temporary.py)
manager.add("organizations:my-feature", OrganizationFeature, 
            FeatureHandlerStrategy.FLAGPOLE, api_expose=True)

# 2. Python 체크
if features.has("organizations:my-feature", organization, actor=user):

# 3. 프론트엔드 체크 (api_expose=True 필요)
organization.features.includes('my-feature')

# 4. 테스트
with self.feature("organizations:my-feature"):
    ...
```

---

### 6. PR 분리 규칙 (AI에게 명시)

> Frontend (`static/`) and backend (`src/`, `tests/`) are **not atomically deployed**. 
> A CI check enforces this.
> - If your changes touch both frontend and backend, split them into **separate PRs**.
> - Land the backend PR first when the frontend depends on new API changes.

---

## 핵심 인사이트

### Sentry의 혁신: 파일 경로 기반 컨텍스트 자동 선택

일반적인 문제: AGENTS.md가 커질수록 토큰 낭비가 심해짐.
Sentry의 해결책: Cursor `.mdc` 파일로 편집 파일에 따라 관련 섹션만 자동 로드.

```
편집: src/sentry/api/test_base.py
  → Cursor가 .cursor/rules/backend.mdc 읽기
  → src/AGENTS.md 자동 로드 (백엔드 패턴)
  → tests/AGENTS.md, static/AGENTS.md 로드 안 함 (불필요)
```

### 단일 소스 원칙

모든 AI 도구 지침을 AGENTS.md 하나에 집중시키고,
도구별 파일(CLAUDE.md, .cursorrules)은 단순히 AGENTS.md를 _참조_만 하는 구조.

**장점:**
- 중복 없음 (한 곳에서만 수정)
- 모든 AI 도구가 동일한 최신 지침 받음
- 유지보수 용이

---

## 배울 점

1. **Cursor `.mdc` 파일로 컨텍스트 자동 선택** — 파일 경로 패턴별로 다른 AGENTS.md 섹션 자동 로드
2. **AGENTS.md = 단일 소스** — CLAUDE.md나 .cursorrules에 중복하지 않는 원칙
3. **AI 에이전트용 명시적 명령어** — `.venv/bin/pytest` 같은 정확한 명령어 기술
4. **프론트/백엔드 분리 규칙** — AI가 PR을 어떻게 분리해야 하는지 명시
