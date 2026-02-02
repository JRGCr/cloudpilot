# Cloudflare Observability Implementation

This document describes the comprehensive Cloudflare-specific observability system implemented for CloudPilot, covering Pages Functions, Workers, and D1 database operations.

## Overview

CloudPilot now features extensive Cloudflare-native logging that captures every aspect of the Cloudflare infrastructure behavior including:

- **Cloudflare Pages Functions** - Authentication, health checks, and API endpoints
- **Cloudflare Workers** - Main API worker invocations and performance  
- **D1 Database Operations** - All SQL queries, transactions, and performance metrics
- **Cloudflare Analytics** - Request patterns, geographic data, and performance insights

All logs are written to both console (captured by Cloudflare) and dedicated files in structured NDJSON format with correlation IDs.

## Log File Structure

### Cloudflare-Specific Log Files

| File | Purpose | Content |
|------|---------|---------|
| `logs/cloudflare-pages.log` | Pages Functions Activity | Function invocations, auth flows, health checks, performance timing |
| `logs/cloudflare-workers.log` | Worker Invocations | Request handling, memory usage, CPU time, response metrics |
| `logs/cloudflare-d1.log` | D1 Database Operations | SQL queries, batch operations, performance, errors |
| `logs/cloudflare-analytics.log` | Analytics & Insights | Geographic data, performance trends, usage patterns |

## Implementation Details

### 1. Cloudflare Pages Functions Observability

**Files Enhanced:**
- `/apps/web/functions/api/auth/[[path]].ts` - Better Auth handler
- `/apps/web/functions/api/health.ts` - Health check endpoint

**Features:**
- Complete request lifecycle tracking with CF-specific context
- Geographic information from CF edge (country, city, colo)
- Better Auth flow detailed logging
- Error route monitoring
- Response timing and performance metrics
- Cookie and session tracking

**Sample Log Entry:**
```json
{
  "id": "abc123",
  "timestamp": "2026-02-02T00:00:00.000Z",
  "level": "info", 
  "source": "pages",
  "message": "Pages Function: POST /api/auth/sign-in/social",
  "correlationId": "req-xyz789",
  "requestId": "req-abc123",
  "cf": {
    "colo": "SJC",
    "country": "US",
    "city": "San Francisco",
    "region": "California"
  },
  "pages": {
    "environment": "production",
    "functionName": "auth-handler"
  },
  "request": {
    "method": "POST",
    "url": "/api/auth/sign-in/social",
    "path": "/api/auth/sign-in/social",
    "userAgent": "Mozilla/5.0...",
    "ip": "192.168.1.1"
  },
  "timing": {
    "duration": 150,
    "slow": false,
    "verySlow": false
  },
  "metadata": {
    "auth": {
      "step": "request_received",
      "hasAuthorizationHeader": false,
      "hasCookieHeader": true
    }
  }
}
```

### 2. Cloudflare Workers Observability

**Files Enhanced:**
- `/apps/api/src/index.ts` - Main worker entry point
- `/apps/api/src/types/context.ts` - Added worker logger to context

**Features:**
- Worker invocation tracking with unique invocation IDs
- Request performance monitoring
- Memory usage tracking
- Error handling and recovery
- CPU time measurement (where available)
- Subrequest identification

**Sample Log Entry:**
```json
{
  "id": "wkr456",
  "timestamp": "2026-02-02T00:00:00.000Z",
  "level": "info",
  "source": "worker", 
  "message": "Worker Invocation: cloudpilot-api",
  "correlationId": "req-xyz789",
  "cf": {
    "colo": "LAX",
    "country": "US"
  },
  "worker": {
    "name": "cloudpilot-api",
    "invocationId": "inv-1643760000123",
    "memoryUsage": 25165824,
    "cpuTime": 45
  },
  "timing": {
    "duration": 200,
    "cpuTime": 45,
    "slow": false,
    "verySlow": false
  },
  "metadata": {
    "worker": {
      "step": "invocation_success",
      "responseStatus": 200
    }
  }
}
```

### 3. D1 Database Observability

**Files Enhanced:**
- `/apps/api/src/db/client.ts` - Database client with CF logging
- `/packages/shared/src/logging/cloudflare-logger.ts` - D1-specific logging

**Features:**
- Every SQL query with execution timing
- Parameter sanitization and tracking
- Row count and change tracking
- Slow query detection and alerting
- Batch operation monitoring
- Transaction tracking (with D1 limitations noted)
- Error context with SQL statement

**Sample Log Entry:**
```json
{
  "id": "d1_789",
  "timestamp": "2026-02-02T00:00:00.000Z", 
  "level": "info",
  "source": "d1",
  "message": "D1 Query: SELECT",
  "correlationId": "req-xyz789",
  "d1": {
    "database": "cloudpilot",
    "operation": "query",
    "sql": "SELECT * FROM users WHERE email = ? LIMIT 1",
    "params": 1,
    "rowsAffected": 0,
    "rowsReturned": 1,
    "duration": 45,
    "success": true
  },
  "timing": {
    "duration": 45,
    "slow": false,
    "verySlow": false
  },
  "metadata": {
    "database": "cloudpilot"
  }
}
```

