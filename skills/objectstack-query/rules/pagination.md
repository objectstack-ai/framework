# Pagination Rules

Guide for implementing pagination in ObjectStack queries.

## Strategies Overview

| Strategy | Best For | Pros | Cons |
|:---------|:---------|:-----|:-----|
| Offset | UI page navigation, small datasets | Simple, random page access | Slow on large offsets, drift on inserts |
| Cursor | Infinite scroll, real-time feeds | Consistent results, O(1) performance | No random page access |

## Offset Pagination

```typescript
// Page 1 (first 20 records)
{
  object: 'post',
  where: { published: true },
  orderBy: [{ field: 'created_at', order: 'desc' }],
  limit: 20,
  offset: 0
}

// Page 3 (records 41–60)
{
  object: 'post',
  where: { published: true },
  orderBy: [{ field: 'created_at', order: 'desc' }],
  limit: 20,
  offset: 40
}
```

### OData Compatibility

`top` is an alias for `limit` (for OData-style APIs):

```typescript
// These are equivalent
{ limit: 20 }
{ top: 20 }
```

## Cursor Pagination

Cursor pagination uses the last record's sort key values to fetch the next page.

```typescript
// First page
{
  object: 'post',
  orderBy: [{ field: 'created_at', order: 'desc' }],
  limit: 20
}

// Next page — pass the last record's values as cursor
{
  object: 'post',
  orderBy: [{ field: 'created_at', order: 'desc' }],
  limit: 20,
  cursor: {
    created_at: '2025-01-15T10:30:00Z',
    id: 'post_abc123'
  }
}
```

**⚠️ CRITICAL:** Cursor keys MUST match the `orderBy` fields for correct pagination.

```typescript
// ❌ Wrong: cursor fields don't match orderBy
{
  orderBy: [{ field: 'created_at', order: 'desc' }],
  cursor: { name: 'John' }  // name is not in orderBy!
}

// ✅ Correct: cursor fields match orderBy
{
  orderBy: [{ field: 'created_at', order: 'desc' }],
  cursor: { created_at: '2025-01-15T10:30:00Z' }
}
```

## Sorting with Pagination

**⚠️ CRITICAL:** Always combine `orderBy` with pagination for stable results.

```typescript
// ❌ Wrong: no orderBy — results are non-deterministic
{
  object: 'user',
  limit: 20,
  offset: 0
}

// ✅ Correct: explicit ordering guarantees stable pages
{
  object: 'user',
  orderBy: [{ field: 'created_at', order: 'desc' }],
  limit: 20,
  offset: 0
}
```

### Multi-field Sorting

```typescript
// Sort by status (asc), then by created date (newest first)
{
  object: 'task',
  orderBy: [
    { field: 'status', order: 'asc' },
    { field: 'created_at', order: 'desc' }
  ],
  limit: 50
}
```

## REST API Pagination Pattern

When building paginated REST endpoints:

```typescript
// GET /api/v1/posts?limit=20&offset=40
// Maps to:
{
  object: 'post',
  limit: 20,
  offset: 40,
  orderBy: [{ field: 'created_at', order: 'desc' }]
}

// Response includes pagination metadata
{
  data: [...],
  pagination: {
    total: 150,
    limit: 20,
    offset: 40,
    hasMore: true
  }
}
```

## Common Mistakes

### ❌ Wrong: Mixing cursor and offset

```typescript
// ❌ Don't use both cursor and offset
{
  object: 'post',
  limit: 20,
  offset: 40,
  cursor: { created_at: '2025-01-15T10:30:00Z' }
}

// ✅ Use one or the other
{
  object: 'post',
  limit: 20,
  cursor: { created_at: '2025-01-15T10:30:00Z' }
}
```

### ❌ Wrong: Large offset values

```typescript
// ❌ Performance degrades with large offsets (DB must scan & discard rows)
{
  object: 'post',
  limit: 20,
  offset: 100000  // Very slow on large tables
}

// ✅ Use cursor pagination for deep pagination
{
  object: 'post',
  limit: 20,
  cursor: { created_at: '2024-06-01T00:00:00Z', id: 'post_xyz' }
}
```

### ❌ Wrong: Forgetting limit (unbounded queries)

```typescript
// ❌ No limit — returns ALL records
{
  object: 'user',
  where: { status: 'active' }
}

// ✅ Always set a limit for list queries
{
  object: 'user',
  where: { status: 'active' },
  limit: 100,
  orderBy: [{ field: 'name', order: 'asc' }]
}
```

## DISTINCT Queries

Remove duplicate rows from results:

```typescript
{
  object: 'order',
  fields: ['customer_id', 'product_category'],
  distinct: true,
  orderBy: [{ field: 'customer_id', order: 'asc' }]
}
```
