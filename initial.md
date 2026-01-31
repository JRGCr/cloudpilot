# CloudPilot Template Repository Build Prompt

Create a GitHub template repository called "cloudpilot" - an autonomous deployment platform for Claude Code on Cloudflare. Uses TypeScript only.

## Project Overview

Build a monorepo template that enables Claude Code to autonomously deploy and manage web applications on Cloudflare. Claude Code is the sole developer. The system provides comprehensive JSON file logging so Claude can monitor its own work, auto-commits changes, runs tests, and deploys to preview environments automatically. Production deployments require human approval.

## Technology Stack

- **Runtime**: Cloudflare Workers (API) + Cloudflare Pages (Web)
- **Language**: TypeScript (ES2022, strict mode)
- **API Framework**: Hono
- **Frontend**: React 18 with SSR via Vite
- **Database**: Cloudflare D1 (SQLite)
- **Log Storage**: Local JSON files (for Claude Code to read and analyze)
- **Authentication**: Better Auth (GitHub OAuth provider)
- **State Management**: Zustand
- **Linting/Formatting**: Biome
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **Git Hooks**: Lefthook
- **Container**: Docker with sandbox environment

---

## Phase 1: Project Foundation

### 1.1 Monorepo Structure

Create the directory structure:

```
cloudpilot/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── db/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── wrangler.toml
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   ├── lib/
│       │   ├── pages/
│       │   ├── styles/
│       │   ├── App.tsx
│       │   ├── entry-client.tsx
│       │   └── entry-server.tsx
│       ├── functions/
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── wrangler.toml
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── logging/
│       │   ├── utils/
│       │   ├── types/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── migrations/
├── docker/
├── scripts/
├── .github/
│   └── workflows/
├── logs/
│   ├── .gitkeep
│   └── README.md
├── package.json
├── biome.json
├── vitest.config.ts
├── vitest.workspace.ts
├── playwright.config.ts
├── lefthook.yml
├── tsconfig.json
├── .gitignore
├── .env.example
└── README.md
```

### 1.2 Root Configuration Files

**package.json (root):**
- Workspace configuration for pnpm
- Scripts: dev, build, lint, typecheck, test, test:e2e
- Dev dependencies: typescript, biome, vitest, playwright, lefthook

**tsconfig.json (root):**
- Target: ES2022
- Module: ESNext
- Module resolution: bundler
- Strict: true
- No emit: true (type checking only)
- Skip lib check: true
- Paths: @cloudpilot/shared maps to packages/shared/src
- Include: apps, packages, scripts
- Exclude: node_modules, dist

**biome.json:**
- Schema version: latest
- Organizes imports: true
- Linter enabled with recommended rules
- Specific rules:
  - noConsole: warn (use logger)
  - noVar: error
  - useConst: error
  - noUnusedVariables: error
  - noExplicitAny: warn
- Formatter:
  - Indent style: space
  - Indent width: 2
  - Line width: 100
  - Quote style: single
  - Semicolons: always
  - Trailing comma: all
- Ignore: node_modules, dist, coverage, .wrangler, logs

