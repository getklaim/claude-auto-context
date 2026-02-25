# promptfoo/promptfoo — AI 최적화 분석

> **GitHub**: https://github.com/promptfoo/promptfoo  
> **Stars**: ~10.6k  
> **License**: MIT  
> **분류**: 🥇 고도화된 AI 최적화

---

## 프로젝트 개요

promptfoo는 LLM 애플리케이션 평가 및 테스팅을 위한 오픈소스 프레임워크입니다.
TypeScript로 작성되었으며, 계층적 AGENTS.md 시스템과 `docs/agents/` 전용 문서 폴더를 갖추고 있습니다.

---

## AI 최적화 구성 요소

### 1. 계층형 AGENTS.md 시스템

```
/AGENTS.md                    - 루트 개요
/src/app/AGENTS.md            - Web UI (React 19/Vite/MUI v7)
/src/commands/AGENTS.md       - CLI 커맨드
/src/providers/AGENTS.md      - LLM 프로바이더
/src/redteam/AGENTS.md        - 보안 테스팅
/src/server/AGENTS.md         - 백엔드 서버
/test/AGENTS.md               - 테스트 패턴 (Vitest)
/site/AGENTS.md               - 문서 사이트 (Docusaurus)
/examples/AGENTS.md           - 예제 설정
/drizzle/AGENTS.md            - DB 마이그레이션
```

**핵심 지시:**
> **Read the relevant AGENTS.md when working in that directory.**

디렉토리별 전문화된 가이드를 AI가 적절한 컨텍스트에서 읽도록 유도.

---

### 2. `docs/agents/` 전용 AI 문서 폴더

`docs/agents/` 폴더에 AI 에이전트용 전용 문서:

| 문서 | 언제 읽나 |
|-----|---------|
| `docs/agents/pr-conventions.md` | PR 생성 시 |
| `docs/agents/git-workflow.md` | Git 작업 시 |
| `docs/agents/dependency-management.md` | 패키지 업데이트 시 |
| `docs/agents/logging.md` | 코드에 로깅 추가 시 |
| `docs/agents/python.md` | Python 프로바이더/스크립트 작업 시 |
| `docs/agents/database-security.md` | DB 쿼리 작성 시 |

---

### 3. Git 워크플로우 (엄격한 규칙)

**절대 금지 사항:**
```markdown
- NEVER commit/push directly to main
- NEVER use --force without explicit approval
- NEVER comment on GitHub issues - only create PRs to address them
- ALWAYS create new commits - never amend, squash, or rebase unless explicitly asked
```

**표준 워크플로우:**
```bash
git checkout main && git pull origin main   # 항상 새로 시작
git checkout -b feature/your-branch-name    # 변경 사항용 새 브랜치
# 변경 사항 작성...
git add <specific-files>                    # 절대 blindly 전부 추가 금지
npm run l && npm run f                      # 커밋/푸시 전 lint & format
git commit -m "type(scope): description"    # Conventional commit 형식
git fetch origin main && git merge origin/main  # main과 동기화
git push -u origin feature/your-branch-name
```

---

### 4. 스크린샷 업로드 자동화 (PR용)

GitHub에는 이미지를 PR 설명에 업로드하는 공식 API가 없습니다.
AGENTS.md에서 정확한 해결책을 AI에게 제공:

```bash
# freeimage.host를 사용 (API 키 불필요)
curl -s -X POST \
  -F "source=@/path/to/screenshot.png" \
  -F "type=file" \
  -F "action=upload" \
  "https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5" \
  | jq -r '.image.url'

# PR 본문 업데이트
gh pr edit <PR_NUMBER> --body "$(cat <<'EOF'
## Summary
...
## Screenshot
![Screenshot](https://iili.io/XXXXXXX.png)
EOF
)"
```

**금지:**
- 스크린샷을 브랜치에 커밋하지 않기
- GitHub release assets에 업로드하지 않기
- GitHub 내부 업로드 엔드포인트 사용하지 않기 (브라우저 쿠키 필요, PAT 불가)

---

### 5. 빌드 & 테스트 명령어 완전 가이드

