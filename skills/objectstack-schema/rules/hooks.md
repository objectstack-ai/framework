# Data Lifecycle Hooks (Reference)

> **Note:** This document is a reference pointer. Complete documentation has been moved to the canonical hooks skill.

---

## Complete Documentation

For comprehensive data lifecycle hooks documentation, see:

**→ [objectstack-hooks/references/data-hooks.md](../../objectstack-hooks/references/data-hooks.md)**

The canonical reference includes:
- All 14 lifecycle events (beforeFind, afterFind, beforeInsert, afterInsert, beforeUpdate, afterUpdate, beforeDelete, afterDelete, beforeCount, afterCount, beforeAggregate, afterAggregate, beforeFindOne, afterFindOne)
- Complete Hook definition schema
- HookContext API reference
- Registration methods (declarative, programmatic, file-based)
- 10+ common patterns with full examples
- Performance considerations and optimization tips
- Testing strategies (unit and integration)
- Best practices and anti-patterns

---

## Quick Reference

### Hook Definition

```typescript
import { Hook, HookContext } from '@objectstack/spec/data';

const hook: Hook = {
  name: 'my_hook',              // Required: unique identifier
  object: 'account',            // Required: target object(s)
  events: ['beforeInsert'],     // Required: lifecycle events
  handler: async (ctx: HookContext) => {
    // Your logic here
  },
  priority: 100,                // Optional: execution order
  async: false,                 // Optional: background execution (after* only)
  condition: "status = 'active'", // Optional: conditional execution
};
```

### 14 Lifecycle Events

| Event | When Fires | Use Case |
|:------|:-----------|:---------|
| `beforeFind` | Before querying multiple records | Filter queries, log access |
| `afterFind` | After querying multiple records | Transform results, mask data |
| `beforeFindOne` | Before fetching single record | Validate permissions |
| `afterFindOne` | After fetching single record | Enrich data |
| `beforeCount` | Before counting records | Filter by context |
| `afterCount` | After counting records | Log metrics |
| `beforeAggregate` | Before aggregate operations | Validate rules |
| `afterAggregate` | After aggregate operations | Transform results |
| `beforeInsert` | Before creating a record | Set defaults, validate |
| `afterInsert` | After creating a record | Send notifications |
| `beforeUpdate` | Before updating a record | Validate changes |
| `afterUpdate` | After updating a record | Trigger workflows |
| `beforeDelete` | Before deleting a record | Check dependencies |
| `afterDelete` | After deleting a record | Clean up related data |

### Common Patterns

See the full documentation for complete examples of:

1. **Setting Default Values** — Auto-populate fields on insert
2. **Data Validation** — Custom validation rules beyond declarative
3. **Preventing Deletion** — Block deletes based on conditions
4. **Data Enrichment** — Calculate and set derived fields
5. **Triggering Workflows** — Fire notifications and integrations
6. **Creating Related Records** — Maintain referential integrity
7. **External API Integration** — Sync with external systems
8. **Multi-Object Logic** — Cascade updates across objects
9. **Conditional Execution** — Use `condition` property
10. **Data Masking** — PII protection in read operations

---

## Registration

Three methods available:

### 1. Declarative (in Stack)

```typescript
// objectstack.config.ts
export default defineStack({
  hooks: [accountHook, contactHook],
});
```

### 2. Programmatic (in Plugin)

```typescript
ctx.ql.registerHook('beforeInsert', async (hookCtx) => {
  // Handler logic
}, { object: 'account', priority: 100 });
```

### 3. Hook Files (Convention)

```typescript
// src/objects/account.hook.ts
export default {
  name: 'account_logic',
  object: 'account',
  events: ['beforeInsert'],
  handler: async (ctx) => { /* ... */ },
};
```

---

## Best Practices

✅ **DO:**
1. Use `before*` for validation, `after*` for side effects
2. Set `async: true` for non-critical background work
3. Use `ctx.api` for cross-object operations
4. Handle errors gracefully with meaningful messages
5. Test hooks in isolation and integration

❌ **DON'T:**
1. Don't perform expensive operations in `before*` hooks
2. Don't create infinite loops (hooks triggering themselves)
3. Don't use `object: '*'` unless absolutely necessary
4. Don't throw in `after*` hooks unless critical
5. Don't assume `ctx.session` exists

---

## See Also

- **[objectstack-hooks/SKILL.md](../../objectstack-hooks/SKILL.md)** — Complete hooks system overview
- **[objectstack-hooks/references/data-hooks.md](../../objectstack-hooks/references/data-hooks.md)** — Full data hooks documentation
- **[objectstack-hooks/references/plugin-hooks.md](../../objectstack-hooks/references/plugin-hooks.md)** — Plugin hook system
- **[objectstack-automation](../../objectstack-automation/SKILL.md)** — Flows and Workflows for advanced automation

---

**For complete documentation with detailed examples, context API reference, testing strategies, and performance optimization, see the canonical reference:**

→ **[objectstack-hooks/references/data-hooks.md](../../objectstack-hooks/references/data-hooks.md)**
