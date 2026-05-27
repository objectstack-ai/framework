# @objectstack/driver-memory

> In-memory ObjectQL driver for ObjectStack — zero-config storage for development, unit tests, Storybook, and browser MSW mocks.

[![npm](https://img.shields.io/npm/v/@objectstack/driver-memory.svg)](https://www.npmjs.com/package/@objectstack/driver-memory)
[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-blue.svg)](../../../LICENSING.md)

## Overview

Implements the `IDataEngine` contract against in-memory `Map`-backed tables. Supports the full ObjectQL surface: MongoDB-style operators (`$eq`, `$ne`, `$gt`, `$lt`, `$gte`, `$lte`, `$in`, `$nin`, `$and`, `$or`, `$not`), sorting, pagination, aggregations, and joins. Optional persistence adapters serialize state to disk (Node) or `localStorage` (browser).

## Installation

```bash
pnpm add @objectstack/driver-memory
```

## Quick Start

```typescript
import { ObjectKernel } from '@objectstack/core';
import memoryPlugin from '@objectstack/driver-memory';

const kernel = new ObjectKernel();
kernel.use(memoryPlugin);                 // default plugin
await kernel.bootstrap();
```

### Direct instantiation

```typescript
import { InMemoryDriver } from '@objectstack/driver-memory';

const driver = new InMemoryDriver();
await driver.connect();
```

### With filesystem persistence (Node)

```typescript
import { InMemoryDriver, FileSystemPersistenceAdapter } from '@objectstack/driver-memory';

const driver = new InMemoryDriver({
  persistence: new FileSystemPersistenceAdapter('./data/snapshot.json'),
});
await driver.connect();
```

### With `localStorage` persistence (browser)

```typescript
import { InMemoryDriver, LocalStoragePersistenceAdapter } from '@objectstack/driver-memory';

const driver = new InMemoryDriver({
  persistence: new LocalStoragePersistenceAdapter('objectstack:dev'),
});
```

## Key Exports

| Export | Kind | Description |
|:---|:---|:---|
| `default` | kernel plugin | Drop-in plugin. |
| `InMemoryDriver` | class | Driver instance for direct use. |
| `InMemoryStrategy` | class | Query execution strategy used by ObjectQL. |
| `FileSystemPersistenceAdapter` | class | Node-only persistence. |
| `LocalStoragePersistenceAdapter` | class | Browser-only persistence. |
| `MemoryAnalyticsService` | class | Adds analytics aggregations backed by memory store. |
| `InMemoryDriverConfig`, `PersistenceAdapterInterface`, `MemoryAnalyticsConfig` | types | Configuration shapes. |

## Configuration

| Option | Type | Default | Notes |
|:---|:---|:---|:---|
| `persistence` | `PersistenceAdapterInterface?` | `undefined` | Optional snapshot store. |
| `seed` | `Record<string, any[]>?` | `{}` | Initial rows keyed by object name. |
| `idStrategy` | `'uuid' \| 'auto'` | `'uuid'` | ID generation strategy. |

## When to use

- ✅ Development, unit tests, CI, Storybook.
- ✅ Browser-only demos pairing with [`@objectstack/plugin-msw`](../plugin-msw).

## When not to use

- ❌ Production — data is lost on restart without a persistence adapter; durability/concurrency guarantees are minimal.
- ❌ Multi-process deployments.

## Related Packages

- [`@objectstack/objectql`](../../objectql) — query engine.
- [`@objectstack/driver-sql`](../driver-sql), [`@objectstack/driver-turso`](../driver-turso) — production drivers.
- [`@objectstack/plugin-msw`](../plugin-msw) — browser mock API.

## Links

- 📖 Docs: <https://objectstack.ai/docs>
- 📚 API Reference: <https://objectstack.ai/docs/references>

## License

BUSL-1.1 with a four-year conversion to Apache-2.0. See
[LICENSING.md](../../../LICENSING.md).
