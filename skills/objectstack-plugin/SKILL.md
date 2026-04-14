---
name: objectstack-plugin
description: >
  Develop ObjectStack plugins, register services, and manage the runtime lifecycle.
  Use when creating plugins, registering services, using the hook/event system,
  configuring ObjectKernel or LiteKernel, managing the bootstrap lifecycle,
  or debugging plugin loading issues. ALWAYS use this skill when you see:
  "create a plugin", "register a service", "hook", "trigger", "kernel config",
  "plugin lifecycle", "ObjectKernel", "LiteKernel", "DI", "dependency injection",
  "service registry", "health check", "graceful shutdown", "bootstrap",
  "extend the platform", or "write an extension".
  Do NOT use for data schema design (use objectstack-schema) or query patterns (use objectstack-query).
license: Apache-2.0
compatibility: Requires @objectstack/core v4+, @objectstack/spec v4+
metadata:
  author: objectstack-ai
  version: "3.0"
  domain: plugin
  tags: plugin, kernel, service, hook, event, DI, lifecycle, bootstrap, extension
---

# Plugin Development — ObjectStack Plugin & Runtime System

Expert instructions for developing plugins, managing services, and working
with the ObjectStack microkernel. Covers the Plugin interface, PluginContext
API, service registry, hook/event system, bootstrap sequence, and kernel
configuration.

---

## When to Use This Skill

- You are creating a **new plugin** (driver, server, service, app feature)
- You need to **register or consume services** via the DI container
- You are using the **hook/event system** for inter-plugin communication
- You need to choose between **ObjectKernel** and **LiteKernel**
- You are debugging **plugin loading order** or dependency resolution
- You need to configure **graceful shutdown**, timeouts, or health checks
- You are implementing **service factories** with lifecycle management

---

## Quick Reference — Detailed Rules

For comprehensive documentation with incorrect/correct examples:

- **[Plugin Lifecycle](./rules/plugin-lifecycle.md)** — 3-phase lifecycle (init/start/destroy), execution order, complete examples
- **[Service Registry](./rules/service-registry.md)** — DI container, factories, lifecycles (singleton/transient/scoped), core fallbacks
- **[Hooks & Events](./rules/hooks-events.md)** — 14 built-in hooks, custom events, handler patterns, performance tips

---

## ObjectKernel vs LiteKernel

| Feature | ObjectKernel | LiteKernel |
|:--------|:-------------|:-----------|
| **Use case** | Production servers, full applications | Serverless, edge, unit tests |
| **Package** | `@objectstack/core` | `@objectstack/core` |
| **Plugin loading** | Async with validation & metadata | Synchronous `use()` |
| **Service factories** | Singleton / Transient / Scoped | Direct instances only |
| **Health monitoring** | Built-in per-plugin health checks | Not available |
| **Graceful shutdown** | Timeout + rollback on failure | Basic destroy phase |
| **Dependency resolution** | Topological sort + circular detection | Topological sort |
| **Core fallbacks** | Auto-injects in-memory fallbacks | Not available |
| **Config validation** | Zod schema validation per plugin | Not available |

### Decision Guide

```
What environment are you targeting?
│
├── Production server / full application?
│   └── ✅ ObjectKernel
│       • Full DI with factories and scopes
│       • Health monitoring and auto-recovery
│       • Graceful shutdown with timeout
│       • Startup failure rollback
│
├── Serverless / edge (Cloudflare Workers, Deno Deploy)?
│   └── ✅ LiteKernel
│       • Minimal memory footprint
│       • Fast cold start
│       • No background health checks
│
└── Unit tests (vitest)?
    └── ✅ LiteKernel
        • Simple setup, fast teardown
        • No system requirement validation
        • No shutdown signal handlers
```

### ObjectKernel Configuration

```typescript
import { ObjectKernel } from '@objectstack/core';

const kernel = new ObjectKernel({
  logger: {
    level: 'info',           // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    format: 'json',          // 'json' | 'text' | 'pretty'
  },
  defaultStartupTimeout: 30000,   // Per plugin (ms)
  gracefulShutdown: true,         // Register SIGINT/SIGTERM handlers
  shutdownTimeout: 60000,         // Total shutdown timeout (ms)
  rollbackOnFailure: true,        // Rollback all plugins if one fails
  skipSystemValidation: false,    // Skip system checks (useful for tests)
});
```

