# Hook & Event System

Complete guide for using hooks and events in ObjectStack plugins.

## Hook Registration

Register hook handlers in `init()` or `start()`:

```typescript
async init(ctx: PluginContext) {
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
}
```

## Triggering Events

Trigger custom hooks to notify other plugins:

```typescript
async start(ctx: PluginContext) {
  // Trigger a custom event
  await ctx.trigger('my-plugin:initialized', { version: '1.0.0' });
}
```

## Built-in Hooks

### Kernel Lifecycle Hooks

| Hook | Triggered When | Arguments |
|:-----|:---------------|:----------|
| `kernel:ready` | All plugins started, system validated | (none) |
| `kernel:shutdown` | Shutdown begins | (none) |

### Data Lifecycle Hooks

| Hook | Triggered When | Arguments |
|:-----|:---------------|:----------|
| `data:beforeInsert` | Before a record is created | `(objectName, record)` |
| `data:afterInsert` | After a record is created | `(objectName, record, result)` |
| `data:beforeUpdate` | Before a record is updated | `(objectName, id, record)` |
| `data:afterUpdate` | After a record is updated | `(objectName, id, record, result)` |
| `data:beforeDelete` | Before a record is deleted | `(objectName, id)` |
| `data:afterDelete` | After a record is deleted | `(objectName, id, result)` |
| `data:beforeFind` | Before querying records | `(objectName, query)` |
| `data:afterFind` | After querying records | `(objectName, query, result)` |

### Metadata Hooks

| Hook | Triggered When | Arguments |
|:-----|:---------------|:----------|
| `metadata:changed` | Metadata is registered or updated | `(type, name, metadata)` |

## Custom Hooks

Create your own hooks following the convention: `{plugin-namespace}:{event-name}`.

```typescript
// In your plugin
async start(ctx: PluginContext) {
  await ctx.trigger('analytics:pageview', {
    path: '/dashboard',
    userId: '123',
  });
}

// In another plugin
async init(ctx: PluginContext) {
  ctx.hook('analytics:pageview', async (data) => {
    console.log('Page viewed:', data.path);
  });
}
```

## Hook Handler Patterns

### Simple Handler

```typescript
ctx.hook('kernel:ready', async () => {
  console.log('System ready');
});
```

### Handler with Data

```typescript
ctx.hook('data:afterInsert', async (objectName, record, result) => {
  console.log(`Created ${objectName} record:`, result.id);
});
```

### Handler with Context

```typescript
ctx.hook('data:beforeInsert', async (objectName, record) => {
  // Access kernel context
  const user = ctx.getService('auth').getCurrentUser();
  record.created_by = user.id;
});
```

### Async Error Handling

```typescript
ctx.hook('data:afterInsert', async (objectName, record, result) => {
  try {
    await sendNotification(record);
  } catch (error) {
    ctx.logger.error('Failed to send notification', error);
    // Don't throw — let other hooks continue
  }
});
```

## Incorrect vs Correct

### ❌ Incorrect — Blocking Hook with Slow Operation

```typescript
ctx.hook('data:beforeInsert', async (objectName, record) => {
  // ❌ Blocks transaction
  await sendEmail(record.email);
  await callExternalAPI(record);
});
```

### ✅ Correct — Use after* Hook for Side Effects

```typescript
ctx.hook('data:afterInsert', async (objectName, record, result) {
  // ✅ Non-blocking, outside transaction
  try {
    await sendEmail(record.email);
    await callExternalAPI(record);
  } catch (error) {
    ctx.logger.error('Side effect failed', error);
  }
});
```

### ❌ Incorrect — Throwing in after* Hook

```typescript
ctx.hook('data:afterInsert', async (objectName, record, result) {
  throw new Error('Notification failed');  // ❌ Too late to abort
});
```

### ✅ Correct — Logging Errors in after* Hook

```typescript
ctx.hook('data:afterInsert', async (objectName, record, result) {
  try {
    await sendNotification(result);
  } catch (error) {
    ctx.logger.error('Notification failed', error);  // ✅ Log, don't throw
  }
});
```

### ❌ Incorrect — Modifying result in before* Hook

```typescript
ctx.hook('data:beforeInsert', async (objectName, record) => {
  record.result = { id: '123' };  // ❌ result doesn't exist yet
});
```

### ✅ Correct — Modifying input in before* Hook

