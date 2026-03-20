# Coding Conventions

**Analysis Date:** 2026-03-20

## Naming Patterns

**Files:**
- TypeScript source files: `camelCase.ts` (e.g., `error-handler.ts`, `user.service.ts`)
- Service files use `.service.ts` suffix (e.g., `user.service.ts`)
- Middleware files use `middleware/` directory prefix
- Routes files use `routes/` directory prefix
- Config files: `config.ts`

**Functions:**
- Async functions: `async function findAll()`, `async function create()`
- Named exports only (no default exports for functions)
- camelCase for all function names
- Verb-first naming: `find*`, `create*`, `update*`, `remove*`, `validate*`, `parse*`, `generate*`

**Variables:**
- camelCase for local variables and parameters
- CONSTANT_CASE for module-level constants (e.g., `MAX_PAYLOAD`, `STALE_THRESHOLD_S`)
- Object/array accumulators: `result`, `chunks`, `items`, `groups`
- Pagination: `page`, `limit`, `offset`, `total`, `totalPages`

**Types:**
- PascalCase for interfaces and classes (e.g., `AppError`, `PaginationParams`, `ZodSchema`)
- Interfaces prefixed with `I` are NOT used; use plain PascalCase
- Error classes extend `Error` and use `class` keyword

## Code Style

**Formatting:**
- No linter/formatter configured (no .eslintrc, .prettierrc, or biome.json found)
- Code uses conventional TypeScript spacing: 2-space indentation (inferred from source files)
- Double quotes for strings in JSON and imports
- Single line comments for section headers (e.g., `// ─── Date Utilities ───────────────────────────────────────`)

**Linting:**
- No linting configuration detected in project
- No pre-commit hooks enforcing style

## Import Organization

**Order:**
1. External framework/library imports (e.g., `express`, `zod`)
2. Built-in Node/Bun modules (e.g., `crypto`, `fs`)
3. Local type imports (e.g., `type { Request, Response }`)
4. Local module imports
5. Path aliases: none detected (using relative imports)

**Pattern:**
```typescript
// Framework/libraries first
import express from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// Then local imports
import { usersRouter } from "./routes/users";
import { errorHandler } from "./middleware/error-handler";
import * as userService from "../services/user.service";
```

**Path Aliases:**
- Not used; project relies on relative imports only

## Error Handling

**Patterns:**
- All errors thrown in services and routes use `AppError` class (from `src/middleware/error-handler.ts`)
- `AppError` constructor takes `(message: string, statusCode: number, isOperational?: boolean)`
- Never throw raw `Error` class; always use `AppError`
- Route handlers wrap service calls in try-catch and pass errors to middleware via `next(err)`
- Error handler middleware (Express) catches `AppError` instances and serializes to `{ data: null, error: { message, code }, meta: null }` JSON response

**Example:**
```typescript
// In service
export async function findById(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
}

// In route handler
usersRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await userService.findById(Number(req.params.id));
    res.json({ data: user, error: null });
  } catch (err) {
    next(err);  // Pass to error handler middleware
  }
});
```

## Logging

**Framework:** No logging framework configured; direct `console` usage present

**Note:** CLAUDE.md rules file `logging.md` in test project prohibits `console.*` methods and mandates a project logger instead. However, source code still uses `console.log` and `console.error` (e.g., in `src/index.ts` line 22, `src/middleware/error-handler.ts` line 30).

**Current pattern (violating rule):**
```typescript
console.log(`Server running on port ${port}`);
console.error("Unexpected error:", err);
```

**Expected pattern (per rules):**
```typescript
logger.info(`Server running on port ${port}`);
logger.error("Unexpected error:", err);
```

## Comments

**When to Comment:**
- Section headers with visual separators for utility file organization (e.g., `// ─── Date Utilities ───────────────────────────────────────`)
- Comments explaining complex logic (e.g., token generation, password verification)
- Comments documenting queue operations (e.g., in `worker.mjs`: "// Recover stale processing events")

**JSDoc/TSDoc:**
- Not extensively used; minimal documentation above functions
- No type annotations in comments; rely on TypeScript type system

## Function Design

**Size:** Functions range from 2-30 lines; utility functions (~100 lines) group related functionality

**Parameters:**
- Named parameters preferred; destructuring used for object params
- Optional parameters come last
- Defaults specified at function signature level (e.g., `async function findAll(page = 1, limit = 20)`)

**Return Values:**
- Async functions always return Promise-wrapped values
- Service functions return domain objects (e.g., `User`, `{ items, total, page, totalPages }`)
- Utility functions return typed values with explicit types (e.g., `string`, `number`, `boolean`)
- Pagination helpers return objects with all meta needed (e.g., `{ total, page, limit, totalPages, hasNext, hasPrev }`)

## Module Design

**Exports:**
- Named exports only; no default exports (except for Express app in `src/index.ts`)
- All service functions exported as named exports: `export async function findAll()`, `export async function create()`
- Router exported as named const: `export const usersRouter = Router()`

**Barrel Files:**
- Not used; imports use full relative paths (e.g., `from "../services/user.service"`, not from a barrel)

## Response Shape

**Envelope Pattern:**
All HTTP responses use consistent envelope: `{ data, error, meta }`

**Success responses:**
```typescript
{ data: <resource or null>, error: null, meta: { ... } }
```

**Error responses:**
```typescript
{ data: null, error: { message, statusCode or code }, meta: null }
```

**Specific rules:**
- POST (create) returns HTTP 201 with `meta: { created: true }` (not enforced in code yet)
- List endpoints include pagination in `meta`: `{ total, page, totalPages }`
- Single resource GETs include minimal `meta: null` or omit meta field
- Delete operations return `{ data: { deleted: true }, error: null }`

**Example from routes:**
```typescript
// GET list
res.json({ data: result.items, error: null, meta: { total: result.total, page: result.page, totalPages: result.totalPages } });

// POST create
res.status(201).json({ data: user, error: null });

// GET single
res.json({ data: user, error: null });

// DELETE
res.json({ data: { deleted: true }, error: null });
```

## Configuration

**Environment variables:**
- CLAUDE.md rule `config.md` mandates all env var access go through `src/config.ts` (not in this e2e project, but pattern to follow)
- Direct `process.env` access currently used in `src/index.ts` (violates rule)
- Dotenv loaded at app startup: `dotenv.config()`

## Validation

**Pattern:**
- Zod schemas for request body validation (e.g., `createUserSchema`, `updateUserSchema`)
- Middleware `validate(schema)` function wraps route handlers
- Validation errors throw `AppError` with 400 status code

**Example:**
```typescript
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

usersRouter.post("/", validate(createUserSchema), async (req, res, next) => {
  // req.body is now type-safe
  const user = await userService.create(req.body);
  res.status(201).json({ data: user, error: null });
});
```

## Database

**Pattern:**
- Prisma ORM for database access
- Single `PrismaClient()` instance created per service file
- Service functions handle all DB operations; routes never call Prisma directly
- Promise.all() used for parallel queries (e.g., fetching items + count simultaneously)

**Example:**
```typescript
// In service file
const prisma = new PrismaClient();

export async function findAll(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.user.count(),
  ]);
  return { items: users, total, page, totalPages: Math.ceil(total / limit) };
}
```

---

*Convention analysis: 2026-03-20*
