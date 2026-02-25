# tuist/tuist — AI 최적화 분석

> **GitHub**: https://github.com/tuist/tuist  
> **Stars**: ~5.5k  
> **License**: MIT (부분)  
> **분류**: 🥇 고도화된 AI 최적화 (모듈형 AGENTS.md)

---

## 프로젝트 개요

Tuist는 Xcode 프로젝트 생성 및 관리 도구입니다. Swift로 작성된 iOS/macOS 개발 도구로,
모듈 수준으로 분해된 40+ AGENTS.md 파일을 통해 AI에게 세밀한 컨텍스트를 제공합니다.

---

## AI 최적화 구성 요소

### 1. 모듈형 AGENTS.md (40+ 파일)

각 Swift 모듈마다 전용 AGENTS.md 파일을 보유:

#### CLI 수준 (cli/)
```
cli/AGENTS.md                               - CLI 전체 개요
cli/Sources/tuist/AGENTS.md                 - CLI 진입점
cli/Sources/TuistKit/AGENTS.md              - 커맨드 정의 및 연결
cli/Sources/TuistCore/AGENTS.md             - 핵심 도메인 모델
cli/Sources/TuistSupport/AGENTS.md          - 공유 유틸리티
cli/Sources/TuistGenerator/AGENTS.md        - 프로젝트 생성
cli/Sources/TuistDependencies/AGENTS.md     - 의존성 관리
cli/Sources/TuistLoader/AGENTS.md           - 매니페스트 로딩
cli/Sources/TuistServer/AGENTS.md           - 서버 통합
cli/Sources/TuistCache/AGENTS.md            - 캐시 통합
cli/Sources/ProjectDescription/AGENTS.md   - 프로젝트 설명 모델
cli/Sources/ProjectAutomation/AGENTS.md    - 프로젝트 자동화
cli/Sources/TuistAutomation/AGENTS.md      - Tuist 자동화
cli/Sources/TuistAcceptanceTesting/AGENTS.md
cli/Sources/TuistCAS/AGENTS.md
cli/Sources/TuistCASAnalytics/AGENTS.md
cli/Sources/TuistCI/AGENTS.md
cli/Sources/TuistEnvKit/AGENTS.md
cli/Sources/TuistGit/AGENTS.md
cli/Sources/TuistHTTP/AGENTS.md
cli/Sources/TuistHasher/AGENTS.md
cli/Sources/TuistLaunchctl/AGENTS.md
cli/Sources/TuistMigration/AGENTS.md
cli/Sources/TuistOIDC/AGENTS.md
cli/Sources/TuistPlugin/AGENTS.md
cli/Sources/TuistProcess/AGENTS.md
cli/Sources/TuistRootDirectoryLocator/AGENTS.md
cli/Sources/TuistScaffold/AGENTS.md
cli/Sources/TuistSimulator/AGENTS.md
cli/Sources/TuistTesting/AGENTS.md
cli/Sources/TuistXCActivityLog/AGENTS.md
cli/Sources/TuistXCResultService/AGENTS.md
cli/Sources/TuistXcodeProjectOrWorkspacePathLocator/AGENTS.md
cli/Sources/tuistbenchmark/AGENTS.md
cli/Sources/tuistfixturegenerator/AGENTS.md
```

#### 서버 수준 (server/lib/tuist/)
```
server/lib/tuist/AGENTS.md                  - 서버 전체 개요
server/lib/tuist/accounts/AGENTS.md         - 계정 관리
server/lib/tuist/alerts/AGENTS.md           - 알림
server/lib/tuist/api/AGENTS.md              - API 엔드포인트
server/lib/tuist/app_builds/AGENTS.md       - 앱 빌드
server/lib/tuist/authentication/AGENTS.md   - 인증
server/lib/tuist/authorization/AGENTS.md    - 권한
server/lib/tuist/aws/AGENTS.md              - AWS 통합
server/lib/tuist/billing/AGENTS.md          - 결제
server/lib/tuist/bundles/AGENTS.md          - 번들
server/lib/tuist/cache/AGENTS.md            - 캐시
... (20+ 더)
```

---

### 2. 다운링크(Downlinks) 시스템

