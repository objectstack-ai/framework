---
name: objectstack-query
description: >
  Construct ObjectStack queries, filters, aggregations, and data retrieval patterns.
  Use when building query filters, sorting results, paginating records, aggregating data,
  writing ObjectQL expressions, or implementing full-text search in an ObjectStack project.
  ALWAYS use this skill when you see: "filter", "query", "sort", "paginate", "aggregate",
  "group by", "where clause", "$eq", "$contains", "$in", "search records",
  "count records", "sum", "average", "window function", "join", "expand",
  "cursor pagination", "offset pagination", "ObjectQL", "query DSL".
  Do NOT use for defining objects, fields, or relationships — use objectstack-schema instead.
license: Apache-2.0
compatibility: Requires @objectstack/spec Zod schemas (v4+)
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: query
  tags: query, filter, sort, pagination, aggregation, search, ObjectQL, DSL
---

# Query Design — ObjectStack Query DSL

Expert instructions for constructing data queries using the ObjectStack
Query DSL. This skill covers filter expressions, sorting, pagination,
aggregation, joins, window functions, full-text search, and the expand
system for related records.

---

## Skill Boundaries

| Need | Use instead |
|:-----|:------------|
| Define objects, fields, or relationships | **objectstack-schema** |
| Define REST API endpoints or auth | **objectstack-api** |
| Build views, dashboards, or apps | **objectstack-ui** |
| Create a plugin or register services | **objectstack-plugin** |

---

## When to Use This Skill

- You are constructing a **filter expression** for record retrieval
- You need to **sort or paginate** query results
- You are writing **aggregation queries** (count, sum, avg, group by)
- You need to **expand related records** through lookups
- You are implementing **full-text search** across fields
- You need **window functions** for analytical queries
- You are choosing between **offset vs cursor pagination**

---

## Core Concepts

### Query Structure (QueryAST)

Every ObjectStack query follows the `QuerySchema` structure:

```typescript
{
  object: 'account',           // Target object (required)
  fields: ['name', 'email'],   // SELECT — fields to retrieve
  where: { status: 'active' }, // WHERE — filter conditions
  orderBy: [{ field: 'created_at', order: 'desc' }],  // ORDER BY
  limit: 20,                   // LIMIT — max records
  offset: 0,                   // OFFSET — skip records
}
```

**Key rule:** `object` is the only required property. Everything else is optional.

---

## Quick Reference — Detailed Rules

For comprehensive documentation with incorrect/correct examples:

- **[Filters](./rules/filters.md)** — All operators, logical combinations, nested relations
- **[Aggregation](./rules/aggregation.md)** — GroupBy, aggregation functions, HAVING, window functions
- **[Pagination](./rules/pagination.md)** — Offset vs cursor, best practices, performance

---

## Filter Operators

ObjectStack uses a **declarative, database-agnostic** filter DSL inspired by
Prisma, Strapi, and MongoDB.

### Implicit Equality (Shorthand)

The simplest filter — field equals value:

```typescript
{ where: { status: 'active' } }
// SQL: WHERE status = 'active'
```

### Comparison Operators

| Operator | Purpose | SQL Equivalent | Types |
|:---------|:--------|:---------------|:------|
| `$eq` | Equal | `=` | Any |
| `$ne` | Not equal | `<>` | Any |
| `$gt` | Greater than | `>` | Number, Date |
| `$gte` | Greater than or equal | `>=` | Number, Date |
| `$lt` | Less than | `<` | Number, Date |
| `$lte` | Less than or equal | `<=` | Number, Date |

```typescript
{ where: { age: { $gte: 18 } } }
// SQL: WHERE age >= 18

{ where: { created_at: { $gt: '2025-01-01' } } }
// SQL: WHERE created_at > '2025-01-01'
```

### Set & Range Operators

| Operator | Purpose | SQL Equivalent |
|:---------|:--------|:---------------|
| `$in` | In list | `IN (...)` |
| `$nin` | Not in list | `NOT IN (...)` |
| `$between` | Inclusive range | `BETWEEN ? AND ?` |

```typescript
{ where: { status: { $in: ['active', 'pending'] } } }
// SQL: WHERE status IN ('active', 'pending')

{ where: { amount: { $between: [100, 500] } } }
// SQL: WHERE amount BETWEEN 100 AND 500
```

### String Operators

| Operator | Purpose | SQL Equivalent |
|:---------|:--------|:---------------|
| `$contains` | Contains substring | `LIKE '%?%'` |
| `$notContains` | Does not contain | `NOT LIKE '%?%'` |
| `$startsWith` | Starts with prefix | `LIKE '?%'` |
| `$endsWith` | Ends with suffix | `LIKE '%?'` |

