# @objectstack/driver-turso

Turso/libSQL driver for ObjectStack — edge-first SQLite with embedded replicas and database-per-tenant multi-tenancy.

## Architecture

`TursoDriver` **extends** `SqlDriver` from `@objectstack/driver-sql`. All CRUD operations, schema management, filtering, aggregation, window functions, introspection, and transactions are **inherited** — zero duplicated query/schema code.

```
TursoDriver extends SqlDriver (via Knex + better-sqlite3)
├── Inherited: find, findOne, create, update, delete, count, upsert
├── Inherited: bulkCreate, bulkUpdate, bulkDelete, updateMany, deleteMany
├── Inherited: syncSchema, dropTable, introspectSchema
├── Inherited: aggregate, distinct, findWithWindowFunctions
├── Inherited: beginTransaction, commit, rollback
├── Inherited: applyFilters (MongoDB-style + array-style)
├── Override:  name, version, supports (Turso-specific capabilities)
├── Override:  connect / disconnect (libSQL client lifecycle)
├── Added:     sync() — Embedded replica sync via @libsql/client
├── Added:     Multi-tenant router with TTL cache
└── Added:     TursoDriverConfig (url, authToken, syncUrl, encryptionKey)
```

## Installation

```bash
pnpm add @objectstack/driver-turso
```

## Connection Modes

### Local File (Embedded SQLite)

```typescript
import { TursoDriver } from '@objectstack/driver-turso';

const driver = new TursoDriver({
  url: 'file:./data/app.db',
});
await driver.connect();
```

### In-Memory (Testing)

```typescript
const driver = new TursoDriver({
  url: ':memory:',
});
await driver.connect();
```

### Embedded Replica (Hybrid)

Local SQLite file + automatic sync from Turso cloud:

```typescript
const driver = new TursoDriver({
  url: 'file:./data/replica.db',
  syncUrl: 'libsql://my-db-orgname.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN,
  sync: {
    intervalSeconds: 60, // sync every 60 seconds
    onConnect: true,     // sync on initial connect
  },
});
await driver.connect();

// Manual sync
await driver.sync();
```

## Multi-Tenant Routing

Database-per-tenant architecture with automatic driver caching:

```typescript
import { createMultiTenantRouter } from '@objectstack/driver-turso';

const router = createMultiTenantRouter({
  urlTemplate: 'file:./data/{tenant}.db',
  clientCacheTTL: 300_000, // 5 minutes
  onTenantCreate: async (tenantId) => {
    console.log(`Provisioned database for tenant: ${tenantId}`);
  },
});

// In a request handler:
const driver = await router.getDriverForTenant('acme');
const users = await driver.find('users', { where: { active: true } });

// Cleanup on shutdown
await router.destroyAll();
```

### Multi-Tenant with Turso Cloud

```typescript
const router = createMultiTenantRouter({
  urlTemplate: 'file:./data/{tenant}-replica.db',
  groupAuthToken: process.env.TURSO_GROUP_TOKEN,
  driverConfigOverrides: {
    syncUrl: 'libsql://{tenant}-myorg.turso.io',
    sync: { intervalSeconds: 30 },
  },
});
```

## Configuration

```typescript
interface TursoDriverConfig {
  /** Database URL (file:, :memory:, libsql://, https://) */
  url: string;

  /** JWT auth token for remote Turso database */
  authToken?: string;

  /** AES-256 encryption key for local files */
  encryptionKey?: string;

  /** Maximum concurrent requests. Default: 20 */
  concurrency?: number;

  /** Remote sync URL for embedded replica mode */
  syncUrl?: string;

  /** Sync configuration */
  sync?: {
    intervalSeconds?: number; // Default: 60
    onConnect?: boolean;      // Default: true
  };

  /** Operation timeout in milliseconds */
  timeout?: number;
}
```

## Capabilities

TursoDriver declares enhanced capabilities beyond the base SqlDriver:

| Capability | SqlDriver | TursoDriver |
|:---|:---:|:---:|
| FTS5 Full-Text Search | ❌ | ✅ |
| JSON1 Query | ❌ | ✅ |
| Common Table Expressions | ❌ | ✅ |
| Savepoints | ❌ | ✅ |
| Indexes | ❌ | ✅ |
| Connection Pooling | ✅ | ❌ (concurrency limits) |
| Embedded Replica Sync | — | ✅ |
| Multi-Tenant Routing | — | ✅ |

## Plugin Registration

```typescript
import tursoPlugin from '@objectstack/driver-turso';

// Via plugin system
await kernel.enablePlugin(tursoPlugin, {
  url: 'file:./data/app.db',
});
```

## Testing

```bash
pnpm test        # Run all 53 tests
```

Tests run against in-memory SQLite (`:memory:`) — no external services required.

## License

Apache-2.0 — Copyright (c) 2025 ObjectStack
