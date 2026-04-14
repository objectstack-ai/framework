---
name: objectstack-schema
description: >
  Design ObjectStack data schemas (Objects, Fields, Validations, Indexes).
  Use when creating or modifying business object definitions, choosing field types,
  configuring relationships, or setting up validation rules in an ObjectStack project.
  ALWAYS use this skill when you see: "define object", "add field", "create table",
  "data model", "schema design", "relationship", "validation rule", "index",
  "master_detail", "lookup field", "field type", "object definition".
  Do NOT use for querying, filtering, or aggregating data — use objectstack-query instead.
license: Apache-2.0
compatibility: Requires @objectstack/spec Zod schemas (v4+)
metadata:
  author: objectstack-ai
  version: "3.0"
  domain: schema
  tags: object, field, validation, index, relationship, hooks, schema, data-model
---

# Schema Design — ObjectStack Data Protocol

Expert instructions for designing business data schemas using the ObjectStack
specification. This skill covers Object definitions, Field type selection,
relationship modelling, validation rules, index strategy, and lifecycle hooks.

---

## Skill Boundaries

| Need | Use instead |
|:-----|:------------|
| Query, filter, or aggregate records | **objectstack-query** |
| Define REST API endpoints or auth | **objectstack-api** |
| Build views, dashboards, or apps | **objectstack-ui** |
| Create a plugin or register services | **objectstack-plugin** |

---

## When to Use This Skill

- You are creating a **new business object** (e.g., `account`, `project_task`)
- You need to **choose the right field type** from the 48 supported types
- You are configuring **lookup / master-detail relationships** between objects
- You need to add **validation rules** (uniqueness, cross-field, state machine, etc.)
- You are optimising **query performance with indexes**
- You are extending an existing object with new fields or capabilities
- You need to **implement data lifecycle hooks** for business logic

---

## Core Concepts

### Object Definition

An **Object** is the fundamental data entity in ObjectStack. It maps to a
database table and exposes automatic CRUD APIs.

**Required properties:**

| Property | Type   | Convention | Description |
|:---------|:-------|:-----------|:------------|
| `name`   | string | `snake_case` | Immutable machine identifier (`/^[a-z_][a-z0-9_]*$/`) |
| `fields` | map    | keys in `snake_case` | Field definitions |

**Important optional properties:**

| Property | Default | Description |
|:---------|:--------|:------------|
| `label` | Auto from `name` | Human-readable singular label |
| `pluralLabel` | — | Plural form (e.g., "Accounts") |
| `namespace` | — | Domain prefix; auto-derives `tableName` as `{namespace}_{name}` |
| `datasource` | `'default'` | Target datasource ID for virtualized data |
| `displayNameField` | `'name'` | Field used as record display name |
| `enable` | — | Capability flags (trackHistory, searchable, apiEnabled, etc.) |

### Object Capabilities (`enable`)

Toggle system behaviours per object:

| Flag | Default | Purpose |
|:-----|:--------|:--------|
| `trackHistory` | `false` | Field-level audit trail |
| `searchable` | `true` | Index records for global search |
| `apiEnabled` | `true` | Expose via automatic REST / GraphQL APIs |
| `apiMethods` | all | Whitelist specific operations (`get`, `list`, `create`, …) |
| `files` | `false` | Attachments & document management |
| `feeds` | `false` | Social feed, comments, mentions |
| `activities` | `false` | Tasks & events tracking |
| `trash` | `true` | Soft-delete with restore |
| `mru` | `true` | Most Recently Used tracking |
| `clone` | `true` | Record deep cloning |

---

## Quick Reference — Detailed Rules

For comprehensive documentation with incorrect/correct examples:

- **[Naming Conventions](./rules/naming.md)** — snake_case rules, option values, config properties
- **[Field Types](./rules/field-types.md)** — All 48 field types with decision tree and configs
- **[Relationships](./rules/relationships.md)** — lookup vs master_detail, junction patterns, delete behaviors
- **[Validation Rules](./rules/validation.md)** — All validation types, script inversion, severity levels
- **[Index Strategy](./rules/indexing.md)** — btree/gin/gist/fulltext, composite indexes, partial indexes
- **[Lifecycle Hooks](./rules/hooks.md)** — Data lifecycle hooks, before/after patterns, side effects

---

## Quick-Start Template

```typescript
import { ObjectSchema } from '@objectstack/spec';

export default ObjectSchema.create({
  name: 'support_case',
  label: 'Support Case',
  namespace: 'helpdesk',
  enable: {
    trackHistory: true,
    feeds: true,
    activities: true,
    trash: true,
  },
  fields: {
    subject:     { type: 'text', required: true, maxLength: 255 },
    description: { type: 'richtext' },
    status:      { type: 'select', required: true, options: [
      { label: 'New',       value: 'new', default: true },
      { label: 'Open',      value: 'open' },
      { label: 'Escalated', value: 'escalated', color: '#e74c3c' },
      { label: 'Resolved',  value: 'resolved',  color: '#2ecc71' },
      { label: 'Closed',    value: 'closed' },
    ]},
    priority:    { type: 'select', options: [
      { label: 'Low',    value: 'low' },
      { label: 'Medium', value: 'medium', default: true },
      { label: 'High',   value: 'high',   color: '#e67e22' },
      { label: 'Urgent', value: 'urgent',  color: '#e74c3c' },
    ]},
    account:     { type: 'lookup', reference: 'account', required: true },
    contact:     { type: 'lookup', reference: 'contact' },
    assigned_to: { type: 'lookup', reference: 'user' },
    due_date:    { type: 'datetime' },
  },
  validations: [
    {
      name: 'status_flow',
      type: 'state_machine',
      field: 'status',
      transitions: {
        new:       ['open'],
        open:      ['escalated', 'resolved'],
        escalated: ['open', 'resolved'],
        resolved:  ['open', 'closed'],
        closed:    [],
      },
      message: 'Invalid status transition.',
    },
  ],
  indexes: [
    { fields: ['status', 'priority'] },
    { fields: ['account'] },
  ],
});
```

