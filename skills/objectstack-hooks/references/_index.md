# ObjectStack Hooks — Schema Reference Index

This directory contains reference schemas for developing data lifecycle hooks.

## Available Schemas

### Data Schemas

| File | Description |
|:-----|:------------|
| [hook.zod.ts](./data/hook.zod.ts) | Hook definition schema, HookContext interface, lifecycle events |

## Usage

These reference files are **read-only snapshots** of the canonical schemas from `@objectstack/spec`.
They are provided for quick reference when developing hooks.

**Import from the spec package in your code:**

```typescript
import { Hook, HookContext, HookEvent } from '@objectstack/spec/data';
```

## Schema Relationships

```
Hook Definition
├── name: string (snake_case)
├── object: string | string[] | '*'
├── events: HookEvent[]
│   ├── beforeFind, afterFind
│   ├── beforeFindOne, afterFindOne
│   ├── beforeCount, afterCount
│   ├── beforeAggregate, afterAggregate
│   ├── beforeInsert, afterInsert
│   ├── beforeUpdate, afterUpdate
│   ├── beforeDelete, afterDelete
│   ├── beforeUpdateMany, afterUpdateMany
│   └── beforeDeleteMany, afterDeleteMany
├── handler: Function | string
├── priority: number (default: 100)
├── async: boolean (default: false)
├── condition?: string (formula expression)
├── onError: 'abort' | 'log' (default: 'abort')
├── timeout?: number (ms)
└── retryPolicy?: { maxRetries, backoffMs }

HookContext (Runtime)
├── id?: string (execution ID)
├── object: string
├── event: HookEvent
├── input: Record<string, unknown> (MUTABLE)
├── result?: unknown (MUTABLE, after* only)
├── previous?: Record<string, unknown>
├── session?: { userId, tenantId, roles, accessToken }
├── transaction?: unknown
├── ql: IDataEngine
├── api?: ScopedContext
└── user?: { id, name, email }
```

## Update Frequency

These reference files are updated when the spec package changes.
Always check the spec package for the latest schema definitions.

Last updated: 2026-04-13
