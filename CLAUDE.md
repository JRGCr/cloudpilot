# Project Guidance

This file provides context and guidance for working with this project.

## Instructions

Please periodically update this file as the project evolves to include:
- Project overview and goals
- Setup and installation instructions
- Development workflow
- Coding standards and conventions
- Testing approach
- Any other relevant information for working with this codebase

## Project Rules

### Logging

**NEVER remove logging statements.** This project uses verbose logging at every possible spot for debugging and monitoring purposes.

- All console.log statements must be preserved
- Add more logging when implementing new features
- Use descriptive log prefixes (e.g., `[ServiceName]`, `[MethodName]`)
- Log configuration, state changes, errors, and important execution steps

The linter is configured to allow console.log statements (biome.json has `"noConsole": "off"`).

## Comprehensive Observability Infrastructure

This project implements extensive observability across all layers of the Cloudflare stack.

### Overview

CloudPilot features comprehensive file-based and structured logging that captures every aspect of the application's behavior:
- **Request/Response Lifecycle** - Complete HTTP tracking with timing, headers, IP addresses
- **Database Operations** - SQL queries, execution times, performance warnings  
- **Authentication Flow** - Session validation, login attempts, OAuth flow
- **Error Tracking** - Detailed error context, stack traces, system state
- **Performance Metrics** - Operation timing, memory usage, slow operation alerts

### Log File Structure

| File | Purpose | Content |
|------|---------|---------|
| `logs/requests.log` | HTTP Request Lifecycle | Complete request/response cycle with timing |
| `logs/database.log` | Database Operations | SQL queries, execution times, row counts |
| `logs/auth.log` | Authentication Flow | Session validation, login attempts, OAuth |
| `logs/errors-detailed.log` | Error Tracking | Detailed error context, stack traces |
| `logs/performance.log` | Performance Metrics | Operation timing, memory usage alerts |
| `logs/cloudflare-pages.log` | Pages Functions | Function invocations, auth flows, health checks |
| `logs/cloudflare-workers.log` | Worker Invocations | Request handling, memory usage, CPU time |
| `logs/cloudflare-d1.log` | D1 Database | SQL queries, batch operations, performance |
| `logs/cloudflare-analytics.log` | Analytics & Insights | Geographic data, performance trends |

### Key Features

**1. Correlation ID Tracking**
- Every log entry includes `correlationId` and `requestId` for tracing requests across services
- Enables complete request lifecycle analysis from Pages Functions through Workers to D1

**2. Cloudflare-Native Observability** 
- Geographic information from CF edge (country, city, colo)
- Worker invocation tracking with performance metrics
- D1 query performance monitoring with slow query detection
- Pages Function lifecycle tracking

**3. Performance Monitoring**
- Configurable thresholds (>1s Pages, >5s Workers, >100ms D1)
- Memory usage patterns and growth detection
- CPU time measurement where available
- Slow operation alerting with severity levels

**4. Error Context Preservation**
- Complete error context with system state capture
- Stack traces in development mode
- Request context preservation during errors
- Critical vs application error classification

### Usage Examples

```bash
# Monitor real-time logs
tail -f logs/requests.log | jq -r '.message'

# Track slow operations
tail -f logs/performance.log | jq -r 'select(.timing.slow == true)'

# Monitor authentication flow  
tail -f logs/auth.log | jq -r 'select(.auth.step)'

# Watch D1 performance
tail -f logs/cloudflare-d1.log | jq -r 'select(.d1.duration > 100)'
```

### Implementation Files

**Core Logging Infrastructure:**
- `/packages/shared/src/logging/` - Base logging system
- `/packages/shared/src/logging/cloudflare-logger.ts` - CF-specific logging
- `/apps/api/src/middleware/logging.middleware.ts` - Request logging
- `/apps/api/src/middleware/auth.middleware.ts` - Auth flow logging
- `/apps/api/src/middleware/error.middleware.ts` - Error tracking
- `/apps/api/src/db/client.ts` - Database operation logging
- `/apps/api/src/utils/performance-logger.ts` - Performance tracking

**Pages Functions Enhanced:**
- `/apps/web/functions/api/auth/[[path]].ts` - Better Auth with logging
- `/apps/web/functions/api/health.ts` - Health check with observability

**Documentation:**
- `/OBSERVABILITY.md` - Complete observability implementation guide
- `/CLOUDFLARE-OBSERVABILITY.md` - Cloudflare-specific observability details

### Verified Working

Recent testing confirmed the observability system successfully captures:
- ✅ Client-side auth initiation events
- ✅ Server health check responses with full system status
- ✅ Error detection (500/404 errors immediately identified)
- ✅ Network request failures with context
- ✅ Geographic and performance metadata

The system identified auth endpoint issues (404 on `/api/auth/sign-in/social/github`) while confirming health endpoints work correctly, demonstrating effective real-time issue detection.