**.gitignore:**
- node_modules, dist, coverage, .wrangler
- .env (not .env.example)
- logs/*.log (not .gitkeep)
- test-results, playwright-report

**.env.example:**
- List all required variables with placeholder values
- Comments explaining how to obtain GitHub OAuth credentials

### 1.3 Package Configuration Files

**packages/shared/tsconfig.json:**
- Extends root tsconfig
- Declaration: true (generate .d.ts files)
- Emit: true (compile to dist)
- Out dir: dist
- Include src directory

**packages/shared/package.json:**
- Name: @cloudpilot/shared
- Main: dist/index.js
- Types: dist/index.d.ts
- Scripts: build, typecheck

**apps/api/tsconfig.json:**
- Extends root tsconfig
- Compiler options for Cloudflare Workers environment
- Types include @cloudflare/workers-types
- Include src directory

**apps/api/package.json:**
- Dependencies: hono, better-auth
- Dev dependencies: wrangler, @cloudflare/workers-types
- Scripts: dev, build, deploy

**apps/web/tsconfig.json:**
- Extends root tsconfig
- JSX: react-jsx
- Types include vite/client
- Include src directory

**apps/web/package.json:**
- Dependencies: react, react-dom, zustand
- Dev dependencies: vite, @vitejs/plugin-react
- Scripts: dev, build, preview

---

## Phase 2: Shared Utilities

### 2.1 Result Type

Implement a Result type in packages/shared/src/utils/result.ts to replace throw/catch throughout the codebase.

**Type Definition:**
- Result<T, E> is a discriminated union of Ok<T> and Err<E>
- Ok contains a value of type T
- Err contains an error of type E

**Constructors:**
- ok<T>(value: T): Result<T, never> - creates a success result
- err<E>(error: E): Result<never, E> - creates an error result

**Type Guards:**
- isOk<T, E>(result: Result<T, E>): result is Ok<T>
- isErr<T, E>(result: Result<T, E>): result is Err<E>

**Transformations:**
- map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>
- mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>
- flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>

**Unwrapping:**
- unwrap<T, E>(result: Result<T, E>): T (throws if Err)
- unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T
- unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T

**Async Support:**
- tryCatch<T>(fn: () => T): Result<T, Error>
- tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>>

**Combining:**
- combine<T, E>(results: Result<T, E>[]): Result<T[], E>
- combineObject<T extends Record<string, Result<unknown, E>>, E>(obj: T): Result<{...}, E>

### 2.2 Functional Utilities

Implement in packages/shared/src/utils/functional.ts.

**Composition:**
- pipe<T>(initial: T, ...fns: Array<(arg: any) => any>): any
- pipeAsync<T>(initial: T, ...fns: Array<(arg: any) => any | Promise<any>>): Promise<any>
- compose<T>(...fns: Array<(arg: any) => any>): (initial: any) => T

**Identity:**
- identity<T>(value: T): T
- constant<T>(value: T): () => T

**Caching:**
- memoize<T extends (...args: any[]) => any>(fn: T): T
- memoizeWithTTL<T extends (...args: any[]) => any>(fn: T, ttlMs: number): T

**Rate Limiting:**
- debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T & { cancel: () => void }
- throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T

**Collection Utilities:**
- groupBy<T, K extends string | number>(array: T[], keyFn: (item: T) => K): Record<K, T[]>
- keyBy<T, K extends string | number>(array: T[], keyFn: (item: T) => K): Record<K, T>
- partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]]
- chunk<T>(array: T[], size: number): T[][]
- uniqBy<T, K>(array: T[], keyFn: (item: T) => K): T[]

### 2.3 Validation

Implement in packages/shared/src/utils/validation.ts. Create composable validators that return Result<T, ValidationError>.

**ValidationError type:**
- field: string (path to invalid field)
- message: string (human-readable error)
- code: string (machine-readable error code)

**Primitive Validators:**
- string(): Validator<string>
- nonEmptyString(): Validator<string>
- number(): Validator<number>
- integer(): Validator<number>
- boolean(): Validator<boolean>

**Format Validators:**
- email(): Validator<string>
- uuid(): Validator<string>
- url(): Validator<string>
- isoDate(): Validator<string>

**Constraint Validators:**
- minLength(n: number): Validator<string | unknown[]>
- maxLength(n: number): Validator<string | unknown[]>
- length(n: number): Validator<string | unknown[]>
- range(min: number, max: number): Validator<number>
- pattern(regex: RegExp): Validator<string>
- oneOf<T>(values: readonly T[]): Validator<T>

**Combinators:**
- optional<T>(validator: Validator<T>): Validator<T | undefined>
- nullable<T>(validator: Validator<T>): Validator<T | null>
- array<T>(itemValidator: Validator<T>): Validator<T[]>
- object<T>(schema: { [K in keyof T]: Validator<T[K]> }): Validator<T>
- and<T>(v1: Validator<T>, v2: Validator<T>): Validator<T>
- or<T, U>(v1: Validator<T>, v2: Validator<U>): Validator<T | U>

### 2.4 Shared Types

Define common types in packages/shared/src/types/index.ts:
- User type
- Session type
- LogEntry type
- ApiResponse type
- ValidationError type

### 2.5 Shared Package Index

Export all utilities from packages/shared/src/index.ts.

---

## Phase 3: Logging System

This is the most critical feature - Claude Code needs comprehensive logging to monitor its own work.

### 3.1 Log Types and Constants

Define in packages/shared/src/logging/types.ts and constants.ts.

**Log Entry Structure:**
- id: string (auto-generated nanoid)
- timestamp: string (ISO 8601 format with milliseconds)
- level: string (debug, info, warn, error, fatal)
- source: string (server, client, worker, database, auth, git, build)
- message: string
- correlationId: string or undefined
- requestId: string or undefined
- userId: string or undefined
- metadata: object or undefined
- duration: number or undefined (milliseconds)
- error: object or undefined (name, message, stack)

**Log Levels enum:**
- debug: 0
- info: 1
- warn: 2
- error: 3
- fatal: 4

**Log Sources enum:**
- server, client, worker, database, auth, git, build

### 3.2 Log Writers

Implement in packages/shared/src/logging/writers.ts.

**Writer Interface:**
- write(entry: LogEntry): void | Promise<void>
- flush(): void | Promise<void>

**ConsoleWriter:**
- Formats log entries with color coding by level
- Includes timestamp, level, source, message
- Expands metadata in debug mode
- Used in development for immediate feedback

**FileWriter:**
- Appends JSON lines to specified file path
- Handles rotation when size threshold exceeded (default 10MB)
- Creates log directory if missing
- Uses synchronous writes for reliability
- Flushes buffer on process exit
- Renames rotated files to filename.timestamp.log
- Keeps last 5 rotated files

**FetchWriter:**
- POSTs log entries to API endpoint
- Batches entries (2-second interval or 50 entries)
- Uses sendBeacon for unload scenarios
- Includes retry logic with exponential backoff
- Used by browser client

### 3.3 Logger Factory

Implement in packages/shared/src/logging/logger.ts.

**Factory Parameters:**
- source: the source identifier for all logs
- writers: array of writer instances
- minLevel: minimum level to log
- defaultMetadata: object merged into all entries

**Logger Methods:**

Standard levels:
- debug(message: string, metadata?: object): void
- info(message: string, metadata?: object): void
- warn(message: string, metadata?: object): void
- error(message: string, metadata?: object): void
- fatal(message: string, metadata?: object): void

Function tracking:
- functionEnter(name: string, args?: object): void
- functionExit(name: string, result?: unknown, duration?: number): void
- functionError(name: string, error: Error, duration?: number): void

HTTP tracking:
- httpRequest(method: string, url: string, metadata?: object): void
- httpResponse(status: number, duration: number, metadata?: object): void

Specialized:
- stateChange(store: string, action: string, prev: unknown, next: unknown): void
- dbQuery(query: string, paramCount: number, duration: number, rowsAffected: number): void
- authEvent(event: string, userId?: string, metadata?: object): void
- buildStart(type: string, environment: string): void
- buildComplete(success: boolean, duration: number, metadata?: object): void
- buildError(error: Error, metadata?: object): void
- gitCommit(hash: string, message: string, filesChanged: number): void
- gitPush(branch: string, remote: string, commits: number): void
- gitError(operation: string, error: Error): void

Context management:
- child(metadata: object): Logger
- setContext(metadata: object): void
- withCorrelationId(id: string): Logger
- timed<T>(name: string, fn: () => Promise<T>): Promise<T>

### 3.4 Log File Structure

All logs stored as newline-delimited JSON (NDJSON) in the logs directory:
- logs/server.log - API server logs
- logs/client.log - Browser logs (POSTed to server)
- logs/error.log - Errors from all sources (duplicated for quick access)
- logs/build.log - Build and deployment logs
- logs/git.log - Auto-commit and git operation logs

### 3.5 Log Rotation Configuration

- Maximum file size: 10MB per log file
- Rotation format: filename.YYYY-MM-DDTHH-mm-ss.log
- Keep last 5 rotated files per log type
- Rotation check on each write

---

## Phase 4: Database Schema

### 4.1 Migration Files

Create in migrations/ directory.

**0001_users.sql:**
- id: TEXT PRIMARY KEY
- name: TEXT
- email: TEXT NOT NULL UNIQUE
- emailVerified: INTEGER (0 or 1)
- image: TEXT
- createdAt: TEXT NOT NULL
- updatedAt: TEXT NOT NULL

**0002_sessions.sql:**
- id: TEXT PRIMARY KEY
- userId: TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
- token: TEXT NOT NULL UNIQUE
- expiresAt: TEXT NOT NULL
- ipAddress: TEXT
- userAgent: TEXT
- createdAt: TEXT NOT NULL
- updatedAt: TEXT NOT NULL
- Index on token
- Index on userId

**0003_accounts.sql:**
- id: TEXT PRIMARY KEY
- userId: TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
- accountId: TEXT NOT NULL
- providerId: TEXT NOT NULL
- accessToken: TEXT
- refreshToken: TEXT
- accessTokenExpiresAt: TEXT
- refreshTokenExpiresAt: TEXT
- scope: TEXT
- idToken: TEXT
- createdAt: TEXT NOT NULL
- updatedAt: TEXT NOT NULL
- Index on userId
- Index on (providerId, accountId)

**seed.sql:**
- Test user data for development

### 4.2 Migration Tracking Table

Created automatically by db-migrate script:
- _cloudpilot_migrations table
- Columns: id, filename, applied_at, checksum

---

## Phase 5: Docker Sandbox Environment

### 5.1 Dockerfile

Build a sandboxed development environment in docker/Dockerfile:

- Base image: node:20-slim
- Install system dependencies for Playwright
- Install pnpm globally
- Install Wrangler globally
- Create non-root user "claude" with home directory
- Set working directory /app owned by claude user
- Copy package files and install dependencies as claude user
- Copy source code
- Create logs directory with write permissions
- Expose ports 8787 (API) and 5173 (Web)
- Switch to claude user
- Default command: pnpm dev

### 5.2 docker-compose.yml

Define in docker/docker-compose.yml:

**sandbox service:**
- Build from Dockerfile
- Container name: cloudpilot-sandbox
- User: claude
- Working directory: /app
- Volumes:
  - Source code mounted at /app (delegated consistency)
  - Named volume for node_modules
  - logs directory mounted for persistence
- Ports: 8787:8787, 5173:5173
- Environment: from .env file
- Resource limits: 2 CPU, 4GB memory
- Security options: no-new-privileges
- Read-only root filesystem with tmpfs for /tmp
- Health check: curl localhost:8787/live

**Volumes:**
- node_modules: named volume

**Networks:**
- default: bridge network with internal DNS

---

## Phase 6: API Foundation

### 6.1 API Entry Point

Create apps/api/src/index.ts:
- Initialize Hono app
- Apply global middleware in order
- Mount route handlers
- Export default fetch handler

### 6.2 Type Definitions

**apps/api/src/types/env.d.ts:**
- Cloudflare Workers environment bindings
- D1 database binding as DB
- Environment variables

**apps/api/src/types/context.ts:**
- Extended Hono context with user, session
- Request ID and correlation ID
- Logger instance

### 6.3 Error Types

Create apps/api/src/middleware/error.middleware.ts.

**AppError (base class):**
- message: string
- statusCode: number
- code: string
- details: Record<string, unknown> or undefined

**Specific Errors:**
- NotFoundError: 404, NOT_FOUND
- ValidationError: 400, VALIDATION_ERROR
- UnauthorizedError: 401, UNAUTHORIZED
- ForbiddenError: 403, FORBIDDEN
- ConflictError: 409, CONFLICT
- RateLimitError: 429, RATE_LIMITED

**Error Handler Middleware:**
1. Catches all errors from route handlers
2. Logs error with full context
3. Determines if operational (AppError) or unexpected
4. Returns consistent JSON response
5. Includes request ID for debugging
6. Masks internal details in production

**Error Response Shape:**
- success: false
- error: { code, message, details? }
- meta: { requestId, timestamp }

### 6.4 Logging Middleware

Create apps/api/src/middleware/logging.middleware.ts:
- Generate request ID (nanoid)
- Extract or generate correlation ID from header
- Create request-scoped logger
- Log HTTP request on entry
- Log HTTP response on completion
- Attach logger to context

### 6.5 CORS Middleware

Create apps/api/src/middleware/cors.middleware.ts:
- Allow configured origins
- Allow credentials
- Handle preflight requests

### 6.6 Health Routes

Create apps/api/src/routes/health.routes.ts:
- GET / - Returns service name, version, environment, D1 status
- GET /live - Returns 200 with timestamp
- GET /ready - Returns 200 if D1 accessible, 503 otherwise

### 6.7 Database Client

Create apps/api/src/db/client.ts:
- Helper functions for D1 queries
- Logging wrapper for all queries
- Transaction support

### 6.8 Wrangler Configuration

Create apps/api/wrangler.toml:
- Name: cloudpilot-api
- Main: src/index.ts
- Compatibility date: 2024-01-01
- Compatibility flags: nodejs_compat
- D1 databases binding: DB
- Dev port: 8787
- Environment configs for preview and production

---

## Phase 7: Authentication

### 7.1 Better Auth Configuration

Create auth configuration in apps/api/src/services/auth.ts:
- Database: D1 binding
- Secret: from BETTER_AUTH_SECRET
- Base URL: from BETTER_AUTH_URL
- Session expiry: 7 days
- Session update age: 1 day
- Secure cookies: true in production
- Same site: lax
- Provider: GitHub OAuth

### 7.2 Auth Middleware

Create apps/api/src/middleware/auth.middleware.ts.

**authMiddleware:**
- Runs on all routes
- Extracts session token from cookies
- Validates against database
- Populates user and session on context if valid
- Does not block unauthenticated requests
- Logs auth events

**requireAuth:**
- Runs on protected routes
- Checks if user exists on context
- Returns 401 if not
- Logs unauthorized attempts

### 7.3 Auth Routes

Mount Better Auth handler at /auth/*:
- GET /auth/signin/github - Initiates OAuth
- GET /auth/callback/github - Handles callback
- POST /auth/signout - Destroys session
- GET /auth/session - Returns current session

### 7.4 Auth Proxy for Preview Environments

Create apps/api/src/routes/auth-proxy.routes.ts (production only).

**Problem:** GitHub OAuth requires pre-registered callback URLs, but preview environments have dynamic URLs.

**Solution:**
1. Preview redirects to production /auth-proxy/init with encoded return URL
2. Auth proxy initiates GitHub OAuth with registered callback
3. GitHub redirects to /auth-proxy/callback
4. Auth proxy exchanges code for tokens
5. Creates short-lived transfer token (60 seconds, single-use)
6. Redirects to preview with transfer token
7. Preview calls /auth-proxy/exchange to get session

**Routes:**
- GET /auth-proxy/init - Initiates OAuth, encodes return URL in state
- GET /auth-proxy/callback - Receives GitHub callback, creates transfer token
- POST /auth-proxy/exchange - Exchanges transfer token for session

**Security:**
- Return URLs validated against allowed patterns
- State parameter signed to prevent tampering
- Transfer tokens expire quickly and are single-use

---

## Phase 8: API Routes

### 8.1 Log Routes

Create apps/api/src/routes/log.routes.ts:
- POST /logs - Receive single log entry, write to client.log
- POST /logs/batch - Receive array of entries, write to client.log

### 8.2 User Routes

Create apps/api/src/routes/user.routes.ts (all require auth):
- GET /users/me - Returns current user profile
- PATCH /users/me - Updates name or image
- DELETE /users/me - Deletes user and associated data

### 8.3 User Service

Create apps/api/src/services/user.service.ts:
- getUser(id): Result<User, NotFoundError>
- updateUser(id, data): Result<User, ValidationError | NotFoundError>
- deleteUser(id): Result<void, NotFoundError>

### 8.4 Log Service

Create apps/api/src/services/log.service.ts:
- writeLog(entry): Result<void, Error>
- writeLogs(entries): Result<void, Error>
- Uses FileWriter to write to appropriate log file

---

## Phase 9: Frontend Foundation

### 9.1 Vite Configuration

Create apps/web/vite.config.ts:
- Plugins: react
- Resolve alias: @cloudpilot/shared
- Server port: 5173
- Server proxy: /api to http://localhost:8787
- Build: SSR manifest enabled
- SSR entry: src/entry-server.tsx

### 9.2 Entry Points

**apps/web/src/entry-client.tsx:**
- Hydrate React app on client
- Initialize client logger
- Set up error boundary

**apps/web/src/entry-server.tsx:**
- Render React app to string
- Handle SSR for Pages functions

### 9.3 HTML Template

Create apps/web/index.html:
- Root div for React
- Script tags for client entry
- Meta tags for viewport, charset

### 9.4 Pages Function

Create apps/web/functions/[[path]].ts:
- Catch-all handler for SSR
- Renders app and returns HTML

### 9.5 Global Styles

Create apps/web/src/styles/global.css:
- CSS reset
- Base typography
- CSS variables for theming

---

## Phase 10: State Management

### 10.1 Client Logger

Create apps/web/src/lib/logger.ts:
- Uses FetchWriter to POST logs to API
- Batches logs (2 seconds or 50 entries)
- Flushes on unload and visibility change
- Captures uncaught errors
- Captures unhandled rejections
- Includes page URL, user agent, viewport

### 10.2 Auth Store

Create apps/web/src/lib/store.ts using Zustand.

**State:**
- user: User | null
- session: Session | null
- isLoading: boolean
- error: string | null

**Actions:**
- setUser(user): void
- setSession(session): void
- setLoading(loading): void
- setError(error): void
- reset(): void
- login(): void (redirects to OAuth)
- logout(): Promise<void>
- fetchSession(): Promise<void>

**Initialization:**
- Automatically calls fetchSession on creation

### 10.3 Logging Middleware

Create Zustand middleware that logs state changes:
- Intercepts all state updates
- Logs previous and next state
- Redacts sensitive fields
- Uses client logger

### 10.4 Selector Hooks

Export convenience hooks:
- useUser(): User | null
- useSession(): Session | null
- useIsAuthenticated(): boolean
- useIsAuthLoading(): boolean
- useAuthError(): string | null
- useAuthActions(): { login, logout, fetchSession }

---

## Phase 11: Frontend Components

### 11.1 Error Boundary

Create apps/web/src/components/ErrorBoundary.tsx:
- Catches rendering errors
- Logs errors to client logger
- Displays fallback UI
- Provides retry mechanism

### 11.2 App Component

Create apps/web/src/App.tsx:
- Router setup
- Error boundary wrapper
- Auth state initialization

### 11.3 Pages

**apps/web/src/pages/Home.tsx:**
- Landing page
- Login button if unauthenticated
- Redirect to dashboard if authenticated

**apps/web/src/pages/Dashboard.tsx:**
- Protected route
- User profile display
- Logout button

**apps/web/src/pages/Logs.tsx (optional):**
- Log viewer component
- Filter controls
- Real-time updates

### 11.4 Log Viewer Component (optional)

Create apps/web/src/components/LogViewer.tsx:
- Fetches logs from API or reads from state
- Filters by level, source, time
- Displays formatted entries
- Auto-scrolls for new entries

---

## Phase 12: CLI Scripts

### 12.1 Database Migration Script

Create scripts/db-migrate.ts.

**Commands:**
- status: Show applied and pending migrations
- up: Apply all pending migrations
- up --step N: Apply next N migrations
- down: Rollback last migration (requires down.sql)
- create NAME: Create new migration file
- seed: Run seed.sql

**Arguments:**
- --env, -e: Environment (local, preview, production)
- --dry-run: Show SQL without executing
- --verbose: Show each statement

**Migration Tracking:**
- Tracks in _cloudpilot_migrations table
- Stores filename, applied_at, checksum
- Prevents re-running modified migrations

### 12.2 Log Query Script

Create scripts/query-logs.ts.

**Arguments:**
- --file, -f: Log file (server, client, error, build, git, or path)
- --level, -l: Filter by level
- --source, -s: Filter by source
- --since: Start time (ISO 8601 or relative: 1h, 30m, 7d)
- --until: End time
- --correlation-id, -c: Filter by correlation ID
- --request-id, -r: Filter by request ID
- --user-id, -u: Filter by user ID
- --search, -q: Text search in message
- --metadata: JSON path query
- --limit, -n: Maximum results (default 100)
- --follow, -F: Tail mode (poll every 500ms)
- --format: Output (json, pretty, compact)
- --stats: Show statistics instead of entries

### 12.3 Log Pruning Script

Create scripts/prune-logs.ts.

**Arguments:**
- --dry-run: Show what would be deleted
- --file, -f: Specific file to prune
- --older-than: Age threshold
- --max-size: Force rotation if exceeded
- --keep-rotated: Number of rotated files to keep

**Default Retention:**
- debug: 24 hours
- info: 7 days
- warn: 30 days
- error, fatal: 90 days

### 12.4 Auto-Commit Script

Create scripts/auto-commit.ts.

**Behavior:**
- Watch all files except: node_modules, .git, dist, logs, coverage, .wrangler
- Batch changes over 30-second window
- Stage all changed files when window closes
- Generate descriptive commit message
- Log commits to git.log

**Commit Message Format:**
- Single file: "chore(auto): update path/to/file.ts"
- 2-5 files: "chore(auto): update file1.ts, file2.ts, file3.ts"
- 6+ files: "chore(auto): update N files in src/routes, src/services"
- Skip if only lockfiles changed

**Arguments:**
- --interval: Batch window seconds (default: 30)
- --exclude: Additional patterns to exclude
- --dry-run: Log without committing
- --verbose: Log file change events

---

## Phase 13: Git Hooks

### 13.1 Lefthook Configuration

Create lefthook.yml.

**pre-commit:**
- Run Biome check on staged files
- Run TypeScript in noEmit mode on staged files
- Block commit if either fails

**pre-push:**
- Run full Vitest test suite
- Run Playwright E2E tests
- Run production build
- Block push if any fails

**commit-msg:**
- Validate conventional commit format
- Pattern: type(scope): description
- Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Scope optional, lowercase alphanumeric with hyphens
- Description starts lowercase, no period, max 72 chars
- Block if invalid

---

## Phase 14: Testing

### 14.1 Test Configuration

**vitest.config.ts:**
- Test environment: node
- Include: **/*.test.ts
- Exclude: node_modules, dist, e2e
- Coverage provider: v8
- Coverage thresholds: 80% all metrics
- Setup files: vitest.setup.ts

