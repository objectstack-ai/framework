# Project Bootstrap Patterns

Guide for bootstrapping ObjectStack projects with defineStack().

## Basic Stack Configuration

```typescript
import { defineStack } from '@objectstack/spec';
import { DriverPlugin } from '@objectstack/runtime';
import { TursoDriver } from '@objectstack/driver-turso';

export default defineStack({
  manifest: {
    name: 'my-crm',
    version: '1.0.0',
    description: 'Customer relationship management system',
  },
  driver: new DriverPlugin(
    new TursoDriver({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN!,
    })
  ),
  objects: [
    /* ... */
  ],
});
```

## Driver Selection

| Driver | Use Case |
|:-------|:---------|
| `InMemoryDriver` | Development, testing |
| `SQLiteDriver` | Local development, small deployments |
| `TursoDriver` | Production (edge database) |
| `PostgreSQLDriver` | Production (full-featured) |

## Adapter Selection

| Adapter | Framework |
|:--------|:----------|
| `@objectstack/adapter-express` | Express.js |
| `@objectstack/adapter-fastify` | Fastify |
| `@objectstack/adapter-hono` | Hono |
| `@objectstack/adapter-nextjs` | Next.js |

## Incorrect vs Correct

### ❌ Incorrect — Missing Driver

```typescript
export default defineStack({
  manifest: { /* ... */ },
  // ❌ No driver specified
  objects: [/* ... */],
});
```

### ✅ Correct — Driver Configured

```typescript
export default defineStack({
  manifest: { /* ... */ },
  driver: new DriverPlugin(new InMemoryDriver()),  // ✅ Driver specified
  objects: [/* ... */],
});
```

## Best Practices

1. **Choose appropriate driver** — Match to deployment environment
2. **Use environment variables** — Don't hardcode credentials
3. **Configure logging** — Set appropriate log level
4. **Enable features** — trackHistory, feeds, activities as needed
5. **Organize objects** — Group by domain/module

---

See parent skill for complete documentation: [../SKILL.md](../SKILL.md)
