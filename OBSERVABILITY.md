# CloudPilot Observability Implementation

This document describes the comprehensive observability enhancements implemented in CloudPilot for maximum development and operational visibility.

## Overview

CloudPilot now features extensive file-based logging that captures every aspect of the application's behavior in structured NDJSON format. All logs are written to dedicated files in the `./logs` directory and include correlation IDs for request tracing.

## Log File Structure

### Core Application Logs

| File | Purpose | Content |
|------|---------|---------|
| `logs/requests.log` | HTTP Request Lifecycle | Complete request/response cycle with timing, headers, IP addresses, user agents |
| `logs/database.log` | Database Operations | SQL queries, execution times, row counts, performance warnings |
| `logs/auth.log` | Authentication Flow | Session validation, login attempts, authorization checks, OAuth flow |
| `logs/errors-detailed.log` | Error Tracking | Detailed error context, stack traces, system state, memory usage |
| `logs/performance.log` | Performance Metrics | Operation timing, memory usage, slow operation alerts |

### Additional Log Files (Ready for Implementation)

- `logs/api-endpoints.log` - Per-endpoint performance tracking
- `logs/background-jobs.log` - Async task processing
- `logs/react-components.log` - Component lifecycle events
- `logs/builds.log` - Build process timing and results
- `logs/tests.log` - Test execution results

## Implementation Details

### 1. Enhanced Request/Response Logging

**File**: `apps/api/src/middleware/logging.middleware.ts`

**Features**:
- Complete HTTP request lifecycle tracking
- IP address extraction (CF-Connecting-IP, X-Forwarded-For)
- User agent tracking
- Request/response header logging (sanitized)
- Body size tracking
- Response timing with slow request alerts (>2s)
- Query parameter logging

**Sample Log Entry**:
```json
{
  "id": "abc123",
  "timestamp": "2026-02-01T22:00:00.000Z",
  "level": "info",
  "source": "server",
  "message": "Request completed: GET /api/users 200",
  "correlationId": "req-xyz789",
  "requestId": "req-abc123",
  "metadata": {
    "request": {
      "method": "GET",
      "path": "/api/users",
      "query": "?page=1&limit=10",
      "userAgent": "Mozilla/5.0...",
      "ipAddress": "192.168.1.1",
      "bodySize": 0
    },
    "response": {
      "status": 200,
      "size": 1024,
      "headers": { "content-type": "application/json" }
    },
    "timing": {
      "duration": 150,
      "slow": false
    }
  }
}
```

### 2. Database Operation Logging

**File**: `apps/api/src/db/client.ts`

**Features**:
- Every SQL query with execution timing
- Parameter sanitization (truncates long strings)
- Row count tracking
- Slow query detection and alerts
- Query type classification (SELECT, INSERT, etc.)
- Correlation ID propagation

**Sample Log Entry**:
```json
{
  "id": "db456",
  "timestamp": "2026-02-01T22:00:00.000Z",
  "level": "info",
  "source": "database",
  "message": "Database query completed",
  "correlationId": "req-xyz789",
  "metadata": {
    "database": {
      "queryId": "q789abc",
      "operation": "SELECT",
      "status": "completed",
      "rowsReturned": 25,
      "duration": 45,
      "performance": {
        "slow": false,
        "veryslow": false
      }
    }
  }
}
```

### 3. Authentication Flow Logging

**File**: `apps/api/src/middleware/auth.middleware.ts`

**Features**:
- Session validation timing
- Authentication step tracking
- Authorization checks
- Failed login attempt logging
- User context tracking
- IP and user agent correlation

**Sample Log Entry**:
```json
{
  "id": "auth789",
  "timestamp": "2026-02-01T22:00:00.000Z",
  "level": "info",
  "source": "auth",
  "message": "Session validation successful",
  "correlationId": "req-xyz789",
  "metadata": {
    "auth": {
      "step": "session_validation_success",
      "userId": "user123",
      "userEmail": "user@example.com",
      "sessionId": "sess456",
      "duration": 25,
      "ipAddress": "192.168.1.1"
    }
  }
}
```

