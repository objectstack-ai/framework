---
name: objectstack-hooks
description: >
  Write ObjectStack data lifecycle hooks for third-party plugins and applications.
  Use when implementing business logic, validation, side effects, or data transformations
  during CRUD operations. Covers hook registration, handler patterns, context API,
  error handling, async execution, and integration with the ObjectQL engine.
license: Apache-2.0
compatibility: Requires @objectstack/spec v4+, @objectstack/objectql v4+
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: hooks
  tags: hooks, lifecycle, validation, business-logic, side-effects, data-enrichment
---

# Writing Hooks — ObjectStack Data Lifecycle

Expert instructions for third-party developers to write data lifecycle hooks in ObjectStack.
Hooks are the primary extension point for adding custom business logic, validation rules,
side effects, and data transformations to CRUD operations.

---

## When to Use This Skill

- You need to **add custom validation** beyond declarative rules.
- You want to **enrich data** (set defaults, calculate fields, normalize values).
- You need to trigger **side effects** (send emails, update external systems, publish events).
- You want to **enforce business rules** that span multiple fields or objects.
- You need to **transform data** before or after database operations.
- You want to **integrate with external APIs** during data operations.
- You need to **implement audit trails** or compliance requirements.

---

## Core Concepts

### What Are Hooks?

Hooks are **event handlers** that execute during the ObjectQL data access lifecycle.
They intercept operations at specific points (before/after) and can:

- **Read** the operation context (user, session, input data)
- **Modify** input parameters or operation results
- **Validate** data and throw errors to abort operations
- **Trigger** side effects (notifications, integrations, logging)

### Hook Lifecycle Events

ObjectStack provides **14 lifecycle events** organized by operation type:

| Event | When It Fires | Use Cases |
|:------|:--------------|:----------|
| **Read Operations** | | |
| `beforeFind` | Before querying multiple records | Filter queries by user context, log access |
| `afterFind` | After querying multiple records | Transform results, mask sensitive data |
| `beforeFindOne` | Before fetching a single record | Validate permissions, log access |
| `afterFindOne` | After fetching a single record | Enrich data, mask fields |
| `beforeCount` | Before counting records | Filter by context |
| `afterCount` | After counting records | Log metrics |
| `beforeAggregate` | Before aggregate operations | Validate aggregation rules |
| `afterAggregate` | After aggregate operations | Transform results |
| **Write Operations** | | |
| `beforeInsert` | Before creating a record | Set defaults, validate, normalize |
| `afterInsert` | After creating a record | Send notifications, create related records |
| `beforeUpdate` | Before updating a record | Validate changes, check permissions |
| `afterUpdate` | After updating a record | Trigger workflows, sync external systems |
| `beforeDelete` | Before deleting a record | Check dependencies, prevent deletion |
| `afterDelete` | After deleting a record | Clean up related data, notify users |

### Before vs After Hooks

| Aspect | `before*` Hooks | `after*` Hooks |
|:-------|:----------------|:---------------|
| **Purpose** | Validation, enrichment, transformation | Side effects, notifications, logging |
| **Can modify** | `ctx.input` (mutable) | `ctx.result` (mutable) |
| **Can abort** | Yes (throw error → rollback) | No (operation already committed) |
| **Transaction** | Within transaction | After transaction (unless async: false) |
| **Error handling** | Aborts operation by default | Logged by default (configurable) |

---

## Hook Definition Schema

Every hook must conform to the `HookSchema`:

```typescript
import { Hook, HookContext } from '@objectstack/spec/data';

const myHook: Hook = {
  // Required: Unique identifier (snake_case)
  name: 'my_validation_hook',

  // Required: Target object(s)
  object: 'account',  // string | string[] | '*'

  // Required: Events to subscribe to
  events: ['beforeInsert', 'beforeUpdate'],

  // Required: Handler function (inline or string reference)
  handler: async (ctx: HookContext) => {
    // Your logic here
  },

  // Optional: Execution priority (lower runs first)
  priority: 100,  // System: 0-99, App: 100-999, User: 1000+

  // Optional: Run in background (after* events only)
  async: false,

  // Optional: Conditional execution
  condition: "status = 'active' AND amount > 1000",

  // Optional: Human-readable description
  description: 'Validates account data before save',

  // Optional: Error handling strategy
  onError: 'abort',  // 'abort' | 'log'

  // Optional: Execution timeout (ms)
  timeout: 5000,

  // Optional: Retry policy
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1000,
  },
};
```