### LiteKernel Configuration

```typescript
import { LiteKernel } from '@objectstack/core';

const kernel = new LiteKernel({
  logger: { level: 'warn' },
});
```

---

## Plugin Interface — Quick Overview

```typescript
import type { Plugin, PluginContext } from '@objectstack/core';

export interface Plugin {
  name: string;               // Unique identifier (reverse domain recommended)
  version?: string;           // Semantic version
  type?: string;              // 'standard' | 'ui' | 'driver' | 'server' | 'app'
  dependencies?: string[];    // Plugins that must init before this one

  // Phase 1: Register services
  init(ctx: PluginContext): Promise<void> | void;

  // Phase 2: Execute business logic (optional)
  start?(ctx: PluginContext): Promise<void> | void;

  // Phase 3: Cleanup (optional)
  destroy?(): Promise<void> | void;
}
```

See [rules/plugin-lifecycle.md](./rules/plugin-lifecycle.md) for complete examples.

---

## PluginContext API

### Service Registry

```typescript
// Register a service (in init phase)
ctx.registerService('my-service', myServiceInstance);

// Get a service (in start phase)
const db = ctx.getService<IDataEngine>('objectql');

// Replace a service
ctx.replaceService('cache', new InstrumentedCache(existingCache));

// Get all services
const allServices: Map<string, any> = ctx.getServices();
```

See [rules/service-registry.md](./rules/service-registry.md) for factories and lifecycles.

### Hook / Event System

```typescript
// Register a hook handler
ctx.hook('kernel:ready', async () => {
  ctx.logger.info('System is ready!');
});

// Register data lifecycle hooks
ctx.hook('data:beforeInsert', async (objectName, record) => {
  if (objectName === 'task') {
    record.created_at = new Date().toISOString();
  }
});

// Trigger a custom hook
await ctx.trigger('my-plugin:initialized', { version: '1.0.0' });
```

See [rules/hooks-events.md](./rules/hooks-events.md) for all 14 built-in hooks and patterns.

### Logger

```typescript
ctx.logger.debug('Detailed trace info', { key: 'value' });
ctx.logger.info('Plugin initialized');
ctx.logger.warn('Cache miss rate high', { rate: 0.45 });
ctx.logger.error('Connection failed', error);
```

### Kernel Access

```typescript
const kernel = ctx.getKernel();
const isRunning = kernel.isRunning();
const state = kernel.getState(); // 'idle' | 'initializing' | 'running' | 'stopping' | 'stopped'
```

---

## Complete Plugin Example

```typescript
// packages/plugins/plugin-audit/src/plugin.ts
import type { Plugin, PluginContext } from '@objectstack/core';

interface AuditEntry {
  timestamp: string;
  operation: string;
  object: string;
  recordId?: string;
}

class AuditService {
  private log: AuditEntry[] = [];

  record(entry: AuditEntry) {
    this.log.push(entry);
  }

  getLog(): AuditEntry[] {
    return [...this.log];
  }
}

const AuditPlugin: Plugin = {
  name: 'com.example.audit',
  version: '1.0.0',
  type: 'plugin',
  dependencies: ['com.objectstack.engine.objectql'],

  async init(ctx: PluginContext) {
    // Phase 1: Register service and hooks
    const auditService = new AuditService();
    ctx.registerService('audit', auditService);

    ctx.hook('data:afterInsert', async (objectName, _record, result) => {
      auditService.record({
        timestamp: new Date().toISOString(),
        operation: 'insert',
        object: objectName,
        recordId: result?.id,
      });
    });

    ctx.logger.info('Audit plugin initialized');
  },

  async start(ctx: PluginContext) {
    // Phase 2: Log that audit is active
    ctx.logger.info('Audit logging active');
  },

  async destroy() {
    // Phase 3: Cleanup
  },
};

export default AuditPlugin;
```

---

## Using Plugins