```typescript
ctx.hook('data:beforeInsert', async (objectName, record) {
  record.created_at = new Date().toISOString();  // ✅ Modify input
});
```

## Common Patterns

### Setting Defaults

```typescript
ctx.hook('data:beforeInsert', async (objectName, record) => {
  if (objectName === 'task') {
    record.status = record.status || 'pending';
    record.priority = record.priority || 'medium';
  }
});
```

### Audit Logging

```typescript
ctx.hook('data:afterInsert', async (objectName, record, result) => {
  const audit = ctx.getService('audit');
  await audit.log({
    action: 'create',
    object: objectName,
    recordId: result.id,
    timestamp: new Date().toISOString(),
  });
});
```

### Triggering Workflows

```typescript
ctx.hook('data:afterUpdate', async (objectName, id, record, result) => {
  if (objectName === 'opportunity' && record.stage === 'won') {
    await ctx.trigger('sales:opportunity-won', { id, record: result });
  }
});
```

### Cross-Object Updates

```typescript
ctx.hook('data:afterInsert', async (objectName, record, result) => {
  if (objectName === 'invoice_line_item') {
    // Update invoice total
    const engine = ctx.getService('objectql');
    await engine.object('invoice').update(record.invoice_id, {
      updated_at: new Date().toISOString(),
    });
  }
});
```

### Validation

```typescript
ctx.hook('data:beforeInsert', async (objectName, record) => {
  if (objectName === 'account') {
    if (!record.email || !record.email.includes('@')) {
      throw new Error('Valid email is required');
    }
  }
});
```

## Hook Execution Order

Hooks are executed in **registration order** within each plugin, then by **plugin initialization order**.

```typescript
// Plugin A (depends on nothing)
ctx.hook('kernel:ready', () => console.log('A'));

// Plugin B (depends on A)
ctx.hook('kernel:ready', () => console.log('B'));

// Output: A, B
```

## Performance Considerations

### before* Hooks
- ⚠️ Block the operation — keep fast
- ⚠️ Run inside transaction — don't call slow APIs
- ✅ Use for validation and data enrichment
- ✅ Throw errors to abort operation

### after* Hooks
- ⚠️ Still block by default — use sparingly
- ✅ Use for notifications and logging
- ✅ Use try/catch to prevent cascading failures
- ✅ Consider async execution (if supported)

## Hook Naming Conventions

Follow the pattern: `{namespace}:{event-name}`

**Good names:**
- `auth:user-login`
- `sales:opportunity-created`
- `billing:invoice-paid`
- `analytics:event-tracked`

**Bad names:**
- `userLogin` (no namespace)
- `auth.user.login` (use colons, not dots)
- `auth:USER_LOGIN` (use lowercase)

## Testing Hooks

```typescript
import { describe, it, expect } from 'vitest';
import { LiteKernel } from '@objectstack/core';
import MyPlugin from './plugin';

describe('Hook System', () => {
  it('executes hook handler', async () => {
    const kernel = new LiteKernel();
    let hookCalled = false;

    kernel.use({
      name: 'test-plugin',
      async init(ctx) {
        ctx.hook('test:event', async () => {
          hookCalled = true;
        });
      },
    });

    await kernel.bootstrap();
    await kernel.context.trigger('test:event');

    expect(hookCalled).toBe(true);

    await kernel.shutdown();
  });

  it('passes arguments to hook handler', async () => {
    const kernel = new LiteKernel();
    let receivedData: any;

    kernel.use({
      name: 'test-plugin',
      async init(ctx) {
        ctx.hook('test:event', async (data) => {
          receivedData = data;
        });
      },
    });

    await kernel.bootstrap();
    await kernel.context.trigger('test:event', { foo: 'bar' });

    expect(receivedData).toEqual({ foo: 'bar' });

    await kernel.shutdown();
  });
});
```

## Best Practices

1. **Use before* for validation** — Abort operations early
2. **Use after* for side effects** — Notifications, logging, external API calls
3. **Keep hooks fast** — Especially before* hooks
4. **Use try/catch in after* hooks** — Don't let one failure cascade
5. **Use descriptive hook names** — Follow `{namespace}:{event-name}` convention
6. **Document custom hooks** — What they do, what arguments they pass
7. **Don't mutate arguments** — Except for `record` in before* hooks
8. **Test hook handlers** — Verify they execute and handle errors
9. **Limit hook count** — Too many hooks slow down operations
10. **Use specific object names** — Don't hook all objects unless necessary
