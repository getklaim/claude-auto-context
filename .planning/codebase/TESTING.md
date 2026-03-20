# Testing Patterns

**Analysis Date:** 2026-03-20

## Test Framework

**Runner:**
- Not configured; e2e project has no test framework installed
- CLAUDE.md note: "No test framework installed — do not attempt `bun test`"

**Assertion Library:**
- Not installed

**Run Commands:**
- No test commands available
- Project focuses on manual or external testing (Docker-based E2E)

## Test File Organization

**Location:**
- Test files not found in codebase
- Manual testing via Docker Compose and API requests expected

**Naming:**
- No naming convention established (no test files present)

**Structure:**
- Not applicable; no test infrastructure

## Test Structure

**Suite Organization:**
Not applicable — no test framework configured.

## Mocking

**Framework:**
- Not applicable; no testing framework

## Fixtures and Factories

**Test Data:**
- Not applicable

**Location:**
- Not applicable

## Coverage

**Requirements:**
- No coverage requirements enforced

**View Coverage:**
- Not applicable

## Test Types

**Unit Tests:**
- Not present; no framework for unit testing

**Integration Tests:**
- Manual via `docker compose up` and curl/HTTP client
- Database: PostgreSQL in Docker
- Flow: Start DB with `docker compose up -d db`, then start server with `bun --watch src/index.ts`
- Test via HTTP requests to running server

**E2E Tests:**
- Manual HTTP testing against running server
- Server must start after DB is ready (see CLAUDE.md: "starting server before DB causes PrismaClientInitializationError")

## Manual Testing Approach

**Current workflow:**
1. Start PostgreSQL: `docker compose up -d db`
2. Start server: `bun --watch src/index.ts`
3. Test endpoints via HTTP client (Postman, curl, etc.)

**Endpoint patterns:**
- Health check: `GET /health` returns `{ data: { status: "ok" }, error: null }`
- List users: `GET /users?page=1&limit=20` returns paginated list with meta
- Get user: `GET /users/:id` returns single user or 404
- Create user: `POST /users` with body `{ email, name }` returns 201 with created user
- Update user: `PUT /users/:id` with partial body
- Delete user: `DELETE /users/:id` returns `{ data: { deleted: true }, error: null }`

## Validation Testing

**Approach:**
- Zod schemas validate request bodies before reaching handlers
- Test via invalid payloads (missing required fields, wrong types)

**Example test cases (manual):**
```bash
# Missing required email field
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John"}'
# Expected: 400 error with Zod validation message

# Invalid email format
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "not-an-email", "name": "John"}'
# Expected: 400 error

# Valid creation
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "John"}'
# Expected: 201 with { data: { id, email, name, ... }, error: null }
```

## Error Testing

**Approach:**
- Catch errors in service functions (e.g., "User not found", "Email already in use")
- Errors thrown as `AppError` with specific HTTP status codes
- Middleware catches and serializes to `{ data: null, error: { message, code }, meta: null }`

**Example test cases (manual):**
```bash
# User not found
curl http://localhost:3000/users/99999
# Expected: 404 with error message "User not found"

# Email already in use
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "existing@example.com", "name": "Duplicate"}'
# Expected: 409 with error message "Email already in use"

# Invalid query params (page/limit)
curl "http://localhost:3000/users?page=-1&limit=1000"
# Expected: page clamped to 1, limit clamped to 100 (see utils.ts parseQueryParams)
```

## Integration Points

**Database Integration:**
- PrismaClient used in service layer
- Parallel queries with `Promise.all()` for performance
- Transaction-like patterns could be added but not present yet

**Validation Integration:**
- Zod schema validation on request bodies
- Middleware `validate()` function enforces schema before route handler runs

**Error Handling Integration:**
- Service functions throw `AppError`
- Route handlers catch and forward to middleware via `next(err)`
- Middleware serializes to JSON response

## Known Testing Gaps

**No automated tests:**
- Unit tests not configured
- Integration tests depend on manual API calls
- No CI pipeline running tests

**Missing coverage:**
- No assertion library for automated testing
- No fixtures or factories for test data
- No database seeding for reproducible test scenarios

**Recommendations for adding tests:**
1. Install Vitest or Jest: `npm install --save-dev vitest` (or `jest`)
2. Create `src/**/*.test.ts` or `__tests__/**/*.test.ts`
3. Mock `PrismaClient` for unit tests; use real DB for integration tests
4. Use `supertest` for HTTP endpoint testing
5. Add test database setup in `hooks` or factory pattern
6. Add GitHub Actions workflow to run tests on push/PR

---

*Testing analysis: 2026-03-20*
