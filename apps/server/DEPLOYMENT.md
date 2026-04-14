# Deploying ObjectStack Server to Vercel

This guide demonstrates how to deploy the ObjectStack production server to Vercel using Hono.

## Prerequisites

1. A Vercel account
2. Vercel CLI installed (optional): `npm i -g vercel`

## Environment Variables

Set the following environment variables in your Vercel project:

- `AUTH_SECRET`: A secure random string (minimum 32 characters) for authentication
- `TURSO_DATABASE_URL`: Your Turso database URL (e.g., `libsql://your-database.turso.io`)
- `TURSO_AUTH_TOKEN`: Your Turso authentication token

You can get these credentials from [Turso Dashboard](https://turso.tech/).

## Deployment Steps

### Option 1: Using Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Navigate to the server directory:
   ```bash
   cd apps/server
   ```

3. Deploy to Vercel:
   ```bash
   vercel
   ```

4. Set environment variables:
   ```bash
   vercel env add AUTH_SECRET
   vercel env add TURSO_DATABASE_URL
   vercel env add TURSO_AUTH_TOKEN
   ```

### Option 2: Using Vercel Dashboard

1. Import the repository to Vercel
2. Set the root directory to `apps/server`
3. Add environment variables in the project settings
4. Deploy

## Build Configuration

The build is configured in `vercel.json`:

- **Install Command**: `cd ../.. && pnpm install` (installs monorepo dependencies)
- **Build Command**: `bash scripts/build-vercel.sh` (builds and bundles the application)
- **Framework**: `null` (disabled - uses custom serverless function)
- **Build Environment Variables**:
  - `VITE_RUNTIME_MODE=server`: Configures Studio to run in server mode (connects to API instead of using MSW)
  - `VITE_SERVER_URL=""`: Empty string for same-origin API requests (Studio and API served from same domain)

## How It Works

1. **Build Process** (`scripts/build-vercel.sh`):
   - Builds both server and Studio using Turbo
   - Studio is built with `VITE_RUNTIME_MODE=server` (set in vercel.json build.env)
   - Bundles the server code using esbuild (`scripts/bundle-api.mjs`)
   - Copies Studio dist files to `public/` for static file serving

2. **API Handler** (`api/[[...route]].js`):
   - Committed catch-all route handler that Vercel detects pre-build
   - Delegates to the bundled handler (`api/_handler.js`)

3. **Server Entrypoint** (`server/index.ts`):
   - Boots ObjectStack kernel with Hono adapter
   - Uses `@hono/node-server`'s `getRequestListener()` for Vercel compatibility
   - Connects to Turso database in remote mode (HTTP-only, no local SQLite)
   - Handles Vercel's pre-buffered request body properly

4. **Hono Integration**:
   - Uses `@objectstack/hono` adapter to create the HTTP application
   - Provides REST API at `/api/v1` prefix
   - Includes authentication via AuthPlugin

5. **Studio UI** (Frontend SPA):
   - Built with Vite in server mode (not MSW mode)
   - Served as static files from `public/` directory
   - Connects to same-origin API server (relative URLs)
   - All API requests go to `/api/v1/*` endpoints

## Architecture

The deployment follows Vercel's serverless function pattern:

```
apps/server/
├── api/
│   ├── [[...route]].js      # Committed entry point
│   └── _handler.js           # Generated bundle (not committed)
├── server/
│   └── index.ts              # Server implementation
├── scripts/
│   ├── build-vercel.sh       # Build script
│   └── bundle-api.mjs        # Bundler configuration
├── .npmrc                    # pnpm configuration (node-linker=hoisted)
└── vercel.json               # Vercel configuration
```

## Testing Locally

Before deploying, you can test locally:

```bash
# Build the application
pnpm build

# Run in development mode
pnpm dev

# Test the API
curl http://localhost:3000/api/v1/discovery
```

## Accessing the Application

After deployment, your application will be available at:

- **Studio UI**: `https://your-app.vercel.app/` (main interface)
- **API Discovery**: `https://your-app.vercel.app/api/v1/discovery`
- **Data API**: `https://your-app.vercel.app/api/v1/data/:object`
- **Meta API**: `https://your-app.vercel.app/api/v1/meta/:type`

## Troubleshooting

### Build Fails

- Ensure all dependencies are installed: `pnpm install`
- Check build logs in Vercel dashboard
- Verify `build-vercel.sh` is executable: `chmod +x scripts/build-vercel.sh`

### Runtime Errors

- Check function logs in Vercel dashboard
- Verify environment variables are set correctly (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`)
- Ensure `AUTH_SECRET` is at least 32 characters
- Test Turso connection using the provided credentials

### Database Connection Issues

- Verify your Turso database URL and auth token are correct
- Check that your Turso database is accessible (not paused)
- The deployment uses TursoDriver in **remote mode** (HTTP-only), which doesn't require native modules like better-sqlite3

### Studio Still in MSW Mode

If Studio is running in MSW (Mock Service Worker) mode instead of server mode:

- Verify that `vercel.json` includes the `build.env` section with `VITE_RUNTIME_MODE=server`
- Check that the build process logs show "VITE_RUNTIME_MODE=server" during Studio build
- Open browser DevTools Console and check for `[Console Config]` log to verify runtime mode
- Clear Vercel build cache and redeploy: `vercel --force`

## References

- [Vercel Hono Documentation](https://vercel.com/docs/frameworks/backend/hono)
- [ObjectStack Documentation](../../README.md)
- [Hono Documentation](https://hono.dev/)