```typescript
{ where: { email: { $contains: '@company.com' } } }
// SQL: WHERE email LIKE '%@company.com%'
```

### Null & Existence Operators

| Operator | Purpose | SQL / NoSQL |
|:---------|:--------|:------------|
| `$null` | Is null check | `IS NULL` / `IS NOT NULL` |
| `$exists` | Field exists (NoSQL) | MongoDB `$exists` |

```typescript
{ where: { deleted_at: { $null: true } } }
// SQL: WHERE deleted_at IS NULL
```

### Logical Operators

Combine conditions with `$and`, `$or`, and `$not`:

```typescript
// OR: active accounts OR accounts with high revenue
{
  where: {
    $or: [
      { status: 'active' },
      { revenue: { $gt: 1000000 } }
    ]
  }
}

// AND + OR combined
{
  where: {
    $and: [
      { type: 'enterprise' },
      { $or: [
        { region: 'us' },
        { region: 'eu' }
      ]}
    ]
  }
}

// NOT: exclude closed accounts
{
  where: {
    $not: { status: 'closed' }
  }
}
```

### Nested Relation Filters

Filter through relationships without an explicit join:

```typescript
// Filter accounts where the related contact has a verified profile
{
  object: 'account',
  where: {
    contact: {                    // Relation field name
      profile: {                  // Nested relation
        verified: true
      }
    }
  }
}
```

### Field References (Cross-Field Comparisons)

Compare two fields using `$field`:

```typescript
// Where actual_revenue > estimated_revenue
{
  where: {
    actual_revenue: { $gt: { $field: 'estimated_revenue' } }
  }
}
```

---

## Sorting

Sort with `orderBy` — an array of sort nodes:

```typescript
{
  object: 'account',
  orderBy: [
    { field: 'priority', order: 'desc' },
    { field: 'name', order: 'asc' },      // Secondary sort
  ]
}
```

**Rules:**
- Order of array elements defines sort priority
- Default `order` is `'asc'` — you can omit it for ascending sorts
- Sort fields should be indexed for performance (see **objectstack-schema** indexing rules)

---

## Pagination

### Offset Pagination (Simple)

```typescript
{
  object: 'account',
  limit: 20,
  offset: 40,   // Skip first 40 records (page 3)
}
```

**When to use:** UI pages, small datasets (<100K records), when you need "jump to page N".

**Pitfall:** Offset pagination degrades on large offsets — the database still scans skipped rows.

### Cursor Pagination (Performant)

```typescript
{
  object: 'account',
  limit: 20,
  cursor: { id: 'last-seen-id' },
  orderBy: [{ field: 'id', order: 'asc' }],
}
```

**When to use:** Infinite scroll, APIs, large datasets, real-time feeds.

**Rule:** The cursor fields must match `orderBy` fields. The engine uses them
to generate `WHERE id > ?` instead of `OFFSET`.

### OData Compatibility

`top` is an alias for `limit` (for OData-style APIs):

```typescript
{ object: 'account', top: 50 }
// Equivalent to: { object: 'account', limit: 50 }
```

---

## Aggregation

### Basic Aggregation Functions

| Function | Purpose | SQL |
|:---------|:--------|:----|
| `count` | Count rows | `COUNT(*)` or `COUNT(field)` |
| `sum` | Sum values | `SUM(field)` |
| `avg` | Average | `AVG(field)` |
| `min` | Minimum | `MIN(field)` |
| `max` | Maximum | `MAX(field)` |
| `count_distinct` | Unique count | `COUNT(DISTINCT field)` |
| `array_agg` | Collect into array | `ARRAY_AGG(field)` |
| `string_agg` | Concatenate strings | `STRING_AGG(field, ',')` |

### GroupBy + Aggregation

```typescript
// Total revenue per region
{
  object: 'deal',
  fields: ['region'],
  aggregations: [
    { function: 'sum', field: 'amount', alias: 'total_revenue' },
    { function: 'count', alias: 'deal_count' },
  ],
  groupBy: ['region'],
  orderBy: [{ field: 'total_revenue', order: 'desc' }],
}
// SQL: SELECT region, SUM(amount) AS total_revenue, COUNT(*) AS deal_count
//      FROM deal GROUP BY region ORDER BY total_revenue DESC
```

### HAVING Clause

Filter groups after aggregation:

```typescript
{
  object: 'deal',
  fields: ['region'],
  aggregations: [
    { function: 'sum', field: 'amount', alias: 'total_revenue' },
  ],
  groupBy: ['region'],
  having: { total_revenue: { $gt: 100000 } },
}
// SQL: ... HAVING SUM(amount) > 100000
```

### Filtered Aggregation

Apply a filter to a specific aggregation only:

