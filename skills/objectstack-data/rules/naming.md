# Naming Conventions

ObjectStack enforces strict naming conventions to ensure consistency and machine readability.

## Rules

| Context | Convention | Pattern | Example |
|:--------|:-----------|:--------|:--------|
| Object `name` | `snake_case` | `/^[a-z_][a-z0-9_]*$/` | `project_task` |
| Field keys | `snake_case` | `/^[a-z_][a-z0-9_]*$/` | `first_name`, `due_date` |
| Schema property keys (TS config) | `camelCase` | Standard JS | `maxLength`, `referenceFilters` |
| Option `value` | lowercase machine ID | lowercase | `in_progress` |
| Option `label` | Any case | — | `"In Progress"` |

## Incorrect vs Correct

### ❌ Incorrect — Object Name

```typescript
export default ObjectSchema.create({
  name: 'ProjectTask',  // ❌ PascalCase not allowed
  fields: { /* ... */ }
});
```

### ✅ Correct — Object Name

```typescript
export default ObjectSchema.create({
  name: 'project_task',  // ✅ snake_case
  fields: { /* ... */ }
});
```

### ❌ Incorrect — Field Keys

```typescript
fields: {
  firstName: { type: 'text' },     // ❌ camelCase not allowed
  'Due-Date': { type: 'datetime' }, // ❌ kebab-case not allowed
  Status: { type: 'select' },       // ❌ PascalCase not allowed
}
```

### ✅ Correct — Field Keys

```typescript
fields: {
  first_name: { type: 'text' },     // ✅ snake_case
  due_date: { type: 'datetime' },   // ✅ snake_case
  status: { type: 'select' },       // ✅ snake_case
}
```

### ❌ Incorrect — Schema Properties

```typescript
{
  type: 'text',
  max_length: 255,        // ❌ snake_case not allowed for TS config
  reference_filters: {},  // ❌ snake_case not allowed for TS config
}
```

### ✅ Correct — Schema Properties

```typescript
{
  type: 'text',
  maxLength: 255,        // ✅ camelCase for TS config
  referenceFilters: {},  // ✅ camelCase for TS config
}
```

### ❌ Incorrect — Select Option Values

```typescript
options: [
  { label: 'In Progress', value: 'In Progress' },  // ❌ space/caps in value
  { label: 'Done', value: 'Done' },                // ❌ uppercase in value
]
```

### ✅ Correct — Select Option Values

```typescript
options: [
  { label: 'In Progress', value: 'in_progress' },  // ✅ lowercase, snake_case
  { label: 'Done', value: 'done' },                // ✅ lowercase
]
```

## Critical Rules

1. **Never** use `camelCase` or `PascalCase` for object names or field keys
2. **Always** use `camelCase` for TypeScript configuration property keys
3. **Option values** must be lowercase machine identifiers (use snake_case for multi-word)
4. **Option labels** can use any case for display purposes
5. **Machine names are immutable** — changing them requires data migration

## Rationale

- **snake_case for data**: Database-friendly, SQL-compatible, cross-platform consistency
- **camelCase for config**: TypeScript/JavaScript convention for object properties
- **Lowercase option values**: Case-sensitive database comparisons, URL-safe, API-friendly
