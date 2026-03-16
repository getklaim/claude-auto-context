# Suggestion: Split `src/utils.ts` God File into Domain Modules

## Status
pending

## Category
structure

## Problem

`src/utils.ts` is a 314-line god file containing 9 unrelated functional domains in a single module. Every session that needs any utility function must load the entire 314-line file even when only a single function from one domain is required.

Across 4 consecutive sessions (e2e-s4 through e2e-s7) the file was read in full each time. The signal ratio — useful lines consumed divided by total lines read — is extremely low for targeted lookups. For example, `hashPassword` occupies lines 119-125 (7 lines), meaning a session that needs only that function loads 307 unneeded lines, a signal ratio of approximately 2%.

Domains identified in the file and their approximate line spans:

| Domain | Functions | Lines |
|---|---|---|
| date/time | `formatDate`, `isValidDate`, `daysBetween`, `addDays`, `startOfDay`, `endOfDay`, `relativeTime` | 3-63 (~61 lines) |
| string | `slugify`, `truncate`, `capitalize`, `camelToSnake`, `snakeToCamel`, `generateRandomString`, `maskEmail`, `countWords` | 65-115 (~51 lines) |
| security/crypto | `hashPassword`, `verifyPassword`, `sanitizeInput`, `generateToken` | 117-149 (~33 lines) |
| pagination | `PaginationParams`, `parseQueryParams`, `buildPaginationMeta` | 151-182 (~32 lines) |
| id/uuid | `generateId`, `isValidUUID` | 184-199 (~16 lines) |
| object | `pick`, `omit`, `deepClone`, `isEmpty`, `groupBy` | 201-245 (~45 lines) |
| array | `chunk`, `unique`, `shuffle`, `sortBy` | 247-276 (~30 lines) |
| http | `successResponse`, `errorResponse`, `parseIntParam` | 278-292 (~15 lines) |
| environment | `requireEnv`, `getEnv`, `isDev`, `isProd` | 294-314 (~21 lines) |

## Proposal

Split `src/utils.ts` into focused domain modules under a `src/utils/` directory, then re-export everything from a barrel file to maintain full backward compatibility with existing imports.

**Target file structure:**

```
src/utils/
  date.ts        — formatDate, isValidDate, daysBetween, addDays, startOfDay, endOfDay, relativeTime
  string.ts      — slugify, truncate, capitalize, camelToSnake, snakeToCamel, generateRandomString, maskEmail, countWords
  security.ts    — hashPassword, verifyPassword, sanitizeInput, generateToken
  pagination.ts  — PaginationParams, parseQueryParams, buildPaginationMeta
  id.ts          — generateId, isValidUUID
  object.ts      — pick, omit, deepClone, isEmpty, groupBy
  array.ts       — chunk, unique, shuffle, sortBy
  http.ts        — successResponse, errorResponse, parseIntParam
  env.ts         — requireEnv, getEnv, isDev, isProd
  index.ts       — barrel re-export of all the above
```

The barrel `src/utils/index.ts` re-exports every named export from each module, so any existing code using `import { hashPassword } from '../utils'` continues to work without modification. Only when callers are updated to import directly from the domain module (e.g. `import { hashPassword } from '../utils/security'`) does the per-session read cost drop.

**Estimated per-session read cost after split:**

A session needing only `hashPassword` reads `src/utils/security.ts` (~33 lines) instead of `src/utils.ts` (314 lines) — a reduction of approximately 281 lines per session lookup, or ~89% fewer lines read for that use case.

## Evidence Sessions

- e2e-s4 (2026-03-16): "314줄인데 실제 필요한 건 hashPassword 하나. 파일 전체를 읽어야 해서 signal ratio 극히 낮음." (314 lines loaded to access 1 function; signal ratio ~2%)
- e2e-s5 (2026-03-16): "또 utils.ts 314줄 전체 읽어야 했음. date, string, security, pagination 다 섞여있어서 원하는 함수 찾기 힘듦. 이 파일 매번 전체 로딩됨." (full file loaded again; 4 domains mixed)
- e2e-s6 (2026-03-16): "utils.ts가 god file. 7개 도메인이 한 파일에 있어서 매번 전체 읽어야 함. date-utils, string-utils, security-utils 등으로 분리하면 필요한 것만 읽을 수 있을 텐데." (explicitly identified as god file; named date-utils, string-utils, security-utils as candidates)
- e2e-s7 (2026-03-16): "utils.ts 4번째 읽음. 분리 필요: date-utils, string-utils, security-utils, pagination-utils, validation-utils, array-utils, object-utils." (4th consecutive full read; enumerated 7 split targets)

## Metrics

- File size: 314 lines across 9 functional domains
- Sessions affected: 4/4 (100% of observed sessions read the full file)
- Full-file reads recorded: 4 (e2e-s4, e2e-s5, e2e-s6, e2e-s7)
- Signal ratio (worst case — single function lookup): ~2% (7 useful lines / 314 total lines)
- Signal ratio (average — one domain per session): ~17% (avg domain ~54 lines / 314 total lines)
- Lines eliminated per targeted read after split: ~260 lines average (~83% reduction)
- Backward compatibility risk: None — barrel `index.ts` preserves all existing import paths
- Estimated impact: Sessions touching only security functions read ~33 lines instead of 314; sessions touching only pagination read ~32 lines instead of 314; overall context window pressure from this file drops by 80%+ for typical single-domain usage
