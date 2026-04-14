# REST API Patterns

Guide for designing REST APIs in ObjectStack.

## Auto-Generated APIs

ObjectStack automatically generates REST APIs for all objects with `apiEnabled: true`:

```
GET    /api/v1/objects/{object}           # List records
GET    /api/v1/objects/{object}/{id}      # Get single record
POST   /api/v1/objects/{object}           # Create record
PATCH  /api/v1/objects/{object}/{id}      # Update record
DELETE /api/v1/objects/{object}/{id}      # Delete record
```

## API Configuration

```typescript
{
  enable: {
    apiEnabled: true,
    apiMethods: ['get', 'list', 'create', 'update', 'delete'],
  }
}
```

## Query Parameters

- `filter` — JSON filter expression
- `sort` — Sort fields (e.g., `?sort=-created_at`)
- `limit` — Page size (default: 50, max: 200)
- `offset` — Pagination offset
- `fields` — Select specific fields

## Incorrect vs Correct

### ❌ Incorrect — Exposing Sensitive Objects

```typescript
{
  name: 'user_password_reset',
  enable: {
    apiEnabled: true,  // ❌ Sensitive data exposed
  }
}
```

### ✅ Correct — Disable API for Sensitive Objects

```typescript
{
  name: 'user_password_reset',
  enable: {
    apiEnabled: false,  // ✅ Not exposed via API
  }
}
```

## Best Practices

1. **Disable APIs for internal objects** — System/sensitive objects
2. **Use apiMethods whitelist** — Limit operations (e.g., read-only)
3. **Implement rate limiting** — Protect against abuse
4. **Use field-level permissions** — Control data visibility
5. **Validate input** — Use validation rules

---

See parent skill for complete documentation: [../SKILL.md](../SKILL.md)