### 4. Error Tracking

**File**: `apps/api/src/middleware/error.middleware.ts`

**Features**:
- Complete error context capture
- System state at error time
- Memory usage snapshots
- Request context preservation
- Critical vs. application error classification
- Stack trace inclusion (development mode)

**Sample Log Entry**:
```json
{
  "id": "err999",
  "timestamp": "2026-02-01T22:00:00.000Z",
  "level": "error",
  "source": "server",
  "message": "Unexpected system error",
  "correlationId": "req-xyz789",
  "metadata": {
    "error": {
      "type": "unexpected",
      "name": "TypeError",
      "message": "Cannot read property 'id' of undefined",
      "stack": "TypeError: Cannot read property...",
      "critical": true
    },
    "request": {
      "method": "POST",
      "path": "/api/users",
      "userId": "user123",
      "duration": 250,
      "ipAddress": "192.168.1.1"
    },
    "system": {
      "memory": {
        "rss": 52428800,
        "heapUsed": 25165824,
        "heapTotal": 33554432,
        "external": 1048576
      },
      "uptime": 3600
    }
  }
}
```

### 5. Performance Timing

**File**: `apps/api/src/utils/performance-logger.ts`

**Features**:
- Operation timing with memory tracking
- Checkpoint logging for complex operations
- Slow operation alerts
- Memory growth detection
- Performance baseline establishment

## Usage Examples

### Querying Logs

```bash
# View recent requests
pnpm logs:query --file requests --limit 50

# Filter errors by level
pnpm logs:query --file errors-detailed --level error

# Search auth events
pnpm logs:query --file auth --search "session_validation"

# View slow database queries
pnpm logs:query --file database --search "slowQueryAlert"

# Follow performance logs in real-time
pnpm logs:query --file performance --follow

# Filter by correlation ID
pnpm logs:query --file requests --correlation-id req-xyz789
```

### Performance Tracking in Code

```typescript
import { PerformanceTracker, trackPerformance } from './utils/performance-logger';

// Method 1: Using PerformanceTracker class
const tracker = new PerformanceTracker('user-creation', correlationId, requestId);
tracker.checkpoint('validation-complete');
tracker.checkpoint('database-insert-complete');
const metrics = tracker.end({ userId: newUser.id });

// Method 2: Using trackPerformance utility
const result = await trackPerformance(
  'expensive-operation',
  async () => {
    // Your operation here
    return await complexCalculation();
  },
  correlationId,
  requestId
);
```

## Log Correlation

Every log entry includes correlation IDs that allow tracing a single request across all services:

- **correlationId**: Tracks requests across service boundaries
- **requestId**: Unique identifier for each HTTP request
- **userId**: Links logs to specific users (when authenticated)

## Monitoring and Alerting

The logs include structured metadata that enables:

- **Performance monitoring**: Slow operation detection
- **Error rate tracking**: Application vs. system error classification
- **Memory leak detection**: Memory growth pattern analysis
- **Security monitoring**: Failed auth attempts, IP tracking
- **Capacity planning**: Request volume and performance trends

## File Rotation and Retention

- **Maximum file size**: 10MB per log file
- **Rotation naming**: `filename.YYYY-MM-DDTHH-mm-ss.log`
- **Retention**: Last 5 rotated files per type
- **Cleanup**: Automated via `prune-logs` script

## Next Phase Implementations

This foundation enables easy addition of:

- Frontend component lifecycle logging
- Build process monitoring
- Test execution tracking
- Real-time WebSocket event logging
- Third-party API interaction monitoring
- Resource usage trending
- Business metric correlation

The observability infrastructure is now in place to provide complete visibility into CloudPilot's operation and performance.