상위 AGENTS.md에서 하위 모듈 AGENTS.md로의 명시적 링크:

```markdown
# cli/AGENTS.md의 Related Context (Downlinks)

- CLI 진입점: `cli/Sources/tuist/AGENTS.md`
- 커맨드 정의 및 연결: `cli/Sources/TuistKit/AGENTS.md`
- 핵심 도메인 모델: `cli/Sources/TuistCore/AGENTS.md`
- 공유 유틸리티: `cli/Sources/TuistSupport/AGENTS.md`
- 프로젝트 생성: `cli/Sources/TuistGenerator/AGENTS.md`
- 의존성 관리: `cli/Sources/TuistDependencies/AGENTS.md`
- 매니페스트 로딩: `cli/Sources/TuistLoader/AGENTS.md`
- 서버 통합: `cli/Sources/TuistServer/AGENTS.md`
- 캐시 통합: `cli/Sources/TuistCache/AGENTS.md`
...
```

AI가 상위 컨텍스트에서 시작해 관련 하위 모듈로 드릴다운할 수 있는 구조.

---

### 3. 레거시 모듈 명시

```markdown
## Legacy Modules (새 코드 추가 피하기)

- `cli/Sources/TuistKit` - 모놀리식 커맨드 연결; 
  새 커맨드는 기능별 모듈에 추가해야 함
- `cli/Sources/TuistGenerator` - 모놀리식 생성 파이프라인; 
  새 생성 로직은 더 작고 집중된 모듈에 추가해야 함
```

**중요**: AI에게 레거시 코드를 건드리지 않도록 명시.
새 코드가 어디에 가야 하는지 명확히 안내.

---

### 4. 코드 스타일

```markdown
## Code Style
- 정말 유용하지 않으면 한 줄 주석 추가하지 않기
```

간결함 - 불필요한 주석을 추가하지 않도록 AI에게 명시.

---

### 5. 테스팅 패턴 (Swift Testing 프레임워크)

```swift
// 임시 디렉토리가 필요한 테스트
import FileSystemTesting
import Testing

@Test(.inTemporaryDirectory) func test_example() async throws {
    let temporaryDirectory = try #require(FileSystem.temporaryTestDirectory)
    // 테스트 구현
}
```

- Swift Testing 프레임워크 사용 (XCTest 아님)
- 임시 디렉토리 테스트에 커스텀 트레이트 사용
- `@Test(.inTemporaryDirectory)` 데코레이터

---

### 6. 린팅

```bash
# 커밋 전 코드 형식 확인
mise run cli:lint --fix
```

---

## 핵심 인사이트

### 모듈 경계가 곧 AI 컨텍스트 경계

Tuist의 가장 독창적인 접근: 각 Swift 모듈에 독립적인 AGENTS.md.

**이점:**
1. AI가 관련 모듈의 정확한 컨텍스트만 로드
2. 토큰 낭비 없음 (전체 프로젝트 AGENTS.md 하나 읽기 vs 필요한 모듈 AGENTS.md만 읽기)
3. 모듈별 컨벤션, 패턴, 제약을 정확히 전달
4. 새 기여자와 AI 모두에게 모듈 구조를 명확히 이해시킴

### 다운링크 = 탐색 가이드

AI가 "이게 어디에 있지?" 같은 추측을 하지 않도록,
상위에서 하위로의 명시적 링크가 탐색 경로를 제공.

### 레거시 모듈 명시의 중요성

AI에게 "이 모듈에 새 코드 추가하지 마"라고 말하는 것은 매우 중요.
리팩토링 목표가 있을 때 AI가 잘못된 위치에 코드를 추가하는 것을 방지.

---

## 배울 점

1. **모듈별 AGENTS.md** — 각 모듈/패키지에 자체 AGENTS.md 생성
2. **다운링크 시스템** — 상위 AGENTS.md가 관련 하위 파일들을 명시적으로 나열
3. **레거시 모듈 경고** — 건드리지 말아야 할 코드 명시
4. **Swift Testing 패턴** — 언어/프레임워크 특화 테스팅 패턴
5. **간결한 스타일 규칙** — "불필요한 주석 추가하지 않기" 같은 단순하지만 중요한 규칙