```typescript
import { ObjectKernel } from '@objectstack/core';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { DriverPlugin } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';
import AuditPlugin from './plugin';

const kernel = new ObjectKernel();
await kernel.use(new ObjectQLPlugin());
await kernel.use(new DriverPlugin(new InMemoryDriver()));
await kernel.use(AuditPlugin);
await kernel.bootstrap();

// Services are now available
const audit = kernel.getService<AuditService>('audit');
```

---

## Testing Plugins

```typescript
import { describe, it, expect } from 'vitest';
import { LiteKernel } from '@objectstack/core';
import AuditPlugin from './plugin';

describe('AuditPlugin', () => {
  it('records insert events', async () => {
    const kernel = new LiteKernel({ logger: { level: 'silent' } });
    kernel.use(AuditPlugin);
    await kernel.bootstrap();

    // Simulate a data event
    await kernel.context.trigger('data:afterInsert', 'task', {}, { id: '123' });

    const audit = kernel.getService('audit');
    const log = audit.getLog();
    expect(log).toHaveLength(1);
    expect(log[0].operation).toBe('insert');
    expect(log[0].object).toBe('task');

    await kernel.shutdown();
  });
});
```

---

## Well-Known Plugin Names & Services

| Plugin Name | Service Key | Package |
|:------------|:------------|:--------|
| `com.objectstack.engine.objectql` | `objectql` | `@objectstack/objectql` |
| `com.objectstack.driver.*` | `driver.{name}` | `@objectstack/driver-*` |
| `com.objectstack.auth` | `auth` | `@objectstack/plugin-auth` |
| `com.objectstack.rest` | `rest` | `@objectstack/rest` |
| `com.objectstack.metadata` | `metadata` | `@objectstack/metadata` |
| `com.objectstack.realtime` | `realtime` | `@objectstack/service-realtime` |
| `com.objectstack.cache` | `cache` | `@objectstack/service-cache` |

---

## Health Monitoring (ObjectKernel Only)

```typescript
const MyPlugin: Plugin & { healthCheck(): Promise<PluginHealthStatus> } = {
  name: 'com.example.db',
  version: '1.0.0',

  async init(ctx) { /* ... */ },

  async healthCheck() {
    try {
      await this.pool.query('SELECT 1');
      return { healthy: true, message: 'Database connected' };
    } catch (err) {
      return { healthy: false, message: 'Database unreachable', details: { error: err.message } };
    }
  },
};

// Check health
const health = await kernel.checkPluginHealth('com.example.db');
const allHealth = await kernel.checkAllPluginsHealth();

// Get startup metrics
const metrics = kernel.getPluginMetrics();
// Map<string, number> — plugin name → startup duration in ms
```

---

## Feature Flags

```typescript
import { defineStack } from '@objectstack/spec';

export default defineStack({
  featureFlags: [
    {
      name: 'experimental_ai_copilot',
      label: 'AI Copilot',
      enabled: true,
      strategy: 'percentage',
      conditions: { percentage: 25 },   // 25% of users
      environment: ['production'],
    },
    {
      name: 'beta_kanban_view',
      label: 'Kanban View',
      enabled: true,
      strategy: 'group',
      conditions: { groups: ['beta_testers'] },
    },
  ],
});
```

Strategies: `boolean` | `percentage` | `user_list` | `group` | `custom`

---

## References

- [rules/plugin-lifecycle.md](./rules/plugin-lifecycle.md) — 3-phase lifecycle, dependencies, complete examples
- [rules/service-registry.md](./rules/service-registry.md) — DI container, factories, core fallbacks
- [rules/hooks-events.md](./rules/hooks-events.md) — 14 built-in hooks, custom events, patterns
- [references/kernel/plugin.zod.ts](./references/kernel/plugin.zod.ts) — PluginContext schema, lifecycle hooks
- [references/kernel/context.zod.ts](./references/kernel/context.zod.ts) — RuntimeMode, KernelContext
- [references/kernel/service-registry.zod.ts](./references/kernel/service-registry.zod.ts) — Service scope types
- [references/kernel/feature.zod.ts](./references/kernel/feature.zod.ts) — Feature flag strategies
- [references/_index.md](./references/_index.md) — Complete schema index
