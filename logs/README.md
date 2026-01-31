# CloudPilot Logs

This directory contains JSON log files for Claude Code to monitor and analyze application behavior.

## Log Files

| File | Description |
|------|-------------|
| `server.log` | API server logs (requests, responses, errors) |
| `client.log` | Browser client logs (POSTed from frontend) |
| `error.log` | Errors from all sources (duplicated for quick access) |
| `build.log` | Build and deployment logs |
| `git.log` | Auto-commit and git operation logs |

## Format

All logs are stored as newline-delimited JSON (NDJSON). Each line is a valid JSON object with the following structure:

```json
{
  "id": "unique-nanoid",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "source": "server",
  "message": "HTTP request received",
  "correlationId": "optional-correlation-id",
  "requestId": "optional-request-id",
  "userId": "optional-user-id",
  "metadata": {},
  "duration": 123,
  "error": {
    "name": "Error",
    "message": "Something went wrong",
    "stack": "..."
  }
}
```

## Querying Logs

Use the `query-logs` script to search and filter logs:

```bash
# View recent server logs
pnpm logs:query --file server --limit 50

# Filter by level
pnpm logs:query --file server --level error

# Search in messages
pnpm logs:query --file server --search "authentication"

# Filter by time range
pnpm logs:query --file server --since 1h

# Follow mode (tail)
pnpm logs:query --file server --follow
```

## Log Rotation

- Maximum file size: 10MB per log file
- Rotated files: `filename.YYYY-MM-DDTHH-mm-ss.log`
- Retention: Last 5 rotated files per log type

Use the `prune-logs` script to manage log retention:

```bash
# Preview what would be deleted
pnpm logs:prune --dry-run

# Prune logs older than 7 days
pnpm logs:prune --older-than 7d
```

## Default Retention Policy

| Level | Retention |
|-------|-----------|
| debug | 24 hours |
| info | 7 days |
| warn | 30 days |
| error | 90 days |
| fatal | 90 days |

## Git Ignore

Log files (except `.gitkeep` and `README.md`) are ignored by git. This ensures logs are not committed to the repository while the directory structure is preserved.
