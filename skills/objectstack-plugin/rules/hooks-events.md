# Plugin Hooks & Events (Reference)

> **Note:** This document is a reference pointer. Complete documentation has been moved to the canonical hooks skill.

---

## Complete Documentation

For comprehensive plugin hooks and event system documentation, see:

**→ [objectstack-hooks/references/plugin-hooks.md](../../objectstack-hooks/references/plugin-hooks.md)**

The canonical reference includes:
- Complete hook registration API (`ctx.hook`, `ctx.trigger`)
- All built-in hooks (kernel lifecycle + data events)
- Custom plugin event patterns
- Hook handler patterns and error handling
- Performance considerations
- Testing strategies
- Best practices

---

## Quick Reference

### Hook Registration

Register hook handlers in `init()` or `start()`:

```typescript
async init(ctx: PluginContext) {
  // Kernel lifecycle hook
  ctx.hook('kernel:ready', async () => {
    ctx.logger.info('System ready');
  });

  // Data lifecycle hook
  ctx.hook('data:beforeInsert', async (objectName, record) => {
    if (objectName === 'task') {
      record.created_at = new Date().toISOString();
    }
  });
}
```

### Triggering Custom Events

```typescript
async start(ctx: PluginContext) {
  await ctx.trigger('my-plugin:initialized', { version: '1.0.0' });
}
```

### Built-in Hooks

**Kernel Lifecycle:**
- `kernel:ready` — All plugins started, system validated
- `kernel:shutdown` — Shutdown begins

**Data Lifecycle:**
- `data:beforeInsert` — Before record created
- `data:afterInsert` — After record created
- `data:beforeUpdate` — Before record updated
- `data:afterUpdate` — After record updated
- `data:beforeDelete` — Before record deleted
- `data:afterDelete` — After record deleted
- `data:beforeFind` — Before querying records
- `data:afterFind` — After querying records

**Metadata:**
- `metadata:changed` — Metadata registered or updated

### Custom Hooks

Follow the convention: `{plugin-namespace}:{event-name}`

```typescript
// Trigger
await ctx.trigger('analytics:pageview', { path: '/dashboard', userId: '123' });

// Subscribe
ctx.hook('analytics:pageview', async (data) => {
  console.log('Page viewed:', data.path);
});
```

---

## Common Patterns

### Setting Defaults

```typescript
ctx.hook('data:beforeInsert', async (objectName, record) => {
  if (objectName === 'task') {
    record.status = record.status || 'pending';
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

---

## Best Practices

✅ **DO:**
1. Use `before*` for validation
2. Use `after*` for side effects (notifications, logging, external API calls)
3. Keep hooks fast — especially `before*` hooks
4. Use try/catch in `after*` hooks — don't let one failure cascade
5. Follow naming convention: `{namespace}:{event-name}`
6. Test hook handlers thoroughly

❌ **DON'T:**
1. Don't block operations with slow external API calls in `before*` hooks
2. Don't throw in `after*` hooks (use try/catch and log errors)
3. Don't mutate arguments (except `record` in `before*` hooks)
4. Don't create circular dependencies between plugins
5. Don't hook all objects unless necessary

---

## Hook Execution Order

Hooks execute in **registration order** within each plugin, then by **plugin initialization order** (based on dependencies).

---

## See Also

- **[objectstack-hooks/SKILL.md](../../objectstack-hooks/SKILL.md)** — Complete hooks system overview
- **[objectstack-hooks/references/plugin-hooks.md](../../objectstack-hooks/references/plugin-hooks.md)** — Full plugin hooks documentation
- **[objectstack-hooks/references/data-hooks.md](../../objectstack-hooks/references/data-hooks.md)** — Data lifecycle hooks
- **[Plugin Lifecycle](./plugin-lifecycle.md)** — 3-phase plugin lifecycle
- **[Service Registry](./service-registry.md)** — DI container and service management

---

**For complete documentation with detailed examples, hook context API, testing strategies, and performance optimization, see the canonical reference:**

→ **[objectstack-hooks/references/plugin-hooks.md](../../objectstack-hooks/references/plugin-hooks.md)**