### Key Properties Explained

#### `object` — Target Scope

```typescript
// Single object
object: 'account'

// Multiple objects
object: ['account', 'contact', 'lead']

// All objects (use sparingly — performance impact)
object: '*'
```

#### `events` — Lifecycle Events

```typescript
// Single event
events: ['beforeInsert']

// Multiple events (common pattern)
events: ['beforeInsert', 'beforeUpdate']

// After events for side effects
events: ['afterInsert', 'afterUpdate', 'afterDelete']
```

#### `handler` — Implementation

Handlers can be:

1. **Inline functions** (recommended for simple hooks):
   ```typescript
   handler: async (ctx: HookContext) => {
     if (!ctx.input.email) {
       throw new Error('Email is required');
     }
   }
   ```

2. **String references** (for registered handlers):
   ```typescript
   handler: 'my_plugin.validateAccount'
   ```

#### `priority` — Execution Order

Lower numbers execute first:

```typescript
// System hooks (framework internals)
priority: 50

// Application hooks (your app logic)
priority: 100  // default

// User customizations
priority: 1000
```

#### `async` — Background Execution

Only applicable for `after*` events:

```typescript
// Blocking (default) — runs within transaction
async: false

// Fire-and-forget — runs in background
async: true
```

**When to use async: true:**
- Sending emails/notifications
- Calling slow external APIs
- Logging to external systems
- Non-critical side effects

**When to use async: false:**
- Creating related records
- Updating dependent data
- Critical consistency requirements

#### `condition` — Declarative Filtering

Skip handler execution if condition is false:

```typescript
// Only run for high-value accounts
condition: "annual_revenue > 1000000"

// Only run for specific statuses
condition: "status IN ('pending', 'in_review')"

// Complex conditions
condition: "type = 'enterprise' AND region = 'APAC' AND is_active = true"
```

#### `onError` — Error Handling

```typescript
// Abort operation on error (default for before* hooks)
onError: 'abort'

// Log error and continue (default for after* hooks)
onError: 'log'
```

---

## Hook Context API

The `HookContext` passed to your handler provides:

### Context Properties

```typescript
interface HookContext {
  // Immutable identifiers
  id?: string;           // Unique execution ID for tracing
  object: string;        // Target object name (e.g., 'account')
  event: HookEventType;  // Current event (e.g., 'beforeInsert')

  // Mutable data
  input: Record<string, unknown>;    // Operation parameters (MUTABLE)
  result?: unknown;                  // Operation result (MUTABLE, after* only)
  previous?: Record<string, unknown>; // Previous state (update/delete)

  // Execution context
  session?: {
    userId?: string;
    tenantId?: string;
    roles?: string[];
    accessToken?: string;
  };

  transaction?: unknown;  // Database transaction handle

  // Engine access
  ql: IDataEngine;       // ObjectQL engine instance
  api?: ScopedContext;   // Cross-object CRUD API

  // User info shortcut
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
}
```

### `input` — Operation Parameters

The structure of `ctx.input` varies by event:

**Insert operations:**
```typescript
// beforeInsert, afterInsert
{
  // All field values being inserted
  name: 'Acme Corp',
  industry: 'Technology',
  annual_revenue: 5000000,
  ...
}
```

**Update operations:**
```typescript
// beforeUpdate, afterUpdate
{
  id: '123',  // Record ID being updated
  // Only fields being changed
  status: 'active',
  updated_at: '2026-04-13T10:00:00Z',
}
```

**Delete operations:**
```typescript
// beforeDelete, afterDelete
{
  id: '123',  // Record ID being deleted
}
```

**Query operations:**
```typescript
// beforeFind, afterFind
{
  query: {
    filter: { status: 'active' },
    sort: [{ field: 'created_at', order: 'desc' }],
    limit: 50,
    offset: 0,
  },
  options: { includeCount: true },
}
```

### `result` — Operation Result

Available in `after*` hooks:

```typescript
// afterInsert
result: { id: '123', name: 'Acme Corp', ... }

// afterUpdate
result: { id: '123', status: 'active', ... }

// afterDelete
result: { success: true, id: '123' }

// afterFind
result: {
  records: [{ id: '1', ... }, { id: '2', ... }],
  total: 150,
}
```

