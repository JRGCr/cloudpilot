# CloudPilot Core Principles

This document defines the foundational principles that guide all development decisions in CloudPilot. These principles enable autonomous operation by Claude Code while maintaining high code quality, security, and maintainability.

---

## 1. Autonomous Operation

**Goal**: Claude Code should build, test, and deploy projects without human intervention.

### Principles

- **Self-Monitoring**: Comprehensive logging allows Claude to understand system state at all times
- **Self-Correcting**: Automated tests catch errors before deployment
- **Self-Documenting**: Code should be readable enough that Claude can understand it months later
- **Minimal User Input**: All decisions should be derivable from requirements and context

### Implementation

- All significant operations must be logged (function entry/exit, state changes, HTTP requests, database queries)
- Tests run automatically before commits and deployments
- Failures are logged with full context for debugging
- CLI scripts provide programmatic access to all operations

---

## 2. Comprehensive Logging

**Goal**: Claude Code must know exactly what is happening and when, across all systems.

### Logging Requirements

**Server-Side Logging**:
- All API requests/responses (method, path, status, duration)
- Database operations (queries, duration, rows affected)
- Authentication events (login, logout, session validation)
- Error conditions with full stack traces
- State changes with before/after snapshots

**Client-Side Logging**:
- User interactions and navigation
- API calls from browser
- Uncaught errors and unhandled promise rejections
- Performance metrics (page load, render times)
- State management changes (Zustand actions)

**Log Infrastructure**:
- Structured JSON logging (NDJSON format)
- Multiple log files by concern (server.log, client.log, error.log, build.log, git.log)
- Correlation IDs to trace requests across systems
- Request IDs for individual request tracking
- Automatic log rotation (10MB max, keep 5 rotated files)
- Queryable via CLI (scripts/query-logs.ts)

### Log Levels

