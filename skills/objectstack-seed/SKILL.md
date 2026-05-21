---
name: objectstack-seed
description: >
  Define and manage seed data (fixtures) for ObjectStack objects using defineDataset().
  Use when populating system bootstrap data, reference data, demo/test fixtures, or
  any initial records for an ObjectStack project.
  ALWAYS use this skill when you see: "seed data", "fixtures", "demo data", "bootstrap data",
  "initial records", "defineDataset", "test data", "reference data", "load data",
  "import records", "populate object".
  Do NOT use for querying or filtering records — use objectstack-query instead.
  Do NOT use for defining the object schema itself — use objectstack-schema instead.
license: Apache-2.0
compatibility: Requires @objectstack/spec v4+
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: seed
  tags: seed, dataset, fixtures, bootstrap, demo, reference-data, import, upsert
---

# Seed Data & Fixtures — ObjectStack Data Protocol

Expert instructions for defining type-safe seed data using `defineDataset()` in
ObjectStack. This skill covers all import modes, environment scoping, upsert key
selection, relationship references, and best practices for idempotent data loading.

---

## Skill Boundaries

| Need | Use instead |
|:-----|:------------|
| Define object schema or fields | **objectstack-schema** |
| Query, filter, or aggregate records | **objectstack-query** |
| Define REST API endpoints | **objectstack-api** |
| Create automation flows or triggers | **objectstack-automation** |

---

## When to Use This Skill

- You need to **bootstrap system data** (admin accounts, default roles, standard picklist values)
- You need **reference / lookup data** (countries, currencies, ISO codes)
- You need **demo or test fixtures** that should be re-loadable without duplicates
- You need to **control which environments** receive specific records (`prod` vs `dev` vs `test`)
- You need **type-safe record authoring** — field names checked at compile time

---

## Core Concepts

### `defineDataset()`

`defineDataset()` is a type-safe factory that creates a `Dataset` object. It accepts
the **object definition** (not just a string name) so TypeScript can infer and validate
the field keys of every record at compile time.

```typescript
import { defineDataset } from '@objectstack/spec/data';
import { MyObject } from './my-object.object';

export const myObjectSeed = defineDataset(MyObject, {
  externalId: 'name',   // field used as upsert key
  mode: 'upsert',       // conflict resolution strategy
  env: ['prod', 'dev', 'test'],
  records: [
    { name: 'Record A', status: 'active' },
    { name: 'Record B', status: 'inactive' },
  ],
});
```

### `Dataset` Schema Fields

| Field | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `object` | `string` | — | Auto-derived from `objectDef.name` — do not set manually |
| `externalId` | `string` | `'name'` | Field used as the idempotency / upsert key |
| `mode` | `DatasetImportMode` | `'upsert'` | Conflict resolution strategy (see Import Modes) |
| `env` | `Array<'prod' \| 'dev' \| 'test'>` | `['prod','dev','test']` | Environments where this dataset is loaded |
| `records` | `Array<Partial<Record<keyof TObj['fields'], unknown>>>` | — | The data payload |

---

## Quick-Start Template

```typescript
// src/data/index.ts
import { defineDataset } from '@objectstack/spec/data';
import { Status } from '../objects/status.object';
import { Category } from '../objects/category.object';

// Reference data — safe to run in all environments
export const statusSeed = defineDataset(Status, {
  externalId: 'code',
  mode: 'upsert',
  records: [
    { code: 'active',   label: 'Active',   color: '#2ecc71' },
    { code: 'inactive', label: 'Inactive', color: '#95a5a6' },
    { code: 'archived', label: 'Archived', color: '#e74c3c' },
  ],
});

// Demo data — only in dev and test environments
export const categorySeed = defineDataset(Category, {
  externalId: 'slug',
  mode: 'upsert',
  env: ['dev', 'test'],
  records: [
    { slug: 'electronics', name: 'Electronics', is_active: true },
    { slug: 'software',    name: 'Software',    is_active: true },
  ],
});

/** Export all datasets as a flat array for the seed runner */
export const SeedData = [statusSeed, categorySeed];
```

---

## Import Modes

### `upsert` (Default — recommended for most use cases)

Creates a new record if none matches `externalId`; updates the existing record if
one is found. Idempotent — safe to run repeatedly.

```typescript
defineDataset(Country, {
  externalId: 'code',
  mode: 'upsert',
  records: [
    { code: 'US', name: 'United States', dial_code: '+1' },
    { code: 'GB', name: 'United Kingdom', dial_code: '+44' },
  ],
});
```