### `previous` — Previous State

Available in update/delete hooks:

```typescript
// beforeUpdate, afterUpdate
ctx.previous: {
  id: '123',
  status: 'pending',  // Old value
  updated_at: '2026-04-01T00:00:00Z',
}

// beforeDelete, afterDelete
ctx.previous: {
  id: '123',
  name: 'Old Account',
  // ... full record state
}
```

### Cross-Object API

Access other objects within the same transaction:

```typescript
handler: async (ctx: HookContext) => {
  // Get API for another object
  const users = ctx.api?.object('user');

  // Query users
  const admin = await users.findOne({
    filter: { role: 'admin' }
  });

  // Create related record
  await ctx.api?.object('audit_log').insert({
    action: 'account_created',
    user_id: ctx.session?.userId,
    record_id: ctx.input.id,
  });
}
```

---

## Common Patterns

### 1. Setting Default Values

```typescript
const setAccountDefaults: Hook = {
  name: 'account_defaults',
  object: 'account',
  events: ['beforeInsert'],
  handler: async (ctx) => {
    // Set default industry
    if (!ctx.input.industry) {
      ctx.input.industry = 'Other';
    }

    // Set created timestamp
    ctx.input.created_at = new Date().toISOString();

    // Set owner to current user
    if (!ctx.input.owner_id && ctx.session?.userId) {
      ctx.input.owner_id = ctx.session.userId;
    }
  },
};
```

### 2. Data Validation

```typescript
const validateAccount: Hook = {
  name: 'account_validation',
  object: 'account',
  events: ['beforeInsert', 'beforeUpdate'],
  handler: async (ctx) => {
    // Validate email format
    if (ctx.input.email && !ctx.input.email.includes('@')) {
      throw new Error('Invalid email format');
    }

    // Validate website URL
    if (ctx.input.website && !ctx.input.website.startsWith('http')) {
      throw new Error('Website must start with http or https');
    }

    // Check annual revenue
    if (ctx.input.annual_revenue && ctx.input.annual_revenue < 0) {
      throw new Error('Annual revenue cannot be negative');
    }
  },
};
```

### 3. Preventing Deletion

```typescript
const protectStrategicAccounts: Hook = {
  name: 'protect_strategic_accounts',
  object: 'account',
  events: ['beforeDelete'],
  handler: async (ctx) => {
    // ctx.previous contains the record being deleted
    if (ctx.previous?.type === 'Strategic') {
      throw new Error('Cannot delete Strategic accounts');
    }

    // Check for active opportunities
    const oppCount = await ctx.api?.object('opportunity').count({
      filter: {
        account_id: ctx.input.id,
        stage: { $in: ['Prospecting', 'Negotiation'] }
      }
    });

    if (oppCount && oppCount > 0) {
      throw new Error(`Cannot delete account with ${oppCount} active opportunities`);
    }
  },
};
```

### 4. Data Enrichment

```typescript
const enrichLeadScore: Hook = {
  name: 'lead_scoring',
  object: 'lead',
  events: ['beforeInsert', 'beforeUpdate'],
  handler: async (ctx) => {
    let score = 0;

    // Email domain scoring
    if (ctx.input.email?.endsWith('@enterprise.com')) {
      score += 50;
    }

    // Phone number bonus
    if (ctx.input.phone) {
      score += 20;
    }

    // Company size scoring
    if (ctx.input.company_size === 'Enterprise') {
      score += 30;
    }

    // Industry scoring
    if (ctx.input.industry === 'Technology') {
      score += 25;
    }

    ctx.input.score = score;
  },
};
```

### 5. Triggering Workflows

```typescript
const notifyOnStatusChange: Hook = {
  name: 'notify_status_change',
  object: 'opportunity',
  events: ['afterUpdate'],
  async: true,  // Fire-and-forget
  handler: async (ctx) => {
    // Detect status change
    const oldStatus = ctx.previous?.stage;
    const newStatus = ctx.input.stage;

    if (oldStatus !== newStatus) {
      // Send notification (async, doesn't block transaction)
      console.log(`Opportunity ${ctx.input.id} moved from ${oldStatus} to ${newStatus}`);

      // Could trigger email, Slack notification, etc.
      // await sendEmail({
      //   to: ctx.user?.email,
      //   subject: `Opportunity stage changed to ${newStatus}`,
      //   body: `...`
      // });
    }
  },
};
```

