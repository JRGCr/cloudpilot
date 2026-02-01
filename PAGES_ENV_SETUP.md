# Cloudflare Pages Environment Variables Setup

This guide explains how to configure environment variables for the Pages Functions deployment.

## Overview

The API now runs as Cloudflare Pages Functions, which means environment variables must be configured in the Cloudflare Pages dashboard (not Workers).

## Required Environment Variables

### Production Environment Variables

Set these in **Cloudflare Dashboard → Pages → cloudpilot-web → Settings → Environment Variables → Production**:

| Variable | Description | Example |
|----------|-------------|---------|
| `BETTER_AUTH_SECRET` | Auth secret (min 32 chars) | Generate with: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Full auth endpoint URL | `https://cloudpilot-web.pages.dev/api/auth` |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | From https://github.com/settings/developers |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret | From https://github.com/settings/developers |
| `NODE_ENV` | Environment | `production` |
| `BUILD_VERSION` | Optional: build version | Auto-set via CI/CD |
| `BUILD_TIME` | Optional: build timestamp | Auto-set via CI/CD |

### Preview Environment Variables

Set these for **Preview** deployments (same variables as production):

| Variable | Value |
|----------|-------|
| `BETTER_AUTH_SECRET` | Same as production (or generate separate) |
| `BETTER_AUTH_URL` | Update per-preview: `https://[branch].cloudpilot-web.pages.dev/api/auth` |
| `GITHUB_CLIENT_ID` | Same as production |
| `GITHUB_CLIENT_SECRET` | Same as production |
| `NODE_ENV` | `production` (yes, even for preview) |

## Setup Steps

### 1. Generate Auth Secret

```bash
openssl rand -base64 32
```

Copy the output and save it securely.

### 2. Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: CloudPilot (Production)
   - **Homepage URL**: `https://cloudpilot-web.pages.dev`
   - **Authorization callback URL**: `https://cloudpilot-web.pages.dev/api/auth/callback/github`
4. Click "Register application"
5. Copy the **Client ID**
6. Click "Generate a new client secret"
7. Copy the **Client Secret** (you won't see it again!)

### 3. Set Environment Variables in Cloudflare Dashboard

#### Via Web UI:

1. Go to https://dash.cloudflare.com/
2. Select your account
3. Go to **Workers & Pages**
4. Click **cloudpilot-web**
5. Go to **Settings** tab
6. Scroll to **Environment variables**
7. Click **Add variables**
8. For each variable:
   - Enter **Variable name** (e.g., `BETTER_AUTH_SECRET`)
   - Enter **Value**
   - Select **Production** environment
   - Click **Encrypt** if it's a secret
   - Click **Save**

#### Via Wrangler CLI:

```bash
cd apps/web

# Set production secrets
echo "your-secret-here" | pnpm wrangler pages secret put BETTER_AUTH_SECRET --env production
echo "your-github-client-id" | pnpm wrangler pages secret put GITHUB_CLIENT_ID --env production
echo "your-github-client-secret" | pnpm wrangler pages secret put GITHUB_CLIENT_SECRET --env production

# Set public environment variables
pnpm wrangler pages secret put BETTER_AUTH_URL --env production
# Enter: https://cloudpilot-web.pages.dev/api/auth

pnpm wrangler pages secret put NODE_ENV --env production
# Enter: production
```

### 4. Configure D1 Database Binding

The D1 database binding is configured in `apps/web/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudpilot"
database_id = "74e356ad-42c2-4806-b2b7-c7f4850261a2"
```

This is automatically applied during deployment. No manual configuration needed.

### 5. Update GitHub Actions Secrets

For automated deployments, set these in **GitHub → Repository Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `PROD_BETTER_AUTH_SECRET` | Same as `BETTER_AUTH_SECRET` above |
| `PROD_GITHUB_CLIENT_ID` | Same as `GITHUB_CLIENT_ID` above |
| `PROD_GITHUB_CLIENT_SECRET` | Same as `GITHUB_CLIENT_SECRET` above |

## Local Development

For local development, create `apps/web/.dev.vars`:

```bash
cd apps/web
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```
BETTER_AUTH_SECRET=your-local-secret-min-32-chars
BETTER_AUTH_URL=http://localhost:8788/api/auth
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-secret
NODE_ENV=development
```

**Note**: For local development, create a separate GitHub OAuth app with callback URL: `http://localhost:8788/api/auth/callback/github`

## Verification

After setting up environment variables:

1. **Trigger a deployment** (push to main or redeploy)
2. **Check deployment logs** in Cloudflare Dashboard
3. **Test health check**: Visit `https://cloudpilot-web.pages.dev/api/health`
   - Should return: `{"success":true,"data":{...}}`
4. **Test OAuth**:
   - Visit the app
   - Click "Sign in with GitHub"
   - Should redirect to GitHub
   - After auth, should redirect back and log you in ✅

## Troubleshooting

### "BETTER_AUTH_SECRET is required" error

- Check that the environment variable is set in Cloudflare Pages settings
- Verify the variable name is exactly `BETTER_AUTH_SECRET` (case-sensitive)
- Try redeploying after setting the variable

### "State mismatch" error during OAuth

- Check that `BETTER_AUTH_URL` matches the actual Pages URL
- Verify GitHub OAuth callback URL matches: `https://cloudpilot-web.pages.dev/api/auth/callback/github`
- Check browser DevTools → Application → Cookies - should see `cloudpilot_session` cookie

### Environment variables not applying

- After setting variables, you must **redeploy** for them to take effect
- Variables are applied at build time and runtime
- Clear Cloudflare cache if needed

## Migration from Workers

If you're migrating from the Workers setup:

1. The old environment variables were set in **Workers → Settings**
2. You need to **copy** these to **Pages → Settings → Environment Variables**
3. Update `BETTER_AUTH_URL` from `workers.dev/auth` to `pages.dev/api/auth`
4. Update GitHub OAuth callback URLs to point to `pages.dev` instead of `workers.dev`
5. After successful Pages deployment, you can delete the old Workers deployment

## Security Notes

1. **Never commit `.dev.vars`** - it's in `.gitignore`
2. **Encrypt secrets** in Cloudflare dashboard (checkbox when adding variables)
3. **Rotate secrets periodically** - especially `BETTER_AUTH_SECRET`
4. **Use different secrets** for preview vs production if handling sensitive data
5. **Restrict GitHub OAuth app** to specific domains if needed