**vitest.workspace.ts:**
- packages/shared: node environment
- apps/api: node with miniflare for D1
- apps/web: jsdom for React

**playwright.config.ts:**
- Test directory: tests/e2e
- Base URL: http://localhost:5173
- Timeout: 30 seconds
- Retries: 2 in CI, 0 locally
- Workers: 1
- Web server: pnpm dev
- Projects: chromium only
- Screenshots: on failure
- Trace: on first retry

### 14.2 Unit Tests

**packages/shared tests:**
- Result type: constructors, guards, transformations, combinators
- Functional utilities: pipe, compose, memoize, debounce, collections
- Validation: each validator with valid/invalid inputs, combinators
- Logger: entry formatting, level filtering, child loggers

**apps/api tests:**
- Route handlers: mock D1 and context, success and error paths
- Middleware: test in isolation
- Services: mock dependencies, test business logic
- Error classes: status codes and serialization

**apps/web tests:**
- Components: React Testing Library
- Store: actions, state transitions, selectors
- Client logger: batching, flush behavior

### 14.3 Integration Tests

- API routes with local D1
- Auth middleware with mocked sessions
- Log routes write to temp files
- Middleware chains
- Error handler formatting

### 14.4 E2E Tests

Create tests/e2e/ directory:
- auth.spec.ts: login, session persistence, logout
- protected.spec.ts: redirect when unauthenticated
- error.spec.ts: error boundary catches errors