### 6. Creating Related Records

```typescript
const createAuditTrail: Hook = {
  name: 'audit_trail',
  object: ['account', 'contact', 'opportunity'],
  events: ['afterInsert', 'afterUpdate', 'afterDelete'],
  async: false,  // Must run in transaction
  handler: async (ctx) => {
    const action = ctx.event.replace('after', '').toLowerCase();

    await ctx.api?.object('audit_log').insert({
      object_type: ctx.object,
      record_id: String(ctx.input.id || ''),
      action,
      user_id: ctx.session?.userId,
      timestamp: new Date().toISOString(),
      changes: ctx.event === 'afterUpdate' ? {
        before: ctx.previous,
        after: ctx.result,
      } : undefined,
    });
  },
};
```

### 7. External API Integration

```typescript
const syncToExternalCRM: Hook = {
  name: 'sync_external_crm',
  object: 'account',
  events: ['afterInsert', 'afterUpdate'],
  async: true,  // Don't block the main transaction
  timeout: 10000,  // 10 second timeout
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 2000,
  },
  handler: async (ctx) => {
    try {
      // Call external API
      // await fetch('https://external-crm.com/api/accounts', {
      //   method: 'POST',
      //   headers: { 'Authorization': 'Bearer ...' },
      //   body: JSON.stringify(ctx.result),
      // });

      console.log(`Synced account ${ctx.input.id} to external CRM`);
    } catch (error) {
      // Error is logged but doesn't abort the operation
      console.error('Failed to sync to external CRM', error);
    }
  },
};
```

### 8. Multi-Object Logic

```typescript
const cascadeAccountUpdate: Hook = {
  name: 'cascade_account_updates',
  object: 'account',
  events: ['afterUpdate'],
  handler: async (ctx) => {
    // If account industry changed, update all contacts
    if (ctx.input.industry && ctx.previous?.industry !== ctx.input.industry) {
      await ctx.api?.object('contact').updateMany({
        filter: { account_id: ctx.input.id },
        data: { account_industry: ctx.input.industry },
      });
    }
  },
};
```

### 9. Conditional Execution

```typescript
const highValueAccountAlert: Hook = {
  name: 'high_value_alert',
  object: 'account',
  events: ['afterInsert'],
  // Only run for high-value accounts
  condition: "annual_revenue > 10000000",
  async: true,
  handler: async (ctx) => {
    console.log(`🚨 High-value account created: ${ctx.result.name}`);
    // Send alert to sales leadership
  },
};
```

### 10. Data Masking (Read Operations)

```typescript
const maskSensitiveData: Hook = {
  name: 'mask_pii',
  object: ['contact', 'lead'],
  events: ['afterFind', 'afterFindOne'],
  handler: async (ctx) => {
    // Check user role
    const isAdmin = ctx.session?.roles?.includes('admin');

    if (!isAdmin) {
      // Mask sensitive fields
      const maskField = (record: any) => {
        if (record.ssn) {
          record.ssn = '***-**-' + record.ssn.slice(-4);
        }
        if (record.credit_card) {
          record.credit_card = '**** **** **** ' + record.credit_card.slice(-4);
        }
      };

      if (Array.isArray(ctx.result?.records)) {
        ctx.result.records.forEach(maskField);
      } else if (ctx.result) {
        maskField(ctx.result);
      }
    }
  },
};
```

---

## Registration Methods

### Method 1: Declarative (Stack Definition)

**Best for:** Application-level hooks defined in metadata.

```typescript
// objectstack.config.ts
import { defineStack } from '@objectstack/spec';
import taskHook from './objects/task.hook';

export default defineStack({
  manifest: { /* ... */ },
  objects: [/* ... */],
  hooks: [taskHook],  // Register hooks here
});
```

### Method 2: Programmatic (Runtime)

**Best for:** Plugin-provided hooks, dynamic registration.

```typescript
// In your plugin's onEnable()
export const onEnable = async (ctx: { ql: ObjectQL }) => {
  ctx.ql.registerHook('beforeInsert', async (hookCtx) => {
    // Handler logic
  }, {
    object: 'account',
    priority: 100,
  });
};
```

### Method 3: Hook Files (Convention)

**Best for:** Organized codebases, per-object hooks.