**Use for:** reference data, system bootstrap records, anything that must survive re-runs.

---

### `insert`

Attempts to insert every record. Fails (throws error) on a duplicate `externalId`.

```typescript
defineDataset(AuditLog, {
  externalId: 'event_id',
  mode: 'insert',
  env: ['test'],
  records: [
    { event_id: 'evt_001', action: 'login', user: 'alice@example.com' },
  ],
});
```

**Use for:** append-only tables, audit logs, immutable event streams.

---

### `update`

Only updates records that already exist (matched by `externalId`). Ignores records
with no match — never creates new records.

```typescript
defineDataset(SystemConfig, {
  externalId: 'key',
  mode: 'update',
  records: [
    { key: 'max_upload_size', value: '50mb' },
  ],
});
```

**Use for:** patching configuration that must already exist; migration scripts that
should never create rows.

---

### `ignore`

Tries to insert; silently skips duplicates without error.

```typescript
defineDataset(DefaultRole, {
  externalId: 'code',
  mode: 'ignore',
  records: [
    { code: 'admin',  label: 'Administrator' },
    { code: 'viewer', label: 'Viewer' },
  ],
});
```

**Use for:** additive bootstrap data where idempotency is required but updates to
existing records are undesired.

---

### `replace` ⚠️ Dangerous

Deletes **all records** in the object first, then inserts the new records. Data loss
is guaranteed for existing records not in the payload.

```typescript
defineDataset(CacheTable, {
  externalId: 'key',
  mode: 'replace',
  env: ['dev'],
  records: [
    { key: 'rates_usd', value: '1.00' },
    { key: 'rates_eur', value: '0.92' },
  ],
});
```

**Use for:** ephemeral cache tables or lookup tables that must be fully rebuilt on
each seed run. Never use on objects that contain user-generated data.

---

## Environment Scoping

The `env` array controls which deployment environments receive the records.

| Value | When loaded |
|:------|:------------|
| `'prod'` | Production environment |
| `'dev'` | Development / local environment |
| `'test'` | CI/CD and automated test environment |

```typescript
// Loaded everywhere — safe bootstrap data
defineDataset(Currency, {
  env: ['prod', 'dev', 'test'],  // this is the default — can be omitted
  records: [...],
});

// Demo accounts — never reach production
defineDataset(Account, {
  env: ['dev', 'test'],
  records: [
    { name: 'Acme Demo Corp', type: 'customer' },
  ],
});

// Specific CI fixtures — test environment only
defineDataset(TestUser, {
  env: ['test'],
  records: [
    { email: 'ci-user@example.com', role: 'admin' },
  ],
});
```

---

## `externalId` — Upsert Key Selection

The `externalId` field identifies an existing record for update/upsert/ignore
operations. Choosing the right key is critical for idempotency.

### Best Practices

| Scenario | Recommended `externalId` |
|:---------|:------------------------|
| Named entities (countries, currencies) | `'code'` or `'slug'` |
| User records | `'email'` |
| Generic named records | `'name'` (default) |
| Externally sourced data | `'external_id'` |
| Avoid | `'id'` — UUIDs are environment-specific and not portable |

```typescript
// Good — stable natural key
defineDataset(Contact, {
  externalId: 'email',
  records: [{ email: 'alice@example.com', first_name: 'Alice' }],
});

// Good — stable code
defineDataset(Country, {
  externalId: 'code',
  records: [{ code: 'US', name: 'United States' }],
});

// Avoid — UUIDs differ between environments
defineDataset(Product, {
  externalId: 'id',  // ❌ not portable
  records: [...],
});
```

---

## Relationship Fields

When a record has a `lookup` field referencing another object, supply the
**natural key value** of the related record (e.g., `name`, `email`, `code`) — not
the UUID. The seed runner resolves natural keys to IDs automatically.

```typescript
// accounts must be seeded before contacts
const accounts = defineDataset(Account, {
  externalId: 'name',
  records: [
    { name: 'Acme Corporation', type: 'customer' },
  ],
});

const contacts = defineDataset(Contact, {
  externalId: 'email',
  records: [
    {
      email: 'john@acme.example.com',
      first_name: 'John',
      last_name: 'Smith',
      account: 'Acme Corporation',  // natural key — resolved at load time
    },
  ],
});
```

**Rule:** Always seed parent records before child records so references can resolve.
Export datasets in dependency order.

---

## Dynamic Values (CEL Expressions)

Any field value in a seed record may be a CEL expression that the SeedLoader
evaluates at install time using a single per-load pinned `now`. This is the
**only** correct way to author dates / identity-derived values in seeds —
`new Date()` and `Date.now()` evaluate at compile time and ship the package
author's clock to every customer.

