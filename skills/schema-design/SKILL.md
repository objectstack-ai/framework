---
name: schema-design
description: >
  Design ObjectStack data schemas (Objects, Fields, Validations, Indexes).
  Use when creating or modifying business object definitions, choosing field types,
  configuring relationships, or setting up validation rules in an ObjectStack project.
license: Apache-2.0
compatibility: Requires @objectstack/spec Zod schemas (v4+)
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: data
  tags: object, field, validation, index, relationship
---

# Schema Design — ObjectStack Data Protocol

Expert instructions for designing business data schemas using the ObjectStack
specification. This skill covers Object definitions, Field type selection,
relationship modelling, validation rules, and index strategy.

---

## When to Use This Skill

- You are creating a **new business object** (e.g., `account`, `project_task`).
- You need to **choose the right field type** from the 48 supported types.
- You are configuring **lookup / master-detail relationships** between objects.
- You need to add **validation rules** (uniqueness, cross-field, state machine, etc.).
- You are optimising **query performance with indexes**.
- You are extending an existing object with new fields or capabilities.

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
| `enable` | — | Capability flags (see below) |

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

## Field Type Reference

ObjectStack supports **48 field types** organised into categories.

### Text & Content

| Type | When to Use |
|:-----|:------------|
| `text` | Single-line strings (names, codes, short values) |
| `textarea` | Multi-line plain text (notes, descriptions) |
| `email` | Email addresses — built-in format validation |
| `url` | Web URLs — built-in format validation |
| `phone` | Phone numbers |
| `password` | Masked / hashed input |
| `markdown` | Markdown-formatted content |
| `html` | Raw HTML content |
| `richtext` | WYSIWYG rich text editor |

### Numbers

| Type | When to Use |
|:-----|:------------|
| `number` | Generic numeric value |
| `currency` | Monetary amounts — supports `currencyConfig` with `precision`, `currencyMode`, `defaultCurrency` |
| `percent` | Percentage values |

### Date & Time

| Type | When to Use |
|:-----|:------------|
| `date` | Date only (no time component) |
| `datetime` | Full date + time |
| `time` | Time only (no date component) |

### Logic

| Type | When to Use |
|:-----|:------------|
| `boolean` | Standard checkbox |
| `toggle` | Toggle switch (distinct UI affordance from checkbox) |

### Selection

| Type | When to Use |
|:-----|:------------|
| `select` | Single-choice dropdown; define `options` array |
| `multiselect` | Tag-style multi-choice |
| `radio` | Radio button group (fewer choices, always visible) |
| `checkboxes` | Checkbox group |

> **Critical:** Every option must have a lowercase machine `value` and a
> human-readable `label`. Optional `color` enables badge/chart styling.

### Relational

| Type | When to Use | Key Config |
|:-----|:------------|:-----------|
| `lookup` | Reference another object | `reference` (target object name) |
| `master_detail` | Parent–child with lifecycle control | `reference`, `deleteBehavior` (`cascade` / `restrict` / `set_null`) |
| `tree` | Hierarchical self-reference | `reference` |

> Set `multiple: true` on a lookup to create a many-to-many junction.

### Media

`image`, `file`, `avatar`, `video`, `audio` — all support
`fileAttachmentConfig` for size limits, allowed types, virus scanning, and
storage provider.

### Calculated

| Type | When to Use |
|:-----|:------------|
| `formula` | Computed from an `expression` referencing other fields |
| `summary` | Roll-up aggregation from child records (`count`, `sum`, `min`, `max`, `avg`) |
| `autonumber` | Auto-incrementing display format (e.g., `"CASE-{0000}"`) |

### Enhanced Types

`location`, `address`, `code`, `json`, `color`, `rating`, `slider`,
`signature`, `qrcode`, `progress`, `tags`, `vector`

> **`vector`** is for AI/ML embeddings (semantic search, RAG). Configure
> `vectorConfig` with `dimensions`, `distanceMetric`, and `indexType`.

---

## Naming Rules — Non-Negotiable

| Context | Convention | Example |
|:--------|:-----------|:--------|
| Object `name` | `snake_case` | `project_task` |
| Field keys | `snake_case` | `first_name`, `due_date` |
| Schema property keys (TS config) | `camelCase` | `maxLength`, `referenceFilters` |
| Option `value` | lowercase machine ID | `in_progress` |
| Option `label` | Any case | `"In Progress"` |

> **Never** use `camelCase` or `PascalCase` for object names or field keys.
> **Always** use `camelCase` for TypeScript configuration property keys.

---

## Relationship Modelling Guide

### When to Use `lookup` vs `master_detail`

| Criteria | `lookup` | `master_detail` |
|:---------|:---------|:-----------------|
| Lifecycle coupling | Independent | Child deleted when parent deleted |
| Required? | Optional by default | Always required |
| Sharing | Independent | Inherits parent sharing model |
| Roll-up summaries | Not available | Supported via `summary` fields |
| Use case | "Related to" | "Owned by" (e.g., Invoice → Line Items) |

### Many-to-Many Relationships

ObjectStack does not have a native many-to-many type. Model it as:

```
ObjectA ← junction_object → ObjectB
```

The junction object has two `lookup` fields, one to each side.

---

## Validation Rules — Best Practices

### Available Rule Types

| Type | Purpose |
|:-----|:--------|
| `script` | Formula expression — validation **fails** when expression is `true` |
| `unique` | Composite uniqueness across multiple fields |
| `state_machine` | Legal state transitions (e.g., `draft → submitted → approved`) |
| `format` | Regex or built-in format (`email`, `url`, `phone`, `json`) |
| `cross_field` | Compare values across fields (e.g., `end_date > start_date`) |
| `json_schema` | Validate a JSON field against a JSON Schema |
| `async` | External API validation (with timeout and debounce) |
| `custom` | Registered validator function |
| `conditional` | Apply a rule only when a condition is met |

### Common Patterns

1. **Prevent backdating:** `cross_field` with `condition: "start_date >= TODAY()"`
2. **Enforce status flow:** `state_machine` on `status` field
3. **Composite unique:** `unique` on `['tenant_id', 'email']` with `caseSensitive: false`

### Pitfalls

- `script` condition is **inverted**: `true` means **invalid**.
- Always set `severity` (`error` | `warning` | `info`) — default is `error`.
- Set `events` to control when the rule fires (`insert`, `update`, `delete`).
- Lower `priority` numbers execute **first**.

---

## Index Strategy

```typescript
indexes: [
  { fields: ['status', 'created_at'], type: 'btree' },
  { fields: ['email'], type: 'btree', unique: true },
  { fields: ['description'], type: 'fulltext' },
  { fields: ['tags'], type: 'gin' },
  { fields: ['location'], type: 'gist' },
]
```

| Type | When to Use |
|:-----|:------------|
| `btree` | Default — equality and range queries |
| `hash` | Exact equality only (rare) |
| `fulltext` | Text search columns |
| `gin` | Array / JSONB containment |
| `gist` | Geospatial / range types |

> Use `partial` indexes to index only a subset of rows
> (e.g., `partial: "status = 'active'"`).

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

- `priority` controls merge order (default `200`; range `0–999`).
- Extensions can add fields, validations, and indexes — but cannot remove them.

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
    { fields: ['status', 'priority'], type: 'btree' },
    { fields: ['account'],            type: 'btree' },
  ],
});
```

---

## References

- Zod source: `packages/spec/src/data/field.zod.ts`
- Zod source: `packages/spec/src/data/object.zod.ts`
- Zod source: `packages/spec/src/data/validation.zod.ts`
- Documentation: `content/docs/references/data/`