```typescript
// src/objects/account.hook.ts
import { Hook, HookContext } from '@objectstack/spec/data';

const accountHook: Hook = {
  name: 'account_logic',
  object: 'account',
  events: ['beforeInsert', 'beforeUpdate'],
  handler: async (ctx: HookContext) => {
    // Validation logic
  },
};

export default accountHook;

// Then import and register in objectstack.config.ts
```

---

## Best Practices

### ✅ DO

1. **Use specific events** — Don't subscribe to all events if you only need one.
2. **Keep handlers focused** — One hook = one responsibility.
3. **Use `condition` for filtering** — Avoid unnecessary handler execution.
4. **Set appropriate priorities** — Ensure correct execution order.
5. **Use `async: true` for side effects** — Don't block transactions for non-critical operations.
6. **Validate early** — Use `before*` hooks for validation.
7. **Handle errors gracefully** — Provide meaningful error messages.
8. **Use `ctx.api` for cross-object operations** — Maintains transaction consistency.
9. **Document your hooks** — Use `description` and comments.
10. **Test thoroughly** — Unit test hooks in isolation.

### ❌ DON'T

1. **Don't mutate immutable properties** — `ctx.object`, `ctx.event`, `ctx.id` are read-only.
2. **Don't perform expensive operations in `before*` hooks** — Use `after*` + `async: true` instead.
3. **Don't create infinite loops** — Be careful when hooks modify data that triggers other hooks.
4. **Don't ignore `ctx.previous`** — Essential for detecting changes.
5. **Don't use `object: '*'` unless necessary** — Performance impact.
6. **Don't block on external APIs** — Use `async: true` and proper timeouts.
7. **Don't assume `ctx.session` exists** — System operations may have no user context.
8. **Don't throw in `after*` hooks unless critical** — Use `onError: 'log'` for non-critical errors.
9. **Don't duplicate validation** — Use declarative validation rules when possible.
10. **Don't forget transaction boundaries** — `async: true` runs outside transaction.

---

## Error Handling

### Throwing Errors (Abort Operation)

```typescript
handler: async (ctx) => {
  if (!ctx.input.email) {
    // Aborts operation, rolls back transaction
    throw new Error('Email is required');
  }
}
```

### Logging Errors (Continue)

```typescript
{
  onError: 'log',  // Log error, don't abort
  handler: async (ctx) => {
    try {
      await sendEmail(ctx.input.email);
    } catch (error) {
      // Error is logged, operation continues
      console.error('Failed to send email', error);
    }
  }
}
```

### Custom Error Messages

```typescript
handler: async (ctx) => {
  if (ctx.input.annual_revenue < 0) {
    throw new Error('Annual revenue cannot be negative');
  }

  if (ctx.input.annual_revenue > 1000000000) {
    throw new Error('Annual revenue exceeds maximum allowed value (1B)');
  }
}
```

---

## Testing Hooks

### Unit Testing

```typescript
import { describe, it, expect } from 'vitest';
import { HookContext } from '@objectstack/spec/data';
import accountHook from './account.hook';

describe('accountHook', () => {
  it('sets default industry', async () => {
    const ctx: Partial<HookContext> = {
      object: 'account',
      event: 'beforeInsert',
      input: { name: 'Acme Corp' },
    };

    await accountHook.handler(ctx as HookContext);

    expect(ctx.input.industry).toBe('Other');
  });

  it('validates website URL', async () => {
    const ctx: Partial<HookContext> = {
      object: 'account',
      event: 'beforeInsert',
      input: { website: 'invalid-url' },
    };

    await expect(
      accountHook.handler(ctx as HookContext)
    ).rejects.toThrow('Website must start with http');
  });
});
```

### Integration Testing

```typescript
import { LiteKernel } from '@objectstack/core';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { DriverPlugin } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';

describe('Hook Integration', () => {
  it('executes hook on insert', async () => {
    const kernel = new LiteKernel();
    kernel.use(new ObjectQLPlugin());
    kernel.use(new DriverPlugin(new InMemoryDriver()));

    // Register hook
    const ql = kernel.getService('objectql');
    ql.registerHook('beforeInsert', async (ctx) => {
      ctx.input.created_at = '2026-04-13T10:00:00Z';
    }, { object: 'account' });

    // Test insert
    const result = await ql.object('account').insert({
      name: 'Test Account',
    });

    expect(result.created_at).toBe('2026-04-13T10:00:00Z');

    await kernel.shutdown();
  });
});
```