---

## Common Patterns

### Naming Rules Summary

| Context | Convention | Example |
|:--------|:-----------|:--------|
| Object `name` | `snake_case` | `project_task` |
| Field keys | `snake_case` | `first_name`, `due_date` |
| Schema properties | `camelCase` | `maxLength`, `referenceFilters` |
| Option `value` | lowercase | `in_progress` |

See [rules/naming.md](./rules/naming.md) for incorrect/correct examples.

### Field Type Selection

48 types available. Quick categories:

- **Text:** `text`, `textarea`, `email`, `url`, `phone`, `markdown`, `html`, `richtext`
- **Numbers:** `number`, `currency`, `percent`
- **Date/Time:** `date`, `datetime`, `time`
- **Logic:** `boolean`, `toggle`
- **Selection:** `select`, `multiselect`, `radio`, `checkboxes`
- **Relational:** `lookup`, `master_detail`, `tree`
- **Media:** `image`, `file`, `avatar`, `video`, `audio`
- **Calculated:** `formula`, `summary`, `autonumber`
- **Enhanced:** `location`, `address`, `code`, `json`, `color`, `rating`, `slider`, `signature`, `qrcode`, `progress`, `tags`, `vector`

See [rules/field-types.md](./rules/field-types.md) for full reference.

### Relationship Patterns

| Pattern | Implementation |
|:--------|:---------------|
| One-to-Many (independent) | `lookup` field on child |
| One-to-Many (owned) | `master_detail` field on child |
| Many-to-Many | Junction object with two `lookup` fields |
| Hierarchical | `tree` field (self-reference) |

See [rules/relationships.md](./rules/relationships.md) for detailed examples.

### Validation Patterns

**⚠️ Script validation is inverted:** Validation **fails** when expression is `true`.

Common validation types:
- `script` — Formula expression (inverted logic)
- `unique` — Composite uniqueness
- `state_machine` — Legal state transitions
- `format` — Regex or built-in format
- `cross_field` — Compare values across fields

See [rules/validation.md](./rules/validation.md) for all types and examples.

### Index Patterns

**Omit default values:** `type` defaults to `'btree'`, `unique` defaults to `false`.

```typescript
indexes: [
  { fields: ['status', 'created_at'] },              // btree (default)
  { fields: ['email'], unique: true },                // btree + unique
  { fields: ['description'], type: 'fulltext' },      // non-default type
]
```

See [rules/indexing.md](./rules/indexing.md) for composite/partial/gin/gist indexes.

### Lifecycle Hooks

Implement business logic at data operation lifecycle points:

```typescript
import { Hook, HookContext } from '@objectstack/spec/data';

const accountHook: Hook = {
  name: 'account_defaults',
  object: 'account',
  events: ['beforeInsert'],
  handler: async (ctx: HookContext) => {
    if (!ctx.input.industry) {
      ctx.input.industry = 'Other';
    }
    ctx.input.created_at = new Date().toISOString();
  },
};

export default accountHook;
```

See [rules/hooks.md](./rules/hooks.md) for all 14 lifecycle events and patterns.

---

## Object Extension Model

When extending an object you do not own:

```typescript
{
  ownership: 'extend',
  extend: 'crm.account',      // target object FQN
  fields: { custom_score: { type: 'number' } },
  priority: 300,               // higher = applied later
}
```

- `priority` controls merge order (default `200`; range `0–999`)
- Extensions can add fields, validations, and indexes — but cannot remove them

---

## Advanced Features Checklist

| Feature | When to Consider |
|:--------|:-----------------|
| `tenancy` | Multi-tenant SaaS — choose `shared`, `isolated`, or `hybrid` |
| `softDelete` | Regulatory requirement for data retention |
| `versioning` | Audit / compliance — `snapshot`, `delta`, or `event-sourcing` |
| `partitioning` | Tables > 100M rows — `range`, `hash`, or `list` |
| `cdc` | Real-time sync to Kafka, webhooks, or data lakes |
| `encryptionConfig` | GDPR / HIPAA / PCI-DSS field-level encryption |
| `maskingRule` | PII masking for non-privileged users |

---

## References

- [rules/naming.md](./rules/naming.md) — Naming conventions with incorrect/correct examples
- [rules/field-types.md](./rules/field-types.md) — All 48 field types with decision tree
- [rules/relationships.md](./rules/relationships.md) — lookup vs master_detail, patterns
- [rules/validation.md](./rules/validation.md) — All validation types, script inversion
- [rules/indexing.md](./rules/indexing.md) — Index types, composite/partial strategies
- [rules/hooks.md](./rules/hooks.md) — Data lifecycle hooks, 14 events, patterns
- [references/data/field.zod.ts](./references/data/field.zod.ts) — FieldType enum, FieldSchema
- [references/data/object.zod.ts](./references/data/object.zod.ts) — ObjectSchema, capabilities
- [references/data/validation.zod.ts](./references/data/validation.zod.ts) — Validation rule types
- [references/data/hook.zod.ts](./references/data/hook.zod.ts) — Hook schema, HookContext
- [Schema index](./references/_index.md) — All bundled schemas with dependency tree
