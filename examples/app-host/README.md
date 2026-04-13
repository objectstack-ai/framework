# ObjectStack Example Server

This is a reference implementation of the ObjectStack Server Protocol (Kernel).
It demonstrates how to build a metadata-driven backend that dynamically loads object definitions from plugins and automatically generates REST APIs.

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/objectstack-ai/framework/tree/main/examples/app-host&project-name=objectstack-app-host&repository-name=objectstack-app-host)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Features

- **Dynamic Schema Loading**: Loads `crm` and `todo` apps as plugins.
- **Unified Metadata API**: `/api/v1/meta/objects`
- **Unified Data API**: `/api/v1/data/:object` (CRUD)
- **Zero-Code Backend**: No creating routes or controllers per object.
- **Preview Mode**: Run in demo mode — bypass login, auto-simulate admin identity.
- **Vercel Deployment**: Ready-to-deploy to Vercel with Hono adapter.

## Setup

### Prerequisites
- Node.js 18+ and pnpm 8+

### Install & Run

1. Make sure all dependencies are installed in the workspace root:
   ```bash
   corepack enable && pnpm install
   ```

2. Run the server:
   ```bash
   pnpm dev
   # Expected: Server starts at http://localhost:3000
   ```

3. Run in **preview mode** (skip login, simulate admin):
   ```bash
   OS_MODE=preview pnpm dev
   # Expected: Server starts in preview mode — no login required
   ```

## Preview / Demo Mode

Preview mode allows visitors (e.g. marketplace customers) to explore the platform
without registering or logging in. The kernel boots with `mode: 'preview'` and the
frontend skips authentication screens, automatically simulating an admin session.

### How It Works

1. The runtime reads `OS_MODE=preview` from the environment (or the stack config).
2. The `KernelContext` is created with `mode: 'preview'` and a `previewMode` config.
3. The frontend detects `mode === 'preview'` and:
   - Hides the login / registration pages.
   - Automatically creates a simulated admin session.
   - Shows a preview banner to indicate demo mode.

### Configuration

```typescript
import { KernelContextSchema } from '@objectstack/spec/kernel';

const ctx = KernelContextSchema.parse({
  instanceId: '550e8400-e29b-41d4-a716-446655440000',
  mode: 'preview',
  version: '1.0.0',
  cwd: process.cwd(),
  startTime: Date.now(),
  previewMode: {
    autoLogin: true,            // Skip login/registration pages
    simulatedRole: 'admin',     // Simulated user role (admin | user | viewer)
    simulatedUserName: 'Demo Admin',
    readOnly: false,            // Allow writes (set true for read-only demos)
    expiresInSeconds: 3600,     // Session expires after 1 hour (0 = no expiration)
    bannerMessage: 'You are exploring a demo — data will be reset periodically.',
  },
});
```

### PreviewModeConfig Properties

| Property | Type | Default | Description |
|:---|:---|:---|:---|
| **autoLogin** | `boolean` | `true` | Auto-login as simulated user, skip login/registration |
| **simulatedRole** | `'admin' \| 'user' \| 'viewer'` | `'admin'` | Permission role for the simulated user |
| **simulatedUserName** | `string` | `'Preview User'` | Display name shown in the UI |
| **readOnly** | `boolean` | `false` | Block all write operations |
| **expiresInSeconds** | `integer` | `0` | Session duration (0 = no expiration) |
| **bannerMessage** | `string` | — | Banner message displayed in the UI |

> **⚠️ Security:** Preview mode should NEVER be used in production environments.

## API Usage Examples

### 1. Get All Objects
```bash
curl http://localhost:3000/api/v1/meta/objects
# Expected: JSON array of loaded object definitions
# Example: [{"name":"todo_task","label":"Task",...}, {"name":"account","label":"Account",...}]
```

### 2. Create a Todo
```bash
curl -X POST http://localhost:3000/api/v1/data/todo_task \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy Milk", "priority": "high"}'
# Expected: {"id":"<generated-id>","title":"Buy Milk","priority":"high",...}
```

### 3. List Todos
```bash
curl http://localhost:3000/api/v1/data/todo_task
# Expected: {"data":[{"id":"...","title":"Buy Milk","priority":"high",...}]}
```