```typescript
import { defineDataset, cel } from '@objectstack/spec';

export const opportunities = defineDataset(Opportunity, {
  records: [
    {
      name: 'Acme Q3 Renewal',
      close_date: cel`daysFromNow(45)`,
      created_at: cel`now()`,
      owner_id:   cel`os.user.id`,         // installer becomes owner
      organization_id: cel`os.org.id`,
    },
    {
      name: 'Lapsed deal',
      close_date: cel`daysAgo(30)`,        // 30 days before install
    },
  ],
});
```

**Available stdlib in seed context:** `now()`, `today()`, `daysFromNow(n)`,
`daysAgo(n)`, `isBlank(v)`, `coalesce(v, fallback)`, plus the variable scope
`os.user`, `os.org`, `os.env`. See **objectstack-formula** for the full
contract.

**Determinism gate.** Two consecutive `objectstack build` runs with no source
changes must produce byte-identical `dist/objectstack.json`. CEL plus pinned
`now` is what guarantees this. **Do not** use `new Date()` or `Date.now()` in
seed records — CI will fail the SHA-1 comparison.

---

## Type Safety

`defineDataset()` infers valid field keys from the object definition passed as the
first argument. Typos in record field names are caught at compile time.

```typescript
import { Account } from './account.object';

defineDataset(Account, {
  records: [
    { name: 'Test Corp', typo_field: 'value' },
    //                   ^^^^^^^^^^^
    //  TS Error: Object literal may only specify known properties,
    //  and 'typo_field' does not exist in type 'Partial<Record<keyof ...>>'
  ],
});
```

This is a core advantage over plain `DatasetSchema.parse({...})` — always prefer
`defineDataset()` over the raw schema.

---

## Organising Multiple Datasets

For applications with multiple objects, co-locate all seed files under `src/data/`
and export a single aggregate array for the seed runner.

```
src/
  data/
    index.ts          ← exports SeedData array
    accounts.seed.ts
    contacts.seed.ts
    products.seed.ts
```

```typescript
// src/data/index.ts
import { accountsSeed } from './accounts.seed';
import { contactsSeed } from './contacts.seed';
import { productsSeed } from './products.seed';

// Order matters — parents before children
export const SeedData = [
  accountsSeed,
  contactsSeed,
  productsSeed,
];
```

---

## Best Practices

| Practice | Detail |
|:---------|:-------|
| **Always use `defineDataset()`** | Never use `DatasetSchema.parse()` directly — you lose compile-time field checking |
| **Prefer natural keys** | Set `externalId` to a stable business key (`code`, `email`, `slug`) — avoid `id` |
| **Default to `upsert`** | `upsert` is the idempotent default; use other modes only when the use case demands it |
| **Scope with `env`** | Keep demo/test data out of production by setting `env: ['dev', 'test']` |
| **Seed in dependency order** | Parent objects must appear before child objects in the exported array |
| **Use `replace` sparingly** | Only for cache/lookup tables with no user data; document the intent clearly |
| **Keep records realistic** | Demo data should reflect realistic values — it will appear in screenshots and demos |
| **One file per object** | Split large seed sets into `{object}.seed.ts` files for readability |

---

## CRM Seed Blueprint

Reference shape: `src/data/index.ts`

1. Use **one `defineDataset()` per object** (`account`, `contact`, `lead`, `opportunity`, ...), then export a single ordered array.
2. Keep **dependency order explicit** (parent first, child later), e.g. account → contact → opportunity.
3. Prefer **natural keys** for cross-record references (`account: 'Acme Corporation'`, `externalId: 'email'`).
4. Use **CEL dynamic values** (`cel\`daysFromNow(45)\``, `cel\`daysAgo(3)\``) for deterministic time-based fixtures.
5. For generated fixture loops, wrap date helpers (`celDaysAgo`, `celDaysFromNow`) to keep expressions valid inside `.map()`.

This pattern is the baseline for realistic demo + test seed packs in metadata applications.

---

## References

- [references/dataset.zod.ts](./references/dataset.zod.ts) — `DatasetSchema`, `DatasetMode`, `defineDataset()` source
- [packages/spec/src/data/dataset.zod.ts](../../packages/spec/src/data/dataset.zod.ts) — Canonical source
- [objectstack-schema](../objectstack-schema/SKILL.md) — Object & field schema design
- [objectstack-query](../objectstack-query/SKILL.md) — Querying seeded data
