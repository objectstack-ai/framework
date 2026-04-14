# View Types and Patterns

Comprehensive guide for designing UI views in ObjectStack.

## View Types

ObjectStack supports multiple view types for different data presentation needs:

- **Grid** — Tabular data display with sorting, filtering, pagination
- **Kanban** — Card-based workflow visualization (by status/stage)
- **Calendar** — Date-based event and task scheduling
- **Gantt** — Timeline/project planning visualization
- **Form** — Create/edit record interface
- **Detail** — Single record display with related lists
- **Dashboard** — Multiple components and widgets

## Common Patterns

### Grid View Configuration

```typescript
{
  type: 'grid',
  object: 'account',
  columns: ['name', 'industry', 'annual_revenue', 'owner'],
  filters: { status: 'active' },
  sort: [{ field: 'created_at', order: 'desc' }],
}
```

### Kanban View Configuration

```typescript
{
  type: 'kanban',
  object: 'opportunity',
  groupBy: 'stage',
  cardFields: ['name', 'amount', 'close_date'],
}
```

## Incorrect vs Correct

### ❌ Incorrect — Missing Required Fields

```typescript
{
  type: 'grid',  // ❌ No object specified
  columns: ['name'],
}
```

### ✅ Correct — Complete View Definition

```typescript
{
  type: 'grid',
  object: 'account',  // ✅ Object specified
  columns: ['name', 'industry'],
}
```

## Best Practices

1. **Limit columns in grid views** — 5-7 columns max for readability
2. **Use default filters** — Pre-filter to relevant records
3. **Choose appropriate view type** — Match view to data structure
4. **Configure search** — Enable search on key fields
5. **Set pagination limits** — Balance performance and UX

---

See parent skill for complete documentation: [../SKILL.md](../SKILL.md)