- **debug**: Detailed diagnostic information (development only)
- **info**: General informational messages (normal operations)
- **warn**: Warning messages (potentially harmful situations)
- **error**: Error events (failures that don't stop execution)
- **fatal**: Critical errors (application cannot continue)

---

## 3. Security and Secrets Management

**Goal**: Secrets must be stored outside of Claude Code's view and control.

### Principles

- **No Secrets in Code**: All secrets come from environment variables
- **No Secrets in Logs**: Automatic redaction of sensitive data (passwords, tokens, API keys)
- **No Secrets in Git**: .env files are gitignored, only .env.example committed
- **Limited Secret Access**: Claude Code can use secrets but cannot read or modify them

### Implementation

- All secrets in environment variables or Cloudflare bindings
- Secrets validation at startup (fail fast if missing)
- Automatic redaction in logs (password, token, secret, apiKey, etc.)
- GitHub Actions secrets for CI/CD
- Better Auth manages session tokens securely
- No secret values in error messages or stack traces

---

## 4. Docker Sandbox Environment

**Goal**: Claude Code runs in an isolated, reproducible Docker container.

### Container Requirements

- **Base Image**: node:20-slim for minimal attack surface
- **Non-Root User**: Run as "claude" user, not root
- **Resource Limits**: 2 CPU, 4GB memory maximum
- **Network Isolation**: Only exposed ports 8787 (API) and 5173 (Web)
- **Security**: no-new-privileges, read-only root filesystem where possible
- **Volume Mounts**: Source code (delegated), node_modules (named volume), logs (persistent)

### Benefits

- Consistent development environment
- Isolation from host system
- Easy cleanup and reset
- Matches deployment environment closely
- Safe experimentation without affecting host

---

## 5. Functional Programming Style

**Goal**: Maximize use of functional programming paradigms for predictability and testability.

### Core Tenets

**Pure Functions**:
- Same input always produces same output
- No side effects (except at boundaries)
- Easier to test, reason about, and compose

**Immutability**:
- Never mutate data structures
- Use spread operators, Object.assign, array methods that return new instances
- State changes create new state objects

**Composition Over Inheritance**:
- Build complex behavior from simple functions
- Use pipe/compose for multi-step operations
- Prefer HOFs (Higher-Order Functions) over classes

**Result Type Instead of Exceptions**:
- All functions return Result<T, E> for error handling
- No throw/catch except at entry points (API boundaries)
- Wrap external calls with tryCatch/tryCatchAsync

### Functional Utilities

```typescript
// Composition
pipe(data, validate, transform, save)
pipeAsync(data, fetchUser, updateProfile, sendEmail)
compose(f, g, h)(x) // equivalent to f(g(h(x)))

// Memoization
const expensive = memoize((x) => /* slow computation */)

// Rate limiting
const limited = debounce(fn, 300)
const controlled = throttle(fn, 1000)

// Collections
groupBy(users, user => user.role)
partition(items, item => item.active)
```

---

## 6. Automatic Git Commits

**Goal**: Auto-commit changes whenever files are modified to preserve work history.

### Commit Strategy

**File Watching**:
- Watch all files except: node_modules, .git, dist, logs, coverage, .wrangler
- Batch changes over 30-second window
- Stage all changed files when window closes

**Commit Messages**:
- Single file: "chore(auto): update path/to/file.ts"
- 2-5 files: "chore(auto): update file1.ts, file2.ts, file3.ts"
- 6+ files: "chore(auto): update N files in src/routes, src/services"
- Skip if only lockfiles changed

**Git Log Integration**:
- All git operations logged to git.log
- Track commits, pushes, merge conflicts
- Correlation IDs link commits to the work that triggered them

**Script**: `pnpm auto-commit` runs scripts/auto-commit.ts

---

## 7. Interfaces and Type Safety

**Goal**: Always use interfaces for contracts, maximum TypeScript strictness.

### Type System Rules

**Strict TypeScript**:
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "noUncheckedIndexedAccess": true
}
```

**Interface Requirements**:
- All public APIs must have interfaces
- Services implement interfaces for dependency injection
- Props and state use interfaces, not type aliases
- Database models have TypeScript interfaces

**Type Inference**:
- Let TypeScript infer return types for pure functions
- Explicitly type function parameters
- Explicitly type API boundaries (request/response)

**No `any`**:
- Use `unknown` if type is truly unknown
- Use generics for flexible types
- Use union types for known alternatives

### Example

```typescript
// ✅ Good: Interface-based service
interface UserRepository {
  getUser(id: string): Promise<Result<User, Error>>;
  updateUser(id: string, data: Partial<User>): Promise<Result<User, Error>>;
  deleteUser(id: string): Promise<Result<void, Error>>;
}

class D1UserRepository implements UserRepository {
  constructor(private db: D1Database) {}
  // ... implementation
}

// ✅ Good: Dependency injection
class UserService {
  constructor(private repo: UserRepository) {}
  // ... business logic
}
```

---

## 8. Test-Driven Development (TDD/BDD)

**Goal**: Write tests first, ensure all code is testable and tested.

### Testing Strategy

**Test First**:
1. Write failing test that describes desired behavior
2. Implement minimum code to pass the test
3. Refactor while keeping tests green
4. Repeat

**Test Pyramid**:
- **Many Unit Tests**: Test individual functions and modules (70%)
- **Some Integration Tests**: Test component interactions (20%)
- **Few E2E Tests**: Test critical user flows (10%)

**Coverage Requirements**:
- Minimum 80% coverage (lines, branches, functions)
- 100% coverage for critical paths (auth, payments, data loss scenarios)
- Tests must be fast (unit tests < 100ms, integration < 1s)

**Testing Patterns**:
```typescript
// ✅ BDD-style test naming
describe('user service', () => {
  describe('getUser', () => {
    it('returns user when found', () => { /* ... */ });
    it('returns NotFoundError when user does not exist', () => { /* ... */ });
    it('returns error when database is unavailable', () => { /* ... */ });
  });
});
```

---

## 9. Design Principles

### KISS (Keep It Simple, Stupid)

**Simple > Clever**:
- Favor readability over cleverness
- Use straightforward solutions over complex abstractions
- Avoid premature optimization
- If it's hard to explain, it's probably too complex

**Examples**:
```typescript
// ✅ Simple
const isAdmin = user.role === 'admin';

