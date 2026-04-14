# Translation Bundles

Guide for i18n translation bundle structure in ObjectStack.

## Translation Bundle Structure

```typescript
{
  locale: 'en-US',
  namespace: 'crm',
  translations: {
    'account.label': 'Account',
    'account.pluralLabel': 'Accounts',
    'account.fields.name': 'Account Name',
    'account.fields.industry': 'Industry',
  },
}
```

## Coverage Detection

ObjectStack automatically detects untranslated keys:

- Objects without translated labels
- Fields without translated labels
- UI elements missing translations

## Naming Conventions

| Context | Pattern | Example |
|:--------|:--------|:--------|
| Object label | `{object}.label` | `account.label` |
| Object plural | `{object}.pluralLabel` | `account.pluralLabel` |
| Field label | `{object}.fields.{field}` | `account.fields.name` |
| UI element | `{namespace}.{component}.{key}` | `crm.dashboard.title` |

## Incorrect vs Correct

### ❌ Incorrect — Inconsistent Key Structure

```typescript
{
  'accountLabel': 'Account',  // ❌ Wrong format
  'account_name': 'Account Name',  // ❌ Wrong separator
}
```

### ✅ Correct — Consistent Dotted Keys

```typescript
{
  'account.label': 'Account',  // ✅ Correct format
  'account.fields.name': 'Account Name',  // ✅ Correct format
}
```

## Best Practices

1. **Use dotted notation** — `object.fields.field_name`
2. **Group by namespace** — Organize by domain/module
3. **Provide context** — Use descriptive keys
4. **Check coverage** — Use coverage detection tools
5. **Test all locales** — Validate translations display correctly

---

See parent skill for complete documentation: [../SKILL.md](../SKILL.md)
