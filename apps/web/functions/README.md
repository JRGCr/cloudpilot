# Cloudflare Pages Functions - API Implementation

This directory contains the API implementation as Cloudflare Pages Functions. This architecture solves the OAuth state_mismatch error by serving both the web app and API from the same domain.

## Why Pages Functions?

**Problem**: The previous architecture had the web app on `cloudpilot-web.pages.dev` and API on `cloudpilot-api.blackbaysolutions.workers.dev` - different domains. This caused OAuth cookies to be blocked due to cross-origin restrictions.

**Solution**: Move the API to Pages Functions so everything runs on `cloudpilot-web.pages.dev`:
- Web app: `cloudpilot-web.pages.dev/`
- API: `cloudpilot-web.pages.dev/api/`
- Same-origin = cookies work perfectly!

## Directory Structure

```
functions/
  api/
    auth/
      [[path]].ts       # Handles all /api/auth/* routes (Better Auth)
    logs/
      batch.ts          # POST /api/logs/batch
    users/
      me.ts            # GET/PATCH/DELETE /api/users/me
    health.ts          # GET /api/health
```

## Pages Functions vs Workers

Key differences:
- **Export pattern**: Use `onRequest`, `onRequestGet`, `onRequestPost`, etc.
- **Context object**: Receive `{ request, env, params, waitUntil, next, data }`
- **File-based routing**: File path determines URL (e.g., `api/health.ts` → `/api/health`)
- **D1 access**: Same D1 bindings as Workers, configured in wrangler.toml

## Environment Variables

Set in Cloudflare Pages Settings or `.dev.vars` (local):

- `BETTER_AUTH_SECRET` - Auth secret (min 32 chars)
- `BETTER_AUTH_URL` - Full URL to auth endpoint (e.g., `https://cloudpilot-web.pages.dev/api/auth`)
- `GITHUB_CLIENT_ID` - GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth app secret
- `NODE_ENV` - Environment (development/production)
- `DB` - D1 database binding (auto-configured from wrangler.toml)

## Local Development

```bash
# Install dependencies
cd apps/web
npm install

# Start Pages Functions dev server
npx wrangler pages dev dist --port 8788

# Or use the Vite dev server which proxies to functions
npm run dev
```

## Deployment

Pages Functions are automatically deployed with the Pages project:

```bash
cd apps/web
npm run build
npx wrangler pages deploy dist
```

## GitHub OAuth Configuration

Update your GitHub OAuth app:
1. Go to https://github.com/settings/developers
2. Update Authorization callback URL:
   - Production: `https://cloudpilot-web.pages.dev/api/auth/callback/github`
   - Preview: `https://[preview-url].pages.dev/api/auth/callback/github`
   - Local: `http://localhost:8788/api/auth/callback/github`

## Migration Notes

All API functionality from the Workers deployment has been migrated to Pages Functions:

1. **Better Auth** - Handles all `/api/auth/*` routes including OAuth callbacks
2. **Health checks** - Simple database connectivity check at `/api/health`
3. **User management** - Protected routes at `/api/users/me`
4. **Log ingestion** - Client log collection at `/api/logs/batch`

The original Workers API (`apps/api/`) is kept for reference but no longer deployed.
