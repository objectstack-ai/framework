# Plugin Hooks & Events (Reference)

> **Note:** This document is a compact pointer. Complete documentation lives in
> the canonical reference:
> **→ [references/plugin-hooks.md](../references/plugin-hooks.md)**

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

  // Metadata hot-reload / publish announcement
  ctx.hook('metadata:reloaded', async (payload?: { changed?: string[] }) => {
    ctx.logger.info('Metadata reloaded', { changed: payload?.changed });
  });
}
```

### Triggering Custom Events

```typescript
async start(ctx: PluginContext) {
  await ctx.trigger('my-plugin:initialized', { version: '1.0.0' });
}
```

### Built-in Kernel Events

| Event | Fires | Payload |
|:------|:------|:--------|
| `kernel:ready` | All plugins started (route/service registration phase) | (none) |
| `kernel:bootstrapped` | After every `kernel:ready` handler settles (reconcile/backfill anchor) | (none) |
| `kernel:listening` | After bootstrapped — HTTP servers open their socket here | (none) |
| `kernel:shutdown` | Shutdown begins | (none) |
| `app:seeded` | An app's inline seed attempt settled | `{ appId, overBudget }` |
| `metadata:reloaded` | Metadata hot-reload or publish (dev reload, publish-drafts) | `{ changed: string[], metadata? }` |
| `external.schema.drift` | Federated datasource schema drift detected | `{ datasource, object, diffs }` |

There is no `metadata:changed` event — the real name is `metadata:reloaded`.

### ⚠️ No `data:*` Kernel Events

**Record-level lifecycle logic does not live on the kernel bus.** The engine
dispatches unprefixed events (`beforeInsert`, `afterUpdate`, …) with a single
`HookContext` argument — author them via the `hooks:` collection or
`ql.on('beforeInsert', 'task', async (ctx) => { … })` on the `objectql`
service. A kernel handler registered for `'data:beforeInsert'` registers
without error and **silently never fires**. Kernel hooks are for platform
lifecycle only → see **[objectstack-data](../../objectstack-data/SKILL.md)**.

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

## Rules of Thumb

✅ **DO:**
1. Use kernel hooks for **platform lifecycle only** (boot, shutdown, metadata
   reload, seed settle)
2. Do reconcile/backfill work in `kernel:bootstrapped`, not `kernel:ready`
3. Open server sockets in `kernel:listening`
4. Catch handler errors unless you want to abort boot — errors propagate
5. Follow the naming convention: `{namespace}:{event-name}`

❌ **DON'T:**
1. Don't subscribe to `data:*` kernel events — they don't exist and never fire
2. Don't call `kernel.context.trigger(...)` in tests — `context` is protected;
   capture a `PluginContext` from a probe plugin
3. Don't create circular dependencies between plugins (both kernels throw)

---

## Hook Execution Order

Hooks execute in **registration order** within each event (which follows
plugin initialization order). Handlers run sequentially and are awaited.

---

## See Also

- **[references/plugin-hooks.md](../references/plugin-hooks.md)** — Full kernel hooks documentation (payloads, patterns, testing)
- **[objectstack-data/SKILL.md](../../objectstack-data/SKILL.md)** — Data lifecycle hooks (engine-level)
- **[objectstack-data/references/data-hooks.md](../../objectstack-data/references/data-hooks.md)** — The 8-event engine hook guide
- **[Plugin Lifecycle](./plugin-lifecycle.md)** — 3-phase plugin lifecycle
- **[Service Registry](./service-registry.md)** — DI container and service management
