# Vercel Deployment Example

Deploy an ObjectStack server with Hono to Vercel.

## Features

- ✅ Hono adapter for fast, edge-compatible API routes
- ✅ Turso/LibSQL database driver with in-memory fallback
- ✅ Authentication with better-auth
- ✅ Security plugin for RBAC
- ✅ Optimized serverless function bundling with esbuild
- ✅ Environment-based configuration

## Prerequisites

1. A [Vercel](https://vercel.com) account
2. A [Turso](https://turso.tech) database (optional, uses in-memory storage if not configured)

## Local Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start local development server
cd examples/vercel
pnpm dev
```

The server will be available at `http://localhost:3000/api/v1`.

## Deployment to Vercel

### Option 1: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from the examples/vercel directory
cd examples/vercel
vercel
```

### Option 2: Deploy via Vercel Dashboard

1. Import your GitHub repository in the [Vercel Dashboard](https://vercel.com/new)
2. Set the **Root Directory** to `examples/vercel`
3. Configure environment variables (see below)
4. Click **Deploy**

## Environment Variables

Configure these in your Vercel project settings:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `TURSO_DATABASE_URL` | Turso database connection URL | No* | `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso authentication token | No* | `eyJ...` |
| `AUTH_SECRET` | Secret key for authentication (min 32 chars) | Yes | Generate with `openssl rand -base64 32` |

*If not set, the server will use an in-memory database (data will be lost on restart).

### Setting up Turso Database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create a new database
turso db create objectstack-vercel

# Get the database URL
turso db show objectstack-vercel --url

# Create an auth token
turso db tokens create objectstack-vercel

# Add both values to Vercel environment variables
```

## Project Structure

```
examples/vercel/
├── api/
│   └── [[...route]].js       # Vercel serverless function entry point
├── scripts/
│   ├── bundle-api.mjs         # esbuild bundler for serverless function
│   └── build-vercel.sh        # Vercel build script
├── server/
│   └── index.ts               # Server entrypoint with kernel bootstrap
├── objectstack.config.ts      # ObjectStack configuration
├── package.json
├── tsconfig.json
├── vercel.json                # Vercel deployment configuration
└── README.md
```

## How It Works

1. **Build Step**: `scripts/build-vercel.sh` runs on Vercel, which:
   - Builds the monorepo using turbo
   - Bundles `server/index.ts` → `api/_handler.js` using esbuild

2. **Runtime**: Vercel routes requests to `api/[[...route]].js`, which:
   - Lazily boots the ObjectStack kernel on first request
   - Delegates to the Hono adapter for request handling
   - Persists kernel state across warm invocations

3. **Database**:
   - Production: Uses Turso (edge-compatible LibSQL)
   - Local dev: Falls back to in-memory driver

## API Routes

All ObjectStack API routes are available under `/api/v1`:

- `GET /api/v1/meta` - Metadata discovery
- `GET /api/v1/data/:object` - Query data
- `POST /api/v1/data/:object` - Insert records
- `PATCH /api/v1/data/:object/:id` - Update records
- `DELETE /api/v1/data/:object/:id` - Delete records
- `POST /api/v1/auth/sign-in` - Authentication
- And more...

## Testing the Deployment

```bash
# Health check
curl https://your-deployment.vercel.app/api/v1/meta

# Example API request (after authentication)
curl https://your-deployment.vercel.app/api/v1/data/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Build fails with "Module not found"

Make sure you're running the build from the monorepo root, or that Vercel's `installCommand` is set correctly in `vercel.json`.

### Database connection issues

- Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set correctly
- Check Turso database is accessible from Vercel's network
- For debugging, you can temporarily use `:memory:` as the database URL

### Cold start timeout

- Increase `maxDuration` in `vercel.json` if needed
- Consider using Vercel Pro for higher limits

## Learn More

- [ObjectStack Documentation](https://docs.objectstack.dev)
- [Hono Vercel Deployment Guide](https://vercel.com/docs/frameworks/backend/hono)
- [Turso Documentation](https://docs.turso.tech)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)

## License

Apache-2.0