---

## Phase 15: CI/CD Workflows

### 15.1 CI Workflow

Create .github/workflows/ci.yml.

**Triggers:** Pull request to any branch

**Jobs:**

**lint:**
- Checkout, setup Node 20, setup pnpm
- Install dependencies
- Run Biome lint and format
- Run TypeScript type check

**test (depends on lint):**
- Run Vitest with coverage
- Upload coverage artifact

**e2e (depends on lint):**
- Install Playwright browsers
- Start dev servers
- Run Playwright tests
- Upload results artifact

### 15.2 Preview Deploy Workflow

Create .github/workflows/deploy-preview.yml.

**Triggers:** Push to any branch except main

**Jobs:**

**deploy:**
- Run CI checks
- Generate preview name from branch
- Deploy API to Workers preview
- Deploy Web to Pages preview
- Comment preview URLs on PR
- Log to git.log

### 15.3 Production Deploy Workflow

Create .github/workflows/deploy-production.yml.

**Triggers:** Push to main

**Jobs:**

**deploy:**
- Run CI checks
- Wait for manual approval (environment protection)
- Run D1 migrations
- Deploy API to Workers production
- Deploy Web to Pages production
- Create GitHub release
- Log to git.log

---

## Environment Variables

**Required:**
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- D1_DATABASE_ID
- BETTER_AUTH_SECRET (32+ characters)
- BETTER_AUTH_URL
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET

