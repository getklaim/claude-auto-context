# meteor/meteor — AI 최적화 분석

> **GitHub**: https://github.com/meteor/meteor  
> **Stars**: ~44k  
> **License**: MIT  
> **분류**: 🥇 고도화된 AI 최적화

---

## 프로젝트 개요

Meteor는 현대 웹 및 모바일 앱을 위한 풀스택 JavaScript 플랫폼입니다.
AGENTS.md + 6개의 전문화된 Skills로 구성된 깔끔한 AI 최적화 시스템을 갖추고 있습니다.

---

## AI 최적화 구성 요소

### 1. AGENTS.md 구조

루트 AGENTS.md는 간결하면서도 완전한 프로젝트 가이드:

```markdown
# Meteor

Full-stack JavaScript platform for modern web and mobile applications.

## Commands
./meteor run                                 # 소스에서 실행
./meteor create my-app                       # 앱 생성
./meteor self-test                           # CLI 테스트
./meteor test-packages ./packages/<name>     # 패키지 테스트
npm run test:modern                          # E2E 테스트 (Jest + Playwright)

## Structure
packages/          # 핵심 Meteor 패키지 (~100+)
tools/             # CLI 및 빌드 시스템 (Isobuild)
npm-packages/      # 게시된 @meteorjs/* 패키지
scripts/           # 빌드 및 릴리스 자동화

## Skills (on-demand context)
[codebase]         - 빌드 시스템, CLI, isobuild
[conventions]      - 패키지 작성, CLI 커맨드, 코드 패턴
[testing]          - 테스트 작성, 실패 디버깅
[packages]         - 기능별 패키지 찾기, 의존성 이해
[modern-tools]     - tools-core 유틸리티, rspack, 현대 통합
[ai-context]       - AI 문서 파일 생성/업데이트/유지보수
```

---

### 2. Skills 시스템 (6개 스킬)

`.github/skills/` 디렉토리에 6개의 전문화된 스킬:

| 스킬 | 위치 | 언제 사용 |
|-----|------|---------|
| `codebase` | `.github/skills/codebase/SKILL.md` | 빌드 시스템, CLI, isobuild, tools/ 디렉토리 |
| `conventions` | `.github/skills/conventions/SKILL.md` | 패키지 작성, CLI 커맨드, 코드 패턴 |
| `testing` | `.github/skills/testing/SKILL.md` | 테스트 작성, 실패 디버깅, 테스트 인프라 |
| `packages` | `.github/skills/packages/SKILL.md` | 기능별 패키지 찾기, 의존성 이해 |
| `modern-tools` | `.github/skills/modern-tools/SKILL.md` | tools-core 유틸리티, rspack, 현대 통합 |
| `ai-context` | `.github/skills/ai-context/SKILL.md` | AI 문서 파일 생성/업데이트/유지보수 |

---

### 3. Conventions 스킬 (상세)

`.github/skills/conventions/SKILL.md`:

#### 패키지 구조
```
packages/my-package/
├── package.js          # 패키지 매니페스트
├── my-package.js       # 메인 구현
├── my-package-server.js # 서버 전용 코드
├── my-package-client.js # 클라이언트 전용 코드
├── my-package-tests.js  # 테스트
└── README.md
```

#### 파일 명명 컨벤션
| 패턴 | 목적 |
|-----|------|
| `*-server.js` | 서버 전용 코드 |
| `*-client.js` | 클라이언트 전용 코드 |
| `*-common.js` | 공유 코드 |
| `*-tests.js` | 테스트 파일 |
| `*.d.ts` | TypeScript 선언 |

#### Package.js 구조 예시
```javascript
Package.describe({
  name: 'my-package',
  version: '1.0.0',
  summary: '간략한 설명',
});

Package.onUse(function(api) {
  api.versionsFrom(['3.0']);
  api.use(['ecmascript', 'mongo', 'tracker']);
  api.mainModule('my-package-server.js', 'server');
  api.mainModule('my-package-client.js', 'client');
  api.export('MyPackage');
});
```

---

### 4. 핵심 진입점 테이블