// ❌ Unnecessarily complex
const isAdmin = ['admin'].includes(user.role) && !['user', 'guest'].includes(user.role);
```

### YAGNI (You Aren't Gonna Need It)

**Build What's Needed Now**:
- Don't add features "just in case"
- Don't build abstractions until you need them 3+ times
- Delete code that isn't being used
- Resist building for hypothetical future requirements

**Examples**:
```typescript
// ✅ YAGNI: Build what's needed
function createUser(email: string, name: string) {
  return { email, name };
}

// ❌ Over-engineering
function createUser(
  email: string,
  name: string,
  options?: {
    role?: string;
    permissions?: string[];
    metadata?: Record<string, unknown>;
    hooks?: { onCreate?: () => void };
  }
) {
  // Complex logic for features we don't need yet
}
```

### SOLID Principles

**S - Single Responsibility**:
- Each class/function has one reason to change
- UserRepository handles database, UserService handles business logic

**O - Open/Closed**:
- Open for extension, closed for modification
- Add new log writers without changing logger
- Add new validators without changing validation system

**L - Liskov Substitution**:
- Subtypes must be substitutable for base types
- All LogWriters can be used interchangeably

**I - Interface Segregation**:
- Many specific interfaces > one general interface
- Don't force clients to depend on methods they don't use

**D - Dependency Inversion**:
- Depend on abstractions (interfaces), not concrete classes
- Inject dependencies rather than constructing them

### Dependency Injection

**Constructor Injection**:
```typescript
class UserService {
  constructor(
    private userRepo: UserRepository,
    private logger: Logger,
    private emailService: EmailService
  ) {}
}
```

**Benefits**:
- Easy to test (inject mocks)
- Clear dependencies
- Loose coupling
- Runtime flexibility

---

## 10. File Organization

**Goal**: Files should be small, focused, and single-purpose.

### File Size Guidelines

- **Maximum 300 lines** per file (excluding tests)
- **Ideal 100-150 lines** per file
- If file exceeds 300 lines, split by concern

### Single Responsibility

Each file should have **one primary purpose**:

**Examples**:
```
✅ Good Structure:
- user.service.ts (business logic)
- user.repository.ts (data access)
- user.types.ts (type definitions)
- user.validation.ts (input validation)
- user.routes.ts (HTTP endpoints)

❌ Bad Structure:
- user.ts (everything in one file)
```

### Naming Conventions

**Files**:
- kebab-case for all files
- *.test.ts for tests
- *.types.ts for type definitions
- *.routes.ts for route handlers
- *.service.ts for business logic
- *.middleware.ts for middleware

**Directories**:
- Group by feature/domain, not by type
- Keep directory nesting shallow (max 3 levels)

```
✅ Good (feature-based):
src/
  users/
    user.service.ts
    user.repository.ts
    user.routes.ts
  posts/
    post.service.ts
    post.repository.ts

❌ Bad (type-based):
src/
  services/
    user.service.ts
    post.service.ts
  repositories/
    user.repository.ts
    post.repository.ts
