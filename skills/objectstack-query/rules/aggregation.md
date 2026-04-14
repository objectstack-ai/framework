# Aggregation Rules

Guide for building ObjectStack aggregation queries.

## Aggregation Functions

| Function | SQL Equivalent | Purpose | Requires `field` |
|:---------|:---------------|:--------|:-----------------|
| `count` | `COUNT(*)` / `COUNT(field)` | Count rows | Optional |
| `sum` | `SUM(field)` | Sum numeric values | Yes |
| `avg` | `AVG(field)` | Average numeric values | Yes |
| `min` | `MIN(field)` | Minimum value | Yes |
| `max` | `MAX(field)` | Maximum value | Yes |
| `count_distinct` | `COUNT(DISTINCT field)` | Count unique values | Yes |
| `array_agg` | `ARRAY_AGG(field)` | Collect values into array | Yes |
| `string_agg` | `STRING_AGG(field, ',')` | Concatenate string values | Yes |

## Basic Aggregation

```typescript
// SQL: SELECT COUNT(*) AS total_orders FROM order
{
  object: 'order',
  aggregations: [
    { function: 'count', alias: 'total_orders' }
  ]
}
```

## Aggregation with GROUP BY

```typescript
// SQL: SELECT region, SUM(amount) AS total, AVG(amount) AS average
//      FROM sale GROUP BY region
{
  object: 'sale',
  fields: ['region'],
  aggregations: [
    { function: 'sum', field: 'amount', alias: 'total' },
    { function: 'avg', field: 'amount', alias: 'average' }
  ],
  groupBy: ['region']
}
```

**⚠️ CRITICAL:** When using `groupBy`, you MUST include the grouped fields in `fields` array.

```typescript
// ❌ Wrong: groupBy field not in fields
{
  object: 'sale',
  aggregations: [{ function: 'sum', field: 'amount', alias: 'total' }],
  groupBy: ['region']  // region not in fields!
}

// ✅ Correct: groupBy field included in fields
{
  object: 'sale',
  fields: ['region'],
  aggregations: [{ function: 'sum', field: 'amount', alias: 'total' }],
  groupBy: ['region']
}
```

## HAVING Clause

Filter aggregated results (post-aggregation filtering):

```typescript
// SQL: SELECT customer_id, COUNT(*) AS order_count
//      FROM order GROUP BY customer_id HAVING COUNT(*) > 5
{
  object: 'order',
  fields: ['customer_id'],
  aggregations: [
    { function: 'count', alias: 'order_count' }
  ],
  groupBy: ['customer_id'],
  having: {
    order_count: { $gt: 5 }
  }
}
```

**Key difference:** `where` filters rows BEFORE aggregation; `having` filters groups AFTER aggregation.

## Filtered Aggregation (FILTER WHERE)

Apply a condition to a single aggregation without affecting others:

```typescript
// SQL: SELECT
//   COUNT(*) AS total,
//   COUNT(*) FILTER (WHERE status = 'active') AS active_count
// FROM user
{
  object: 'user',
  aggregations: [
    { function: 'count', alias: 'total' },
    {
      function: 'count',
      alias: 'active_count',
      filter: { status: 'active' }
    }
  ]
}
```

## DISTINCT Aggregation

```typescript
// SQL: SELECT COUNT(DISTINCT department) FROM employee
{
  object: 'employee',
  aggregations: [
    { function: 'count_distinct', field: 'department', alias: 'dept_count' }
  ]
}

// Alternative: use distinct flag
{
  object: 'employee',
  aggregations: [
    { function: 'count', field: 'department', alias: 'dept_count', distinct: true }
  ]
}
```

## Window Functions

Window functions compute values across row sets WITHOUT collapsing results.

### ROW_NUMBER

```typescript
// Rank products within each category by sales
{
  object: 'product',
  fields: ['name', 'category', 'sales'],
  windowFunctions: [
    {
      function: 'row_number',
      alias: 'category_rank',
      over: {
        partitionBy: ['category'],
        orderBy: [{ field: 'sales', order: 'desc' }]
      }
    }
  ]
}
```

### Running Total

```typescript
// Cumulative sum of transactions
{
  object: 'transaction',
  fields: ['date', 'amount'],
  windowFunctions: [
    {
      function: 'sum',
      field: 'amount',
      alias: 'running_total',
      over: {
        orderBy: [{ field: 'date', order: 'asc' }],
        frame: {
          type: 'rows',
          start: 'UNBOUNDED PRECEDING',
          end: 'CURRENT ROW'
        }
      }
    }
  ]
}
```

### LAG / LEAD (Period-over-Period)

```typescript
// Month-over-month comparison
{
  object: 'monthly_revenue',
  fields: ['month', 'revenue'],
  windowFunctions: [
    {
      function: 'lag',
      field: 'revenue',
      alias: 'prev_month_revenue',
      over: {
        orderBy: [{ field: 'month', order: 'asc' }]
      }
    }
  ]
}
```

## Common Mistakes

### ❌ Wrong: Aggregation without alias

```typescript
// ❌ alias is required
{
  aggregations: [
    { function: 'count' }
  ]
}

// ✅ Always provide alias
{
  aggregations: [
    { function: 'count', alias: 'total' }
  ]
}
```

### ❌ Wrong: Using where to filter aggregated results

```typescript
// ❌ where filters BEFORE aggregation
{
  object: 'order',
  where: { order_count: { $gt: 5 } },  // order_count doesn't exist yet!
  aggregations: [{ function: 'count', alias: 'order_count' }],
  groupBy: ['customer_id']
}

// ✅ Use having to filter AFTER aggregation
{
  object: 'order',
  fields: ['customer_id'],
  aggregations: [{ function: 'count', alias: 'order_count' }],
  groupBy: ['customer_id'],
  having: { order_count: { $gt: 5 } }
}
```

### ❌ Wrong: sum/avg on non-numeric fields

```typescript
// ❌ Cannot sum a string field
{
  aggregations: [
    { function: 'sum', field: 'name', alias: 'total' }
  ]
}

// ✅ sum/avg only work on numeric fields
{
  aggregations: [
    { function: 'sum', field: 'amount', alias: 'total' }
  ]
}
```