```bash
# 핵심 명령어
npm run build              # 빌드
npm run build:clean        # dist 디렉토리 정리
npm run build:watch        # 워치 모드 TypeScript 재빌드
npm test                   # 모든 테스트
npm run tsc                # TypeScript 컴파일러

# 린팅 & 포매팅
npm run lint               # Biome 린터
npm run format             # 전체 포매팅
npm run l                  # 변경된 파일만 린팅
npm run f                  # 변경된 파일만 포매팅

# 테스팅
npm run test:watch         # 워치 모드
npm run test:integration   # 통합 테스트
npx vitest path/to/test    # 특정 테스트 파일

# 개발
npm run dev                # 서버 + 앱 모두
npm run dev:app            # 프론트엔드만 (localhost:5173)
npm run dev:server         # 서버만 (localhost:3000)
npm run local -- eval      # 로컬 빌드로 테스트
```

---

### 6. 개발 중 평가 실행 규칙

```markdown
## 중요 규칙들:

1. 항상 리포지토리 루트에서 실행
2. 개발 중 항상 --no-cache 사용 (신선한 결과 보장)

npm run local -- eval -c examples/my-example/promptfooconfig.yaml --env-file .env --no-cache

3. 결과 내보내기로 검증
npm run local -- eval -c path/to/config.yaml -o output.json --no-cache
```

---

### 7. 캐시 & 데이터베이스 보호 규칙

```markdown
## 절대 금지:
- NEVER delete or clear the cache without explicit permission
  → 대신 --no-cache 플래그 사용
  → 캐시 위치: ~/.cache/promptfoo

- NEVER delete the database
  → 위치: ~/.promptfoo/promptfoo.db (SQLite)
  → 읽기만 가능
```

---

### 8. 코드 스타일 가이드라인

```markdown
- TypeScript strict 타입 체킹
- 일관된 import 순서 (Biome가 자동 정렬)
- 모든 제어문에 일관된 중괄호
- let보다 const 선호; var 금지
- 가능하면 object shorthand 사용
- async/await 사용
- 모든 테스트에 Vitest 사용
- 적절한 타입 체크로 일관된 에러 처리
- 파일에서 re-export 금지; 소스 모듈에서 직접 import
```

---

### 9. 로깅 패턴

```typescript
// 객체 컨텍스트와 함께 logger 사용 (자동 검열)
logger.debug('[Component] Message', { headers, body, config });
```

---

### 10. 코드 작성 전 체크리스트

```markdown
## Before Writing Code:
- Search for existing implementations before creating new code
- Check for existing utilities in src/util/ before adding helpers
- Don't add dependencies without checking if functionality exists in current deps
- Reuse patterns from similar files in the codebase
- Test both success and error cases for all functionality
- Document provider configurations following examples in existing code
```

---

## 핵심 인사이트

### `docs/agents/` 폴더 패턴

AGENTS.md의 모든 내용을 한 파일에 넣는 대신,
도구별 상세 가이드를 `docs/agents/` 폴더에 분리하고 AGENTS.md에서 링크.

**장점:**
- AGENTS.md를 간결하게 유지 (빠른 스캔)
- 상세 내용은 필요할 때만 참조
- 각 워크플로우별 전문 문서 유지보수 용이

### PR 스크린샷 해결책

AI가 자주 막히는 지점(스크린샷 업로드)에 대한 구체적인 해결책을 AGENTS.md에 포함.
freeimage.host + curl 조합으로 API 키 없이 이미지 업로드 가능.

### Conventional Commits 강제

```markdown
타입: feat, fix, chore, docs, test, refactor, ci, perf
```

AI에게 커밋 메시지 형식을 명시적으로 지정하여 일관성 유지.

---

## 배울 점

1. **`docs/agents/` 폴더** — 워크플로우별 전용 AI 문서 분리
2. **디렉토리별 AGENTS.md** — 작업 중인 디렉토리 관련 가이드 즉시 로드
3. **절대 금지 사항 명시** — "main에 직접 커밋 금지", "캐시 삭제 금지" 같은 명확한 규칙
4. **스크린샷 업로드 해결책** — AI가 막히는 엣지 케이스에 대한 정확한 해결책 제공
5. **Pre-commit 검증** — `npm run l && npm run f` 커밋 전 필수 실행
