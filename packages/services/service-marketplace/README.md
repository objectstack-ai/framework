# @objectstack/service-marketplace

Marketplace Service for ObjectStack — enables runtime plugin loading from the cloud marketplace.

## Features

- 🌐 **Remote Plugin Loading**: Load plugins dynamically from cloud marketplace
- 💾 **Persistent State**: Track installed plugins in Turso database
- 🔄 **Hot Reload**: Enable/disable plugins at runtime without redeployment
- 🚀 **Vercel Compatible**: Works in serverless environments
- 🔒 **Security**: Supports authentication tokens for private plugins

## Installation

```bash
pnpm add @objectstack/service-marketplace
```

## Usage

```typescript
import { MarketplaceServicePlugin } from '@objectstack/service-marketplace';

const config = defineStack({
  plugins: [
    // ... other plugins
    new MarketplaceServicePlugin({
      marketplaceUrl: 'https://cloud.objectstack.ai',
      authToken: process.env.OBJECTSTACK_AUTH_TOKEN,
      enableCache: true,
      persistState: true,
    }),
  ],
});
```

## Environment Variables

- `OBJECTSTACK_MARKETPLACE_URL` - Cloud marketplace URL (default: https://cloud.objectstack.ai)
- `OBJECTSTACK_AUTH_TOKEN` - Authentication token for private plugins

## API Endpoints

The service automatically exposes the following REST API endpoints:

- `GET /api/v1/marketplace/plugins` - List available plugins from marketplace
- `POST /api/v1/marketplace/plugins/:id/install` - Install a plugin
- `DELETE /api/v1/marketplace/plugins/:id` - Uninstall a plugin
- `GET /api/v1/marketplace/plugins/installed` - List installed plugins

## License

Apache-2.0