**Production Only:**
- AUTH_PROXY_SECRET

**Optional:**
- NODE_ENV (development, preview, production)
- LOG_LEVEL (debug, info, warn, error)
- LOG_MAX_SIZE (default: 10MB)
- LOG_RETENTION_DAYS

---

## Key Implementation Principles

1. **All functions return Result types** - No throwing except at entry points. Wrap external calls with tryCatchAsync.

2. **Comprehensive logging** - Every significant operation logs. Include correlation IDs to trace flows.

3. **Immutable data** - Never mutate. Use spread operators and methods returning new collections.

4. **Type safety throughout** - Strict TypeScript, no explicit any. Define types for all structures.

5. **Functional composition** - Use pipe and pipeAsync for multi-step operations.

6. **Validate at boundaries** - Validate external input at API entry points.

7. **Fail fast with context** - Include enough context in errors to debug without searching.

8. **No secrets in code** - All secrets from environment variables.

---

## Success Criteria

The template is complete when:

1. pnpm install completes without errors
2. pnpm dev starts API on 8787 and Web on 5173
3. pnpm lint passes with no errors
4. pnpm typecheck passes with no errors
5. pnpm test passes with 80%+ coverage
6. pnpm test:e2e passes all tests
7. pnpm build creates production builds
8. Docker sandbox starts and runs dev environment
9. GitHub OAuth works end-to-end
10. Logs appear in JSON files and are queryable
11. scripts/query-logs.ts can search and tail logs
12. scripts/auto-commit.ts batches and commits changes
13. scripts/db-migrate.ts applies migrations
14. CI workflow passes on pull requests
15. Preview deploys create working environments
16. Production deploy requires approval and succeeds
17. Claude Code can autonomously develop, test, and deploy