| 작업 | 위치 |
|-----|------|
| CLI 커맨드 | `tools/cli/commands.js` |
| 빌드 시스템 | `tools/isobuild/bundler.js` |
| 패키지 조회 | `packages/<name>/package.js` |
| 현대 번들러 | `packages/rspack/`, `packages/tools-core/` |

---

### 5. 패키지 도메인 분류

AI가 어떤 패키지가 어떤 기능을 담당하는지 빠르게 찾을 수 있도록:

| 카테고리 | 패키지 |
|---------|--------|
| 인증 | `accounts-base`, `accounts-password`, `accounts-oauth` |
| 데이터베이스 | `mongo`, `minimongo`, `ddp-server`, `ddp-client` |
| 빌드 | `babel-compiler`, `ecmascript`, `typescript`, `rspack` |
| 웹 | `webapp`, `autoupdate`, `reload` |
| 반응성 | `tracker`, `reactive-var`, `reactive-dict` |

---

### 6. ai-context 스킬 (메타 스킬)

AI 문서 파일을 어떻게 만들고 유지보수하는지에 대한 메타 스킬:

```markdown
## ai-context/SKILL.md 주요 내용
- CLAUDE.md가 필요한 이유: Claude Code는 AGENTS.md를 네이티브로 로드하지 않음
  → CLAUDE.md 브리지 파일이 Claude Code를 컨텍스트 시스템에 연결
- CLAUDE.md 내용: "Read AGENTS.md before starting any task + Skills 테이블"
- Skills 테이블을 AGENTS.md와 동기화 유지
- CLAUDE.md와 AGENTS.md의 skills 테이블 항상 동기화

## 스킬 생성 방법
1. .github/skills/<topic>/SKILL.md 생성
2. AGENTS.md의 Skills 테이블에 추가
3. CLAUDE.md의 Skills 테이블에도 추가 (동기화)
```

**핵심 통찰**: 일부 AI 도구(Claude Code)는 AGENTS.md를 자동 로드하지 않으므로,
CLAUDE.md 브리지 파일이 필요하다는 것을 명시적으로 다루고 있음.

---

### 7. Notes (메모)

```markdown
## Notes
- docs/와 guide/는 공개 문서 웹사이트, 에이전트 컨텍스트 아님
- v3-docs/는 Meteor 3.x 문서
- 기여자 셋업은 DEVELOPMENT.md 참조
```

---

## 핵심 인사이트

### "Skills = 온디맨드 컨텍스트" 패턴

Meteor의 AGENTS.md는 매우 간결합니다 (핵심 명령어와 구조만).
세부 내용은 필요할 때만 로드되는 스킬로 분리.

이것이 이상적인 패턴:
- AGENTS.md: 빠른 참조 (30초 내 핵심 파악)
- Skills: 깊이 있는 가이드 (필요 시 로드)

### 6번째 스킬: ai-context

대부분의 프로젝트가 AI 도구용 파일을 만들지만,
그 파일을 어떻게 만들고 유지보수하는지에 대한 스킬은 드뭅니다.
Meteor는 이것을 명시적인 스킬로 만들었습니다.

**의미**: AI가 AI 문서를 업데이트할 때도 일관된 방식으로 할 수 있도록.

### CLAUDE.md 브리지 패턴

Claude Code가 AGENTS.md를 자동 로드하지 않는 이슈를 해결하기 위해
`CLAUDE.md` = AGENTS.md를 읽어라 + Skills 테이블을 담은 브리지 파일.

---

## 배울 점

1. **간결한 AGENTS.md + 상세 Skills** — 필요한 것만 로드하는 온디맨드 컨텍스트
2. **ai-context 스킬** — AI 문서 파일 자체를 어떻게 관리하는지에 대한 메타 스킬
3. **CLAUDE.md 브리지** — Claude Code가 AGENTS.md를 직접 읽지 않는 문제 해결
4. **파일 명명 컨벤션 표** — AI가 새 파일을 어디에 어떻게 명명할지 명확한 가이드
5. **패키지 도메인 분류** — AI가 어떤 패키지를 수정해야 하는지 빠르게 찾도록