```

---

## 11. Cloudflare Platform

**Goal**: Maximize use of Cloudflare's edge platform for performance and cost.

### Platform Usage

**Cloudflare Workers (API)**:
- Serverless functions at the edge
- Fast cold starts, global distribution
- Uses Hono web framework
- D1 database binding for SQLite
- KV for rate limiting and caching

**Cloudflare Pages (Frontend)**:
- Static site hosting with edge functions
- SSR via functions/[[path]].ts
- Automatic deployments from Git
- Preview environments for branches

**D1 Database**:
- SQLite at the edge
- Low latency reads/writes
- Automatic backups
- Drizzle ORM for type-safe queries

### Platform Constraints

- No Node.js APIs (use Workers-compatible alternatives)
- No long-running processes (max 30s execution time)
- No WebSockets (use Durable Objects if needed)
- Environment variables via bindings

---

## 12. Code Quality Standards

### Linting and Formatting

**Biome**:
- Linting with recommended rules
- Formatting (spaces, 100 char line width, single quotes)
- No console.log (use logger)
- No var, require const
- No unused variables

**Pre-commit Hooks**:
- Biome check on staged files
- TypeScript type check
- Block commit if either fails

**Pre-push Hooks**:
- Full test suite (Vitest)
- E2E tests (Playwright)
- Production build
- Block push if any fail

### Code Review (Automated)

- CI runs on all PRs
- Type checking, linting, tests must pass
- Coverage must not decrease
- Build must succeed

---

## 13. Error Handling

**Goal**: All errors are captured, logged, and handled gracefully.

### Error Strategy

**Result Type**:
```typescript
// ✅ Return Result, don't throw
function getUser(id: string): Promise<Result<User, Error>> {
  return tryCatchAsync(async () => {
    const user = await db.getUser(id);
    if (!user) return err(new NotFoundError('User not found'));
    return ok(user);
  });
}

// ❌ Don't throw
function getUser(id: string): Promise<User> {
  const user = await db.getUser(id);
  if (!user) throw new Error('User not found');
  return user;
}
```

**Error Classes**:
- AppError (base class with statusCode, code, details)
- NotFoundError (404)
- ValidationError (400)
- UnauthorizedError (401)
- ForbiddenError (403)

**Error Logging**:
- All errors logged with full context
- Stack traces included in logs
- Correlation IDs for distributed tracing
- Error aggregation by type/code

**User-Facing Errors**:
- Production: Generic messages ("An error occurred")
- Development: Detailed error information
- Never expose internal details (file paths, DB schema, etc.)

---

## 14. Performance

**Goal**: Fast, efficient applications with minimal resource usage.

### Performance Guidelines

**Bundle Size**:
- Analyze bundle with Vite visualizer
- Code split routes
- Lazy load non-critical components
- Tree-shake unused code

**Caching**:
- HTTP caching headers for static assets
- Memoize expensive computations
- Cache database queries where appropriate
- Service worker for offline support

**Database**:
- Index frequently queried columns
- Avoid N+1 queries
- Use prepared statements
- Batch writes when possible

**Logging**:
- Batch log writes (FetchWriter: 50 entries or 2s)
- Async log writes (don't block request)
- Log rotation to prevent disk fill

---

## 15. Deployment

**Goal**: Automated, safe deployments with rollback capability.

### Deployment Pipeline

**Preview Deployments**:
- Automatic on branch push
- Unique URL per branch
- Full environment (API + Web)
- Comment on PR with URLs

**Production Deployments**:
- Trigger on main branch push
- Require manual approval
- Run database migrations first
- Deploy API then Web
- Create GitHub release
- Automatic rollback on failure

### Deployment Safety

- All tests must pass
- Type checks must pass
- Build must succeed
- Migrations must be reversible
- Zero-downtime deployments

---

## Summary: The CloudPilot Way

1. **Autonomous**: Claude Code operates independently with comprehensive logging
2. **Secure**: Secrets isolated, automatic redaction, least privilege
3. **Functional**: Pure functions, immutability, composition over inheritance
4. **Tested**: TDD/BDD, 80%+ coverage, fast tests
5. **Simple**: KISS, YAGNI, small focused files
6. **Type-Safe**: Strict TypeScript, interfaces everywhere
7. **Automated**: Auto-commit, CI/CD, git hooks
8. **Observable**: Comprehensive logging, queryable logs, correlation IDs
9. **Platform-Native**: Cloudflare Workers, Pages, D1
10. **Quality-First**: Linting, formatting, code review, error handling

These principles guide every decision. When in doubt, ask: "Does this help Claude Code operate autonomously while maintaining code quality and security?"

---

**Last Updated**: January 30, 2026
**Version**: 1.0