```typescript
{
  object: 'order',
  aggregations: [
    { function: 'count', alias: 'total_orders' },
    { function: 'count', alias: 'high_value_orders',
      filter: { amount: { $gt: 1000 } } },
  ],
}
// SQL: COUNT(*) AS total_orders,
//      COUNT(*) FILTER (WHERE amount > 1000) AS high_value_orders
```

---

## Expand (Related Records)

Load related records through lookup/master_detail fields:

```typescript
{
  object: 'task',
  fields: ['title', 'status'],
  expand: {
    assignee: {
      object: 'user',
      fields: ['name', 'email'],
    },
    project: {
      object: 'project',
      fields: ['name'],
      expand: {
        org: { object: 'org', fields: ['name'] }  // Nested expand
      }
    }
  }
}
```

**Rules:**
- Max expand depth is **3** by default
- The engine resolves expands via batch `$in` queries (not N+1)
- Keys in `expand` must be lookup or master_detail field names
- Each expand value is a full `QueryAST` — you can filter, sort, and paginate within it

---

## Joins (Advanced)

For cross-object queries beyond what `expand` provides:

```typescript
{
  object: 'order',
  fields: ['id', 'amount'],
  joins: [
    {
      type: 'inner',       // 'inner' | 'left' | 'right' | 'full'
      object: 'customer',
      alias: 'c',
      on: { 'order.customer_id': { $eq: { $field: 'c.id' } } },
    }
  ],
}
```

### Join Strategy Hints

| Strategy | When to use |
|:---------|:------------|
| `auto` | Default — engine decides |
| `database` | Both objects on same datasource |
| `hash` | Cross-datasource, moderate data |
| `loop` | Small right-side lookup table |

---

## Full-Text Search

```typescript
{
  object: 'article',
  search: {
    query: 'machine learning',
    fields: ['title', 'content'],
    fuzzy: true,
    boost: { title: 2.0 },
    highlight: true,
  },
  limit: 10,
}
```

**Options:**
- `fuzzy: true` — tolerates typos
- `boost` — field-specific relevance weighting
- `operator: 'and' | 'or'` — match all terms or any term
- `minScore` — minimum relevance threshold
- `language` — text analysis language

---

## Window Functions (Analytics)

Window functions compute values across row sets without collapsing results:

```typescript
// Rank products by sales within each category
{
  object: 'product',
  fields: ['name', 'category', 'sales'],
  windowFunctions: [
    {
      function: 'row_number',
      alias: 'category_rank',
      over: {
        partitionBy: ['category'],
        orderBy: [{ field: 'sales', order: 'desc' }],
      }
    }
  ],
}
```

### Available Window Functions

| Function | Purpose |
|:---------|:--------|
| `row_number` | Sequential number within partition |
| `rank` | Rank with gaps for ties |
| `dense_rank` | Rank without gaps |
| `lag` / `lead` | Access previous/next row value |
| `first_value` / `last_value` | First/last value in window |
| `sum` / `avg` / `count` / `min` / `max` | Running aggregates |

---

## Common Patterns

### Expand vs Join: Which to Use?

| Scenario | Use |
|:---------|:----|
| Load lookup fields for display | `expand` |
| Filter parent by child conditions | Nested relation filter |
| Cross-datasource joins | `joins` with `strategy: 'hash'` |
| Analytical queries across tables | `joins` |
| Simple parent→child navigation | `expand` |

### Pagination Pattern for APIs

```typescript
// Page-based API response
{
  object: 'account',
  where: { status: 'active' },
  fields: ['id', 'name', 'email'],
  orderBy: [{ field: 'name', order: 'asc' }],
  limit: 20,
  offset: (page - 1) * 20,
}
```

### Dashboard Aggregation Pattern

```typescript
// KPI dashboard: multiple aggregations on same object
{
  object: 'deal',
  aggregations: [
    { function: 'count', alias: 'total_deals' },
    { function: 'sum', field: 'amount', alias: 'pipeline_value' },
    { function: 'avg', field: 'amount', alias: 'avg_deal_size' },
    { function: 'count', alias: 'won_deals',
      filter: { stage: 'closed_won' } },
  ],
}
```

---

## References

- [rules/filters.md](./rules/filters.md) — Complete filter operator reference
- [rules/aggregation.md](./rules/aggregation.md) — Aggregation, GroupBy, window functions
- [rules/pagination.md](./rules/pagination.md) — Offset vs cursor pagination patterns
- [references/data/query.zod.ts](./references/data/query.zod.ts) — QuerySchema, AggregationNode, JoinNode
- [references/data/filter.zod.ts](./references/data/filter.zod.ts) — FilterCondition, FieldOperators
- [Schema index](./references/_index.md) — All bundled schemas