### 4. Enhanced Logging Utilities

**New CloudflareLogger Class:**
- `createPagesLogger()` - For Pages Functions
- `createWorkerLogger()` - For Workers  
- `createD1Logger()` - For D1 operations

**Key Methods:**
- `pagesRequest()` / `pagesResponse()` - Page function lifecycle
- `workerInvocation()` / `workerPerformance()` - Worker monitoring
- `d1Query()` / `d1BatchOperation()` - Database operations
- `trackPagesFunction()` / `trackWorkerOperation()` - Performance tracking

## Usage Examples

### Pages Function Logging

```typescript
import { createPagesLogger } from '@cloudpilot/shared/logging/cloudflare-logger';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const logger = createPagesLogger(env, request, 'my-function');
  
  logger.pagesRequest(request, { step: 'function_start' });
  
  try {
    // Your function logic
    const result = await logger.trackPagesFunction('my-operation', async () => {
      return await doSomething();
    });
    
    logger.pagesResponse(new Response(JSON.stringify(result)), Date.now() - start);
    return response;
  } catch (error) {
    logger.pagesError(error, request);
    throw error;
  }
};
```

### Worker Logging

```typescript
import { createWorkerLogger } from '@cloudpilot/shared/logging/cloudflare-logger';

app.use('*', async (c, next) => {
  const workerLogger = createWorkerLogger(c.env, c.req.raw);
  c.set('workerLogger', workerLogger);
  
  workerLogger.workerInvocation('my-worker', `inv-${Date.now()}`);
  
  await next();
  
  workerLogger.workerPerformance('request-handling', duration);
});
```

### D1 Database Logging

```typescript
import { query } from '../db/client';

const result = await query(
  db,
  'SELECT * FROM users WHERE id = ?',
  [userId],
  logger,
  workerLogger  // CF logger for enhanced D1 observability
);
```

## Monitoring and Analytics

### Key Metrics Tracked

- **Performance Monitoring**
  - Request/response timing across all CF services
  - Slow operation detection (>1s Pages, >5s Workers, >100ms D1)
  - Memory usage patterns in Workers

- **Error Tracking**
  - Complete error context with CF location data
  - Auth flow failures and recovery
  - Database errors with SQL context

- **Geographic Insights**
  - Request distribution by Cloudflare edge location
  - User geographic patterns
  - Performance by region

- **Resource Usage**
  - Worker CPU time and memory consumption
  - D1 query patterns and optimization opportunities
  - Pages Function execution efficiency

### Log Correlation

All Cloudflare logs include comprehensive correlation:
- **correlationId** - Traces requests across Pages/Workers/D1
- **requestId** - Unique identifier per HTTP request
- **cf.colo** - Cloudflare edge location for geographic analysis
- **invocationId** - Worker-specific execution tracking

## Query and Analysis

### Real-time Monitoring

```bash
# Monitor Pages Functions
tail -f logs/cloudflare-pages.log | jq -r '.message'

# Watch D1 slow queries
tail -f logs/cloudflare-d1.log | jq -r 'select(.timing.slow == true)'

# Monitor Worker performance
tail -f logs/cloudflare-workers.log | jq -r 'select(.timing.duration > 1000)'

# Track errors across all Cloudflare services
tail -f logs/cloudflare-*.log | jq -r 'select(.level == "error")'
```

### Analytics Queries

```bash
# Top 10 slowest operations by service
cat logs/cloudflare-*.log | jq -s 'sort_by(.timing.duration) | reverse | .[0:10]'

# Error rate by Cloudflare edge location
cat logs/cloudflare-*.log | jq -r 'select(.level == "error") | .cf.colo' | sort | uniq -c

# D1 query performance analysis
cat logs/cloudflare-d1.log | jq -s 'group_by(.d1.operation) | map({operation: .[0].d1.operation, avg_duration: (map(.d1.duration) | add / length), count: length})'
```

## Integration with Cloudflare Analytics

The logging system captures data compatible with:
- **Cloudflare Analytics API** - For dashboard integration
- **Workers Analytics Engine** - For custom metrics
- **Logpush** - For external analytics platforms
- **Real User Monitoring** - For frontend performance correlation

## Performance Impact

- **Console Logging**: Minimal impact, handled natively by CF
- **File Logging**: Only in development/testing (conditionally enabled)
- **Structured Format**: NDJSON for efficient parsing and analysis
- **Correlation IDs**: Minimal overhead, maximum traceability

The Cloudflare observability system provides complete visibility into your application's performance across the entire Cloudflare stack while maintaining minimal performance overhead.