---

## Performance Considerations

### Hook Execution Overhead

```
Single Record Insert:
┌─────────────────┬──────────────┐
│ Hook Count      │ Overhead     │
├─────────────────┼──────────────┤
│ 0 hooks         │ ~1ms         │
│ 5 hooks         │ ~5ms         │
│ 20 hooks        │ ~20ms        │
└─────────────────┴──────────────┘
```

### Optimization Tips

1. **Use `condition` to filter** — Avoid executing handlers unnecessarily.
2. **Use `async: true` for non-critical side effects** — Don't block transactions.
3. **Batch operations in `after*` hooks** — Reduce database round-trips.
4. **Cache expensive lookups** — Use kernel cache service.
5. **Use specific `object` targets** — Avoid `object: '*'`.

### Anti-Patterns

```typescript
// ❌ BAD: Expensive synchronous operation
{
  events: ['beforeInsert'],
  async: false,
  handler: async (ctx) => {
    await slowExternalAPI(ctx.input);  // Blocks transaction
  }
}

// ✅ GOOD: Async background operation
{
  events: ['afterInsert'],
  async: true,  // Fire-and-forget
  handler: async (ctx) => {
    await slowExternalAPI(ctx.result);
  }
}
```

---

## Advanced Topics

### Dynamic Hook Registration

```typescript
// Register hooks based on configuration
export const onEnable = async (ctx: { ql: ObjectQL }) => {
  const config = await loadConfig();

  config.objects.forEach(objectName => {
    ctx.ql.registerHook('beforeInsert', async (hookCtx) => {
      // Dynamic logic
    }, { object: objectName });
  });
};
```

### Hook Composition

```typescript
// Compose multiple validators
const validators = [
  validateEmail,
  validatePhone,
  validateWebsite,
];

const composedHook: Hook = {
  name: 'validation_suite',
  object: 'account',
  events: ['beforeInsert', 'beforeUpdate'],
  handler: async (ctx) => {
    for (const validator of validators) {
      await validator(ctx);
    }
  },
};
```

### Conditional Hook Execution

```typescript
const conditionalHook: Hook = {
  name: 'enterprise_only',
  object: 'account',
  events: ['afterInsert'],
  handler: async (ctx) => {
    // Check runtime condition
    if (process.env.FEATURE_FLAG_ENTERPRISE !== 'true') {
      return;  // Skip execution
    }

    // Enterprise-specific logic
  },
};
```

---

## Troubleshooting

### Common Issues

**Issue:** Hook not executing

**Solutions:**
1. Check `object` matches target object name
2. Verify `events` includes the expected event
3. Check `condition` doesn't filter out all records
4. Ensure hook is registered before operations

**Issue:** Transaction rollback on `after*` hook error

**Solution:** Set `onError: 'log'` or `async: true`

**Issue:** Infinite loop (hook triggers itself)

**Solution:** Use conditional checks, track execution state

**Issue:** `ctx.api` is undefined

**Solution:** Ensure ObjectQL engine is initialized with API support

**Issue:** Performance degradation

**Solutions:**
1. Use `async: true` for non-critical operations
2. Add `condition` to filter executions
3. Reduce number of global (`object: '*'`) hooks

---

## References

- [hook.zod.ts](./references/data/hook.zod.ts) — Hook schema definition, HookContext interface
- [Examples: app-todo](../../examples/app-todo/src/objects/task.hook.ts) — Simple task hook
- [Examples: app-crm](../../examples/app-crm/src/objects/) — Advanced CRM hooks

---

## Summary

Hooks are the **primary extension mechanism** in ObjectStack. They enable you to:

- ✅ Add custom validation and business rules
- ✅ Enrich data with calculated fields
- ✅ Trigger side effects and integrations
- ✅ Enforce security and compliance
- ✅ Implement audit trails
- ✅ Transform data in/out

**Golden Rules:**

1. Use `before*` for validation, `after*` for side effects
2. Set `async: true` for non-critical background work
3. Use `ctx.api` for cross-object operations
4. Handle errors gracefully with meaningful messages
5. Test hooks in isolation and integration

For more advanced patterns, see the **objectstack-automation** skill for Flows and Workflows.
