# Filter Rules

Comprehensive guide for building ObjectStack query filters.

## Operator Reference

| Category | Operator | SQL Equivalent | Example |
|:---------|:---------|:---------------|:--------|
| Equality | `$eq` | `=` | `{ status: { $eq: 'active' } }` |
| Equality | `$ne` | `<>` | `{ status: { $ne: 'deleted' } }` |
| Comparison | `$gt` | `>` | `{ age: { $gt: 18 } }` |
| Comparison | `$gte` | `>=` | `{ amount: { $gte: 100 } }` |
| Comparison | `$lt` | `<` | `{ price: { $lt: 50 } }` |
| Comparison | `$lte` | `<=` | `{ score: { $lte: 100 } }` |
| Set | `$in` | `IN (...)` | `{ status: { $in: ['active', 'pending'] } }` |
| Set | `$nin` | `NOT IN (...)` | `{ role: { $nin: ['guest'] } }` |
| Range | `$between` | `BETWEEN ? AND ?` | `{ age: { $between: [18, 65] } }` |
| String | `$contains` | `LIKE %?%` | `{ name: { $contains: 'john' } }` |
| String | `$notContains` | `NOT LIKE %?%` | `{ email: { $notContains: 'spam' } }` |
| String | `$startsWith` | `LIKE ?%` | `{ code: { $startsWith: 'PRJ-' } }` |
| String | `$endsWith` | `LIKE %?` | `{ file: { $endsWith: '.pdf' } }` |
| Null | `$null` | `IS NULL` / `IS NOT NULL` | `{ deleted_at: { $null: true } }` |
| Existence | `$exists` | (NoSQL) `$exists` | `{ metadata: { $exists: true } }` |

## Implicit Equality (Shorthand)

The most common filter — equality — has a shorthand:

```typescript
// ✅ Implicit equality (preferred for simple cases)
where: { status: 'active' }

// ✅ Explicit equality (same result)
where: { status: { $eq: 'active' } }
```

## Logical Operators

### AND (implicit)

All top-level conditions are AND-combined by default:

```typescript
// ✅ Implicit AND — all conditions must match
where: {
  status: 'active',
  role: 'admin',
  age: { $gte: 18 }
}

// ✅ Explicit $and — same result
where: {
  $and: [
    { status: 'active' },
    { role: 'admin' },
    { age: { $gte: 18 } }
  ]
}
```

### OR

```typescript
// ✅ Find admins OR managers
where: {
  $or: [
    { role: 'admin' },
    { role: 'manager' }
  ]
}

// ✅ Equivalent using $in
where: {
  role: { $in: ['admin', 'manager'] }
}
```

### NOT

```typescript
// ✅ Exclude deleted records
where: {
  $not: { status: 'deleted' }
}
```

### Combining Logical Operators

```typescript
// ✅ Active users who are admin OR have high score
where: {
  status: 'active',            // AND
  $or: [
    { role: 'admin' },
    { score: { $gte: 90 } }
  ]
}
```

## Field References

Compare a field against another field (not a literal value):

```typescript
// ✅ Find records where actual exceeds budget
where: {
  actual_cost: { $gt: { $field: 'budget' } }
}

// ✅ Find overdue tasks (due_date before today is handled by runtime)
where: {
  end_date: { $lt: { $field: 'start_date' } }
}
```

## Nested Relation Filters

Filter by a related object's fields:

```typescript
// ✅ Find orders where the customer is in the US
where: {
  customer: {
    country: 'US'
  }
}

// ✅ Deeper nesting
where: {
  customer: {
    organization: {
      industry: 'Technology'
    }
  }
}
```

## Common Mistakes

### ❌ Wrong: Multiple operators on different fields inside $or

```typescript
// ❌ This is an AND, not an OR
where: {
  role: 'admin',
  status: 'active'
}
// Correct only if you want both conditions

// ✅ For OR, wrap in $or array
where: {
  $or: [
    { role: 'admin' },
    { status: 'active' }
  ]
}
```

### ❌ Wrong: Using string operators on non-string fields

```typescript
// ❌ $contains only works on string fields
where: {
  age: { $contains: '25' }  // age is a number
}

// ✅ Use comparison operators for numbers
where: {
  age: { $eq: 25 }
}
```

### ❌ Wrong: Using $between with wrong tuple length

```typescript
// ❌ $between requires exactly [min, max]
where: {
  price: { $between: [10, 50, 100] }
}

// ✅ Correct: exactly two elements
where: {
  price: { $between: [10, 50] }
}
```

### ❌ Wrong: Null check with equality

```typescript
// ❌ Don't use equality to check for null
where: {
  deleted_at: null
}

// ✅ Use $null operator
where: {
  deleted_at: { $null: true }
}
```

## Date Filtering Patterns

```typescript
// Records created in the last 7 days (compute date in application code)
where: {
  created_at: { $gte: new Date('2025-01-01') }
}

// Records within a date range
where: {
  created_at: {
    $between: [new Date('2025-01-01'), new Date('2025-03-31')]
  }
}
```
