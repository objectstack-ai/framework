---
name: objectstack-hooks
description: >
  Canonical reference for all ObjectStack hooks and lifecycle events.
  Use when implementing data lifecycle hooks, plugin hooks, kernel events,
  or understanding the hook system architecture. This skill serves as the
  single source of truth for hook documentation across the platform.
license: Apache-2.0
compatibility: Requires @objectstack/spec v4+, @objectstack/objectql v4+
metadata:
  author: objectstack-ai
  version: "2.0"
  domain: hooks
  tags: hooks, lifecycle, validation, business-logic, side-effects, data-enrichment, events, plugin-hooks
---

# Hooks System — ObjectStack Canonical Reference

This skill is the **single source of truth** for all hook and event documentation in ObjectStack.
It consolidates hook patterns across data lifecycle, plugin system, and kernel events to eliminate
duplication and ensure consistency.

---

## When to Use This Skill

- You need to understand the **complete hooks architecture** across ObjectStack
- You are implementing **data lifecycle hooks** (beforeInsert, afterUpdate, etc.)
- You are working with **plugin hooks** (kernel:ready, data:*, custom events)
- You need to compare **data hooks vs plugin hooks** patterns
- You are designing hook-based integrations or extensions
- You want to reference hook best practices and common patterns

---

## Skill Organization

This skill is organized into two main reference documents:

### 1. **Data Lifecycle Hooks** → [references/data-hooks.md](./references/data-hooks.md)

Comprehensive guide for data operation hooks:
- 14 lifecycle events (beforeFind, afterFind, beforeInsert, afterInsert, etc.)
- Hook definition schema and HookContext API
- Registration methods (declarative, programmatic, file-based)
- Common patterns (validation, defaults, audit logging, workflows)
- Performance considerations and best practices
- Complete code examples and testing strategies

**Use for:** Object-level business logic, validation, data enrichment, side effects during CRUD operations.

### 2. **Plugin & Kernel Hooks** → [references/plugin-hooks.md](./references/plugin-hooks.md)

Guide for plugin-level hooks and event system:
- Kernel lifecycle hooks (kernel:ready, kernel:shutdown)
- Plugin event system (ctx.hook, ctx.trigger)
- Built-in data events (data:beforeInsert, data:afterInsert, etc.)
- Custom plugin events and namespacing
- Hook handler patterns and error handling
- Cross-plugin communication

**Use for:** Plugin development, kernel events, cross-plugin communication, system-level hooks.

---

## Quick Comparison: Data Hooks vs Plugin Hooks

| Aspect | Data Hooks | Plugin Hooks |
|:-------|:-----------|:-------------|
| **Defined in** | Object metadata (Stack) | Plugin code (init/start) |
| **Registration** | `hooks: [...]` in stack config | `ctx.hook()` in plugin |
| **Context** | Rich HookContext with input/result/api | Flexible arguments per event |
| **Scope** | Object-specific or global (`object: '*'`) | Global, across all objects |
| **Priority** | Explicit `priority` field | Plugin dependency order |
| **Use case** | Business logic tied to objects | System integration, cross-cutting concerns |

---

## References from Other Skills

This skill is referenced by:

- **[objectstack-schema](../objectstack-schema/SKILL.md)** — Uses data hooks for object lifecycle
- **[objectstack-plugin](../objectstack-plugin/SKILL.md)** — Uses plugin hooks for kernel integration
- **[objectstack-automation](../objectstack-automation/SKILL.md)** — Flows can trigger via hooks

---

## Documentation Map

```
objectstack-hooks/
├── SKILL.md (this file)
└── references/
    ├── data-hooks.md        — Data lifecycle hooks (14 events)
    └── plugin-hooks.md      — Plugin & kernel hooks
```

---

## Quick Start

### For Data Lifecycle Hooks

See [references/data-hooks.md](./references/data-hooks.md) for complete documentation.

Quick example:
```typescript
import { Hook, HookContext } from '@objectstack/spec/data';

const hook: Hook = {
  name: 'validate_account',
  object: 'account',
  events: ['beforeInsert', 'beforeUpdate'],
  handler: async (ctx: HookContext) => {
    if (!ctx.input.email?.includes('@')) {
      throw new Error('Valid email required');
    }
  },
};
```

### For Plugin Hooks

See [references/plugin-hooks.md](./references/plugin-hooks.md) for complete documentation.

Quick example:
```typescript
async init(ctx: PluginContext) {
  ctx.hook('kernel:ready', async () => {
    ctx.logger.info('System ready');
  });

  ctx.hook('data:afterInsert', async (objectName, record, result) => {
    console.log(`Created ${objectName}:`, result.id);
  });
}
```

---

## Design Philosophy

1. **Single Source of Truth** — All hook documentation lives here, other skills reference it
2. **Clear Separation** — Data hooks vs plugin hooks serve different purposes
3. **Consistency** — Patterns and best practices apply across both systems
4. **Cross-References** — Easy navigation between related concepts

---

## See Also

- [objectstack-schema/SKILL.md](../objectstack-schema/SKILL.md) — Object and field definitions
- [objectstack-plugin/SKILL.md](../objectstack-plugin/SKILL.md) — Plugin development guide
- [objectstack-automation/SKILL.md](../objectstack-automation/SKILL.md) — Flows and workflows
