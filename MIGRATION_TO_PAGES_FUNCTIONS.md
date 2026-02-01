# Migration to Cloudflare Pages Functions

This document explains the migration from Workers + Pages to Pages Functions only.

## Problem Solved

**OAuth state_mismatch Error**: The previous architecture had cross-origin cookie issues because:
- Web app: `cloudpilot-web.pages.dev`
- API: `cloudpilot-api.blackbaysolutions.workers.dev`

Modern browsers block third-party cookies, causing Better Auth OAuth flow to fail with "State mismatch: State not persisted correctly".

## Solution

Move the API to Cloudflare Pages Functions so everything runs on the same domain:
- Web app: `cloudpilot-web.pages.dev/`
- API: `cloudpilot-web.pages.dev/api/` ✅ Same origin!

## Changes Made

### 1. New Pages Functions (`apps/web/functions/`)

Created API endpoints as Pages Functions:
- `api/auth/[[path]].ts` - Better Auth handler (all /api/auth/* routes)
- `api/health.ts` - Health check endpoint
- `api/logs/batch.ts` - Log ingestion
- `api/users/me.ts` - User management

### 2. Updated Web App Configuration

**`apps/web/src/lib/config.ts`**:
```typescript
// Before:
apiUrl: 'https://cloudpilot-api.blackbaysolutions.workers.dev'

// After:
apiUrl: '/api'  // Same-origin!
```

**`apps/web/src/lib/auth-client.ts`**:
```typescript
// Before:
baseURL: 'https://cloudpilot-api.blackbaysolutions.workers.dev/auth'

// After:
baseURL: '/api/auth'  // Same-origin!
```

### 3. Environment Variables

**New Location**: Set in Cloudflare Pages settings or `apps/web/.dev.vars`

**Updated Variables**:
- `BETTER_AUTH_URL`: Now `https://cloudpilot-web.pages.dev/api/auth` (was on workers.dev)
- `TRUSTED_ORIGINS`: No longer needed for same-origin setup (kept for compatibility)

**Required Variables**:
- `BETTER_AUTH_SECRET` - Auth secret (min 32 chars)
- `BETTER_AUTH_URL` - Full auth endpoint URL
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth secret
- `NODE_ENV` - Environment (development/production)

### 4. Database Binding

**`apps/web/wrangler.toml`**:
```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudpilot"
database_id = "74e356ad-42c2-4806-b2b7-c7f4850261a2"
```

Same D1 database, now accessed from Pages Functions instead of Workers.

### 5. Deployment Workflow

**`.github/workflows/deploy-production.yml`**:
- ❌ Removed Workers API deployment
- ✅ Pages deployment now includes Functions automatically
- ✅ Migrations run from `apps/web` instead of `apps/api`
- ✅ Environment variables set via Pages secrets

### 6. GitHub OAuth App Configuration

**IMPORTANT**: Update GitHub OAuth app callback URLs:

1. Go to https://github.com/settings/developers
2. Select your OAuth app
3. Update **Authorization callback URL**:
   - Production: `https://cloudpilot-web.pages.dev/api/auth/callback/github`
   - Preview: `https://[branch].cloudpilot-web.pages.dev/api/auth/callback/github`
   - Local: `http://localhost:8788/api/auth/callback/github`

## Local Development

### Before:
```bash
# Terminal 1: API
cd apps/api
npm run dev  # Port 8787

# Terminal 2: Web
cd apps/web
npm run dev  # Port 5173
```

### After:
```bash
# Single terminal
cd apps/web
npm run dev  # Port 5173, includes Pages Functions
```

Or for Pages Functions dev server:
```bash
cd apps/web
npm run build
npx wrangler pages dev dist --port 8788
```

## Production Deployment

### Before:
1. Deploy Workers API to `cloudpilot-api.blackbaysolutions.workers.dev`
2. Deploy Pages to `cloudpilot-web.pages.dev`
3. Configure CORS
4. Deal with cross-origin cookie issues

### After:
1. Deploy Pages (includes Functions automatically) to `cloudpilot-web.pages.dev`
2. Done! No CORS, cookies work perfectly.

## Verification

After deployment, verify:

1. **Health check**: Visit `https://cloudpilot-web.pages.dev/api/health`
   - Should return `{"success":true, "deployment":"pages-functions"}`

2. **OAuth flow**:
   - Navigate to the app
   - Click "Sign in with GitHub"
   - Should redirect to GitHub
   - After auth, should redirect back and be logged in ✅
   - No "state_mismatch" errors!

3. **Session persistence**:
   - Refresh the page
   - Should stay logged in
   - Check DevTools → Application → Cookies
   - Should see `cloudpilot_session` cookie on `cloudpilot-web.pages.dev` domain

## Rollback Plan

If issues arise:

1. The old Workers API (`apps/api/`) still exists in the codebase
2. Revert changes to:
   - `apps/web/src/lib/config.ts`
   - `apps/web/src/lib/auth-client.ts`
   - `.github/workflows/deploy-production.yml`
3. Re-deploy Workers API
4. Update GitHub OAuth callback URLs back to workers.dev

However, this would bring back the OAuth cookie issues.

## Original Workers API

The `apps/api/` directory is kept for reference but is no longer deployed. All functionality has been migrated to Pages Functions:

- ✅ Better Auth / OAuth
- ✅ Health checks
- ✅ User management
- ✅ Log ingestion
- ✅ Database access (D1)

## Benefits

1. **Fixes OAuth**: Same-origin = cookies work
2. **Simpler architecture**: One deployment instead of two
3. **No CORS**: Same-origin requests
4. **Better DX**: Single dev server
5. **Lower costs**: One project instead of two (Workers + Pages)

## Technical Details

### Pages Functions vs Workers

Key differences:
- **Export pattern**: `onRequest`, `onRequestGet`, etc. instead of `export default`
- **Context**: `{ request, env, params }` instead of `Request, Env, ExecutionContext`
- **File-based routing**: URL determined by file path
- **Same capabilities**: Full access to D1, KV, Durable Objects, etc.

### Cookie Behavior

**Before (broken)**:
```
1. User on pages.dev → Request to workers.dev
2. workers.dev sets cookie on workers.dev domain
3. Cookie blocked (cross-origin)
4. OAuth fails (can't find state)
```

**After (working)**:
```
1. User on pages.dev → Request to pages.dev/api
2. pages.dev/api sets cookie on pages.dev domain
3. Cookie works! (same-origin)
4. OAuth succeeds ✅
```

## Next Steps

1. Test OAuth flow thoroughly
2. Monitor production for any issues
3. Consider removing `apps/api/` directory once stable
4. Update documentation to reflect Pages Functions architecture
